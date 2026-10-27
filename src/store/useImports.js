/**
 * src/store/useImports.js
 *
 * Store de Zustand para la gestión de importaciones bancarias desde CSV:
 *   - Perfiles de mapeo guardados por cuenta (importProfiles).
 *   - Reglas automáticas de categorización por palabra clave (categoryRules).
 *   - Historial de lotes importados con capacidad de reversión atómica (importBatches).
 *
 * Reglas:
 *   - Todos los montos se operan en CENTAVOS ENTEROS.
 *   - Las operaciones de base de datos están envueltas en try/catch.
 *   - Reversión atómica de movimientos y saldos en una sola transacción Dexie.
 */

import { create } from 'zustand'
import { db } from '../db/database.js'
import { useMovements } from './useMovements.js'
import { useAccounts } from './useAccounts.js'

export const useImports = create((set, get) => ({
  batches: [],
  profiles: [],
  categoryRules: [],
  loading: false,
  error: null,

  /**
   * Carga el historial de lotes importados.
   */
  fetchBatches: async () => {
    set({ loading: true, error: null })
    try {
      const items = await db.importBatches.toArray()
      items.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
      set({ batches: items, loading: false })
    } catch (err) {
      console.error('[useImports] Error al cargar lotes:', err)
      set({ error: 'No se pudo cargar el historial de importaciones.', loading: false })
    }
  },

  /**
   * Carga todas las reglas de categorización.
   */
  fetchCategoryRules: async () => {
    try {
      const items = await db.categoryRules.toArray()
      items.sort((a, b) => (b.hitCount ?? 0) - (a.hitCount ?? 0))
      set({ categoryRules: items })
      return items
    } catch (err) {
      console.error('[useImports] Error al cargar reglas de categoría:', err)
      return []
    }
  },

  /**
   * Guarda o actualiza una regla de categorización por palabra clave.
   * Si ya existe la palabra clave, actualiza la categoría e incrementa su hitCount.
   */
  saveCategoryRule: async (keyword, categoryId) => {
    if (!keyword || !categoryId) return
    const cleanKw = keyword.trim().toLowerCase()
    if (!cleanKw) return

    try {
      const existing = await db.categoryRules.where('keyword').equals(cleanKw).first()
      if (existing) {
        await db.categoryRules.update(existing.id, {
          categoryId,
          hitCount: (existing.hitCount || 0) + 1,
        })
      } else {
        await db.categoryRules.add({
          id: crypto.randomUUID(),
          keyword: cleanKw,
          categoryId,
          hitCount: 1,
          createdAt: new Date().toISOString(),
        })
      }
      await get().fetchCategoryRules()
    } catch (err) {
      console.error('[useImports] Error al guardar regla de categoría:', err)
    }
  },

  /**
   * Carga el perfil de mapeo guardado para una cuenta específica.
   */
  getProfileForAccount: async (accountId) => {
    if (!accountId) return null
    try {
      const profile = await db.importProfiles.where('accountId').equals(accountId).first()
      return profile || null
    } catch (err) {
      console.error('[useImports] Error al obtener perfil de cuenta:', err)
      return null
    }
  },

  /**
   * Guarda o actualiza el perfil de mapeo para una cuenta.
   */
  saveProfileForAccount: async (accountId, profileData) => {
    if (!accountId) return
    try {
      const existing = await db.importProfiles.where('accountId').equals(accountId).first()
      const payload = {
        accountId,
        name: profileData.name || 'Mapeo predeterminado',
        delimiter: profileData.delimiter || ',',
        skipRows: Number(profileData.skipRows) || 0,
        dateColumn: profileData.dateColumn ?? 0,
        dateFormat: profileData.dateFormat || 'auto',
        descColumn: profileData.descColumn ?? 1,
        amountMode: profileData.amountMode || 'single', // 'single' | 'twoColumns'
        amountColumn: profileData.amountColumn ?? 2,
        chargeColumn: profileData.chargeColumn ?? 2,
        creditColumn: profileData.creditColumn ?? 3,
        decimalSep: profileData.decimalSep || '.',
        thousandSep: profileData.thousandSep || ',',
        invertSign: Boolean(profileData.invertSign),
        updatedAt: new Date().toISOString(),
      }

      if (existing) {
        await db.importProfiles.update(existing.id, payload)
      } else {
        await db.importProfiles.add({
          id: crypto.randomUUID(),
          ...payload,
        })
      }
    } catch (err) {
      console.error('[useImports] Error al guardar perfil de mapeo:', err)
    }
  },

  /**
   * Ejecuta la importación en bloque de las filas seleccionadas.
   * Realiza en una sola transacción:
   *   1. Inserción de movimientos con importBatchId.
   *   2. Actualización de saldo de la cuenta.
   *   3. Ajuste de conciliación si el usuario lo solicitó.
   *   4. Guardado de reglas de categoría seleccionadas.
   *   5. Creación del registro en importBatches.
   */
  executeImport: async ({
    accountId,
    fileName,
    rows, // Filas { selected, date, amount, type, categoryId, note, rememberRule, keyword }
    reconciliationEndingBalance = null, // Saldo final del estado de cuenta opcional
  }) => {
    set({ loading: true, error: null })
    try {
      const targetAccount = await db.accounts.get(accountId)
      if (!targetAccount) {
        throw new Error('La cuenta seleccionada no existe.')
      }

      const selectedRows = rows.filter((r) => r.selected && r.amount > 0 && r.type !== 'zero')
      if (selectedRows.length === 0) {
        throw new Error('No hay movimientos seleccionados para importar.')
      }

      const batchId = crypto.randomUUID()
      const nowIso = new Date().toISOString()

      let totalExpenseCents = 0
      let totalIncomeCents = 0

      // Calcular montos y preparar movimientos
      const newMovements = selectedRows.map((r) => {
        if (r.type === 'expense') totalExpenseCents += r.amount
        else if (r.type === 'income') totalIncomeCents += r.amount

        return {
          id: crypto.randomUUID(),
          type: r.type,
          amount: Math.round(Number(r.amount)),
          currency: targetAccount.currency || 'MXN',
          fxRate: 1,
          accountId,
          toAccountId: null,
          categoryId: r.categoryId || null,
          date: r.date,
          note: (r.note || '').trim(),
          msi: null,
          fixedId: null,
          importBatchId: batchId,
          createdAt: nowIso,
        }
      })

      // Cálculo de impacto neto en el saldo
      // Débito/Efectivo/Ahorro: balance = balance + ingresos - gastos
      // Crédito: balance (deuda) = balance + gastos (compras) - ingresos (pagos/abonos)
      const isCredit = targetAccount.type === 'credit'
      let balanceDelta = 0
      if (isCredit) {
        balanceDelta = totalExpenseCents - totalIncomeCents
      } else {
        balanceDelta = totalIncomeCents - totalExpenseCents
      }

      const initialNewBalance = (targetAccount.balance || 0) + balanceDelta

      // Reglas a guardar
      const rulesToSave = selectedRows.filter((r) => r.rememberRule && r.keyword && r.categoryId)

      // Ejecutar todo en transacción atómica de Dexie
      await db.transaction('rw', [db.movements, db.accounts, db.importBatches, db.categoryRules], async () => {
        // 1. Insertar movimientos
        await db.movements.bulkAdd(newMovements)

        // 2. Si se solicitó conciliación con saldo final y hay diferencia:
        let finalAccountBalance = initialNewBalance
        if (reconciliationEndingBalance !== null && !isNaN(Number(reconciliationEndingBalance))) {
          const targetEndingCents = Math.round(Number(reconciliationEndingBalance))
          const diffCents = targetEndingCents - initialNewBalance

          if (diffCents !== 0) {
            // Crear movimiento de ajuste de cuadre
            const adjustmentMovement = {
              id: crypto.randomUUID(),
              type: 'adjustment',
              amount: Math.abs(diffCents),
              deltaCents: diffCents,
              currency: targetAccount.currency || 'MXN',
              fxRate: 1,
              accountId,
              toAccountId: null,
              categoryId: null,
              date: newMovements[0]?.date || nowIso.slice(0, 10),
              note: `Ajuste por conciliación de estado de cuenta (${fileName || 'CSV'})`,
              reason: 'import_reconciliation',
              importBatchId: batchId,
              createdAt: nowIso,
            }
            await db.movements.add(adjustmentMovement)
            finalAccountBalance = targetEndingCents
          }
        }

        // 3. Actualizar saldo y fecha de conciliación de la cuenta
        await db.accounts.update(accountId, {
          balance: finalAccountBalance,
          lastReconciledAt: nowIso.slice(0, 10),
        })

        // 4. Crear registro de lote
        await db.importBatches.add({
          id: batchId,
          accountId,
          date: nowIso.slice(0, 10),
          fileName: fileName || 'movimientos.csv',
          rowCount: newMovements.length,
          totalExpenseCents,
          totalIncomeCents,
          status: 'completed',
          createdAt: nowIso,
        })

        // 5. Guardar/actualizar reglas de categorías
        for (const rule of rulesToSave) {
          const cleanKw = rule.keyword.trim().toLowerCase()
          const existing = await db.categoryRules.where('keyword').equals(cleanKw).first()
          if (existing) {
            await db.categoryRules.update(existing.id, {
              categoryId: rule.categoryId,
              hitCount: (existing.hitCount || 0) + 1,
            })
          } else {
            await db.categoryRules.add({
              id: crypto.randomUUID(),
              keyword: cleanKw,
              categoryId: rule.categoryId,
              hitCount: 1,
              createdAt: nowIso,
            })
          }
        }
      })

      // Actualizar stores locales
      await Promise.all([
        get().fetchBatches(),
        get().fetchCategoryRules(),
        useMovements.getState().fetchMovements(),
        useAccounts.getState().fetchAccounts(),
      ])

      set({ loading: false })
      return { batchId, rowCount: newMovements.length }
    } catch (err) {
      console.error('[useImports] Error al ejecutar importación:', err)
      set({ error: err.message || 'Error al importar los movimientos.', loading: false })
      throw err
    }
  },

  /**
   * Deshace una importación completa por ID de lote.
   * Elimina todos sus movimientos asociados y revierte atómicamente el saldo de la cuenta.
   */
  revertBatch: async (batchId) => {
    set({ loading: true, error: null })
    try {
      const batch = await db.importBatches.get(batchId)
      if (!batch) {
        throw new Error('El lote de importación no existe.')
      }

      const account = await db.accounts.get(batch.accountId)
      if (!account) {
        throw new Error('La cuenta asociada a este lote ya no existe.')
      }

      // Buscar todos los movimientos asociados a este lote
      const movementsInBatch = await db.movements.where('importBatchId').equals(batchId).toArray()

      // Calcular la reversión de saldo
      const isCredit = account.type === 'credit'
      let deltaToRevert = 0

      for (const m of movementsInBatch) {
        if (m.type === 'adjustment') {
          // Revertir delta de ajuste
          const delta = m.deltaCents !== undefined ? m.deltaCents : m.amount
          deltaToRevert -= delta
        } else if (m.type === 'expense') {
          // Si era gasto:
          // en débito redujo el saldo -> revertir suma m.amount
          // en crédito aumentó la deuda -> revertir resta m.amount
          deltaToRevert += isCredit ? -m.amount : m.amount
        } else if (m.type === 'income') {
          // Si era ingreso:
          // en débito aumentó el saldo -> revertir resta m.amount
          // en crédito redujo la deuda -> revertir suma m.amount
          deltaToRevert += isCredit ? m.amount : -m.amount
        }
      }

      const restoredBalance = (account.balance || 0) + deltaToRevert

      // Ejecutar en transacción atómica
      await db.transaction('rw', [db.movements, db.accounts, db.importBatches], async () => {
        // 1. Eliminar movimientos
        const movementIds = movementsInBatch.map((m) => m.id)
        await db.movements.bulkDelete(movementIds)

        // 2. Restaurar saldo de la cuenta
        await db.accounts.update(account.id, {
          balance: restoredBalance,
        })

        // 3. Eliminar lote
        await db.importBatches.delete(batchId)
      })

      // Actualizar stores
      await Promise.all([
        get().fetchBatches(),
        useMovements.getState().fetchMovements(),
        useAccounts.getState().fetchAccounts(),
      ])

      set({ loading: false })
      return true
    } catch (err) {
      console.error('[useImports] Error al deshacer lote:', err)
      set({ error: err.message || 'Error al deshacer la importación.', loading: false })
      throw err
    }
  },
}))

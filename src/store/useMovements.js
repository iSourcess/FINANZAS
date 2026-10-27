/**
 * src/store/useMovements.js
 *
 * Store de Zustand para registrar, editar, listar y eliminar movimientos financieros.
 *
 * Persistencia en Dexie (IndexedDB):
 *   - Toda modificación de movimiento actualiza el balance de la cuenta afectada
 *     de manera atómica dentro de una transacción db.transaction('rw', ...).
 *   - Las transferencias mueven saldo entre cuenta origen y destino sin contar
 *     como ingreso ni gasto.
 *   - Soporte para deshacer el último movimiento eliminado.
 */

import { create } from 'zustand'
import { db } from '../db/database.js'
import { useAccounts } from './useAccounts.js'
import {
  applyMovementToAccount,
  revertMovementFromAccount,
} from '../domain/movements.js'
import { todayLocalISO } from '../lib/format.js'

export const useMovements = create((set, get) => ({
  movements: [],
  categories: [],
  loading: false,
  error: null,
  lastDeleted: null, // Para Toast con Deshacer

  /**
   * Carga categorías y movimientos desde IndexedDB.
   */
  fetchMovements: async () => {
    set({ loading: true, error: null })
    try {
      const [allMovements, allCategories] = await Promise.all([
        db.movements.toArray(),
        db.categories.toArray(),
      ])

      // Ordenar movimientos por fecha descendente, luego createdAt descendente
      allMovements.sort((a, b) => {
        const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime()
        if (dateDiff !== 0) return dateDiff
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      })

      // Ordenar categorías por sortOrder
      allCategories.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

      set({
        movements: allMovements,
        categories: allCategories,
        loading: false,
      })

      // Sincronizar widget nativo de pantalla de inicio
      triggerWidgetSync(allMovements)
    } catch (err) {
      console.error('[useMovements] Error al cargar movimientos:', err)
      set({ error: 'No se pudieron cargar los movimientos.', loading: false })
    }
  },

  /**
   * Registra un nuevo movimiento y actualiza los saldos de cuenta de forma atómica.
   * @param {Object} movementData
   */
  addMovement: async (movementData) => {
    set({ loading: true, error: null })
    try {
      // Obtener tipo de cambio del store useFx si es moneda extranjera (fuente única de verdad)
      let fxRate = 1
      if (movementData.currency && movementData.currency !== 'MXN') {
        try {
          const { useFx } = await import('./useFx.js')
          fxRate = useFx.getState().getRate(movementData.currency)
        } catch {
          const settings = await db.settings.get('global')
          fxRate = settings?.fxRateManual ? (settings.fxRateManual > 100 ? settings.fxRateManual / 100 : settings.fxRateManual) : 20.0
        }
      }

      const isAdjustment = movementData.type === 'adjustment'
      const deltaCents = isAdjustment
        ? Math.round(Number(movementData.deltaCents !== undefined ? movementData.deltaCents : movementData.amount) || 0)
        : null

      const newMovement = {
        id: crypto.randomUUID(),
        type: movementData.type || 'expense', // 'income' | 'expense' | 'transfer' | 'adjustment'
        amount: isAdjustment ? Math.abs(deltaCents) : Math.round(Number(movementData.amount) || 0), // Centavos
        deltaCents: isAdjustment ? deltaCents : null,
        reason: isAdjustment ? (movementData.reason || 'reconcile') : null,
        debtId: movementData.debtId || null,
        currency: movementData.currency || 'MXN',
        fxRate,
        accountId: movementData.accountId,
        toAccountId: movementData.type === 'transfer' ? movementData.toAccountId : null,
        categoryId: (movementData.type === 'transfer' || isAdjustment) ? null : movementData.categoryId,
        date: movementData.date || todayLocalISO(),
        note: (movementData.note || '').trim(),
        msi: movementData.msi || null,
        fixedId: movementData.fixedId || null,
        recurringIncomeId: movementData.recurringIncomeId || null,
        recurringDueDate: movementData.recurringDueDate || null,
        createdAt: new Date().toISOString(),
      }

      // Transacción atómica en Dexie para guardar movimiento y actualizar balance
      await db.transaction('rw', [db.movements, db.accounts], async () => {
        // 1. Guardar movimiento
        await db.movements.add(newMovement)

        // 2. Actualizar cuenta origen
        const sourceAcc = await db.accounts.get(newMovement.accountId)
        if (sourceAcc) {
          const updatedSource = applyMovementToAccount(sourceAcc, newMovement, true)
          const accountUpdates = { balance: updatedSource.balance }
          if (newMovement.type === 'adjustment') {
            accountUpdates.lastReconciledAt = newMovement.date
          }
          await db.accounts.update(sourceAcc.id, accountUpdates)
        }

        // 3. Si es transferencia, actualizar cuenta destino
        if (newMovement.type === 'transfer' && newMovement.toAccountId) {
          const destAcc = await db.accounts.get(newMovement.toAccountId)
          if (destAcc) {
            const updatedDest = applyMovementToAccount(destAcc, newMovement, false)
            await db.accounts.update(destAcc.id, { balance: updatedDest.balance })
          }
        }
      })

      // Actualizar estado local
      set(state => ({
        movements: [newMovement, ...state.movements],
        loading: false,
      }))

      // Sincronizar store de cuentas
      useAccounts.getState().fetchAccounts()

      // Reprogramar recordatorios (cancela el diario de hoy si ya hubo movimiento)
      import('../services/notifications.js').then(({ rescheduleAll }) => {
        rescheduleAll().catch(() => {})
      }).catch(() => {})

      // Sincronizar widget nativo de pantalla de inicio
      triggerWidgetSync([newMovement, ...get().movements])

      return newMovement
    } catch (err) {
      console.error('[useMovements] Error al agregar movimiento:', err)
      set({ error: 'No se pudo guardar el movimiento.', loading: false })
      throw err
    }
  },

  /**
   * Actualiza un movimiento existente y sincroniza los balances.
   * @param {string} id
   * @param {Object} updates
   */
  updateMovement: async (id, updates) => {
    set({ loading: true, error: null })
    try {
      await db.transaction('rw', [db.movements, db.accounts], async () => {
        const oldMovement = await db.movements.get(id)
        if (!oldMovement) throw new Error('Movimiento no encontrado')

        // 1. Revertir balance previo en cuenta(s)
        const oldSource = await db.accounts.get(oldMovement.accountId)
        if (oldSource) {
          const revertedSource = revertMovementFromAccount(oldSource, oldMovement, true)
          await db.accounts.update(oldSource.id, { balance: revertedSource.balance })
        }
        if (oldMovement.type === 'transfer' && oldMovement.toAccountId) {
          const oldDest = await db.accounts.get(oldMovement.toAccountId)
          if (oldDest) {
            const revertedDest = revertMovementFromAccount(oldDest, oldMovement, false)
            await db.accounts.update(oldDest.id, { balance: revertedDest.balance })
          }
        }

        // 2. Preparar nuevo movimiento
        const isAdj = (updates.type ?? oldMovement.type) === 'adjustment'
        const updatedDelta = isAdj
          ? Math.round(Number(updates.deltaCents ?? oldMovement.deltaCents ?? updates.amount ?? oldMovement.amount) || 0)
          : null

        const updatedMovement = {
          ...oldMovement,
          ...updates,
          amount: isAdj ? Math.abs(updatedDelta) : Math.round(Number(updates.amount ?? oldMovement.amount) || 0),
          deltaCents: isAdj ? updatedDelta : null,
          reason: isAdj ? (updates.reason ?? oldMovement.reason ?? 'reconcile') : null,
          debtId: updates.debtId !== undefined ? updates.debtId : (oldMovement.debtId || null),
          note: (updates.note ?? oldMovement.note ?? '').trim(),
        }

        // 3. Guardar en db
        await db.movements.update(id, updatedMovement)

        // 4. Aplicar nuevos balances
        const newSource = await db.accounts.get(updatedMovement.accountId)
        if (newSource) {
          const appliedSource = applyMovementToAccount(newSource, updatedMovement, true)
          const accountUpdates = { balance: appliedSource.balance }
          if (updatedMovement.type === 'adjustment') {
            accountUpdates.lastReconciledAt = updatedMovement.date
          }
          await db.accounts.update(newSource.id, accountUpdates)
        }
        if (updatedMovement.type === 'transfer' && updatedMovement.toAccountId) {
          const newDest = await db.accounts.get(updatedMovement.toAccountId)
          if (newDest) {
            const appliedDest = applyMovementToAccount(newDest, updatedMovement, false)
            await db.accounts.update(newDest.id, { balance: appliedDest.balance })
          }
        }
      })

      // Refrescar lista local y cuentas
      await get().fetchMovements()
      useAccounts.getState().fetchAccounts()
    } catch (err) {
      console.error('[useMovements] Error al actualizar movimiento:', err)
      set({ error: 'No se pudo actualizar el movimiento.', loading: false })
      throw err
    }
  },

  /**
   * Elimina un movimiento y revierte su balance, guardándolo para 'Deshacer'.
   * @param {string} id
   */
  deleteMovement: async (id) => {
    set({ loading: true, error: null })
    try {
      let movementToDelete = null

      await db.transaction('rw', [db.movements, db.accounts], async () => {
        movementToDelete = await db.movements.get(id)
        if (!movementToDelete) return

        // 1. Revertir balance cuenta origen
        const sourceAcc = await db.accounts.get(movementToDelete.accountId)
        if (sourceAcc) {
          const reverted = revertMovementFromAccount(sourceAcc, movementToDelete, true)
          await db.accounts.update(sourceAcc.id, { balance: reverted.balance })
        }

        // 2. Si fue transferencia, revertir cuenta destino
        if (movementToDelete.type === 'transfer' && movementToDelete.toAccountId) {
          const destAcc = await db.accounts.get(movementToDelete.toAccountId)
          if (destAcc) {
            const revertedDest = revertMovementFromAccount(destAcc, movementToDelete, false)
            await db.accounts.update(destAcc.id, { balance: revertedDest.balance })
          }
        }

        // 3. Eliminar
        await db.movements.delete(id)

        // 4. Si fue ajuste, actualizar lastReconciledAt con el ajuste restante más reciente
        if (movementToDelete.type === 'adjustment' && sourceAcc) {
          const remaining = await db.movements
            .where('accountId')
            .equals(sourceAcc.id)
            .filter((m) => m.id !== id && m.type === 'adjustment')
            .sortBy('date')
          const latest = remaining.length > 0 ? remaining[remaining.length - 1].date : null
          await db.accounts.update(sourceAcc.id, { lastReconciledAt: latest })
        }
      })

      set(state => ({
        movements: state.movements.filter(m => m.id !== id),
        lastDeleted: movementToDelete,
        loading: false,
      }))

      // Actualizar cuentas
      useAccounts.getState().fetchAccounts()

      // Sincronizar widget nativo de pantalla de inicio
      triggerWidgetSync(get().movements)
    } catch (err) {
      console.error('[useMovements] Error al eliminar movimiento:', err)
      set({ error: 'No se pudo eliminar el movimiento.', loading: false })
      throw err
    }
  },

  /**
   * Deshace la última eliminación restaurando el movimiento y su balance.
   */
  undoDelete: async () => {
    const deleted = get().lastDeleted
    if (!deleted) return

    set({ loading: true, error: null })
    try {
      await db.transaction('rw', [db.movements, db.accounts], async () => {
        // Restaurar movimiento
        await db.movements.add(deleted)

        // Restaurar balance origen
        const sourceAcc = await db.accounts.get(deleted.accountId)
        if (sourceAcc) {
          const applied = applyMovementToAccount(sourceAcc, deleted, true)
          const accUpdates = { balance: applied.balance }
          if (deleted.type === 'adjustment') {
            accUpdates.lastReconciledAt = deleted.date
          }
          await db.accounts.update(sourceAcc.id, accUpdates)
        }

        // Restaurar balance destino si fue transferencia
        if (deleted.type === 'transfer' && deleted.toAccountId) {
          const destAcc = await db.accounts.get(deleted.toAccountId)
          if (destAcc) {
            const appliedDest = applyMovementToAccount(destAcc, deleted, false)
            await db.accounts.update(destAcc.id, { balance: appliedDest.balance })
          }
        }
      })

      const updatedMovements = [deleted, ...get().movements]
      set({
        movements: updatedMovements,
        lastDeleted: null,
        loading: false,
      })

      useAccounts.getState().fetchAccounts()

      // Sincronizar widget nativo de pantalla de inicio
      triggerWidgetSync(updatedMovements)
    } catch (err) {
      console.error('[useMovements] Error al deshacer eliminación:', err)
      set({ error: 'No se pudo restaurar el movimiento.', loading: false })
    }
  },

  /**
   * Limpia el estado de último eliminado (cierre del Toast).
   */
  clearLastDeleted: () => {
    set({ lastDeleted: null })
  },
}))

/**
 * Notifica en segundo plano al servicio de sincronización del widget nativo.
 */
function triggerWidgetSync(movements) {
  if (!Array.isArray(movements)) return
  import('./useSettings.js').then(({ useSettings }) => {
    const settings = useSettings.getState().settings
    import('../services/widget.js').then(({ syncWidgetSnapshot }) => {
      syncWidgetSnapshot({ movements, settings }).catch(() => {})
    }).catch(() => {})
  }).catch(() => {})
}

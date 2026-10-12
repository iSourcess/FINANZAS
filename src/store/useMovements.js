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
      // Obtener tipo de cambio de settings si es USD
      let fxRate = 1
      if (movementData.currency === 'USD') {
        const settings = await db.settings.get('global')
        fxRate = settings?.fxRateManual ? (settings.fxRateManual > 100 ? settings.fxRateManual / 100 : settings.fxRateManual) : 20.0
      }

      const newMovement = {
        id: crypto.randomUUID(),
        type: movementData.type || 'expense', // 'income' | 'expense' | 'transfer'
        amount: Math.round(Number(movementData.amount) || 0), // Centavos
        currency: movementData.currency || 'MXN',
        fxRate,
        accountId: movementData.accountId,
        toAccountId: movementData.type === 'transfer' ? movementData.toAccountId : null,
        categoryId: movementData.type === 'transfer' ? null : movementData.categoryId,
        date: movementData.date || new Date().toISOString().slice(0, 10),
        note: (movementData.note || '').trim(),
        msi: null,
        fixedId: null,
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
          await db.accounts.update(sourceAcc.id, { balance: updatedSource.balance })
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
        const updatedMovement = {
          ...oldMovement,
          ...updates,
          amount: Math.round(Number(updates.amount ?? oldMovement.amount) || 0),
          note: (updates.note ?? oldMovement.note ?? '').trim(),
        }

        // 3. Guardar en db
        await db.movements.update(id, updatedMovement)

        // 4. Aplicar nuevos balances
        const newSource = await db.accounts.get(updatedMovement.accountId)
        if (newSource) {
          const appliedSource = applyMovementToAccount(newSource, updatedMovement, true)
          await db.accounts.update(newSource.id, { balance: appliedSource.balance })
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
      })

      set(state => ({
        movements: state.movements.filter(m => m.id !== id),
        lastDeleted: movementToDelete,
        loading: false,
      }))

      // Actualizar cuentas
      useAccounts.getState().fetchAccounts()
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
          await db.accounts.update(sourceAcc.id, { balance: applied.balance })
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

      set(state => ({
        movements: [deleted, ...state.movements],
        lastDeleted: null,
        loading: false,
      }))

      useAccounts.getState().fetchAccounts()
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

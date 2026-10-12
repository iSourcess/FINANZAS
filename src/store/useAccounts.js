/**
 * src/store/useAccounts.js
 *
 * Store de Zustand para la gestión de cuentas y tarjetas con persistencia en Dexie (IndexedDB).
 *
 * Reglas:
 *   - Todos los montos monetarios se manejan en CENTAVOS ENTEROS.
 *   - Toda interacción con Dexie está envuelta en try/catch.
 *   - No calcula rendimientos ni MSI aquí (reservado para domain/ en fases posteriores).
 */

import { create } from 'zustand'
import { db } from '../db/database.js'
import { runSeed } from '../db/seed.js'

export const useAccounts = create((set, get) => ({
  accounts: [],
  loading: false,
  error: null,
  selectedAccountId: null,

  /**
   * Carga todas las cuentas desde IndexedDB.
   * Si la base está vacía, dispara el seed inicial primero.
   */
  fetchAccounts: async () => {
    set({ loading: true, error: null })
    try {
      let items = await db.accounts.toArray()

      // Si no hay cuentas, correr el seed y recargar
      if (items.length === 0) {
        await runSeed()
        items = await db.accounts.toArray()
      }

      // Ordenar por sortOrder ascendente
      items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

      set({ accounts: items, loading: false })
    } catch (err) {
      console.error('[useAccounts] Error al cargar cuentas:', err)
      set({ error: 'No se pudieron cargar las cuentas de la base de datos.', loading: false })
    }
  },

  /**
   * Agrega una nueva cuenta a Dexie y al estado local.
   * @param {Object} accountData
   */
  addAccount: async (accountData) => {
    set({ loading: true, error: null })
    try {
      const current = get().accounts
      const maxOrder = current.reduce((max, acc) => Math.max(max, acc.sortOrder ?? 0), 0)

      const newAccount = {
        id: crypto.randomUUID(),
        name: accountData.name.trim(),
        type: accountData.type || 'debit',
        currency: accountData.currency || 'MXN',
        balance: Math.round(Number(accountData.balance) || 0),
        themeKey: accountData.themeKey || 'nu',
        color: accountData.color || null,
        last4: accountData.last4 ? String(accountData.last4).slice(-4) : null,
        hidden: Boolean(accountData.hidden),
        sortOrder: maxOrder + 1,
        yieldTiers: accountData.yieldTiers || null,
        yieldCapBase: accountData.yieldCapBase || null,
        parentId: accountData.parentId || null,
        credit: accountData.type === 'credit' ? {
          limit: Math.round(Number(accountData.credit?.limit) || 0),
          cutDay: Number(accountData.credit?.cutDay) || 1,
          payDay: Number(accountData.credit?.payDay) || 20,
        } : null,
        createdAt: new Date().toISOString(),
      }

      await db.accounts.add(newAccount)

      set(state => ({
        accounts: [...state.accounts, newAccount].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
        loading: false,
      }))

      return newAccount
    } catch (err) {
      console.error('[useAccounts] Error al crear cuenta:', err)
      set({ error: 'No se pudo guardar la cuenta.', loading: false })
      throw err
    }
  },

  /**
   * Actualiza una cuenta existente por ID.
   * @param {string} id
   * @param {Object} updates
   */
  updateAccount: async (id, updates) => {
    set({ loading: true, error: null })
    try {
      const sanitizedUpdates = { ...updates }

      if ('balance' in sanitizedUpdates) {
        sanitizedUpdates.balance = Math.round(Number(sanitizedUpdates.balance) || 0)
      }
      if ('name' in sanitizedUpdates && typeof sanitizedUpdates.name === 'string') {
        sanitizedUpdates.name = sanitizedUpdates.name.trim()
      }
      if ('last4' in sanitizedUpdates && sanitizedUpdates.last4) {
        sanitizedUpdates.last4 = String(sanitizedUpdates.last4).slice(-4)
      }
      if ('credit' in sanitizedUpdates && sanitizedUpdates.credit) {
        sanitizedUpdates.credit = {
          limit: Math.round(Number(sanitizedUpdates.credit.limit) || 0),
          cutDay: Number(sanitizedUpdates.credit.cutDay) || 1,
          payDay: Number(sanitizedUpdates.credit.payDay) || 20,
        }
      }

      await db.accounts.update(id, sanitizedUpdates)

      set(state => ({
        accounts: state.accounts.map(acc => (acc.id === id ? { ...acc, ...sanitizedUpdates } : acc)),
        loading: false,
      }))
    } catch (err) {
      console.error('[useAccounts] Error al actualizar cuenta:', err)
      set({ error: 'No se pudo actualizar la cuenta.', loading: false })
      throw err
    }
  },

  /**
   * Elimina una cuenta por ID.
   * @param {string} id
   */
  deleteAccount: async (id) => {
    set({ loading: true, error: null })
    try {
      await db.accounts.delete(id)
      set(state => ({
        accounts: state.accounts.filter(acc => acc.id !== id),
        selectedAccountId: state.selectedAccountId === id ? null : state.selectedAccountId,
        loading: false,
      }))
    } catch (err) {
      console.error('[useAccounts] Error al eliminar cuenta:', err)
      set({ error: 'No se pudo eliminar la cuenta.', loading: false })
      throw err
    }
  },

  /**
   * Reordena las cuentas y persiste el orden en Dexie.
   * @param {Array<string>} orderedIds - Array de IDs en nuevo orden
   */
  reorderAccounts: async (orderedIds) => {
    try {
      await db.transaction('rw', db.accounts, async () => {
        for (let i = 0; i < orderedIds.length; i++) {
          await db.accounts.update(orderedIds[i], { sortOrder: i + 1 })
        }
      })

      set(state => {
        const idMap = new Map(state.accounts.map(a => [a.id, a]))
        const reordered = orderedIds
          .map((id, idx) => {
            const acc = idMap.get(id)
            return acc ? { ...acc, sortOrder: idx + 1 } : null
          })
          .filter(Boolean)
        return { accounts: reordered }
      })
    } catch (err) {
      console.error('[useAccounts] Error al reordenar cuentas:', err)
    }
  },

  /**
   * Selecciona una cuenta para ver detalle.
   * @param {string|null} id
   */
  selectAccount: (id) => {
    set({ selectedAccountId: id })
  },
}))

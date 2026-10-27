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
import { reorderAccounts as domainReorder } from '../domain/accountOrder.js'

export const useAccounts = create((set, get) => ({
  accounts: [],
  loading: false,
  error: null,
  selectedAccountId: null,
  _prevAccounts: null, // snapshot para deshacer el último reordenamiento

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
      } else {
        // Sincronización / migración de tasas y cajitas
        let needsReload = false

        for (const item of items) {
          // Nu: Si tiene Cajita Turbo con el segundo tramo viejo del 7%, actualizar a solo 13%
          if (
            item.themeKey === 'nu' &&
            (item.yieldCapBase === 'principal' || item.isTurbo || item.name.toLowerCase().includes('turbo'))
          ) {
            if (Array.isArray(item.yieldTiers) && item.yieldTiers.length > 1) {
              item.yieldTiers = [{ upTo: 2_500_000, rate: 0.13 }]
              await db.accounts.update(item.id, { yieldTiers: item.yieldTiers })
              needsReload = true
            }
            if (item.name === 'Nu Débito') {
              item.name = 'Cajita Turbo'
              item.type = 'savings'
              await db.accounts.update(item.id, { name: 'Cajita Turbo', type: 'savings' })
              needsReload = true
            }
          }

          // Mercado Pago: actualizar a 15% hasta $25k y 5.3% excedente si tenía tasas anteriores
          if (item.themeKey === 'mercadoPago') {
            const tiers = item.yieldTiers
            if (
              Array.isArray(tiers) &&
              (tiers[0]?.rate !== 0.15 || tiers[1]?.rate !== 0.053)
            ) {
              item.yieldTiers = [
                { upTo: 2_500_000, rate: 0.15 },
                { upTo: null, rate: 0.053 },
              ]
              await db.accounts.update(item.id, { yieldTiers: item.yieldTiers })
              needsReload = true
            }
          }
        }

        // Si existe Nu pero no existe 'Cajita Ahorro', agregarla automáticamente
        const hasNu = items.some((a) => a.themeKey === 'nu')
        const hasAhorro = items.some(
          (a) =>
            a.name.toLowerCase().includes('cajita ahorro') ||
            a.name.toLowerCase() === 'ahorro nu'
        )
        if (hasNu && !hasAhorro) {
          const maxOrder = items.reduce((max, acc) => Math.max(max, acc.sortOrder ?? 0), 0)
          const cajitaAhorro = {
            id: crypto.randomUUID(),
            name: 'Cajita Ahorro',
            type: 'savings',
            currency: 'MXN',
            balance: 0,
            themeKey: 'nu',
            color: null,
            hidden: false,
            sortOrder: maxOrder + 1,
            yieldTiers: [{ upTo: null, rate: 0.07 }],
            yieldCapBase: 'balance',
            parentId: null,
            credit: null,
            createdAt: new Date().toISOString(),
          }
          await db.accounts.add(cajitaAhorro)
          items.push(cajitaAhorro)
          needsReload = true
        }

        if (needsReload) {
          items = await db.accounts.toArray()
        }
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
   * Reordena las cuentas a partir de un movimiento drag-and-drop.
   * Usa la función pura domainReorder para calcular el nuevo orden y persiste
   * todos los sortOrder en una sola transacción de Dexie.
   *
   * @param {string}   activeId    - ID de la cuenta arrastrada.
   * @param {string}   overId      - ID de la cuenta sobre la que se soltó.
   * @param {string[]|null} [visibleIds=null] - IDs visibles si hay filtro activo.
   * @returns {Promise<boolean>} true si se guardó correctamente.
   */
  reorderAccounts: async (activeId, overId, visibleIds = null) => {
    const { accounts } = get()
    // Guardar snapshot previo para poder deshacer
    const prevAccounts = accounts.map(a => ({ ...a }))

    // Calcular nuevo orden (puro, sin efectos secundarios)
    const reordered = domainReorder(accounts, activeId, overId, visibleIds)
    if (!reordered) return false

    // Optimistic update: actualizar UI de inmediato
    set({ accounts: reordered })

    // Persistir en una sola transacción
    try {
      await db.transaction('rw', db.accounts, async () => {
        for (const acc of reordered) {
          await db.accounts.update(acc.id, { sortOrder: acc.sortOrder })
        }
      })
      // Guardar snapshot para undo
      set({ _prevAccounts: prevAccounts })
      return true
    } catch (err) {
      console.error('[useAccounts] Error al guardar orden:', err)
      // Revertir optimistic update
      set({ accounts: prevAccounts })
      return false
    }
  },

  /**
   * Deshace el último reordenamiento.
   * Restaura el orden previo y lo persiste en Dexie.
   */
  undoReorder: async () => {
    const { _prevAccounts } = get()
    if (!_prevAccounts) return

    set({ accounts: _prevAccounts, _prevAccounts: null })
    try {
      await db.transaction('rw', db.accounts, async () => {
        for (const acc of _prevAccounts) {
          await db.accounts.update(acc.id, { sortOrder: acc.sortOrder })
        }
      })
    } catch (err) {
      console.error('[useAccounts] Error al deshacer orden:', err)
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

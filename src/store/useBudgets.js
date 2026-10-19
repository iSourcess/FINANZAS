/**
 * src/store/useBudgets.js
 *
 * Store de Zustand para la gestión de presupuestos por categoría y gastos fijos recurrentes.
 *
 * Persistencia en Dexie (IndexedDB):
 *   - budgets: presupuestos mensuales por categoría (montos en centavos).
 *   - fixedExpenses: gastos fijos mensuales (Netflix, internet, renta, etc.).
 *   - Identificación automática de gastos fijos pendientes del mes sin duplicados.
 */

import { create } from 'zustand'
import { db } from '../db/database.js'
import { useMovements } from './useMovements.js'
import {
  getPendingRecurringExpenses,
  createMovementFromFixedExpense,
} from '../domain/recurring.js'

export const useBudgets = create((set, get) => ({
  budgets: [],
  fixedExpenses: [],
  pendingRecurring: [],
  loading: false,
  error: null,

  /**
   * Carga presupuestos y gastos fijos desde Dexie y calcula los pendientes del mes.
   */
  fetchBudgets: async () => {
    set({ loading: true, error: null })
    try {
      const [allBudgets, allFixed, allMovements] = await Promise.all([
        db.budgets.toArray(),
        db.fixedExpenses.toArray(),
        db.movements.toArray(),
      ])

      const pending = getPendingRecurringExpenses({
        fixedExpenses: allFixed,
        movements: allMovements,
        referenceDate: new Date(),
      })

      set({
        budgets: allBudgets,
        fixedExpenses: allFixed,
        pendingRecurring: pending,
        loading: false,
      })
    } catch (err) {
      console.error('[useBudgets] Error al cargar presupuestos y gastos fijos:', err)
      set({ error: 'No se pudieron cargar los presupuestos.', loading: false })
    }
  },

  /**
   * Establece o actualiza el presupuesto mensual para una categoría.
   * @param {string} categoryId
   * @param {number} monthlyLimitCents
   */
  setBudget: async (categoryId, monthlyLimitCents) => {
    set({ loading: true, error: null })
    try {
      const existing = await db.budgets.where('categoryId').equals(categoryId).first()
      const limit = Math.max(0, Math.round(Number(monthlyLimitCents) || 0))

      if (existing) {
        await db.budgets.update(existing.id, { monthlyLimit: limit })
      } else {
        await db.budgets.add({
          id: crypto.randomUUID(),
          categoryId,
          monthlyLimit: limit,
        })
      }

      const updated = await db.budgets.toArray()
      set({ budgets: updated, loading: false })
    } catch (err) {
      console.error('[useBudgets] Error al guardar presupuesto:', err)
      set({ error: 'No se pudo guardar el presupuesto.', loading: false })
      throw err
    }
  },

  /**
   * Elimina un presupuesto por ID.
   * @param {string} id
   */
  deleteBudget: async (id) => {
    try {
      await db.budgets.delete(id)
      set(state => ({
        budgets: state.budgets.filter(b => b.id !== id),
      }))
    } catch (err) {
      console.error('[useBudgets] Error al eliminar presupuesto:', err)
    }
  },

  /**
   * Agrega un nuevo gasto fijo mensual.
   * @param {Object} fixedData
   */
  addFixedExpense: async (fixedData) => {
    set({ loading: true, error: null })
    try {
      const newFixed = {
        id: crypto.randomUUID(),
        name: fixedData.name.trim(),
        amount: Math.round(Number(fixedData.amount) || 0),
        currency: fixedData.currency || 'MXN',
        categoryId: fixedData.categoryId,
        accountId: fixedData.accountId,
        dayOfMonth: Math.min(31, Math.max(1, parseInt(fixedData.dayOfMonth, 10) || 1)),
        active: fixedData.active !== false,
        createdAt: new Date().toISOString(),
      }

      await db.fixedExpenses.add(newFixed)
      await get().fetchBudgets()
      return newFixed
    } catch (err) {
      console.error('[useBudgets] Error al agregar gasto fijo:', err)
      set({ error: 'No se pudo guardar el gasto fijo.', loading: false })
      throw err
    }
  },

  /**
   * Actualiza un gasto fijo por ID.
   * @param {string} id
   * @param {Object} updates
   */
  updateFixedExpense: async (id, updates) => {
    try {
      const sanitized = { ...updates }
      if ('amount' in sanitized) sanitized.amount = Math.round(Number(sanitized.amount) || 0)
      if ('dayOfMonth' in sanitized) sanitized.dayOfMonth = Math.min(31, Math.max(1, parseInt(sanitized.dayOfMonth, 10) || 1))
      if ('name' in sanitized && typeof sanitized.name === 'string') sanitized.name = sanitized.name.trim()

      await db.fixedExpenses.update(id, sanitized)
      await get().fetchBudgets()
    } catch (err) {
      console.error('[useBudgets] Error al actualizar gasto fijo:', err)
    }
  },

  /**
   * Elimina un gasto fijo por ID.
   * @param {string} id
   */
  deleteFixedExpense: async (id) => {
    try {
      await db.fixedExpenses.delete(id)
      await get().fetchBudgets()
    } catch (err) {
      console.error('[useBudgets] Error al eliminar gasto fijo:', err)
    }
  },

  /**
   * Alterna el estado activo de un gasto fijo.
   * @param {string} id
   * @param {boolean} active
   */
  toggleFixedExpense: async (id, active) => {
    try {
      await db.fixedExpenses.update(id, { active })
      await get().fetchBudgets()
    } catch (err) {
      console.error('[useBudgets] Error al alternar gasto fijo:', err)
    }
  },

  /**
   * Confirma y registra el pago de un gasto fijo pendiente en un solo toque.
   * @param {Object} pendingItem - Elemento de pendingRecurring
   * @param {string} [customAccountId] - Cuenta opcional con la que se paga
   */
  confirmRecurringExpense: async (pendingItem, customAccountId = null) => {
    try {
      const movementPayload = createMovementFromFixedExpense(
        pendingItem.fixedExpense,
        pendingItem.dueDate,
        customAccountId
      )

      // Registrar movimiento oficial (actualiza saldos automáticamente)
      await useMovements.getState().addMovement(movementPayload)

      // Actualizar lista de pendientes
      await get().fetchBudgets()
    } catch (err) {
      console.error('[useBudgets] Error al confirmar gasto fijo:', err)
      throw err
    }
  },
}))

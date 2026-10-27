/**
 * src/store/useGoals.js
 *
 * Store de Zustand para la gestión de metas de ahorro y aportes vinculados a cuentas.
 *
 * Persistencia en Dexie (IndexedDB):
 *   - goals: metas de ahorro (nombre, monto objetivo, fecha opcional).
 *   - goalContributions: aportes vinculados a una cuenta bancaria/efectivo.
 *
 * Reglas de AGENTS.md:
 *   - Todos los montos se manejan en CENTAVOS ENTEROS.
 *   - Toda interacción con Dexie está envuelta en try/catch.
 *   - Lógica de cálculo en domain/goals.js.
 */

import { create } from 'zustand'
import { db } from '../db/database.js'
import { validateGoal, validateContribution } from '../domain/goals.js'
import { todayLocalISO } from '../lib/format.js'

export const useGoals = create((set, get) => ({
  goals: [],
  contributions: [],
  loading: false,
  error: null,

  /**
   * Carga metas y aportes desde IndexedDB.
   */
  fetchGoals: async () => {
    set({ loading: true, error: null })
    try {
      if (!db.goals || !db.goalContributions) {
        set({ goals: [], contributions: [], loading: false })
        return
      }

      const [allGoals, allContributions] = await Promise.all([
        db.goals.toArray(),
        db.goalContributions.toArray(),
      ])

      // Ordenar metas por fecha de creación o estado (activas primero)
      allGoals.sort((a, b) => {
        if ((a.status === 'completed') !== (b.status === 'completed')) {
          return a.status === 'completed' ? 1 : -1
        }
        return (b.createdAt || '').localeCompare(a.createdAt || '')
      })

      // Ordenar aportes de más recientes a más antiguos
      allContributions.sort((a, b) => {
        const dateDiff = (b.date || '').localeCompare(a.date || '')
        if (dateDiff !== 0) return dateDiff
        return (b.createdAt || '').localeCompare(a.createdAt || '')
      })

      set({ goals: allGoals, contributions: allContributions, loading: false })
    } catch (err) {
      console.error('[useGoals] Error al cargar metas de ahorro:', err)
      set({ error: 'No se pudieron cargar las metas de ahorro.', loading: false })
    }
  },

  /**
   * Crea una nueva meta de ahorro.
   * @param {Object} goalData - { name, targetAmount, targetDate }
   */
  addGoal: async (goalData) => {
    set({ loading: true, error: null })
    try {
      const validation = validateGoal(goalData)
      if (!validation.isValid) {
        throw new Error(validation.error || 'Datos de la meta inválidos.')
      }

      const newGoal = {
        id: crypto.randomUUID(),
        name: goalData.name.trim(),
        targetAmount: Math.round(Number(goalData.targetAmount) || 0), // Centavos
        targetDate: goalData.targetDate ? String(goalData.targetDate).trim() : null,
        status: 'active',
        createdAt: new Date().toISOString(),
      }

      await db.goals.add(newGoal)

      set(state => ({
        goals: [newGoal, ...state.goals],
        loading: false,
      }))

      return newGoal
    } catch (err) {
      console.error('[useGoals] Error al crear meta:', err)
      set({ error: err.message || 'No se pudo guardar la meta.', loading: false })
      throw err
    }
  },

  /**
   * Actualiza una meta de ahorro existente.
   * @param {string} id
   * @param {Object} updates
   */
  updateGoal: async (id, updates) => {
    set({ loading: true, error: null })
    try {
      const current = get().goals.find(g => g.id === id)
      if (!current) throw new Error('Meta no encontrada.')

      const merged = { ...current, ...updates }
      const validation = validateGoal(merged)
      if (!validation.isValid) {
        throw new Error(validation.error || 'Datos actualizados inválidos.')
      }

      const cleanUpdates = {
        name: merged.name.trim(),
        targetAmount: Math.round(Number(merged.targetAmount) || 0),
        targetDate: merged.targetDate ? String(merged.targetDate).trim() : null,
        status: merged.status || 'active',
      }

      await db.goals.update(id, cleanUpdates)

      set(state => ({
        goals: state.goals.map(g => (g.id === id ? { ...g, ...cleanUpdates } : g)),
        loading: false,
      }))
    } catch (err) {
      console.error('[useGoals] Error al actualizar meta:', err)
      set({ error: err.message || 'No se pudo actualizar la meta.', loading: false })
      throw err
    }
  },

  /**
   * Elimina una meta y todos sus aportes asociados en cascada.
   * @param {string} id
   */
  deleteGoal: async (id) => {
    set({ loading: true, error: null })
    try {
      await db.transaction('rw', [db.goals, db.goalContributions], async () => {
        await db.goals.delete(id)
        const toDelete = await db.goalContributions.where('goalId').equals(id).primaryKeys()
        await db.goalContributions.bulkDelete(toDelete)
      })

      set(state => ({
        goals: state.goals.filter(g => g.id !== id),
        contributions: state.contributions.filter(c => c.goalId !== id),
        loading: false,
      }))
    } catch (err) {
      console.error('[useGoals] Error al eliminar meta:', err)
      set({ error: 'No se pudo eliminar la meta.', loading: false })
      throw err
    }
  },

  /**
   * Registra un aporte a una meta vinculado a una cuenta bancaria/efectivo.
   * @param {Object} contributionData - { goalId, accountId, amount, date, note }
   */
  addContribution: async (contributionData) => {
    set({ loading: true, error: null })
    try {
      const payload = {
        goalId: contributionData.goalId,
        accountId: contributionData.accountId,
        amount: Math.round(Number(contributionData.amount) || 0),
        date: contributionData.date || todayLocalISO(),
        note: (contributionData.note || '').trim(),
      }

      const validation = validateContribution(payload)
      if (!validation.isValid) {
        throw new Error(validation.error || 'Datos de aporte inválidos.')
      }

      const newContribution = {
        id: crypto.randomUUID(),
        ...payload,
        createdAt: new Date().toISOString(),
      }

      await db.goalContributions.add(newContribution)

      set(state => ({
        contributions: [newContribution, ...state.contributions],
        loading: false,
      }))

      return newContribution
    } catch (err) {
      console.error('[useGoals] Error al registrar aporte:', err)
      set({ error: err.message || 'No se pudo registrar el aporte.', loading: false })
      throw err
    }
  },

  /**
   * Elimina un aporte específico por ID.
   * @param {string} id
   */
  deleteContribution: async (id) => {
    set({ loading: true, error: null })
    try {
      await db.goalContributions.delete(id)
      set(state => ({
        contributions: state.contributions.filter(c => c.id !== id),
        loading: false,
      }))
    } catch (err) {
      console.error('[useGoals] Error al eliminar aporte:', err)
      set({ error: 'No se pudo eliminar el aporte.', loading: false })
      throw err
    }
  },
}))

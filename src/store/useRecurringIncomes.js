/**
 * src/store/useRecurringIncomes.js
 *
 * Store de Zustand para la administración y seguimiento de ingresos recurrentes
 * (sueldo, quincena, renta cobrada, etc.) y sus ocurrencias periódicas.
 *
 * Persistencia en Dexie (IndexedDB):
 *   - recurringIncomes: configuración de ingresos y frecuencia
 *   - recurringIncomeOccurrences: ocurrencias pendientes, recibidas u omitidas
 */

import { create } from 'zustand'
import { db } from '../db/database.js'
import { useMovements } from './useMovements.js'
import {
  generatePendingIncomeOccurrences,
  createMovementFromRecurringIncome,
} from '../domain/recurringIncome.js'
import { toISODate } from '../domain/periods.js'

export const useRecurringIncomes = create((set, get) => ({
  recurringIncomes: [],
  occurrences: [],
  pendingOccurrences: [],
  loading: false,
  error: null,

  /**
   * Carga los ingresos recurrentes y sincroniza ocurrencias pendientes en Dexie.
   */
  fetchRecurringIncomes: async () => {
    set({ loading: true, error: null })
    try {
      const [allIncomes, allOccurrences] = await Promise.all([
        db.recurringIncomes.toArray(),
        db.recurringIncomeOccurrences.toArray(),
      ])

      const todayStr = toISODate(new Date())

      // Generar ocurrencias faltantes desde max(startDate, hace 2 meses) hasta hoy
      const newOccurrences = generatePendingIncomeOccurrences({
        recurringIncomes: allIncomes,
        existingOccurrences: allOccurrences,
        todayStr,
        referenceDate: new Date(),
      })

      if (newOccurrences.length > 0) {
        // Asignar IDs y guardar en Dexie
        const toInsert = newOccurrences.map(occ => ({
          id: crypto.randomUUID(),
          ...occ,
          movementId: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))

        await db.recurringIncomeOccurrences.bulkAdd(toInsert)
        allOccurrences.push(...toInsert)
      }

      // Filtrar ocurrencias pendientes ordenadas por fecha de vencimiento ascendente
      const pending = allOccurrences
        .filter(occ => occ.status === 'pending')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

      set({
        recurringIncomes: allIncomes,
        occurrences: allOccurrences,
        pendingOccurrences: pending,
        loading: false,
      })
    } catch (err) {
      console.error('[useRecurringIncomes] Error al sincronizar ingresos recurrentes:', err)
      set({ error: 'No se pudieron cargar los ingresos recurrentes.', loading: false })
    }
  },

  /**
   * Registra una nueva configuración de ingreso recurrente.
   * @param {Object} data
   */
  addRecurringIncome: async (data) => {
    set({ loading: true, error: null })
    try {
      const newIncome = {
        id: crypto.randomUUID(),
        name: (data.name || '').trim(),
        amountCents: Math.round(Number(data.amountCents) || 0),
        currency: data.currency || 'MXN',
        categoryId: data.categoryId || null,
        accountId: data.accountId || null,
        frequency: data.frequency || 'monthly', // 'monthly' | 'biweekly' | 'weekly'
        schedule: data.schedule || { dayOfMonth: 15 },
        startDate: data.startDate || toISODate(new Date()),
        active: data.active !== false,
        createdAt: new Date().toISOString(),
      }

      await db.recurringIncomes.add(newIncome)
      await get().fetchRecurringIncomes()
      return newIncome
    } catch (err) {
      console.error('[useRecurringIncomes] Error al agregar ingreso recurrente:', err)
      set({ error: 'No se pudo guardar el ingreso recurrente.', loading: false })
      throw err
    }
  },

  /**
   * Actualiza un ingreso recurrente por ID.
   * @param {string} id
   * @param {Object} updates
   */
  updateRecurringIncome: async (id, updates) => {
    try {
      const sanitized = { ...updates }
      if ('amountCents' in sanitized) sanitized.amountCents = Math.round(Number(sanitized.amountCents) || 0)
      if ('name' in sanitized && typeof sanitized.name === 'string') sanitized.name = sanitized.name.trim()

      await db.recurringIncomes.update(id, sanitized)
      await get().fetchRecurringIncomes()
    } catch (err) {
      console.error('[useRecurringIncomes] Error al actualizar ingreso recurrente:', err)
      throw err
    }
  },

  /**
   * Elimina un ingreso recurrente y sus ocurrencias asociadas.
   * @param {string} id
   */
  deleteRecurringIncome: async (id) => {
    try {
      await db.transaction('rw', [db.recurringIncomes, db.recurringIncomeOccurrences], async () => {
        await db.recurringIncomes.delete(id)
        await db.recurringIncomeOccurrences.where('recurringId').equals(id).delete()
      })
      await get().fetchRecurringIncomes()
    } catch (err) {
      console.error('[useRecurringIncomes] Error al eliminar ingreso recurrente:', err)
      throw err
    }
  },

  /**
   * Activa o pausa un ingreso recurrente.
   * @param {string} id
   * @param {boolean} active
   */
  toggleRecurringIncome: async (id, active) => {
    try {
      await db.recurringIncomes.update(id, { active })
      await get().fetchRecurringIncomes()
    } catch (err) {
      console.error('[useRecurringIncomes] Error al alternar estado de ingreso recurrente:', err)
      throw err
    }
  },

  /**
   * "Ya me cayó": Confirma la ocurrencia, crea el movimiento de ingreso oficial y marca como recibida.
   *
   * @param {Object} occurrence
   * @param {Object} [options]
   * @param {number} [options.customAmountCents]
   * @param {string} [options.customDate]
   * @param {string} [options.customAccountId]
   */
  confirmReceived: async (occurrence, options = {}) => {
    try {
      const recurringIncome = get().recurringIncomes.find(item => item.id === occurrence.recurringId)
      if (!recurringIncome) {
        throw new Error('Configuración de ingreso recurrente no encontrada.')
      }

      const movementPayload = createMovementFromRecurringIncome({
        recurringIncome,
        occurrence,
        customAmountCents: options.customAmountCents,
        customDate: options.customDate,
        customAccountId: options.customAccountId,
      })

      // Registrar movimiento oficial (actualiza saldos automáticamente)
      const createdMovement = await useMovements.getState().addMovement(movementPayload)

      // Actualizar estado de ocurrencia a 'received'
      await db.recurringIncomeOccurrences.update(occurrence.id, {
        status: 'received',
        movementId: createdMovement?.id || null,
        updatedAt: new Date().toISOString(),
      })

      await get().fetchRecurringIncomes()
    } catch (err) {
      console.error('[useRecurringIncomes] Error al confirmar cobro ("Ya me cayó"):', err)
      throw err
    }
  },

  /**
   * "Ya lo registré": Marca la ocurrencia como recibida sin crear movimiento ni alterar saldos.
   * @param {Object} occurrence
   */
  markReceivedWithoutMovement: async (occurrence) => {
    try {
      await db.recurringIncomeOccurrences.update(occurrence.id, {
        status: 'received',
        movementId: null,
        updatedAt: new Date().toISOString(),
      })

      await get().fetchRecurringIncomes()
    } catch (err) {
      console.error('[useRecurringIncomes] Error al marcar como registrado:', err)
      throw err
    }
  },

  /**
   * "Omitir": Marca la ocurrencia como omitida para descartarla de pendientes.
   * @param {Object} occurrence
   */
  markSkipped: async (occurrence) => {
    try {
      await db.recurringIncomeOccurrences.update(occurrence.id, {
        status: 'skipped',
        updatedAt: new Date().toISOString(),
      })

      await get().fetchRecurringIncomes()
    } catch (err) {
      console.error('[useRecurringIncomes] Error al omitir ocurrencia:', err)
      throw err
    }
  },

  /**
   * Sugerencia de vinculación: Enlaza un ingreso manual existente con la ocurrencia pendiente.
   *
   * @param {Object} occurrence
   * @param {string} movementId
   */
  linkManualMovement: async (occurrence, movementId) => {
    try {
      await db.transaction('rw', [db.movements, db.recurringIncomeOccurrences], async () => {
        // Enlazar movimiento
        await db.movements.update(movementId, {
          recurringIncomeId: occurrence.recurringId,
          recurringDueDate: occurrence.dueDate,
        })

        // Marcar ocurrencia como recibida
        await db.recurringIncomeOccurrences.update(occurrence.id, {
          status: 'received',
          movementId,
          updatedAt: new Date().toISOString(),
        })
      })

      // Recargar movimientos y pendientes
      await useMovements.getState().fetchMovements()
      await get().fetchRecurringIncomes()
    } catch (err) {
      console.error('[useRecurringIncomes] Error al vincular movimiento manual:', err)
      throw err
    }
  },
}))

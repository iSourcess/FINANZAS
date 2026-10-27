/**
 * src/store/useDebts.js
 *
 * Store de Zustand para la administración de deudas y préstamos ("me deben" y "debo").
 *
 * Persistencia en Dexie (IndexedDB):
 *   - debts: registros de deudas y préstamos
 *   - debtPayments: abonos registrados
 *
 * Integración con movimientos:
 *   - Permite crear movimientos de tipo 'adjustment' cuando el usuario decide
 *     afectar el saldo de una cuenta bancaria / efectivo.
 *   - Al eliminar un abono, revierte atómicamente el ajuste de saldo asociado.
 */

import { create } from 'zustand'
import { db } from '../db/database.js'
import { useMovements } from './useMovements.js'
import {
  calculateDebtRemainingCents,
  calculateDebtStatus,
  getAdjustmentDetailsForDebt,
} from '../domain/debts.js'
import { toISODate } from '../domain/periods.js'

export const useDebts = create((set, get) => ({
  debts: [],
  payments: [],
  debtPayments: [],
  loading: false,
  error: null,

  /**
   * Carga todas las deudas y abonos desde Dexie.
   */
  fetchDebts: async () => {
    set({ loading: true, error: null })
    try {
      const [allDebts, allPayments] = await Promise.all([
        db.debts.toArray(),
        db.debtPayments.toArray(),
      ])

      // Ordenar: primero abiertas (por fecha de vencimiento o apertura), luego saldadas
      allDebts.sort((a, b) => {
        const statusDiff = (a.status === 'settled' ? 1 : 0) - (b.status === 'settled' ? 0 : 1)
        if (statusDiff !== 0) return statusDiff

        // Si ambas tienen fecha de vencimiento, la más próxima primero
        if (a.dueDate && b.dueDate) {
          return a.dueDate.localeCompare(b.dueDate)
        }
        return (b.openedAt || '').localeCompare(a.openedAt || '')
      })

      // Ordenar abonos por fecha descendente
      allPayments.sort((a, b) => (b.date || '').localeCompare(a.date || ''))

      set({
        debts: allDebts,
        payments: allPayments,
        debtPayments: allPayments,
        loading: false,
      })
    } catch (err) {
      console.error('[useDebts] Error al cargar deudas y abonos:', err)
      set({ error: 'No se pudieron cargar las deudas y préstamos.', loading: false })
    }
  },

  /**
   * Registra una nueva deuda o préstamo.
   *
   * @param {Object} debtData
   * @param {Object} [options]
   * @param {boolean} [options.affectAccount=false]
   * @param {string} [options.accountId=null]
   */
  addDebt: async (debtData, options = {}) => {
    set({ loading: true, error: null })
    try {
      const newDebtId = crypto.randomUUID()
      const newDebt = {
        id: newDebtId,
        direction: debtData.direction || 'owed_to_me', // 'owed_to_me' | 'i_owe'
        person: (debtData.person || '').trim(),
        principalCents: Math.round(Number(debtData.principalCents) || 0),
        currency: debtData.currency || 'MXN',
        openedAt: debtData.openedAt || toISODate(new Date()),
        dueDate: debtData.dueDate || null,
        note: (debtData.note || '').trim(),
        status: 'open',
        createdAt: new Date().toISOString(),
      }

      // 1. Si el usuario marcó afectar saldo de una cuenta al prestar o pedir prestado
      let initialPaymentId = null
      if (options.affectAccount && options.accountId) {
        const adjustmentPayload = getAdjustmentDetailsForDebt({
          debt: newDebt,
          amountCents: newDebt.principalCents,
          accountId: options.accountId,
          date: newDebt.openedAt,
          isPayment: false,
        })

        await useMovements.getState().addMovement(adjustmentPayload)
      }

      // 2. Guardar deuda en Dexie
      await db.debts.add(newDebt)

      await get().fetchDebts()
      return newDebt
    } catch (err) {
      console.error('[useDebts] Error al agregar deuda:', err)
      set({ error: 'No se pudo registrar la deuda.', loading: false })
      throw err
    }
  },

  /**
   * Actualiza una deuda por ID.
   * @param {string} id
   * @param {Object} updates
   */
  updateDebt: async (id, updates) => {
    try {
      const sanitized = { ...updates }
      if ('person' in sanitized && typeof sanitized.person === 'string') {
        sanitized.person = sanitized.person.trim()
      }
      if ('principalCents' in sanitized) {
        sanitized.principalCents = Math.round(Number(sanitized.principalCents) || 0)
      }

      await db.debts.update(id, sanitized)
      await get().fetchDebts()
    } catch (err) {
      console.error('[useDebts] Error al actualizar deuda:', err)
      throw err
    }
  },

  /**
   * Elimina una deuda y todos sus abonos asociados.
   * Si los abonos tenían ajustes de saldo vinculados, se revierten.
   * @param {string} id
   */
  deleteDebt: async (id) => {
    try {
      const debtPayments = await db.debtPayments.where('debtId').equals(id).toArray()

      // Revertir cualquier movimiento de ajuste creado por los abonos
      for (const p of debtPayments) {
        if (p.adjustmentId) {
          try {
            await useMovements.getState().deleteMovement(p.adjustmentId)
          } catch (mErr) {
            console.warn('[useDebts] No se pudo revertir ajuste al borrar deuda:', mErr)
          }
        }
      }

      await db.transaction('rw', [db.debts, db.debtPayments], async () => {
        await db.debts.delete(id)
        await db.debtPayments.where('debtId').equals(id).delete()
      })

      await get().fetchDebts()
    } catch (err) {
      console.error('[useDebts] Error al eliminar deuda:', err)
      throw err
    }
  },

  /**
   * Marca una deuda directamente como saldada.
   * @param {string} id
   */
  settleDebt: async (id) => {
    try {
      await db.debts.update(id, { status: 'settled' })
      await get().fetchDebts()
    } catch (err) {
      console.error('[useDebts] Error al saldar deuda:', err)
      throw err
    }
  },

  /**
   * Registra un abono a una deuda existente.
   *
   * @param {string} debtId
   * @param {Object} paymentData
   * @param {Object} [options]
   * @param {boolean} [options.affectAccount=false]
   * @param {string} [options.accountId=null]
   */
  addDebtPayment: async (debtId, paymentData, options = {}) => {
    set({ loading: true, error: null })
    try {
      const debt = await db.debts.get(debtId)
      if (!debt) throw new Error('Deuda no encontrada.')

      const paymentAmount = Math.round(Number(paymentData.amountCents) || 0)
      const paymentDate = paymentData.date || toISODate(new Date())

      let adjustmentId = null

      // Si se activa afectar cuenta, crear movimiento 'adjustment'
      if (options.affectAccount && options.accountId) {
        const adjustmentPayload = getAdjustmentDetailsForDebt({
          debt,
          amountCents: paymentAmount,
          accountId: options.accountId,
          date: paymentDate,
          isPayment: true,
        })

        const createdMov = await useMovements.getState().addMovement(adjustmentPayload)
        adjustmentId = createdMov?.id || null
      }

      const newPayment = {
        id: crypto.randomUUID(),
        debtId,
        amountCents: paymentAmount,
        date: paymentDate,
        accountId: options.accountId || null,
        adjustmentId,
        createdAt: new Date().toISOString(),
      }

      await db.debtPayments.add(newPayment)

      // Recalcular saldo restante para actualizar estado si quedó saldada
      const allDebtPayments = await db.debtPayments.where('debtId').equals(debtId).toArray()
      const remaining = calculateDebtRemainingCents(debt, allDebtPayments)
      if (remaining <= 0) {
        await db.debts.update(debtId, { status: 'settled' })
      }

      await get().fetchDebts()
      return newPayment
    } catch (err) {
      console.error('[useDebts] Error al registrar abono:', err)
      set({ error: 'No se pudo registrar el abono.', loading: false })
      throw err
    }
  },

  /**
   * Elimina un abono y revierte su ajuste de saldo si tenía uno asociado.
   * @param {string} paymentId
   */
  deleteDebtPayment: async (paymentId) => {
    try {
      const payment = await db.debtPayments.get(paymentId)
      if (!payment) return

      // Si generó un ajuste en cuentas, revertirlo
      if (payment.adjustmentId) {
        try {
          await useMovements.getState().deleteMovement(payment.adjustmentId)
        } catch (mErr) {
          console.warn('[useDebts] No se pudo revertir ajuste de abono:', mErr)
        }
      }

      const debtId = payment.debtId
      await db.debtPayments.delete(paymentId)

      // Reabrir la deuda si estaba saldada y ahora tiene saldo restante
      const remainingPayments = await db.debtPayments.where('debtId').equals(debtId).toArray()
      const debt = await db.debts.get(debtId)
      if (debt) {
        const status = calculateDebtStatus(debt, remainingPayments)
        if (debt.status !== status) {
          await db.debts.update(debtId, { status })
        }
      }

      await get().fetchDebts()
    } catch (err) {
      console.error('[useDebts] Error al eliminar abono:', err)
      throw err
    }
  },

  addPayment: async (debtId, paymentData, options = {}) => {
    return get().addDebtPayment(debtId, paymentData, options)
  },

  deletePayment: async (paymentId) => {
    return get().deleteDebtPayment(paymentId)
  },
}))

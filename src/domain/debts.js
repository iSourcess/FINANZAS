/**
 * src/domain/debts.js
 *
 * Lógica pura de deudas y préstamos ("me deben" y "debo").
 *
 * REGLAS ESTRICTAS:
 *   - Funciones puras: sin React, sin IndexedDB, sin efectos secundarios.
 *   - Montos siempre en CENTAVOS ENTEROS.
 *   - Manejo de fechas en hora local.
 *   - Soporte multimoneda (MXN y USD) con consolidación en MXN mediante tipo de cambio.
 *   - Abono mayor al saldo se rechaza salvo confirmación explícita (allowOverpayment).
 */

import { fromISODate } from './periods.js'

/**
 * Calcula la diferencia en días entre dos fechas 'YYYY-MM-DD'.
 * @param {string} dateStrA
 * @param {string} dateStrB
 * @returns {number}
 */
export function diffInDays(dateStrA, dateStrB) {
  const dateA = fromISODate(dateStrA)
  const dateB = fromISODate(dateStrB)
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((dateA.getTime() - dateB.getTime()) / msPerDay)
}

/**
 * Suma el total abonado a una deuda específica.
 * @param {Object} debt
 * @param {Array<Object>} payments
 * @returns {number} Centavos enteros
 */
export function calculateDebtTotalPaid(debt, payments = []) {
  if (!debt || !payments.length) return 0
  return payments
    .filter(p => p.debtId === debt.id)
    .reduce((sum, p) => sum + Math.round(Number(p.amountCents) || 0), 0)
}

/**
 * Calcula el saldo restante de una deuda.
 * @param {Object} debt
 * @param {Array<Object>} payments
 * @returns {number} Centavos enteros (mínimo 0)
 */
export function calculateDebtRemainingCents(debt, payments = []) {
  if (!debt) return 0
  const principal = Math.round(Number(debt.principalCents) || 0)
  const paid = calculateDebtTotalPaid(debt, payments)
  return Math.max(0, principal - paid)
}

/**
 * Calcula el porcentaje pagado de una deuda (0 a 100).
 * @param {Object} debt
 * @param {Array<Object>} payments
 * @returns {number}
 */
export function calculateDebtProgressPercent(debt, payments = []) {
  if (!debt) return 0
  const principal = Math.round(Number(debt.principalCents) || 0)
  if (principal <= 0) return 100
  const paid = calculateDebtTotalPaid(debt, payments)
  return Math.min(100, Math.max(0, Math.round((paid / principal) * 100)))
}

/**
 * Determina el estado efectivo de una deuda ('open' o 'settled').
 * @param {Object} debt
 * @param {Array<Object>} payments
 * @returns {'open'|'settled'}
 */
export function calculateDebtStatus(debt, payments = []) {
  if (!debt) return 'open'
  if (debt.status === 'settled') return 'settled'
  const remaining = calculateDebtRemainingCents(debt, payments)
  return remaining <= 0 ? 'settled' : 'open'
}

/**
 * Valida si un abono es legal o si requiere confirmación por sobrepago.
 *
 * @param {Object} params
 * @param {number} params.remainingCents
 * @param {number} params.paymentAmountCents
 * @param {boolean} [params.allowOverpayment=false]
 * @returns {{ valid: boolean, requiresConfirmation?: boolean, error?: string }}
 */
export function validateDebtPayment({
  remainingCents,
  paymentAmountCents,
  allowOverpayment = false,
}) {
  const safeAmount = Math.round(Number(paymentAmountCents) || 0)
  const safeRemaining = Math.max(0, Math.round(Number(remainingCents) || 0))

  if (safeAmount <= 0) {
    return { valid: false, error: 'El monto del abono debe ser mayor a 0.' }
  }

  if (safeAmount > safeRemaining && !allowOverpayment) {
    return {
      valid: false,
      requiresConfirmation: true,
      error: `El abono ($${(safeAmount / 100).toFixed(2)}) supera el saldo pendiente ($${(safeRemaining / 100).toFixed(2)}).`,
    }
  }

  return { valid: true }
}

/**
 * Comprueba si una deuda está vencida respecto a hoy.
 * @param {Object} debt
 * @param {string} todayStr - YYYY-MM-DD
 * @param {Array<Object>} [payments=[]]
 * @returns {boolean}
 */
export function isDebtOverdue(debt, todayStr, payments = []) {
  if (!debt || !debt.dueDate || !todayStr) return false
  const status = calculateDebtStatus(debt, payments)
  if (status === 'settled') return false
  return debt.dueDate < todayStr
}

/**
 * Comprueba si una deuda vence próximamente (en los siguientes N días).
 * @param {Object} debt
 * @param {string} todayStr - YYYY-MM-DD
 * @param {number} [withinDays=7]
 * @param {Array<Object>} [payments=[]]
 * @returns {boolean}
 */
export function isDebtUpcoming(debt, todayStr, withinDays = 7, payments = []) {
  if (!debt || !debt.dueDate || !todayStr) return false
  const status = calculateDebtStatus(debt, payments)
  if (status === 'settled') return false
  if (debt.dueDate < todayStr) return false // Ya está vencida
  const days = diffInDays(debt.dueDate, todayStr)
  return days <= withinDays
}

/**
 * Retorna las deudas abiertas que vencen próximamente o que ya están vencidas.
 * Utilizado por el sistema de recordatorios y notificaciones.
 *
 * @param {Array<Object>} debts
 * @param {string} todayStr - YYYY-MM-DD
 * @param {number} [withinDays=3]
 * @param {Array<Object>} [payments=[]]
 * @returns {Array<Object>}
 */
export function upcomingDebtDue(debts = [], todayStr, withinDays = 3, payments = []) {
  if (!debts.length || !todayStr) return []

  const matching = []

  for (const debt of debts) {
    const status = calculateDebtStatus(debt, payments)
    if (status === 'settled') continue
    if (!debt.dueDate) continue

    const isOverdue = debt.dueDate < todayStr
    const daysUntilDue = diffInDays(debt.dueDate, todayStr)

    if (isOverdue || daysUntilDue <= withinDays) {
      matching.push({
        ...debt,
        remainingCents: calculateDebtRemainingCents(debt, payments),
        isOverdue,
        daysUntilDue,
      })
    }
  }

  // Ordenar por fecha de vencimiento ascendente (primero las más urgentes)
  matching.sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  return matching
}

/**
 * Calcula el resumen consolidado de deudas (me deben, debo y neto) por moneda y consolidado en MXN.
 *
 * @param {Object} params
 * @param {Array<Object>} params.debts
 * @param {Array<Object>} params.payments
 * @param {number} [params.fxRate=1] - Tipo de cambio USD a MXN
 * @returns {Object}
 */
export function calculateDebtsSummary({
  debts = [],
  payments = [],
  fxRate = 1,
}) {
  const rate = Math.max(0.0001, Number(fxRate) || 1)

  let owedToMeMXNCents = 0
  let owedToMeUSDCents = 0

  let iOweMXNCents = 0
  let iOweUSDCents = 0

  let openCount = 0
  let settledCount = 0

  for (const debt of debts) {
    const status = calculateDebtStatus(debt, payments)
    if (status === 'settled') {
      settledCount += 1
      continue
    }

    openCount += 1
    const remaining = calculateDebtRemainingCents(debt, payments)
    const isUSD = (debt.currency || 'MXN').toUpperCase() === 'USD'

    if (debt.direction === 'owed_to_me') {
      if (isUSD) {
        owedToMeUSDCents += remaining
      } else {
        owedToMeMXNCents += remaining
      }
    } else {
      if (isUSD) {
        iOweUSDCents += remaining
      } else {
        iOweMXNCents += remaining
      }
    }
  }

  // Consolidado total en MXN
  const totalOwedToMeMXN = owedToMeMXNCents + Math.round(owedToMeUSDCents * rate)
  const totalIOweMXN = iOweMXNCents + Math.round(iOweUSDCents * rate)
  const netBalanceMXN = totalOwedToMeMXN - totalIOweMXN

  return {
    owedToMeMXNCents,
    owedToMeUSDCents,
    totalOwedToMeMXN,
    iOweMXNCents,
    iOweUSDCents,
    totalIOweMXN,
    netBalanceMXN,
    netMXNCents: netBalanceMXN,
    openCount,
    openDebtsCount: openCount,
    settledCount,
    totalCount: debts.length,
    fxRate: rate,
  }
}

/**
 * Genera el payload de movimiento de tipo 'adjustment' para afectar la cuenta bancaria seleccionada.
 *
 * Motivos soportados:
 *   - loan_given: dinero prestado a un tercero (sale dinero: deltaCents negativo)
 *   - loan_received: préstamo recibido de un tercero (entra dinero: deltaCents positivo)
 *   - repayment_received: cobro de deuda / abono recibido (entra dinero: deltaCents positivo)
 *   - repayment_made: pago de deuda / abono hecho (sale dinero: deltaCents negativo)
 *
 * @param {Object} params
 * @param {Object} params.debt
 * @param {number} params.amountCents
 * @param {string} params.accountId
 * @param {string} params.date - YYYY-MM-DD
 * @param {boolean} [params.isPayment=false] - Si es un abono posterior o la creación del préstamo
 * @returns {Object} Payload para useMovements.addMovement()
 */
export function getAdjustmentDetailsForDebt({
  debt,
  amountCents,
  accountId,
  date,
  isPayment = false,
}) {
  const safeAmount = Math.round(Number(amountCents) || 0)
  const isOwedToMe = debt.direction === 'owed_to_me'

  let reason = ''
  let deltaCents = 0
  let note = ''

  if (!isPayment) {
    if (isOwedToMe) {
      reason = 'loan_given'
      deltaCents = -safeAmount // Sale dinero de mi cuenta al prestar
      note = `[Préstamo a ${debt.person}] ${debt.note || ''}`.trim()
    } else {
      reason = 'loan_received'
      deltaCents = safeAmount // Entra dinero a mi cuenta cuando me prestan
      note = `[Préstamo de ${debt.person}] ${debt.note || ''}`.trim()
    }
  } else {
    if (isOwedToMe) {
      reason = 'repayment_received'
      deltaCents = safeAmount // Me pagaron un abono: entra dinero
      note = `[Abono recibido de ${debt.person}]`
    } else {
      reason = 'repayment_made'
      deltaCents = -safeAmount // Pagué un abono: sale dinero
      note = `[Abono pagado a ${debt.person}]`
    }
  }

  return {
    type: 'adjustment',
    amount: safeAmount,
    deltaCents,
    reason,
    debtId: debt.id,
    currency: debt.currency || 'MXN',
    accountId,
    date,
    note,
  }
}

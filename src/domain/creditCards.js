/**
 * src/domain/creditCards.js
 *
 * Lógica pura de tarjetas de crédito, cortes, fechas límite de pago y crédito disponible.
 *
 * Reglas de negocio (PLAN.md sección 5.2):
 *   - Disponible = límite − deuda actual − mensualidades MSI pendientes.
 *   - Próximo corte según cutDay (1 a 31).
 *   - Próxima fecha de pago según payDay (1 a 31).
 *   - Estados de cuenta: compras antes del corte entran al periodo actual; después, al siguiente.
 */

import { toISODate, fromISODate } from './periods.js'
import { calculatePendingMsiDebt, calculateMsiProgress } from './msi.js'

/**
 * Obtiene el último día válido para un año y mes específicos (ej. 28/29 en feb, 30 en nov).
 * @param {number} year
 * @param {number} month - 0 a 11
 * @param {number} desiredDay - 1 a 31
 * @returns {Date}
 */
function getClampedDate(year, month, desiredDay) {
  const maxDays = new Date(year, month + 1, 0).getDate()
  const clampedDay = Math.min(desiredDay, maxDays)
  return new Date(year, month, clampedDay, 12, 0, 0)
}

/**
 * Calcula la próxima fecha de corte ('YYYY-MM-DD') a partir del día de corte.
 *
 * @param {number} cutDay - Día de corte del mes (1 a 31)
 * @param {Date} [referenceDate=new Date()]
 * @returns {string} Fecha ISO 'YYYY-MM-DD'
 */
export function getNextCutDate(cutDay, referenceDate = new Date()) {
  const safeCutDay = Math.min(31, Math.max(1, parseInt(cutDay, 10) || 1))
  const refYear = referenceDate.getFullYear()
  const refMonth = referenceDate.getMonth()
  const refDay = referenceDate.getDate()

  // Si hoy es anterior o igual al corte de este mes, el próximo corte es este mes
  if (refDay <= safeCutDay) {
    const cutDate = getClampedDate(refYear, refMonth, safeCutDay)
    return toISODate(cutDate)
  }

  // Si ya pasó el corte de este mes, el próximo corte es el mes siguiente
  const nextMonthCut = getClampedDate(refYear, refMonth + 1, safeCutDay)
  return toISODate(nextMonthCut)
}

/**
 * Calcula la próxima fecha límite de pago asociada al corte próximo o actual.
 *
 * @param {number} payDay - Día límite de pago (1 a 31)
 * @param {number} cutDay - Día de corte (1 a 31)
 * @param {Date} [referenceDate=new Date()]
 * @returns {string} Fecha ISO 'YYYY-MM-DD'
 */
export function getNextPayDate(payDay, cutDay, referenceDate = new Date()) {
  const safePayDay = Math.min(31, Math.max(1, parseInt(payDay, 10) || 1))
  const safeCutDay = Math.min(31, Math.max(1, parseInt(cutDay, 10) || 1))

  const nextCutStr = getNextCutDate(safeCutDay, referenceDate)
  const cutDate = fromISODate(nextCutStr)

  // En México, si payDay < cutDay (ej: corte 17, pago 7), el pago es el mes posterior al corte
  // Si payDay > cutDay (ej: corte 5, pago 25), el pago es en el mismo mes que el corte
  let payYear = cutDate.getFullYear()
  let payMonth = cutDate.getMonth()

  if (safePayDay <= safeCutDay) {
    payMonth += 1
  }

  const payDate = getClampedDate(payYear, payMonth, safePayDay)
  return toISODate(payDate)
}

/**
 * Calcula el estado financiero completo de una tarjeta de crédito.
 *
 * @param {Object} params
 * @param {Object} params.account - Objeto de cuenta { type: 'credit', balance, credit: { limit, cutDay, payDay } }
 * @param {Array<Object>} [params.movements=[]] - Lista de movimientos
 * @param {Date} [params.referenceDate=new Date()]
 * @returns {Object}
 */
export function getCreditCardStatus({
  account,
  movements = [],
  referenceDate = new Date(),
}) {
  if (!account || account.type !== 'credit') {
    return {
      isCredit: false,
      limitCents: 0,
      currentDebtCents: 0,
      pendingMsiDebtCents: 0,
      totalDebtCents: 0,
      availableCreditCents: 0,
      nextCutDate: null,
      nextPayDate: null,
      daysToCut: 0,
      daysToPay: 0,
      activeMsiList: [],
    }
  }

  const limitCents = account.credit?.limit || 0
  const currentDebtCents = Math.max(0, account.balance || 0)
  const cutDay = account.credit?.cutDay || 1
  const payDay = account.credit?.payDay || 20

  // 1. Deuda de MSI pendientes
  const pendingMsiDebtCents = calculatePendingMsiDebt(movements, account.id, referenceDate)

  // 2. Deuda total (corriente + MSI pendientes)
  const totalDebtCents = currentDebtCents + pendingMsiDebtCents

  // 3. Crédito disponible = límite − deuda corriente − MSI pendientes
  const availableCreditCents = Math.max(0, limitCents - totalDebtCents)

  // 4. Fechas de corte y pago
  const nextCutDate = getNextCutDate(cutDay, referenceDate)
  const nextPayDate = getNextPayDate(payDay, cutDay, referenceDate)

  const refDayTime = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate()).getTime()
  const cutDayTime = fromISODate(nextCutDate).getTime()
  const payDayTime = fromISODate(nextPayDate).getTime()

  const msPerDay = 1000 * 60 * 60 * 24
  const daysToCut = Math.max(0, Math.round((cutDayTime - refDayTime) / msPerDay))
  const daysToPay = Math.max(0, Math.round((payDayTime - refDayTime) / msPerDay))

  // 5. Lista detallada de compras MSI activas en esta tarjeta
  const cardMovements = movements.filter(m => m.accountId === account.id && m.msi && m.type === 'expense')
  const activeMsiList = cardMovements
    .map(mov => {
      const progress = calculateMsiProgress(mov, referenceDate)
      return {
        movementId: mov.id,
        note: mov.note || 'Compra a MSI',
        date: mov.date,
        totalAmountCents: progress.totalAmountCents,
        monthlyAmountCents: progress.monthlyAmountCents,
        totalMonths: progress.totalMonths,
        paidMonths: progress.paidMonths,
        remainingMonths: progress.remainingMonths,
        remainingDebtCents: progress.remainingDebtCents,
        isCompleted: progress.isCompleted,
        progressPercent: progress.progressPercent,
      }
    })
    .filter(item => !item.isCompleted) // Solo los activos

  return {
    isCredit: true,
    limitCents,
    currentDebtCents,
    pendingMsiDebtCents,
    totalDebtCents,
    availableCreditCents,
    nextCutDate,
    nextPayDate,
    daysToCut,
    daysToPay,
    activeMsiList,
  }
}

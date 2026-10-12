/**
 * src/domain/msi.js
 *
 * Lógica pura para Meses Sin Intereses (MSI).
 *
 * Reglas de negocio (PLAN.md sección 5.2):
 *   - Dado un gasto, número de meses y fecha, genera el plan de mensualidades iguales
 *     donde el último mes absorbe el redondeo en centavos.
 *   - Calcula mensualidades pagadas, restantes y deuda MSI restante.
 *   - El monto total de MSI reduce el crédito disponible de la tarjeta.
 */

import { toISODate, fromISODate } from './periods.js'

export const ALLOWED_MSI_MONTHS = [3, 6, 9, 12, 18, 24]

/**
 * Genera el plan de pagos mensuales para una compra a Meses Sin Intereses.
 * El último mes absorbe los centavos sobrantes por redondeo.
 *
 * @param {number} totalAmountCents - Monto total en centavos
 * @param {number} months - Número de meses (3, 6, 9, 12, 18, 24)
 * @param {string} [startDateStr] - Fecha de inicio 'YYYY-MM-DD'
 * @returns {Array<{ monthNumber: number, amountCents: number, dueDate: string }>}
 */
export function generateMsiSchedule(
  totalAmountCents,
  months,
  startDateStr = toISODate(new Date())
) {
  const safeTotal = Math.max(0, Math.round(totalAmountCents || 0))
  const safeMonths = Math.max(1, parseInt(months, 10) || 1)

  const baseMonthly = Math.floor(safeTotal / safeMonths)
  const remainder = safeTotal - baseMonthly * safeMonths

  const startDate = fromISODate(startDateStr)
  const schedule = []

  for (let i = 1; i <= safeMonths; i++) {
    // El último mes absorbe el remanente
    const isLast = i === safeMonths
    const amountCents = isLast ? baseMonthly + remainder : baseMonthly

    // Calcular fecha estimada de cada mensualidad (mes i - 1)
    const dueDate = new Date(startDate.getFullYear(), startDate.getMonth() + (i - 1), startDate.getDate(), 12, 0, 0)

    schedule.push({
      monthNumber: i,
      amountCents,
      dueDate: toISODate(dueDate),
    })
  }

  return schedule
}

/**
 * Calcula el progreso de un movimiento a MSI respecto a una fecha de referencia.
 *
 * @param {Object} movement - Movimiento con campo msi: { months, startDate, monthlyAmount }
 * @param {Date} [referenceDate=new Date()]
 * @returns {{
 *   totalMonths: number,
 *   paidMonths: number,
 *   remainingMonths: number,
 *   monthlyAmountCents: number,
 *   totalAmountCents: number,
 *   remainingDebtCents: number,
 *   isCompleted: boolean,
 *   progressPercent: number
 * }}
 */
export function calculateMsiProgress(movement, referenceDate = new Date()) {
  if (!movement || !movement.msi) {
    return {
      totalMonths: 0,
      paidMonths: 0,
      remainingMonths: 0,
      monthlyAmountCents: 0,
      totalAmountCents: 0,
      remainingDebtCents: 0,
      isCompleted: true,
      progressPercent: 100,
    }
  }

  const { months, startDate } = movement.msi
  const totalAmountCents = movement.amount || 0
  const totalMonths = Math.max(1, parseInt(months, 10) || 1)

  const start = fromISODate(startDate || movement.date || toISODate(new Date()))
  const ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 12, 0, 0)

  // Diferencia de meses calendario entre inicio y referencia
  const diffMonths = (ref.getFullYear() - start.getFullYear()) * 12 + (ref.getMonth() - start.getMonth())

  // Si estamos en el mismo mes o posterior a la compra:
  // en el mes de la compra (diffMonths = 0) entra el pago 1 al corte correspondiente
  const paidMonths = Math.min(totalMonths, Math.max(0, diffMonths >= 0 ? diffMonths + 1 : 0))
  const remainingMonths = Math.max(0, totalMonths - paidMonths)

  // Generar el plan completo para sumar los pagos restantes con exactitud de centavos
  const schedule = generateMsiSchedule(totalAmountCents, totalMonths, startDate)
  const remainingDebtCents = schedule
    .filter(item => item.monthNumber > paidMonths)
    .reduce((sum, item) => sum + item.amountCents, 0)

  const monthlyAmountCents = schedule[0]?.amountCents || Math.floor(totalAmountCents / totalMonths)
  const isCompleted = remainingMonths === 0
  const progressPercent = Math.round((paidMonths / totalMonths) * 100)

  return {
    totalMonths,
    paidMonths,
    remainingMonths,
    monthlyAmountCents,
    totalAmountCents,
    remainingDebtCents,
    isCompleted,
    progressPercent,
  }
}

/**
 * Calcula la deuda acumulada total en MSI para una tarjeta de crédito.
 *
 * @param {Array<Object>} movements - Lista de movimientos
 * @param {string} accountId - ID de la cuenta/tarjeta
 * @param {Date} [referenceDate=new Date()]
 * @returns {number} Deuda total pendiente en centavos
 */
export function calculatePendingMsiDebt(movements = [], accountId, referenceDate = new Date()) {
  if (!movements || movements.length === 0 || !accountId) return 0

  const msiMovements = movements.filter(m => m.accountId === accountId && m.msi && m.type === 'expense')

  let totalPending = 0
  for (const mov of msiMovements) {
    const progress = calculateMsiProgress(mov, referenceDate)
    totalPending += progress.remainingDebtCents
  }

  return totalPending
}

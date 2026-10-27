/**
 * src/domain/buckets.js
 *
 * Lógica pura para dividir rangos temporales en cubetas (buckets) homogéneas
 * para alimentar gráficas analíticas (Recharts) que obedecen al PeriodFilter.
 *
 * Reglas de negocio:
 *   - Semana y Mes: cubetas por día.
 *   - Año y Todo: cubetas por mes.
 *   - Rango personalizado:
 *       <= 31 días: por día.
 *       <= 120 días: por semana.
 *       > 120 días: por mes.
 *   - Fechas manejadas estrictamente en hora local (NUNCA toISOString()).
 *   - Cada cubeta tiene la estructura: { start: 'YYYY-MM-DD', end: 'YYYY-MM-DD', label: string }.
 */

import { format, differenceInCalendarDays } from 'date-fns'
import { fromISODate } from './periods.js'

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

/**
 * Convierte un objeto Date a formato local 'YYYY-MM-DD'.
 * @param {Date} date
 * @returns {string}
 */
function toLocalDateStr(date) {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Genera cubetas diarias para un rango dado de fechas (inclusive).
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {boolean} [includeMonthInLabel=false]
 * @returns {Array<{ start: string, end: string, label: string }>}
 */
function generateDailyBuckets(startDate, endDate, includeMonthInLabel = false) {
  const buckets = []
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 12, 0, 0)
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 12, 0, 0)

  while (current <= end) {
    const dateStr = toLocalDateStr(current)
    const label = includeMonthInLabel
      ? `${current.getDate()} ${MONTH_LABELS[current.getMonth()].toLowerCase()}`
      : String(current.getDate()).padStart(2, '0')

    buckets.push({
      start: dateStr,
      end: dateStr,
      label,
    })

    current.setDate(current.getDate() + 1)
  }

  return buckets
}

/**
 * Genera cubetas semanales (intervalos de 7 días) para un rango dado.
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Array<{ start: string, end: string, label: string }>}
 */
function generateWeeklyBuckets(startDate, endDate) {
  const buckets = []
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 12, 0, 0)
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 12, 0, 0)

  while (current <= end) {
    const startStr = toLocalDateStr(current)
    const weekEnd = new Date(current)
    weekEnd.setDate(current.getDate() + 6)
    if (weekEnd > end) {
      weekEnd.setTime(end.getTime())
    }
    const endStr = toLocalDateStr(weekEnd)
    const label = `${current.getDate()} ${MONTH_LABELS[current.getMonth()]}`

    buckets.push({
      start: startStr,
      end: endStr,
      label,
    })

    current.setDate(current.getDate() + 7)
  }

  return buckets
}

/**
 * Genera cubetas mensuales para un rango dado de años/meses.
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {Array<{ start: string, end: string, label: string }>}
 */
function generateMonthlyBuckets(startDate, endDate) {
  const buckets = []
  const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1, 12, 0, 0)
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 12, 0, 0)

  while (current <= end) {
    const year = current.getFullYear()
    const month = current.getMonth()
    const lastDayOfMonth = new Date(year, month + 1, 0).getDate()

    const monthStart = new Date(year, month, 1, 12, 0, 0)
    const monthEnd = new Date(year, month, lastDayOfMonth, 12, 0, 0)

    const startStr = toLocalDateStr(monthStart < startDate ? startDate : monthStart)
    const endStr = toLocalDateStr(monthEnd > end ? end : monthEnd)

    const label = `${MONTH_LABELS[month]} ${String(year).slice(-2)}`

    buckets.push({
      start: startStr,
      end: endStr,
      label: startDate.getFullYear() === endDate.getFullYear() ? MONTH_LABELS[month] : label,
    })

    current.setMonth(current.getMonth() + 1)
  }

  return buckets
}

/**
 * Genera las cubetas temporales correspondientes a un tipo de periodo y rango.
 *
 * @param {Object} period
 * @param {'week'|'month'|'year'|'all'|'custom'} period.type - Tipo de periodo
 * @param {string|null} [period.startDate] - Fecha de inicio 'YYYY-MM-DD'
 * @param {string|null} [period.endDate] - Fecha de fin 'YYYY-MM-DD'
 * @param {Date} [referenceDate=new Date()]
 * @returns {Array<{ start: string, end: string, label: string }>}
 */
export function getBuckets(period, referenceDate = new Date()) {
  if (!period) return []

  const type = period.type || 'month'
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 12, 0, 0)

  // 1. Periodo Semana (Lunes a Domingo) -> Días
  if (type === 'week') {
    const start = period.startDate ? fromISODate(period.startDate) : today
    const end = period.endDate ? fromISODate(period.endDate) : today
    return generateDailyBuckets(start, end, false)
  }

  // 2. Periodo Mes -> Días
  if (type === 'month') {
    const start = period.startDate
      ? fromISODate(period.startDate)
      : new Date(today.getFullYear(), today.getMonth(), 1, 12, 0, 0)
    const end = period.endDate
      ? fromISODate(period.endDate)
      : new Date(today.getFullYear(), today.getMonth() + 1, 0, 12, 0, 0)
    return generateDailyBuckets(start, end, false)
  }

  // 3. Periodo Año -> Meses
  if (type === 'year') {
    const year = period.startDate ? parseInt(period.startDate.slice(0, 4), 10) : today.getFullYear()
    const start = new Date(year, 0, 1, 12, 0, 0)
    const end = new Date(year, 11, 31, 12, 0, 0)
    return generateMonthlyBuckets(start, end)
  }

  // 4. Periodo Todo -> Meses (desde 12 meses atrás hasta hoy si no hay fecha explícita)
  if (type === 'all') {
    const start = period.startDate
      ? fromISODate(period.startDate)
      : new Date(today.getFullYear() - 1, today.getMonth(), 1, 12, 0, 0)
    const end = period.endDate ? fromISODate(period.endDate) : today
    return generateMonthlyBuckets(start, end)
  }

  // 5. Rango personalizado (custom)
  if (type === 'custom' && period.startDate && period.endDate) {
    const start = fromISODate(period.startDate)
    const end = fromISODate(period.endDate)
    const diffDays = Math.max(1, differenceInCalendarDays(end, start) + 1)

    // <= 31 días -> Días
    if (diffDays <= 31) {
      return generateDailyBuckets(start, end, diffDays > 14)
    }

    // <= 120 días -> Semanas
    if (diffDays <= 120) {
      return generateWeeklyBuckets(start, end)
    }

    // > 120 días -> Meses
    return generateMonthlyBuckets(start, end)
  }

  // Fallback si no tiene tipo reconocido
  const fallbackStart = period.startDate ? fromISODate(period.startDate) : today
  const fallbackEnd = period.endDate ? fromISODate(period.endDate) : today
  return generateDailyBuckets(fallbackStart, fallbackEnd, false)
}

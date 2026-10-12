/**
 * src/domain/periods.js
 *
 * Lógica pura para cálculo y manipulación de periodos temporales.
 *
 * Reglas:
 *   - Semana inicia en LUNES (convención ISO / México laboral).
 *   - Las fechas se manejan y retornan como cadenas ISO 'YYYY-MM-DD'.
 *   - Cálculo automático del periodo anterior equivalente:
 *     - Semana: la semana inmediata anterior (lunes a domingo).
 *     - Mes: el mes calendario anterior (día 1 al último día).
 *     - Año: el año calendario anterior (1 ene a 31 dic).
 *     - Rango personalizado: ventana de igual duración inmediatamente anterior.
 *     - Todo: null (no hay comparativa).
 */

/**
 * Convierte un objeto Date a string 'YYYY-MM-DD' en hora local.
 * @param {Date} date
 * @returns {string}
 */
export function toISODate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Parsea un string 'YYYY-MM-DD' a Date en hora local (a las 12:00 para evitar desfases de UTC).
 * @param {string} str
 * @returns {Date}
 */
export function fromISODate(str) {
  const [year, month, day] = str.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0)
}

/**
 * Obtiene el rango de fechas (inicio y fin) para un tipo de periodo dado.
 * @param {'week'|'month'|'year'|'all'|'custom'} periodType
 * @param {Date} [refDate=new Date()]
 * @param {Object} [customRange={}]
 * @param {string} [customRange.startDate]
 * @param {string} [customRange.endDate]
 * @returns {{ startDate: string|null, endDate: string|null, label: string }}
 */
export function getPeriodRange(periodType, refDate = new Date(), customRange = {}) {
  const target = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 12, 0, 0)

  if (periodType === 'week') {
    // Día de la semana (0 = domingo, 1 = lunes, ..., 6 = sábado)
    const dayOfWeek = target.getDay()
    // Distancia al lunes: si es domingo (0), son 6 días hacia atrás; si es lunes (1), 0 días
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1

    const monday = new Date(target)
    monday.setDate(target.getDate() - diffToMonday)

    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)

    return {
      startDate: toISODate(monday),
      endDate: toISODate(sunday),
      label: 'Esta semana',
    }
  }

  if (periodType === 'month') {
    const firstDay = new Date(target.getFullYear(), target.getMonth(), 1, 12, 0, 0)
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12, 0, 0)

    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ]

    return {
      startDate: toISODate(firstDay),
      endDate: toISODate(lastDay),
      label: `${monthNames[target.getMonth()]} ${target.getFullYear()}`,
    }
  }

  if (periodType === 'year') {
    const firstDay = new Date(target.getFullYear(), 0, 1, 12, 0, 0)
    const lastDay = new Date(target.getFullYear(), 11, 31, 12, 0, 0)

    return {
      startDate: toISODate(firstDay),
      endDate: toISODate(lastDay),
      label: `Año ${target.getFullYear()}`,
    }
  }

  if (periodType === 'custom') {
    return {
      startDate: customRange.startDate || toISODate(target),
      endDate: customRange.endDate || toISODate(target),
      label: 'Rango personalizado',
    }
  }

  // 'all' o fallback
  return {
    startDate: null,
    endDate: null,
    label: 'Todo el historial',
  }
}

/**
 * Obtiene el rango de fechas equivalente para el periodo anterior.
 * @param {'week'|'month'|'year'|'all'|'custom'} periodType
 * @param {Date} [refDate=new Date()]
 * @param {Object} [customRange={}]
 * @returns {{ startDate: string|null, endDate: string|null, label: string }|null}
 */
export function getPreviousPeriodRange(periodType, refDate = new Date(), customRange = {}) {
  const target = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 12, 0, 0)

  if (periodType === 'week') {
    // Restar 7 días para caer en la semana anterior
    const prevWeekTarget = new Date(target)
    prevWeekTarget.setDate(target.getDate() - 7)
    const current = getPeriodRange('week', prevWeekTarget)
    return {
      ...current,
      label: 'Semana anterior',
    }
  }

  if (periodType === 'month') {
    // Mes anterior
    const prevMonthTarget = new Date(target.getFullYear(), target.getMonth() - 1, 15, 12, 0, 0)
    const current = getPeriodRange('month', prevMonthTarget)
    return {
      ...current,
      label: 'Mes anterior',
    }
  }

  if (periodType === 'year') {
    const prevYearTarget = new Date(target.getFullYear() - 1, 5, 1, 12, 0, 0)
    const current = getPeriodRange('year', prevYearTarget)
    return {
      ...current,
      label: `Año ${target.getFullYear() - 1}`,
    }
  }

  if (periodType === 'custom' && customRange.startDate && customRange.endDate) {
    const start = fromISODate(customRange.startDate)
    const end = fromISODate(customRange.endDate)
    // Duración en milisegundos y días
    const diffTime = end.getTime() - start.getTime()
    const diffDays = Math.max(1, Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1)

    const prevEnd = new Date(start)
    prevEnd.setDate(start.getDate() - 1)

    const prevStart = new Date(prevEnd)
    prevStart.setDate(prevEnd.getDate() - diffDays + 1)

    return {
      startDate: toISODate(prevStart),
      endDate: toISODate(prevEnd),
      label: 'Periodo anterior',
    }
  }

  return null
}

/**
 * Determina si una fecha 'YYYY-MM-DD' está dentro del rango especificado (inclusivo).
 * @param {string} dateStr
 * @param {string|null} startDate
 * @param {string|null} endDate
 * @returns {boolean}
 */
export function isDateInRange(dateStr, startDate, endDate) {
  if (!dateStr) return false
  if (!startDate && !endDate) return true
  if (startDate && dateStr < startDate) return false
  if (endDate && dateStr > endDate) return false
  return true
}

/**
 * src/lib/format.js
 *
 * Funciones de formato de montos monetarios, porcentajes y fechas.
 *
 * REGLA ESTRICTA:
 *   Los montos se reciben en CENTAVOS ENTEROS (ej: 12550 = $125.50).
 *   Todos los números de salida usan formato legible con números tabulares.
 *   Las fechas de hoy/ayer se calculan en hora local (nunca toISOString()).
 */

import { format } from 'date-fns'

/**
 * Formatea un monto en centavos a cadena con símbolo de moneda y separador de miles.
 * @param {number|null|undefined} cents - Monto en centavos enteros (ej: 250000 = $2,500.00)
 * @param {string} [currency='MXN'] - Código de moneda ('MXN' | 'USD')
 * @param {Object} [options]
 * @param {boolean} [options.showCurrencyCode=false] - Si incluye ' MXN' al final
 * @param {boolean} [options.compact=false] - Formato compacto ($2.5k)
 * @returns {string} Cadena formateada (ej: "$1,250.00")
 */
export function formatMoney(cents, currency = 'MXN', options = {}) {
  if (cents === null || cents === undefined || isNaN(cents)) {
    return '$0.00'
  }

  const isNegative = cents < 0
  const absCents = Math.abs(Math.round(cents))
  const pesos = absCents / 100

  const formatted = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: currency || 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pesos)

  // Intl ya incluye el signo negativo si corresponde, pero nos aseguramos del formato consistente
  const result = isNegative && !formatted.startsWith('-') ? `-${formatted}` : formatted

  if (options.showCurrencyCode) {
    return `${result} ${currency}`
  }

  return result
}

/**
 * Convierte centavos a formato de texto para inputs (sin símbolo de moneda ni comas).
 * @param {number|null|undefined} cents
 * @returns {string} (ej: 12550 -> "125.50")
 */
export function centsToInput(cents) {
  if (cents === null || cents === undefined || isNaN(cents)) return ''
  const val = (Math.round(cents) / 100).toFixed(2)
  return val.endsWith('.00') ? String(Math.round(cents) / 100) : val
}

/**
 * Convierte una cadena de entrada de dinero a centavos enteros redondeados.
 * @param {string|number|null|undefined} input - Ej: "125.50", "$1,250", 100
 * @returns {number} Monto en centavos enteros (ej: 12550)
 */
export function inputToCents(input) {
  if (input === null || input === undefined || input === '') return 0
  if (typeof input === 'number') return Math.round(input * 100)

  // Limpiar caracteres no numéricos excepto punto y guión
  const sanitized = String(input)
    .replace(/[^\d.-]/g, '')
    .trim()

  const num = parseFloat(sanitized)
  if (isNaN(num)) return 0

  return Math.round(num * 100)
}

/**
 * Formatea una tasa decimal anual a porcentaje visible.
 * @param {number|null|undefined} rate - Tasa decimal (ej: 0.13 = 13%)
 * @param {number} [decimals=1]
 * @returns {string} Ej: "13%" o "13.5%"
 */
export function formatPercent(rate, decimals = 1) {
  if (rate === null || rate === undefined || isNaN(rate)) return '0%'
  const percent = rate * 100
  // Si no tiene decimales significativos, mostrar sin decimal
  if (percent % 1 === 0) {
    return `${percent.toFixed(0)}%`
  }
  return `${percent.toFixed(decimals)}%`
}

/**
 * Formatea una fecha ISO (YYYY-MM-DD) a formato corto en español.
 * @param {string|null|undefined} isoDate - Ej: "2026-10-15"
 * @returns {string} Ej: "15 oct 2026"
 */
export function formatDate(isoDate) {
  if (!isoDate) return ''
  try {
    const [year, month, day] = isoDate.split('-').map(Number)
    const date = new Date(year, month - 1, day)
    return new Intl.DateTimeFormat('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date)
  } catch {
    return isoDate
  }
}

/**
 * Formatea los últimos 4 dígitos de tarjeta con máscara.
 * @param {string|number|null|undefined} last4
 * @returns {string} Ej: "•••• 4242"
 */
export function formatCardDigits(last4) {
  if (!last4) return '••••'
  return `•••• ${String(last4).slice(-4)}`
}

/**
 * Devuelve la etiqueta de cuenta con tipo de cuenta incluido.
 * Formato: "Nombre · Tipo" (ej: "Revolut · Crédito")
 *
 * @param {Object|null|undefined} account - Objeto de cuenta { name, type }
 * @returns {string}
 */
export function accountLabel(account) {
  if (!account) return 'Cuenta desconocida'
  const typeLabels = {
    credit: 'Crédito',
    debit: 'Débito',
    cash: 'Efectivo',
    savings: 'Ahorro',
  }
  const typeName = typeLabels[account.type] || account.type || ''
  if (!typeName) return account.name || 'Cuenta'
  return `${account.name} · ${typeName}`
}

/**
 * Devuelve la fecha de hoy en hora local como 'YYYY-MM-DD'.
 * Nunca usa toISOString() para evitar desfase UTC.
 * @returns {string}
 */
export function todayLocalISO() {
  return format(new Date(), 'yyyy-MM-dd')
}

/**
 * Devuelve la fecha de ayer en hora local como 'YYYY-MM-DD'.
 * @returns {string}
 */
export function yesterdayLocalISO() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return format(d, 'yyyy-MM-dd')
}

/**
 * Formatea un timestamp o fecha en tiempo relativo en español (ej: "hace 5 min", "hace 2 h", "hace 3 d").
 * @param {number|string|Date|null|undefined} timestamp
 * @param {Date|number} [nowRef=new Date()]
 * @returns {string}
 */
export function formatRelativeTime(timestamp, nowRef = new Date()) {
  if (!timestamp) return ''
  const dateObj = typeof timestamp === 'number'
    ? new Date(timestamp)
    : new Date(timestamp)

  if (isNaN(dateObj.getTime())) return ''

  const nowMs = typeof nowRef === 'number' ? nowRef : new Date(nowRef).getTime()
  const diffMs = Math.max(0, nowMs - dateObj.getTime())
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMin < 1) return 'hace un momento'
  if (diffMin < 60) return `hace ${diffMin} min`
  if (diffHours < 24) return `hace ${diffHours} h`
  if (diffDays === 1) return 'hace 1 d'
  return `hace ${diffDays} d`
}

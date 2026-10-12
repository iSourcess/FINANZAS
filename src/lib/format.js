/**
 * src/lib/format.js
 *
 * Funciones de formato de montos monetarios, porcentajes y fechas.
 *
 * REGLA ESTRICTA:
 *   Los montos se reciben en CENTAVOS ENTEROS (ej: 12550 = $125.50).
 *   Todos los números de salida usan formato legible con números tabulares.
 */

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

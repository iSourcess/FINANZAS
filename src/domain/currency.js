/**
 * src/domain/currency.js
 *
 * Funciones puras de conversión de divisas.
 *
 * Convención:
 *   - Montos en CENTAVOS ENTEROS.
 *   - fxRate es el tipo de cambio: MXN por 1 divisa extranjera (ej: USD a 20.0, EUR a 21.5).
 *     Si viene en centavos (ej: 2000), se normaliza dividiendo entre 100.
 *   - Si no se proporciona fxRate, consulta al proveedor de tipo de cambio activo (useFx).
 */

let activeRateProvider = null

/**
 * Registra el proveedor de tasa activa del store useFx para conversiones sin tasa explícita.
 * @param {(currency: string) => number} fn
 */
export function setRateProvider(fn) {
  activeRateProvider = fn
}

/**
 * Convierte un monto entre MXN y divisas extranjeras (USD, EUR, etc.) usando un tipo de cambio dado
 * o la tasa activa del store useFx como fuente única de verdad.
 *
 * @param {number} amountCents - Monto en centavos enteros
 * @param {number} [fxRate] - Tipo de cambio (MXN por 1 unidad de divisa extranjera)
 * @param {string} [fromCurrency='MXN']
 * @param {string} [toCurrency='MXN']
 * @returns {number} Monto resultante en centavos enteros redondeados
 */
export function convertCurrency(
  amountCents,
  fxRate,
  fromCurrency = 'MXN',
  toCurrency = 'MXN'
) {
  if (!amountCents || fromCurrency === toCurrency) {
    return Math.round(amountCents || 0)
  }

  // Normalizar fxRate si viene en centavos (ej: 2000 centavos = $20.00 MXN/USD)
  let rate = fxRate > 100 ? fxRate / 100 : fxRate

  // Si no se pasó fxRate, obtener de la fuente única de verdad (useFx)
  if (!rate || rate <= 0) {
    const foreignCurrency = fromCurrency === 'MXN' ? toCurrency : fromCurrency
    if (typeof activeRateProvider === 'function') {
      rate = activeRateProvider(foreignCurrency)
    }
  }

  if (!rate || rate <= 0) {
    return Math.round(amountCents)
  }

  // De divisa extranjera (USD/EUR) a MXN
  if (toCurrency === 'MXN') {
    return Math.round(amountCents * rate)
  }

  // De MXN a divisa extranjera (USD/EUR)
  if (fromCurrency === 'MXN') {
    return Math.round(amountCents / rate)
  }

  return Math.round(amountCents)
}

/**
 * src/domain/currency.js
 *
 * Funciones puras de conversión de divisas.
 *
 * Convención:
 *   - Montos en CENTAVOS ENTEROS.
 *   - fxRate es el tipo de cambio: MXN por 1 USD (ej: 20.0).
 *     Si viene en centavos (ej: 2000), se normaliza dividiendo entre 100.
 */

/**
 * Convierte un monto entre MXN y USD usando un tipo de cambio dado.
 * @param {number} amountCents - Monto en centavos enteros
 * @param {number} fxRate - Tipo de cambio (MXN por 1 USD, ej: 20.0 o 2000 centavos)
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
  const rate = fxRate > 100 ? fxRate / 100 : fxRate

  if (!rate || rate <= 0) {
    return Math.round(amountCents)
  }

  if (fromCurrency === 'USD' && toCurrency === 'MXN') {
    return Math.round(amountCents * rate)
  }

  if (fromCurrency === 'MXN' && toCurrency === 'USD') {
    return Math.round(amountCents / rate)
  }

  return Math.round(amountCents)
}

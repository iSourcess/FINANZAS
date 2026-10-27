/**
 * src/domain/widgetSnapshot.js
 *
 * Lógica pura para calcular el snapshot ligero de datos que consume el
 * widget de la pantalla de inicio de Android (AppWidgetProvider).
 *
 * Sin dependencias de React, DOM ni Capacitor.
 */

/**
 * Calcula el resumen financiero para el widget de la pantalla de inicio.
 *
 * Reglas de negocio:
 * 1. Solo se consideran movimientos reales (ingreso y gasto). Las transferencias no suman ni restan al balance.
 * 2. Montos en centavos enteros.
 * 3. Privacidad: Los montos solo se muestran si el usuario lo permitió explícitamente Y el modo privado no está activo.
 *
 * @param {Object} params
 * @param {Array<Object>} params.movements - Lista de movimientos
 * @param {string} params.todayDateStr - Fecha de hoy en hora local (YYYY-MM-DD)
 * @param {string} [params.currentMonthPrefix] - Prefijo del mes actual (YYYY-MM), calculado a partir de todayDateStr si no se pasa
 * @param {string} [params.currency='MXN'] - Moneda base
 * @param {boolean} [params.showAmountsOnWidget=false] - Ajuste del usuario para mostrar cifras en pantalla de inicio
 * @param {boolean} [params.hideAmounts=false] - Modo privado global de la aplicación
 * @returns {{
 *   todaySpentCents: number,
 *   monthBalanceCents: number,
 *   currency: string,
 *   updatedAt: string,
 *   showAmounts: boolean
 * }}
 */
export function calculateWidgetSnapshot({
  movements = [],
  todayDateStr,
  currentMonthPrefix,
  currency = 'MXN',
  showAmountsOnWidget = false,
  hideAmounts = false,
}) {
  const today = todayDateStr || new Date().toISOString().slice(0, 10)
  const monthPrefix = currentMonthPrefix || today.slice(0, 7)

  let todaySpentCents = 0
  let monthIncomeCents = 0
  let monthExpenseCents = 0

  for (const m of movements) {
    if (!m || typeof m.amount !== 'number' || m.amount <= 0) continue

    // 1. Gastado hoy (solo gastos de la fecha actual)
    if (m.date === today && m.type === 'expense') {
      todaySpentCents += m.amount
    }

    // 2. Balance del mes en curso (ingresos menos gastos del mes)
    if (typeof m.date === 'string' && m.date.startsWith(monthPrefix)) {
      if (m.type === 'income') {
        monthIncomeCents += m.amount
      } else if (m.type === 'expense') {
        monthExpenseCents += m.amount
      }
      // Las transferencias ('transfer') mueven saldo entre cuentas, no modifican el balance mensual
    }
  }

  const monthBalanceCents = monthIncomeCents - monthExpenseCents

  // Privacidad estricta: si el widget tiene los montos apagados O el modo privado está activo, no mostrar
  const showAmounts = Boolean(showAmountsOnWidget && !hideAmounts)

  return {
    todaySpentCents,
    monthBalanceCents,
    currency,
    updatedAt: new Date().toISOString(),
    showAmounts,
  }
}

/**
 * Formatea un monto en centavos para mostrar en el widget nativo.
 * Si showAmounts es falso, retorna máscara privada '••••'.
 *
 * @param {number} cents - Monto en centavos enteros
 * @param {boolean} showAmounts - Si se deben mostrar montos reales
 * @param {string} [currency='MXN'] - Símbolo o código de moneda
 * @param {boolean} [includeSign=false] - Si debe incluir signo explícito (+/-)
 * @returns {string} Texto formateado
 */
export function formatWidgetAmount(cents, showAmounts, currency = 'MXN', includeSign = false) {
  if (!showAmounts) {
    return '••••'
  }

  const isNegative = cents < 0
  const absCents = Math.abs(cents)
  const pesos = (absCents / 100).toLocaleString('es-MX', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  if (includeSign) {
    if (cents > 0) return `+$${pesos}`
    if (cents < 0) return `-$${pesos}`
    return `$${pesos}`
  }

  return isNegative ? `-$${pesos}` : `$${pesos}`
}

/**
 * src/domain/netWorth.js
 *
 * Lógica pura de cálculo de patrimonio total y rentabilidad de inversiones.
 *
 * Fórmula:
 *   Patrimonio total = Efectivo + Débito/Ahorro + Inversiones − Deuda de tarjetas
 *
 * Todos los cálculos monetarios se manejan y retornan en CENTAVOS ENTEROS (MXN).
 */

/**
 * Calcula la rentabilidad y valor actual de una posición individual de inversión.
 *
 * @param {Object} params
 * @param {Object} params.holding - { id, symbol, name, kind, quantity, avgCost, costCurrency }
 * @param {Object} [params.priceInfo] - { price: number, currency: string, change24h: number, isStale: boolean }
 * @param {number} [params.fxRate=1] - Tipo de cambio USD a MXN (decimal, ej. 18.5)
 * @returns {Object} Posición calculada con valores en centavos (MXN y moneda origen)
 */
export function calculateHoldingPerformance({
  holding,
  priceInfo = null,
  fxRate = 1,
}) {
  const quantity = Math.max(0, Number(holding.quantity) || 0)
  const avgCostCents = Math.max(0, Math.round(Number(holding.avgCost) || 0))
  const currency = holding.costCurrency || 'USD'
  const isUSD = currency.toUpperCase() === 'USD'
  const rateToMXN = isUSD ? Math.max(0.0001, Number(fxRate) || 1) : 1

  // Precio actual unitario (float)
  const currentUnitPrice = priceInfo?.price != null ? Math.max(0, Number(priceInfo.price)) : (avgCostCents / 100)
  const change24h = priceInfo?.change24h != null ? Number(priceInfo.change24h) : 0
  const isStale = Boolean(priceInfo?.isStale)

  // Valor actual y costo total en centavos de la moneda original
  const currentTotalCentsOrig = Math.round(quantity * currentUnitPrice * 100)
  const totalCostCentsOrig = Math.round(quantity * avgCostCents)

  // Conversión a centavos MXN
  const currentTotalCentsMXN = Math.round(currentTotalCentsOrig * rateToMXN)
  const totalCostCentsMXN = Math.round(totalCostCentsOrig * rateToMXN)

  // Ganancia / Pérdida en centavos MXN y porcentaje
  const gainLossCentsMXN = currentTotalCentsMXN - totalCostCentsMXN
  const gainLossPercent = totalCostCentsOrig > 0
    ? Number((((currentTotalCentsOrig - totalCostCentsOrig) / totalCostCentsOrig) * 100).toFixed(2))
    : 0

  return {
    holdingId: holding.id,
    symbol: holding.symbol,
    name: holding.name || holding.symbol,
    kind: holding.kind,
    quantity,
    avgCostCents,
    currency,
    currentUnitPrice,
    change24h: Number(change24h.toFixed(2)),
    isStale,
    // Valores en centavos de moneda original
    currentTotalCentsOrig,
    totalCostCentsOrig,
    // Valores consolidados en centavos MXN
    currentTotalCentsMXN,
    totalCostCentsMXN,
    gainLossCentsMXN,
    gainLossPercent,
  }
}

/**
 * Calcula el patrimonio neto consolidado en MXN (centavos enteros).
 *
 * @param {Object} params
 * @param {Array<Object>} [params.accounts=[]] - Cuentas de efectivo, débito, ahorro y crédito
 * @param {Array<Object>} [params.holdings=[]] - Posiciones de inversión
 * @param {Map|Object} [params.priceMap={}] - Mapa de symbol -> { price, currency, change24h, isStale }
 * @param {number} [params.fxRate=1] - Tipo de cambio USD a MXN
 * @returns {Object} Resumen consolidado del patrimonio
 */
export function calculateNetWorth({
  accounts = [],
  holdings = [],
  priceMap = {},
  fxRate = 1,
}) {
  const rate = Math.max(0.0001, Number(fxRate) || 1)

  let cashCents = 0
  let debitCents = 0
  let debtCents = 0

  // 1. Sumar saldos de cuentas convirtiendo USD a MXN si aplica
  for (const acc of accounts) {
    if (acc.hidden) continue

    const balanceCents = Math.round(Number(acc.balance) || 0)
    const isUSD = (acc.currency || 'MXN').toUpperCase() === 'USD'
    const balanceInMXN = Math.round(balanceCents * (isUSD ? rate : 1))

    if (acc.type === 'cash') {
      cashCents += balanceInMXN
    } else if (acc.type === 'debit' || acc.type === 'savings') {
      debitCents += balanceInMXN
    } else if (acc.type === 'credit') {
      // En tarjetas de crédito, balance positivo representa deuda acumulada
      debtCents += Math.max(0, balanceInMXN)
    }
  }

  // 2. Calcular valor consolidado de inversiones
  const lookupPrice = (sym) => {
    if (!sym) return null
    if (priceMap instanceof Map) {
      return priceMap.get(sym.toUpperCase()) || priceMap.get(sym) || null
    }
    return priceMap[sym.toUpperCase()] || priceMap[sym] || null
  }

  const holdingsCalculated = holdings.map(h => {
    const pInfo = lookupPrice(h.symbol)
    return calculateHoldingPerformance({
      holding: h,
      priceInfo: pInfo,
      fxRate: rate,
    })
  })

  let investmentsCents = 0
  let investmentsCostCents = 0

  for (const hCalc of holdingsCalculated) {
    investmentsCents += hCalc.currentTotalCentsMXN
    investmentsCostCents += hCalc.totalCostCentsMXN
  }

  const investmentsGainLossCents = investmentsCents - investmentsCostCents
  const investmentsGainLossPercent = investmentsCostCents > 0
    ? Number((((investmentsCents - investmentsCostCents) / investmentsCostCents) * 100).toFixed(2))
    : 0

  // 3. Patrimonio total = Efectivo + Débito + Inversiones - Deuda
  const netWorthCents = cashCents + debitCents + investmentsCents - debtCents

  return {
    cashCents,
    debitCents,
    investmentsCents,
    investmentsCostCents,
    investmentsGainLossCents,
    investmentsGainLossPercent,
    debtCents,
    netWorthCents,
    holdingsCalculated,
    fxRate: rate,
  }
}

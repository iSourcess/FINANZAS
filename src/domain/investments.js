/**
 * src/domain/investments.js
 *
 * Lógica pura de inversiones por lotes y valoración histórica de portafolio.
 *
 * Reglas de negocio:
 *   - Una posición (holding) puede tener múltiples lotes de compra con fechas distintas.
 *   - Costo promedio ponderado = Σ(cantidad_lote × precio_lote) / Σ(cantidad_lote).
 *   - En una fecha histórica T, solo se consideran los lotes adquiridos con fecha <= T.
 *   - Convierte USD a MXN usando el tipo de cambio histórico de la fecha correspondiente.
 *   - Montos monetarios calculados en CENTAVOS ENTEROS.
 *
 * Sin React, sin base de datos, funciones puras con pruebas.
 */

/**
 * Agrupa y consolida una lista de lotes para calcular cantidad total y costo promedio ponderado.
 *
 * @param {Array<{ quantity: number, priceCents: number, costCurrency?: string, date?: string }>} lots
 * @returns {{
 *   totalQuantity: number,
 *   totalCostCents: number,
 *   avgCostCents: number,
 *   lotCount: number
 * }}
 */
export function aggregateLots(lots = []) {
  if (!Array.isArray(lots) || lots.length === 0) {
    return {
      totalQuantity: 0,
      totalCostCents: 0,
      avgCostCents: 0,
      lotCount: 0,
    }
  }

  let totalQuantity = 0
  let totalCostCents = 0

  for (const lot of lots) {
    const qty = Math.max(0, Number(lot.quantity) || 0)
    const price = Math.max(0, Math.round(Number(lot.priceCents) || 0))
    totalQuantity += qty
    totalCostCents += Math.round(qty * price)
  }

  const avgCostCents = totalQuantity > 0 ? Math.round(totalCostCents / totalQuantity) : 0

  return {
    totalQuantity: Number(totalQuantity.toFixed(8)),
    totalCostCents,
    avgCostCents,
    lotCount: lots.length,
  }
}

/**
 * Encuentra el precio histórico más cercano hacia atrás para un símbolo y fecha dados.
 *
 * @param {string} symbol - Símbolo (ej: 'BTC', 'NVDA')
 * @param {string} targetDate - Fecha 'YYYY-MM-DD'
 * @param {Map<string, number>|Object} priceHistoryMap - Mapa `${symbol}_${date}` -> precio USD
 * @param {number} fallbackPrice - Precio de respaldo
 * @returns {number}
 */
export function resolveHistoricalPrice(symbol, targetDate, priceHistoryMap, fallbackPrice = 0) {
  if (!priceHistoryMap) return fallbackPrice

  // Búsqueda directa
  const key = `${symbol.toUpperCase()}_${targetDate}`
  if (priceHistoryMap instanceof Map && priceHistoryMap.has(key)) {
    return priceHistoryMap.get(key)
  }
  if (typeof priceHistoryMap === 'object' && priceHistoryMap[key] != null) {
    return priceHistoryMap[key]
  }

  // Si no está la fecha exacta, buscar la fecha más cercana anterior (hacia atrás hasta 30 días)
  const [year, month, day] = targetDate.split('-').map(Number)
  const d = new Date(year, month - 1, day, 12, 0, 0)

  for (let i = 1; i <= 30; i++) {
    d.setDate(d.getDate() - 1)
    const prevDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const prevKey = `${symbol.toUpperCase()}_${prevDateStr}`

    if (priceHistoryMap instanceof Map && priceHistoryMap.has(prevKey)) {
      return priceHistoryMap.get(prevKey)
    }
    if (typeof priceHistoryMap === 'object' && priceHistoryMap[prevKey] != null) {
      return priceHistoryMap[prevKey]
    }
  }

  return fallbackPrice
}

/**
 * Encuentra la tasa de cambio USD/MXN más cercana hacia atrás para una fecha dada.
 *
 * @param {string} targetDate - 'YYYY-MM-DD'
 * @param {Map<string, number>|Object} fxHistoryMap - Mapa `USD/MXN_${date}` -> rate
 * @param {number} fallbackRate - Tasa de respaldo
 * @returns {number}
 */
export function resolveHistoricalFxRate(targetDate, fxHistoryMap, fallbackRate = 20.0) {
  if (!fxHistoryMap) return fallbackRate

  const key = `USD/MXN_${targetDate}`
  if (fxHistoryMap instanceof Map && fxHistoryMap.has(key)) {
    return fxHistoryMap.get(key)
  }
  if (typeof fxHistoryMap === 'object' && fxHistoryMap[key] != null) {
    return fxHistoryMap[key]
  }

  const [year, month, day] = targetDate.split('-').map(Number)
  const d = new Date(year, month - 1, day, 12, 0, 0)

  for (let i = 1; i <= 30; i++) {
    d.setDate(d.getDate() - 1)
    const prevDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const prevKey = `USD/MXN_${prevDateStr}`

    if (fxHistoryMap instanceof Map && fxHistoryMap.has(prevKey)) {
      return fxHistoryMap.get(prevKey)
    }
    if (typeof fxHistoryMap === 'object' && fxHistoryMap[prevKey] != null) {
      return fxHistoryMap[prevKey]
    }
  }

  return fallbackRate
}

/**
 * Genera la serie cronológica de ganancia/pérdida del portafolio o de un activo específico
 * para una lista de fechas (cubetas del PeriodFilter).
 *
 * @param {Object} params
 * @param {Array<Object>} params.lots - Lista de lotes de adquisición
 * @param {Array<string>} params.dates - Lista de fechas 'YYYY-MM-DD' (o cubetas con { end, label })
 * @param {Map<string, number>|Object} [params.priceHistoryMap] - Histórico de precios
 * @param {Map<string, number>|Object} [params.fxHistoryMap] - Histórico de tipo de cambio
 * @param {Object} [params.currentPriceMap={}] - Precios actuales de respaldo { symbol: priceUSD }
 * @param {number} [params.currentFxRate=20.0] - Tipo de cambio actual de respaldo
 * @param {string|null} [params.filterSymbol=null] - Filtrar por símbolo (ej. 'BTC') o null para todo el portafolio
 * @returns {Array<{
 *   date: string,
 *   label: string,
 *   costMXN: number,
 *   valueMXN: number,
 *   gainMXN: number,
 *   gainPct: number,
 *   costUSD: number,
 *   valueUSD: number,
 *   gainUSD: number,
 *   gainPctUSD: number
 * }>}
 */
export function calculatePortfolioGainSeries({
  lots = [],
  dates = [],
  priceHistoryMap = null,
  fxHistoryMap = null,
  currentPriceMap = {},
  currentFxRate = 20.0,
  filterSymbol = null,
}) {
  if (!Array.isArray(dates) || dates.length === 0) return []

  const relevantLots = filterSymbol
    ? lots.filter(l => (l.symbol || '').toUpperCase() === filterSymbol.toUpperCase())
    : lots

  // Si no hay lotes para el filtro, devolver serie vacía con ceros
  return dates.map(dateItem => {
    const targetDate = typeof dateItem === 'string' ? dateItem : dateItem.end || dateItem.date
    const label = typeof dateItem === 'string' ? dateItem.slice(5) : (dateItem.label || targetDate.slice(5))

    // Filtrar lotes adquiridos en o antes de targetDate
    const acquiredLots = relevantLots.filter(l => l.date <= targetDate)

    if (acquiredLots.length === 0) {
      return {
        date: targetDate,
        label,
        costMXN: 0,
        valueMXN: 0,
        gainMXN: 0,
        gainPct: 0,
        costUSD: 0,
        valueUSD: 0,
        gainUSD: 0,
        gainPctUSD: 0,
      }
    }

    // Tipo de cambio USD/MXN en targetDate
    const fxRate = resolveHistoricalFxRate(targetDate, fxHistoryMap, currentFxRate)

    let totalCostUSD = 0 // en centavos USD
    let totalValueUSD = 0 // en centavos USD
    let totalCostMXN = 0 // en centavos MXN
    let totalValueMXN = 0 // en centavos MXN

    // Agrupar cantidad por símbolo en esta fecha
    const symbolTotals = new Map()
    for (const lot of acquiredLots) {
      const sym = (lot.symbol || '').toUpperCase()
      const qty = Math.max(0, Number(lot.quantity) || 0)
      const costCents = Math.round(qty * (Number(lot.priceCents) || 0))

      symbolTotals.set(sym, (symbolTotals.get(sym) || 0) + qty)

      if ((lot.costCurrency || 'USD').toUpperCase() === 'USD') {
        totalCostUSD += costCents
        totalCostMXN += Math.round(costCents * fxRate)
      } else {
        totalCostMXN += costCents
        totalCostUSD += fxRate > 0 ? Math.round(costCents / fxRate) : costCents
      }
    }

    // Calcular valor actual con precio histórico
    symbolTotals.forEach((quantity, sym) => {
      const fallbackPrice = currentPriceMap[sym]?.price || currentPriceMap[sym] || 0
      const unitPriceUSD = resolveHistoricalPrice(sym, targetDate, priceHistoryMap, fallbackPrice)
      const valueCentsUSD = Math.round(quantity * unitPriceUSD * 100)

      totalValueUSD += valueCentsUSD
      totalValueMXN += Math.round(valueCentsUSD * fxRate)
    })

    const gainMXN = totalValueMXN - totalCostMXN
    const gainPct = totalCostMXN > 0
      ? Number((((totalValueMXN - totalCostMXN) / totalCostMXN) * 100).toFixed(2))
      : 0

    const gainUSD = totalValueUSD - totalCostUSD
    const gainPctUSD = totalCostUSD > 0
      ? Number((((totalValueUSD - totalCostUSD) / totalCostUSD) * 100).toFixed(2))
      : 0

    return {
      date: targetDate,
      label,
      costMXN: totalCostMXN,
      valueMXN: totalValueMXN,
      gainMXN,
      gainPct,
      costUSD: totalCostUSD,
      valueUSD: totalValueUSD,
      gainUSD,
      gainPctUSD,
    }
  })
}

import { describe, it, expect } from 'vitest'
import {
  aggregateLots,
  resolveHistoricalPrice,
  resolveHistoricalFxRate,
  calculatePortfolioGainSeries,
} from '../src/domain/investments.js'

describe('Domain: Investment lots and historical valuation', () => {
  describe('aggregateLots', () => {
    it('aggregates multiple lots to calculate total quantity and weighted average cost', () => {
      const lots = [
        // Lote 1: 2 acciones a $100.00 USD (10000 cents) = $200
        { quantity: 2, priceCents: 10000, date: '2026-09-01' },
        // Lote 2: 3 acciones a $150.00 USD (15000 cents) = $450
        { quantity: 3, priceCents: 15000, date: '2026-10-01' },
      ]

      const result = aggregateLots(lots)

      expect(result.totalQuantity).toBe(5)
      expect(result.totalCostCents).toBe(65000) // $650.00 USD
      // Costo promedio = $650 / 5 = $130.00 USD (13000 cents)
      expect(result.avgCostCents).toBe(13000)
      expect(result.lotCount).toBe(2)
    })

    it('handles empty or null lots safely', () => {
      expect(aggregateLots([])).toEqual({
        totalQuantity: 0,
        totalCostCents: 0,
        avgCostCents: 0,
        lotCount: 0,
      })
      expect(aggregateLots(null)).toEqual({
        totalQuantity: 0,
        totalCostCents: 0,
        avgCostCents: 0,
        lotCount: 0,
      })
    })
  })

  describe('resolveHistoricalPrice and resolveHistoricalFxRate', () => {
    it('resolves exact date price and falls back to previous day when date is missing', () => {
      const priceMap = new Map([
        ['NVDA_2026-10-10', 120.0],
        ['NVDA_2026-10-12', 125.0],
      ])

      // Fecha exacta
      expect(resolveHistoricalPrice('NVDA', '2026-10-12', priceMap)).toBe(125.0)

      // Fecha intermedia (domingo 11 sin cotización): busca hacia atrás al día 10
      expect(resolveHistoricalPrice('NVDA', '2026-10-11', priceMap)).toBe(120.0)

      // Símbolo sin histórico: usa fallback
      expect(resolveHistoricalPrice('AMD', '2026-10-12', priceMap, 140.0)).toBe(140.0)
    })

    it('resolves historical FX rate and falls back gracefully', () => {
      const fxMap = new Map([
        ['USD/MXN_2026-10-10', 19.2],
        ['USD/MXN_2026-10-12', 19.5],
      ])

      expect(resolveHistoricalFxRate('2026-10-12', fxMap)).toBe(19.5)
      expect(resolveHistoricalFxRate('2026-10-11', fxMap)).toBe(19.2)
      expect(resolveHistoricalFxRate('2026-09-01', fxMap, 18.5)).toBe(18.5)
    })
  })

  describe('calculatePortfolioGainSeries', () => {
    it('calculates historical series taking into account only acquired lots up to each date', () => {
      const lots = [
        // Lote 1: comprado el 5 de octubre: 10 acciones de NVDA a $100 USD (10000 cents) = $1,000 USD
        { id: 'l1', symbol: 'NVDA', quantity: 10, priceCents: 10000, costCurrency: 'USD', date: '2026-10-05' },
        // Lote 2: comprado el 15 de octubre: 5 acciones de NVDA a $120 USD (12000 cents) = $600 USD
        { id: 'l2', symbol: 'NVDA', quantity: 5, priceCents: 12000, costCurrency: 'USD', date: '2026-10-15' },
      ]

      const dates = [
        { end: '2026-10-01', label: '01' },
        { end: '2026-10-10', label: '10' },
        { end: '2026-10-20', label: '20' },
      ]

      const priceMap = new Map([
        ['NVDA_2026-10-10', 110.0], // +$10/acción de ganancia
        ['NVDA_2026-10-20', 130.0], // 15 acciones * 130 = $1,950; costo = $1,600
      ])

      const fxMap = new Map([
        ['USD/MXN_2026-10-10', 20.0],
        ['USD/MXN_2026-10-20', 20.0],
      ])

      const series = calculatePortfolioGainSeries({
        lots,
        dates,
        priceHistoryMap: priceMap,
        fxHistoryMap: fxMap,
      })

      expect(series.length).toBe(3)

      // 1 oct: sin lotes adquiridos aún
      expect(series[0].costUSD).toBe(0)
      expect(series[0].valueUSD).toBe(0)
      expect(series[0].gainUSD).toBe(0)

      // 10 oct: solo lote 1 (10 acciones, costo $1,000 USD = 100000 cents). Precio $110 -> valor $1,100 (110000 cents)
      // Ganancia USD = +$100 (10000 cents) = +10%
      expect(series[1].costUSD).toBe(100000)
      expect(series[1].valueUSD).toBe(110000)
      expect(series[1].gainUSD).toBe(10000)
      expect(series[1].gainPctUSD).toBe(10)
      // En MXN con tasa 20.0: costo $20,000, valor $22,000, ganancia $2,000
      expect(series[1].costMXN).toBe(2000000)
      expect(series[1].valueMXN).toBe(2200000)
      expect(series[1].gainMXN).toBe(200000)

      // 20 oct: ambos lotes (15 acciones). Costo $1,600 USD (160000 cents). Precio $130 -> valor $1,950 (195000 cents)
      // Ganancia USD = +$350 (35000 cents) = 21.88%
      expect(series[2].costUSD).toBe(160000)
      expect(series[2].valueUSD).toBe(195000)
      expect(series[2].gainUSD).toBe(35000)
      expect(series[2].gainPctUSD).toBe(21.88)
    })
  })
})

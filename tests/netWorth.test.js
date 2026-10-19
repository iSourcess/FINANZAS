import { describe, it, expect } from 'vitest'
import {
  calculateHoldingPerformance,
  calculateNetWorth,
} from '../src/domain/netWorth.js'

describe('Domain: net worth and investments performance', () => {
  describe('calculateHoldingPerformance', () => {
    it('calculates stock gain in original currency and converts to MXN', () => {
      // 10 acciones de NVDA compradas a $100.00 USD (10000 cents c/u)
      const holding = {
        id: 'h-nvda',
        symbol: 'NVDA',
        name: 'NVIDIA',
        kind: 'stock',
        quantity: 10,
        avgCost: 10000, // $100.00 USD
        costCurrency: 'USD',
      }

      // Precio actual: $120.00 USD con subida de 5.2% en 24h
      const priceInfo = {
        price: 120,
        currency: 'USD',
        change24h: 5.2,
        isStale: false,
      }

      const fxRate = 20.0 // 1 USD = 20 MXN

      const result = calculateHoldingPerformance({ holding, priceInfo, fxRate })

      expect(result.symbol).toBe('NVDA')
      expect(result.quantity).toBe(10)
      expect(result.currentUnitPrice).toBe(120)
      expect(result.change24h).toBe(5.2)
      expect(result.isStale).toBe(false)

      // Total costo orig: 10 * 10000 cents = 100,000 cents ($1,000 USD)
      expect(result.totalCostCentsOrig).toBe(100_000)
      // Total valor orig: 10 * 120 * 100 = 120,000 cents ($1,200 USD)
      expect(result.currentTotalCentsOrig).toBe(120_000)

      // En MXN (con fxRate 20):
      // Costo: $1,000 USD * 20 = $20,000 MXN = 2,000,000 centavos
      expect(result.totalCostCentsMXN).toBe(2_000_000)
      // Valor actual: $1,200 USD * 20 = $24,000 MXN = 2,400,000 centavos
      expect(result.currentTotalCentsMXN).toBe(2_400_000)
      // Ganancia MXN: +$4,000 MXN = 400,000 centavos
      expect(result.gainLossCentsMXN).toBe(400_000)
      // Rendimiento: +20%
      expect(result.gainLossPercent).toBe(20)
    })

    it('calculates crypto fractional quantity and loss correctly', () => {
      // 0.5 BTC comprado a $70,000 USD (7000000 cents)
      const holding = {
        id: 'h-btc',
        symbol: 'BTC',
        name: 'Bitcoin',
        kind: 'crypto',
        quantity: 0.5,
        avgCost: 7_000_000, // $70,000.00 USD
        costCurrency: 'USD',
      }

      // Precio bajó a $63,000 USD (-10%)
      const priceInfo = {
        price: 63_000,
        currency: 'USD',
        change24h: -4.5,
        isStale: true,
      }

      const fxRate = 18.0

      const result = calculateHoldingPerformance({ holding, priceInfo, fxRate })

      expect(result.isStale).toBe(true)
      expect(result.gainLossPercent).toBe(-10)
      // Costo orig: 0.5 * 70,000 = $35,000 USD
      expect(result.totalCostCentsOrig).toBe(3_500_000)
      // Valor orig: 0.5 * 63,000 = $31,500 USD
      expect(result.currentTotalCentsOrig).toBe(3_150_000)
      // Pérdida en MXN: -$3,500 USD * 18 = -$63,000 MXN (-6,300,000 centavos)
      expect(result.gainLossCentsMXN).toBe(-6_300_000)
    })
  })

  describe('calculateNetWorth', () => {
    it('computes total net worth = efectivo + débito + inversiones − deuda', () => {
      const accounts = [
        { type: 'cash', balance: 500_000, currency: 'MXN' }, // $5,000 MXN
        { type: 'debit', balance: 2_000_000, currency: 'MXN' }, // $20,000 MXN
        { type: 'savings', balance: 500_000, currency: 'MXN' }, // $5,000 MXN
        { type: 'credit', balance: 800_000, currency: 'MXN' }, // $8,000 MXN de deuda
      ]

      const holdings = [
        {
          id: 'h1',
          symbol: 'NFLX',
          kind: 'stock',
          quantity: 2,
          avgCost: 60000, // $600 USD
          costCurrency: 'USD',
        },
      ]

      const priceMap = {
        NFLX: { price: 700, currency: 'USD', change24h: 1.5, isStale: false },
      }

      const fxRate = 20.0

      const netWorth = calculateNetWorth({
        accounts,
        holdings,
        priceMap,
        fxRate,
      })

      // Efectivo: $5,000 = 500,000 centavos
      expect(netWorth.cashCents).toBe(500_000)
      // Débito + Ahorro: $20,000 + $5,000 = $25,000 = 2,500,000 centavos
      expect(netWorth.debitCents).toBe(2_500_000)
      // Deuda: $8,000 = 800,000 centavos
      expect(netWorth.debtCents).toBe(800_000)

      // Inversión: 2 * 700 USD = 1,400 USD * 20 MXN = $28,000 MXN = 2,800,000 centavos
      expect(netWorth.investmentsCents).toBe(2_800_000)

      // Patrimonio total = Efectivo ($5,000) + Débito ($25,000) + Inversiones ($28,000) - Deuda ($8,000)
      // = $50,000 MXN = 5,000,000 centavos
      expect(netWorth.netWorthCents).toBe(5_000_000)
    })

    it('handles USD accounts properly by converting with fxRate', () => {
      const accounts = [
        { type: 'cash', balance: 100_00, currency: 'USD' }, // $100 USD * 20 = $2,000 MXN
        { type: 'credit', balance: 50_00, currency: 'USD' }, // $50 USD deuda * 20 = $1,000 MXN
      ]

      const netWorth = calculateNetWorth({
        accounts,
        holdings: [],
        priceMap: {},
        fxRate: 20,
      })

      expect(netWorth.cashCents).toBe(200_000)
      expect(netWorth.debtCents).toBe(100_000)
      expect(netWorth.netWorthCents).toBe(100_000) // $1,000 MXN
    })

    it('ignores hidden accounts', () => {
      const accounts = [
        { type: 'cash', balance: 100_000, currency: 'MXN', hidden: true },
        { type: 'cash', balance: 200_000, currency: 'MXN', hidden: false },
      ]

      const netWorth = calculateNetWorth({ accounts })
      expect(netWorth.cashCents).toBe(200_000)
    })
  })
})

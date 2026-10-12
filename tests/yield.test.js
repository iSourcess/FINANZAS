import { describe, it, expect } from 'vitest'
import {
  calculateEffectiveRate,
  calculateTierSlices,
  calculateDailyInterest,
  calculateTurboYield,
  calculateAccountYield,
  getCapStatus,
  TURBO_CAP_CENTS,
} from '../src/domain/yield.js'

describe('Domain: yield calculations', () => {
  describe('calculateEffectiveRate (TEA / GAT)', () => {
    it('calculates effective rate for 13% nominal compounding daily', () => {
      const rate = calculateEffectiveRate(0.13)
      // (1 + 0.13/365)^365 - 1 ≈ 0.138828 (13.88% o ~13.9%)
      expect(rate).toBeGreaterThan(0.138)
      expect(rate).toBeLessThan(0.139)
    })

    it('calculates effective rate for 15% nominal compounding daily', () => {
      const rate = calculateEffectiveRate(0.15)
      // ≈ 0.1618 (16.18%)
      expect(rate).toBeGreaterThan(0.161)
      expect(rate).toBeLessThan(0.162)
    })

    it('returns 0 for 0% rate', () => {
      expect(calculateEffectiveRate(0)).toBe(0)
    })
  })

  describe('Nu Cajita Turbo', () => {
    it('calculates yield for exactly $25,000 (2,500,000 cents) at 13%', () => {
      const result = calculateTurboYield({
        principalCents: 2_500_000,
        accumulatedInterestCents: 0,
        rate: 0.13,
      })

      // Interés diario esperado: $25,000 * 0.13 / 365 = 8.9041 MXN -> ~890.41 centavos
      const dailyPesos = result.dailyCents / 100
      expect(dailyPesos).toBeCloseTo(8.904, 2)

      // Anual nominal: $3,250.00 MXN (325,000 centavos)
      expect(result.annualNominalCents).toBeCloseTo(325000, 0)

      // Tope alcanzado exactamente
      expect(result.capStatus.isOverCap).toBe(false)
      expect(result.capStatus.remainingCents).toBe(0)
      expect(result.capStatus.warningMessage).toBeNull()
    })

    it('handles excess principal above $25,000 with warning and overflow rate', () => {
      // $30,000 total: $25,000 al 13% y $5,000 al 7%
      const result = calculateTurboYield({
        principalCents: 3_000_000,
        accumulatedInterestCents: 0,
        rate: 0.13,
        overflowRate: 0.07,
      })

      // 25k * 0.13 / 365 = 8.9041 MXN/día
      // 5k * 0.07 / 365 = 0.9589 MXN/día
      // Total diario = 9.863 MXN/día (~986.3 centavos)
      const dailyPesos = result.dailyCents / 100
      expect(dailyPesos).toBeCloseTo(9.863, 2)

      expect(result.capStatus.isOverCap).toBe(true)
      expect(result.capStatus.excessCents).toBe(500000) // $5,000 excedente
      expect(result.capStatus.warningMessage).toContain('Superaste el tope de $25,000')
    })

    it('calculates remaining amount to reach cap when balance is under $25,000', () => {
      const result = calculateTurboYield({
        principalCents: 1_000_000, // $10,000
        rate: 0.13,
      })

      expect(result.capStatus.isOverCap).toBe(false)
      expect(result.capStatus.remainingCents).toBe(1_500_000) // Faltan $15,000
    })

    it('compounds accumulated interest at 13%', () => {
      // Capital $25,000 + $1,000 de interés acumulado = $26,000 rindiendo al 13%
      const result = calculateTurboYield({
        principalCents: 2_500_000,
        accumulatedInterestCents: 100_000,
        rate: 0.13,
      })

      // 26,000 * 0.13 / 365 = 9.2602 MXN/día
      const dailyPesos = result.dailyCents / 100
      expect(dailyPesos).toBeCloseTo(9.26, 2)
    })
  })

  describe('Revolut tiered yield (15% up to $25k, 7% up to $1M)', () => {
    const revolutTiers = [
      { upTo: 2_500_000, rate: 0.15 },
      { upTo: 100_000_000, rate: 0.07 },
    ]

    it('calculates full 15% rate when under $25,000', () => {
      // $20,000 MXN -> 20,000 * 0.15 / 365 = 8.219 MXN/día
      const result = calculateAccountYield({
        balanceCents: 2_000_000,
        yieldTiers: revolutTiers,
      })

      const dailyPesos = result.dailyCents / 100
      expect(dailyPesos).toBeCloseTo(8.219, 2)
      expect(result.weightedNominalRate).toBe(0.15)
      expect(result.capStatus.remainingCents).toBe(500000) // Faltan $5k
    })

    it('calculates mixed rate across tier boundary ($35,000)', () => {
      // $25,000 al 15% (10.274 MXN/día) + $10,000 al 7% (1.918 MXN/día) = 12.192 MXN/día
      const result = calculateAccountYield({
        balanceCents: 3_500_000,
        yieldTiers: revolutTiers,
      })

      const dailyPesos = result.dailyCents / 100
      expect(dailyPesos).toBeCloseTo(12.192, 2)
      expect(result.capStatus.isOverCap).toBe(true)
    })
  })

  describe('Mercado Pago tiered yield (12% up to $25k, 6% excess)', () => {
    const mpTiers = [
      { upTo: 2_500_000, rate: 0.12 },
      { upTo: null, rate: 0.06 },
    ]

    it('calculates mixed rate for $50,000', () => {
      // 25k * 0.12 / 365 = 8.219 MXN
      // 25k * 0.06 / 365 = 4.110 MXN
      // Total = 12.329 MXN/día
      const result = calculateAccountYield({
        balanceCents: 5_000_000,
        yieldTiers: mpTiers,
      })

      const dailyPesos = result.dailyCents / 100
      expect(dailyPesos).toBeCloseTo(12.329, 2)
      // Tasa ponderada = (25*12 + 25*6) / 50 = 9.0%
      expect(result.weightedNominalRate).toBeCloseTo(0.09, 2)
    })
  })

  describe('BBVA Débito (0% yield)', () => {
    it('returns zero for 0% yield tiers', () => {
      const result = calculateAccountYield({
        balanceCents: 10_000_000, // $100k
        yieldTiers: [{ upTo: null, rate: 0 }],
      })

      expect(result.dailyCents).toBe(0)
      expect(result.monthlyCents).toBe(0)
      expect(result.annualNominalCents).toBe(0)
    })
  })
})

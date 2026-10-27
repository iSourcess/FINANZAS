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

    it('handles excess principal above $25,000 with warning and default 0% overflow rate in Turbo', () => {
      // $30,000 total: $25,000 al 13% y $5,000 al 0% (el excedente no rinde en Turbo)
      const result = calculateTurboYield({
        principalCents: 3_000_000,
        accumulatedInterestCents: 0,
        rate: 0.13,
      })

      // 25k * 0.13 / 365 = 8.9041 MXN/día
      // 5k * 0 / 365 = 0 MXN/día
      const dailyPesos = result.dailyCents / 100
      expect(dailyPesos).toBeCloseTo(8.904, 2)

      expect(result.capStatus.isOverCap).toBe(true)
      expect(result.capStatus.excessCents).toBe(500000) // $5,000 excedente
      expect(result.capStatus.warningMessage).toContain('Superaste el tope de depósito de $25,000')
      expect(result.capStatus.warningMessage).toContain('Cajita Ahorro (7%)')
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

    it('infers balance above $25,000 as accumulated interest compounding at 13%', () => {
      const result = calculateAccountYield({
        balanceCents: 2_794_910, // $27,949.10
        yieldTiers: [{ upTo: 2_500_000, rate: 0.13 }],
        yieldCapBase: 'principal',
      })

      // Capital: $25,000
      expect(result.principalCents).toBe(2_500_000)
      // Intereses acumulados: $2,949.10
      expect(result.accumulatedInterestCents).toBe(294_910)
      // Ambos rinden al 13%: 27,949.10 * 0.13 / 365 = 9.954 MXN/día
      const dailyPesos = result.dailyCents / 100
      expect(dailyPesos).toBeCloseTo(9.954, 2)
      // No está sobre el tope de depósito de capital
      expect(result.capStatus.isOverCap).toBe(false)
      expect(result.capStatus.excessCents).toBe(0)
    })
  })

  describe('Nu Cajita Ahorro (7% flat, no cap)', () => {
    it('calculates 7% yield without cap for any balance', () => {
      const result = calculateAccountYield({
        balanceCents: 10_000_000, // $100,000
        yieldTiers: [{ upTo: null, rate: 0.07 }],
      })

      // 100,000 * 0.07 / 365 = 19.178 MXN/día
      const dailyPesos = result.dailyCents / 100
      expect(dailyPesos).toBeCloseTo(19.178, 2)
      expect(result.capStatus.hasCap).toBe(false)
      expect(result.capStatus.isOverCap).toBe(false)
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

  describe('Mercado Pago Apartados (15% up to $25k, 5.3% excess)', () => {
    const mpTiers = [
      { upTo: 2_500_000, rate: 0.15 },
      { upTo: null, rate: 0.053 },
    ]

    it('calculates mixed rate for $50,000', () => {
      // 25k * 0.15 / 365 = 10.274 MXN
      // 25k * 0.053 / 365 = 3.630 MXN
      // Total = 13.904 MXN/día
      const result = calculateAccountYield({
        balanceCents: 5_000_000,
        yieldTiers: mpTiers,
      })

      const dailyPesos = result.dailyCents / 100
      expect(dailyPesos).toBeCloseTo(13.904, 2)
      // Tasa ponderada = (25*0.15 + 25*0.053) / 50 = 10.15%
      expect(result.weightedNominalRate).toBeCloseTo(0.1015, 3)
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

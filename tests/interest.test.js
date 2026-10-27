import { describe, it, expect } from 'vitest'
import {
  reconstructHistoricalBalance,
  calculateHistoricalInterest,
  projectInterest,
} from '../src/domain/interest.js'

describe('Domain: Historical Interest and Projection', () => {
  describe('reconstructHistoricalBalance', () => {
    it('returns current balance if there are no movements', () => {
      const account = {
        id: 'acc-1',
        type: 'debit',
        balance: 100_000, // $1,000.00
        createdAt: '2026-01-01T00:00:00.000Z',
      }

      const balance = reconstructHistoricalBalance(account, [], '2026-10-20')
      expect(balance).toBe(100_000)
    })

    it('returns 0 if target date is prior to account creation', () => {
      const account = {
        id: 'acc-1',
        type: 'debit',
        balance: 100_000,
        createdAt: '2026-06-01T12:00:00.000Z',
      }

      const balance = reconstructHistoricalBalance(account, [], '2026-05-15')
      expect(balance).toBe(0)
    })

    it('subtracts posterior income and adds posterior expense to reconstruct past balance', () => {
      const account = {
        id: 'acc-1',
        type: 'debit',
        balance: 150_000, // $1,500.00 today
        createdAt: '2026-01-01T00:00:00.000Z',
      }

      const movements = [
        // Posterior income on Oct 22: +$500.00
        {
          id: 'm1',
          accountId: 'acc-1',
          type: 'income',
          amount: 50_000,
          date: '2026-10-22',
        },
        // Posterior expense on Oct 24: -$200.00
        {
          id: 'm2',
          accountId: 'acc-1',
          type: 'expense',
          amount: 20_000,
          date: '2026-10-24',
        },
        // Past expense on Oct 10: -$100.00 (should not affect Oct 20 balance)
        {
          id: 'm3',
          accountId: 'acc-1',
          type: 'expense',
          amount: 10_000,
          date: '2026-10-10',
        },
      ]

      // Prior to Oct 22 and 24:
      // balance(2026-10-20) = 150,000 - (+50,000 - 20,000) = 150,000 - 30,000 = 120,000
      const balance = reconstructHistoricalBalance(account, movements, '2026-10-20')
      expect(balance).toBe(120_000)
    })
  })

  describe('calculateHistoricalInterest', () => {
    it('calculates historical interest for a single account with single tier', () => {
      const account = {
        id: 'acc-revolut',
        name: 'Revolut',
        type: 'debit',
        themeKey: 'revolut',
        balance: 1_000_000, // $10,000.00
        yieldTiers: [{ upTo: null, rate: 0.10 }], // 10% anual
        createdAt: '2026-01-01T00:00:00.000Z',
      }

      const buckets = [
        { start: '2026-10-01', end: '2026-10-01', label: '01' },
        { start: '2026-10-02', end: '2026-10-02', label: '02' },
      ]

      const refDate = new Date(2026, 9, 5) // Oct 5, 2026 (both buckets in past)
      const res = calculateHistoricalInterest({
        accounts: [account],
        movements: [],
        buckets,
        referenceDate: refDate,
      })

      // Daily interest: 1,000,000 * 0.10 / 365 = 273.97 cents/day
      // 2 days -> ~548 cents
      expect(res.totalPeriodInterestCents).toBe(548)
      expect(res.bucketSeries[0].pastInterestCents).toBe(274)
      expect(res.bucketSeries[1].pastInterestCents).toBe(274)
      expect(res.byAccountSummary[0].totalInterestCents).toBe(548)
    })

    it('respects tiered rates for Revolut crossing $25,000 threshold', () => {
      const account = {
        id: 'acc-revolut',
        name: 'Revolut',
        type: 'debit',
        themeKey: 'revolut',
        balance: 3_500_000, // $35,000.00: $25,000 at 15%, $10,000 at 7%
        yieldTiers: [
          { upTo: 2_500_000, rate: 0.15 },
          { upTo: 100_000_000, rate: 0.07 },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
      }

      const buckets = [{ start: '2026-10-01', end: '2026-10-01', label: '01' }]
      const refDate = new Date(2026, 9, 5)

      const res = calculateHistoricalInterest({
        accounts: [account],
        movements: [],
        buckets,
        referenceDate: refDate,
      })

      // Expected daily: (2,500,000 * 0.15 / 365) + (1,000,000 * 0.07 / 365)
      // = 1027.397 + 191.78 = 1219.178 cents -> rounded to 1219
      expect(res.totalPeriodInterestCents).toBe(1219)
    })

    it('calculates Nu Cajita Turbo respecting cap and accumulated interest (excess at 0%)', () => {
      const account = {
        id: 'acc-turbo',
        name: 'Nu Cajita Turbo',
        type: 'savings',
        themeKey: 'nu',
        yieldCapBase: 'principal',
        isTurbo: true,
        balance: 3_000_000, // $30,000.00 ($25k capped + $5k excess)
        accumulatedInterestCents: 50_000, // $500.00 interest compounded at 13%
        yieldTiers: [
          { upTo: 2_500_000, rate: 0.13 },
        ],
        createdAt: '2026-01-01T00:00:00.000Z',
      }

      const buckets = [{ start: '2026-10-01', end: '2026-10-01', label: '01' }]
      const refDate = new Date(2026, 9, 5)

      const res = calculateHistoricalInterest({
        accounts: [account],
        movements: [],
        buckets,
        referenceDate: refDate,
      })

      // Base at 13%: $25,000 + $500 = $25,500 (2,550,000 cents) -> 2,550,000 * 0.13 / 365 = 908.219
      // Base at 0%: $5,000 (500,000 cents) -> 0
      // Total daily: 908 cents
      expect(res.totalPeriodInterestCents).toBe(908)
    })
  })

  describe('projectInterest', () => {
    it('matches closed-form compounding formula for 365 days: A = P * (1 + r/365)^365', () => {
      const principal = 1_000_000 // $10,000.00
      const rate = 0.12 // 12%
      const account = {
        id: 'acc-simple',
        name: 'Ahorro',
        balance: principal,
        yieldTiers: [{ upTo: null, rate }],
      }

      const projection = projectInterest([account], 365, 0)

      // Closed form:
      const expectedA = principal * Math.pow(1 + rate / 365, 365)
      const expectedInterest = Math.round(expectedA - principal)

      // Should match within +/- 2 cents due to daily rounding in steps
      expect(Math.abs(projection.totalInterestCents - expectedInterest)).toBeLessThanOrEqual(2)
      expect(Math.abs(projection.finalBalanceCents - Math.round(expectedA))).toBeLessThanOrEqual(2)
      expect(projection.monthlyBuckets.length).toBe(13) // 365 / 30 = 12 full + remainder
    })

    it('compounds Nu Cajita Turbo with $25k cap and compound interest', () => {
      const account = {
        id: 'acc-nu',
        name: 'Cajita Turbo',
        themeKey: 'nu',
        yieldCapBase: 'principal',
        isTurbo: true,
        balance: 2_500_000, // Exactly $25,000
        yieldTiers: [
          { upTo: 2_500_000, rate: 0.13 },
        ],
      }

      // 30 days projection
      const projection = projectInterest([account], 30, 0)
      expect(projection.totalInterestCents).toBeGreaterThan(0)
      expect(projection.finalBalanceCents).toBe(2_500_000 + projection.totalInterestCents)
    })

    it('incorporates monthly contributions every 30 days', () => {
      const account = {
        id: 'acc-contrib',
        name: 'Ahorro',
        balance: 500_000,
        yieldTiers: [{ upTo: null, rate: 0.10 }],
      }

      const withContrib = projectInterest([account], 90, 100_000) // $1,000 added every 30d
      const withoutContrib = projectInterest([account], 90, 0)

      expect(withContrib.totalInterestCents).toBeGreaterThan(withoutContrib.totalInterestCents)
      // Final balance should include initial + 2 contributions (at day 31 and day 61) + interest
      expect(withContrib.finalBalanceCents).toBeGreaterThan(500_000 + 200_000)
    })
  })
})

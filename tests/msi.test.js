import { describe, it, expect } from 'vitest'
import {
  generateMsiSchedule,
  calculateMsiProgress,
  calculatePendingMsiDebt,
  ALLOWED_MSI_MONTHS,
} from '../src/domain/msi.js'

describe('Domain: Meses Sin Intereses (MSI)', () => {
  describe('generateMsiSchedule', () => {
    it('divides exact amount into equal monthly payments', () => {
      // $12,000 MXN en 12 meses -> $1,000 cada mes (100,000 centavos)
      const schedule = generateMsiSchedule(1_200_000, 12, '2026-10-15')

      expect(schedule.length).toBe(12)
      schedule.forEach(payment => {
        expect(payment.amountCents).toBe(100_000)
      })

      const total = schedule.reduce((sum, p) => sum + p.amountCents, 0)
      expect(total).toBe(1_200_000)
    })

    it('makes the last payment absorb the remainder cents', () => {
      // $100.00 MXN (10,000 centavos) en 3 meses
      // 10,000 / 3 = 3,333 con resto de 1
      const schedule = generateMsiSchedule(10_000, 3, '2026-10-15')

      expect(schedule.length).toBe(3)
      expect(schedule[0].amountCents).toBe(3333)
      expect(schedule[1].amountCents).toBe(3333)
      expect(schedule[2].amountCents).toBe(3334) // Absorbe el centavo restante

      const total = schedule.reduce((sum, p) => sum + p.amountCents, 0)
      expect(total).toBe(10_000)
    })

    it('verifies allowed MSI month options', () => {
      expect(ALLOWED_MSI_MONTHS).toEqual([3, 6, 9, 12, 18, 24])
    })
  })

  describe('calculateMsiProgress and calculatePendingMsiDebt', () => {
    it('calculates progress in the first month (pago 1 de 6)', () => {
      const movement = {
        amount: 600_000, // $6,000
        date: '2026-10-10',
        msi: {
          months: 6,
          startDate: '2026-10-10',
          monthlyAmount: 100_000,
        },
      }

      // Referencia en el mismo mes de la compra (octubre 2026)
      const progress = calculateMsiProgress(movement, new Date(2026, 9, 15))

      expect(progress.paidMonths).toBe(1)
      expect(progress.remainingMonths).toBe(5)
      expect(progress.remainingDebtCents).toBe(500_000) // $5,000 restante
      expect(progress.isCompleted).toBe(false)
      expect(progress.progressPercent).toBe(17) // 1 de 6 ≈ 17%
    })

    it('calculates progress 3 months later (pago 4 de 6)', () => {
      const movement = {
        amount: 600_000,
        date: '2026-10-10',
        msi: {
          months: 6,
          startDate: '2026-10-10',
          monthlyAmount: 100_000,
        },
      }

      // Enero 2027 (3 meses después de octubre)
      const progress = calculateMsiProgress(movement, new Date(2027, 0, 15))

      expect(progress.paidMonths).toBe(4)
      expect(progress.remainingMonths).toBe(2)
      expect(progress.remainingDebtCents).toBe(200_000)
    })

    it('marks as completed when all months have elapsed', () => {
      const movement = {
        amount: 300_000,
        date: '2026-01-10',
        msi: {
          months: 3,
          startDate: '2026-01-10',
          monthlyAmount: 100_000,
        },
      }

      // Junio 2026 (más de 3 meses después)
      const progress = calculateMsiProgress(movement, new Date(2026, 5, 15))

      expect(progress.paidMonths).toBe(3)
      expect(progress.remainingMonths).toBe(0)
      expect(progress.remainingDebtCents).toBe(0)
      expect(progress.isCompleted).toBe(true)
      expect(progress.progressPercent).toBe(100)
    })

    it('calculates total pending MSI debt across multiple movements for a card', () => {
      const movements = [
        {
          id: 'm1',
          accountId: 'card-1',
          type: 'expense',
          amount: 600_000,
          date: '2026-10-10',
          msi: { months: 6, startDate: '2026-10-10', monthlyAmount: 100_000 },
        },
        {
          id: 'm2',
          accountId: 'card-1',
          type: 'expense',
          amount: 120_000,
          date: '2026-10-12',
          msi: { months: 3, startDate: '2026-10-12', monthlyAmount: 40_000 },
        },
        {
          id: 'm3',
          accountId: 'card-2', // Otra tarjeta
          type: 'expense',
          amount: 500_000,
          msi: { months: 5, startDate: '2026-10-10', monthlyAmount: 100_000 },
        },
      ]

      // En octubre 2026:
      // m1: 5 meses restantes * 100,000 = 500,000
      // m2: 2 meses restantes * 40,000 = 80,000
      // Total pendiente para card-1 = 580,000
      const totalPending = calculatePendingMsiDebt(movements, 'card-1', new Date(2026, 9, 15))
      expect(totalPending).toBe(580_000)
    })
  })
})

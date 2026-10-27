import { describe, it, expect } from 'vitest'
import {
  validateGoal,
  validateContribution,
  calculateGoalProgress,
  calculateAllGoalsSummary,
} from '../src/domain/goals.js'

describe('Domain: Savings Goals (Metas de Ahorro)', () => {
  describe('validateGoal', () => {
    it('approves a valid goal with date', () => {
      const res = validateGoal({
        name: 'Fondo de emergencia',
        targetAmount: 5000000, // $50,000.00
        targetDate: '2026-12-31',
      })
      expect(res.isValid).toBe(true)
    })

    it('approves a valid goal without date', () => {
      const res = validateGoal({
        name: 'Viaje a Japón',
        targetAmount: 8000000,
        targetDate: null,
      })
      expect(res.isValid).toBe(true)
    })

    it('rejects an empty name', () => {
      const res = validateGoal({
        name: '   ',
        targetAmount: 500000,
      })
      expect(res.isValid).toBe(false)
      expect(res.error).toContain('nombre')
    })

    it('rejects target amount <= 0 or non-number', () => {
      expect(validateGoal({ name: 'Auto', targetAmount: 0 }).isValid).toBe(false)
      expect(validateGoal({ name: 'Auto', targetAmount: -100 }).isValid).toBe(false)
      expect(validateGoal({ name: 'Auto', targetAmount: 'abc' }).isValid).toBe(false)
    })

    it('rejects an invalid targetDate format', () => {
      const res = validateGoal({
        name: 'Auto',
        targetAmount: 100000,
        targetDate: '31/12/2026',
      })
      expect(res.isValid).toBe(false)
      expect(res.error).toContain('YYYY-MM-DD')
    })
  })

  describe('validateContribution', () => {
    it('approves a valid contribution linked to an account', () => {
      const res = validateContribution({
        goalId: 'goal-123',
        accountId: 'acc-nu',
        amount: 250000, // $2,500.00
        date: '2026-10-26',
      })
      expect(res.isValid).toBe(true)
    })

    it('rejects contribution without accountId (aportes vinculados a una cuenta)', () => {
      const res = validateContribution({
        goalId: 'goal-123',
        accountId: '',
        amount: 250000,
        date: '2026-10-26',
      })
      expect(res.isValid).toBe(false)
      expect(res.error).toContain('cuenta')
    })

    it('rejects contribution without goalId', () => {
      const res = validateContribution({
        goalId: '',
        accountId: 'acc-nu',
        amount: 250000,
        date: '2026-10-26',
      })
      expect(res.isValid).toBe(false)
      expect(res.error).toContain('meta')
    })

    it('rejects contribution with amount <= 0', () => {
      const res = validateContribution({
        goalId: 'goal-123',
        accountId: 'acc-nu',
        amount: 0,
        date: '2026-10-26',
      })
      expect(res.isValid).toBe(false)
      expect(res.error).toContain('mayor a cero')
    })

    it('rejects invalid date format', () => {
      const res = validateContribution({
        goalId: 'goal-123',
        accountId: 'acc-nu',
        amount: 50000,
        date: 'octubre 2026',
      })
      expect(res.isValid).toBe(false)
    })
  })

  describe('calculateGoalProgress', () => {
    const goal = {
      id: 'g1',
      name: 'Fondo de Emergencia',
      targetAmount: 1000000, // $10,000.00
      targetDate: '2026-12-01',
    }

    it('handles goal with 0 contributions', () => {
      const prog = calculateGoalProgress({
        goal,
        contributions: [],
        referenceDate: '2026-10-01',
      })

      expect(prog.savedAmount).toBe(0)
      expect(prog.remainingAmount).toBe(1000000)
      expect(prog.percent).toBe(0)
      expect(prog.clampedPercent).toBe(0)
      expect(prog.isCompleted).toBe(false)
      expect(prog.isOverdue).toBe(false)
      expect(prog.contributionsCount).toBe(0)
      expect(prog.contributionsByAccount).toHaveLength(0)
      expect(prog.daysRemaining).toBe(61) // Oct 1 to Dec 1
      expect(prog.monthsRemaining).toBe(2)
      expect(prog.suggestedMonthlySavings).toBe(500000)
    })

    it('aggregates contributions and groups by account', () => {
      const contributions = [
        { id: 'c1', goalId: 'g1', accountId: 'acc-nu', amount: 300000, date: '2026-10-05' },
        { id: 'c2', goalId: 'g1', accountId: 'acc-bbva', amount: 200000, date: '2026-10-10' },
        { id: 'c3', goalId: 'g1', accountId: 'acc-nu', amount: 150000, date: '2026-10-15' },
        { id: 'c4', goalId: 'other-goal', accountId: 'acc-nu', amount: 999999, date: '2026-10-20' },
      ]

      const prog = calculateGoalProgress({
        goal,
        contributions,
        referenceDate: '2026-10-01',
      })

      expect(prog.savedAmount).toBe(650000) // $6,500.00 (300k + 200k + 150k)
      expect(prog.remainingAmount).toBe(350000) // $3,500.00
      expect(prog.percent).toBe(65)
      expect(prog.clampedPercent).toBe(65)
      expect(prog.isCompleted).toBe(false)
      expect(prog.contributionsCount).toBe(3)

      // Verificación de cuentas vinculadas
      const nuAccount = prog.contributionsByAccount.find(a => a.accountId === 'acc-nu')
      const bbvaAccount = prog.contributionsByAccount.find(a => a.accountId === 'acc-bbva')
      expect(nuAccount).toEqual({ accountId: 'acc-nu', totalCents: 450000, count: 2 })
      expect(bbvaAccount).toEqual({ accountId: 'acc-bbva', totalCents: 200000, count: 1 })
    })

    it('marks as completed when savedAmount >= targetAmount and clamps percent', () => {
      const contributions = [
        { id: 'c1', goalId: 'g1', accountId: 'acc-nu', amount: 1200000, date: '2026-10-05' }, // 120%
      ]

      const prog = calculateGoalProgress({
        goal,
        contributions,
        referenceDate: '2026-10-01',
      })

      expect(prog.savedAmount).toBe(1200000)
      expect(prog.remainingAmount).toBe(0)
      expect(prog.percent).toBe(120)
      expect(prog.clampedPercent).toBe(100)
      expect(prog.isCompleted).toBe(true)
      expect(prog.isOverdue).toBe(false)
    })

    it('marks as overdue if targetDate has passed and goal is not completed', () => {
      const contributions = [
        { id: 'c1', goalId: 'g1', accountId: 'acc-nu', amount: 200000, date: '2026-10-05' },
      ]

      const prog = calculateGoalProgress({
        goal,
        contributions,
        referenceDate: '2026-12-15', // Después del 2026-12-01
      })

      expect(prog.isCompleted).toBe(false)
      expect(prog.isOverdue).toBe(true)
      expect(prog.daysRemaining).toBeLessThan(0)
    })

    it('does not mark as overdue if targetDate has passed but goal is completed', () => {
      const contributions = [
        { id: 'c1', goalId: 'g1', accountId: 'acc-nu', amount: 1000000, date: '2026-10-05' },
      ]

      const prog = calculateGoalProgress({
        goal,
        contributions,
        referenceDate: '2026-12-15',
      })

      expect(prog.isCompleted).toBe(true)
      expect(prog.isOverdue).toBe(false)
    })

    it('handles goal without targetDate gracefully', () => {
      const openGoal = {
        id: 'g2',
        name: 'Ahorro libre',
        targetAmount: 500000,
        targetDate: null,
      }

      const prog = calculateGoalProgress({
        goal: openGoal,
        contributions: [
          { id: 'c1', goalId: 'g2', accountId: 'acc-efectivo', amount: 100000 },
        ],
      })

      expect(prog.daysRemaining).toBeNull()
      expect(prog.suggestedMonthlySavings).toBeNull()
      expect(prog.isOverdue).toBe(false)
      expect(prog.percent).toBe(20)
    })
  })

  describe('calculateAllGoalsSummary', () => {
    it('aggregates multiple goals correctly', () => {
      const goals = [
        { id: 'g1', name: 'Meta 1', targetAmount: 1000000, targetDate: null }, // $10k
        { id: 'g2', name: 'Meta 2', targetAmount: 500000, targetDate: null },  // $5k
      ]

      const contributions = [
        { id: 'c1', goalId: 'g1', accountId: 'acc-1', amount: 1000000 }, // g1 completada (100%)
        { id: 'c2', goalId: 'g2', accountId: 'acc-2', amount: 200000 },  // g2 al 40% ($2k)
      ]

      const summary = calculateAllGoalsSummary({ goals, contributions })

      expect(summary.totalGoalsCount).toBe(2)
      expect(summary.completedCount).toBe(1)
      expect(summary.activeCount).toBe(1)
      expect(summary.totalTargetCents).toBe(1500000) // $15k
      expect(summary.totalSavedCents).toBe(1200000)  // $12k
      expect(summary.totalRemainingCents).toBe(300000) // $3k
      expect(summary.overallPercent).toBe(80)
      expect(summary.clampedOverallPercent).toBe(80)
      expect(summary.items).toHaveLength(2)
    })

    it('handles empty goals list', () => {
      const summary = calculateAllGoalsSummary({ goals: [], contributions: [] })
      expect(summary.totalGoalsCount).toBe(0)
      expect(summary.totalTargetCents).toBe(0)
      expect(summary.totalSavedCents).toBe(0)
      expect(summary.overallPercent).toBe(0)
      expect(summary.items).toHaveLength(0)
    })
  })
})

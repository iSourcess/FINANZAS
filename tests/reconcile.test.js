import { describe, it, expect } from 'vitest'
import {
  calculateReconcileDelta,
  validateReconcileTurbo,
  formatDaysSinceReconcile,
  getReconcileReasonLabel,
} from '../src/domain/reconcile.js'
import {
  calculateBalanceChange,
  applyMovementToAccount,
  revertMovementFromAccount,
} from '../src/domain/movements.js'
import { calculatePeriodSummaries } from '../src/domain/summaries.js'
import { calculateBudgetsSummary } from '../src/domain/budgets.js'

describe('Domain: Reconcile and Balance Adjustments', () => {
  describe('calculateReconcileDelta', () => {
    it('calculates positive delta when real balance is higher', () => {
      const res = calculateReconcileDelta({
        currentBalanceCents: 100_000, // $1,000.00
        realBalanceCents: 150_000,    // $1,500.00
      })
      expect(res.deltaCents).toBe(50_000)
      expect(res.isZero).toBe(false)
      expect(res.sign).toBe('+')
      expect(res.absDeltaCents).toBe(50_000)
    })

    it('calculates negative delta when real balance is lower', () => {
      const res = calculateReconcileDelta({
        currentBalanceCents: 200_000, // $2,000.00
        realBalanceCents: 180_000,    // $1,800.00
      })
      expect(res.deltaCents).toBe(-20_000)
      expect(res.isZero).toBe(false)
      expect(res.sign).toBe('-')
      expect(res.absDeltaCents).toBe(20_000)
    })

    it('detects zero delta when balances match exactly', () => {
      const res = calculateReconcileDelta({
        currentBalanceCents: 250_000,
        realBalanceCents: 250_000,
      })
      expect(res.deltaCents).toBe(0)
      expect(res.isZero).toBe(true)
      expect(res.sign).toBe('')
      expect(res.absDeltaCents).toBe(0)
    })
  })

  describe('Effect on account balances (apply and revert)', () => {
    it('increases debit account balance for positive adjustment', () => {
      const account = { id: 'acc-1', type: 'debit', balance: 50_000 }
      const movement = {
        type: 'adjustment',
        deltaCents: 20_000, // +$200.00
        amount: 20_000,
      }

      const updated = applyMovementToAccount(account, movement)
      expect(updated.balance).toBe(70_000)

      // Revertir debe regresar exactamente al saldo anterior
      const reverted = revertMovementFromAccount(updated, movement)
      expect(reverted.balance).toBe(50_000)
    })

    it('decreases debit account balance for negative adjustment', () => {
      const account = { id: 'acc-1', type: 'debit', balance: 100_000 }
      const movement = {
        type: 'adjustment',
        deltaCents: -35_000, // -$350.00
        amount: 35_000,
      }

      const updated = applyMovementToAccount(account, movement)
      expect(updated.balance).toBe(65_000)

      const reverted = revertMovementFromAccount(updated, movement)
      expect(reverted.balance).toBe(100_000)
    })

    it('handles credit card direction correctly (balance is debt)', () => {
      // En tarjetas de crédito, balance representa la DEUDA (positivo = debes dinero)
      const creditCard = { id: 'card-1', type: 'credit', balance: 300_000 } // $3,000.00 de deuda

      // Si la deuda real en el banco es $3,500 (+50,000 centavos):
      const addDebtAdj = {
        type: 'adjustment',
        deltaCents: 50_000,
        amount: 50_000,
      }
      const withMoreDebt = applyMovementToAccount(creditCard, addDebtAdj)
      expect(withMoreDebt.balance).toBe(350_000) // Deuda subió a $3,500

      // Revertir regresa a $3,000
      expect(revertMovementFromAccount(withMoreDebt, addDebtAdj).balance).toBe(300_000)

      // Si la deuda real en el banco es $2,400 (-60,000 centavos):
      const lessDebtAdj = {
        type: 'adjustment',
        deltaCents: -60_000,
        amount: 60_000,
      }
      const withLessDebt = applyMovementToAccount(creditCard, lessDebtAdj)
      expect(withLessDebt.balance).toBe(240_000) // Deuda bajó a $2,400
      expect(revertMovementFromAccount(withLessDebt, lessDebtAdj).balance).toBe(300_000)
    })
  })

  describe('Exclusion from summaries, donut, trends and budgets', () => {
    it('excludes adjustment movements from totalIncome, totalExpense and categories breakdown', () => {
      const movements = [
        { id: 'm1', type: 'income', amount: 100_000, currency: 'MXN', date: '2026-10-15' },
        { id: 'm2', type: 'expense', amount: 40_000, currency: 'MXN', categoryId: 'cat-food', date: '2026-10-16' },
        // Ajuste de saldo (+50,000 centavos) no debe contar como ingreso
        { id: 'm3', type: 'adjustment', deltaCents: 50_000, amount: 50_000, currency: 'MXN', date: '2026-10-17' },
        // Ajuste de saldo negativo (-30,000 centavos) no debe contar como gasto
        { id: 'm4', type: 'adjustment', deltaCents: -30_000, amount: 30_000, currency: 'MXN', date: '2026-10-18' },
      ]

      const categories = [{ id: 'cat-food', name: 'Comida' }]

      const summary = calculatePeriodSummaries({
        movements,
        categories,
        startDate: '2026-10-01',
        endDate: '2026-10-31',
      })

      // Solo el ingreso de $1,000.00
      expect(summary.totalIncome).toBe(100_000)
      // Solo el gasto de $400.00
      expect(summary.totalExpense).toBe(40_000)
      // Balance operativo = 100,000 - 40,000 = 60,000
      expect(summary.balance).toBe(60_000)

      // Donut solo contiene el gasto de comida
      expect(summary.categoryBreakdown.length).toBe(1)
      expect(summary.categoryBreakdown[0].categoryId).toBe('cat-food')
      expect(summary.categoryBreakdown[0].amount).toBe(40_000)
    })

    it('excludes adjustment movements from budget limits', () => {
      const budgets = [{ id: 'b1', categoryId: 'cat-food', monthlyLimit: 100_000 }]
      const movements = [
        { id: 'm1', type: 'expense', amount: 50_000, categoryId: 'cat-food' },
        // Ajuste no tiene categoría y no es gasto
        { id: 'm2', type: 'adjustment', deltaCents: 80_000, amount: 80_000, categoryId: 'cat-food' },
      ]

      const res = calculateBudgetsSummary({
        budgets,
        movements,
        categories: [{ id: 'cat-food', name: 'Comida' }],
      })

      // El gasto acumulado debe ser únicamente 50,000 (no 130,000)
      expect(res.totalSpentCents).toBe(50_000)
      expect(res.items[0].spentCents).toBe(50_000)
      expect(res.items[0].isExceeded).toBe(false)
    })
  })

  describe('Nu Cajita Turbo reconciliation rules', () => {
    it('keeps deposited capital and allocates balance above capital to accumulated interest', () => {
      const res = validateReconcileTurbo({
        realBalanceCents: 2_850_000, // $28,500.00
        capitalCents: 2_500_000,    // $25,000.00
      })

      expect(res.effectiveCapitalCents).toBe(2_500_000)
      expect(res.accumulatedInterestCents).toBe(350_000) // $3,500.00
      expect(res.isBelowCapital).toBe(false)
      expect(res.warningMessage).toBeNull()
    })

    it('warns without displaying negative interest when balance is below capital', () => {
      const res = validateReconcileTurbo({
        realBalanceCents: 2_200_000, // $22,000.00
        capitalCents: 2_500_000,    // $25,000.00
      })

      expect(res.effectiveCapitalCents).toBe(2_200_000)
      expect(res.accumulatedInterestCents).toBe(0) // NUNCA negativo
      expect(res.isBelowCapital).toBe(true)
      expect(res.warningMessage).toContain('El saldo es menor al capital configurado')
    })
  })

  describe('formatDaysSinceReconcile', () => {
    it('returns "Sin cuadrar aún" when date is null', () => {
      const res = formatDaysSinceReconcile(null)
      expect(res.text).toBe('Sin cuadrar aún')
      expect(res.hasReconciled).toBe(false)
      expect(res.isWarning).toBe(false)
    })

    it('returns "Cuadrado hoy" for same date', () => {
      const res = formatDaysSinceReconcile('2026-10-26', '2026-10-26')
      expect(res.text).toBe('Cuadrado hoy')
      expect(res.days).toBe(0)
      expect(res.isWarning).toBe(false)
    })

    it('returns "Cuadrado ayer" for 1 day ago', () => {
      const res = formatDaysSinceReconcile('2026-10-25', '2026-10-26')
      expect(res.text).toBe('Cuadrado ayer')
      expect(res.days).toBe(1)
      expect(res.isWarning).toBe(false)
    })

    it('warns when more than 30 days have elapsed', () => {
      const res = formatDaysSinceReconcile('2026-09-01', '2026-10-26')
      expect(res.days).toBeGreaterThan(30)
      expect(res.isWarning).toBe(true)
      expect(res.text).toContain('días')
    })
  })

  describe('Reasons label catalog', () => {
    it('resolves friendly labels in Mexican Spanish', () => {
      expect(getReconcileReasonLabel('reconcile')).toBe('Cuadre / Conciliación')
      expect(getReconcileReasonLabel('fee')).toBe('Comisión bancaria')
      expect(getReconcileReasonLabel('loan_given')).toBe('Préstamo otorgado')
      expect(getReconcileReasonLabel('unknown_reason')).toBe('Ajuste de saldo')
    })
  })
})

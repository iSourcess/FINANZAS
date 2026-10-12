import { describe, it, expect } from 'vitest'
import {
  calculateBudgetStatus,
  calculateBudgetsSummary,
} from '../src/domain/budgets.js'

describe('Domain: budgets and alert levels', () => {
  describe('calculateBudgetStatus', () => {
    it('returns normal alert level below 80%', () => {
      // Gastado: $3,000 (300,000 cents), Límite: $5,000 (500,000 cents) -> 60%
      const status = calculateBudgetStatus(300_000, 500_000)

      expect(status.percent).toBe(60)
      expect(status.alertLevel).toBe('normal')
      expect(status.statusLabel).toBe('Dentro del presupuesto')
      expect(status.remainingCents).toBe(200_000)
      expect(status.excessCents).toBe(0)
    })

    it('returns warning alert level between 80% and 100%', () => {
      // Gastado: $4,200 (420,000 cents), Límite: $5,000 -> 84%
      const status = calculateBudgetStatus(420_000, 500_000)

      expect(status.percent).toBe(84)
      expect(status.alertLevel).toBe('warning')
      expect(status.statusLabel).toContain('Cerca del límite')
      expect(status.remainingCents).toBe(80_000)
    })

    it('returns danger alert level when exceeding 100%', () => {
      // Gastado: $5,500 (550,000 cents), Límite: $5,000 -> 110%
      const status = calculateBudgetStatus(550_000, 500_000)

      expect(status.percent).toBe(110)
      expect(status.alertLevel).toBe('danger')
      expect(status.statusLabel).toBe('Presupuesto excedido')
      expect(status.excessCents).toBe(50_000)
      expect(status.remainingCents).toBe(0)
    })
  })

  describe('calculateBudgetsSummary', () => {
    it('aggregates budget status across multiple categories', () => {
      const categories = [
        { id: 'cat-comida', name: 'Comida', color: '#FF7A1A' },
        { id: 'cat-transporte', name: 'Transporte', color: '#FF9A45' },
      ]

      const budgets = [
        { id: 'b1', categoryId: 'cat-comida', monthlyLimit: 400_000 }, // $4,000
        { id: 'b2', categoryId: 'cat-transporte', monthlyLimit: 200_000 }, // $2,000
      ]

      const movements = [
        { type: 'expense', amount: 350_000, categoryId: 'cat-comida' }, // $3,500 (87.5% -> warning)
        { type: 'expense', amount: 250_000, categoryId: 'cat-transporte' }, // $2,500 (125% -> danger)
        { type: 'income', amount: 1_000_000, categoryId: 'cat-comida' }, // ingresos se ignoran
      ]

      const summary = calculateBudgetsSummary({ budgets, movements, categories })

      expect(summary.totalSpentCents).toBe(600_000)
      expect(summary.totalLimitCents).toBe(600_000)
      expect(summary.overallPercent).toBe(100)
      expect(summary.exceededCount).toBe(1) // Transporte excedido
      expect(summary.warningCount).toBe(1)  // Comida en advertencia

      // Ordenado de mayor porcentaje a menor: Transporte (125%) primero
      expect(summary.items[0].categoryId).toBe('cat-transporte')
      expect(summary.items[1].categoryId).toBe('cat-comida')
    })
  })
})

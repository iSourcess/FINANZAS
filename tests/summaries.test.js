import { describe, it, expect } from 'vitest'
import { calculatePeriodSummaries } from '../src/domain/summaries.js'

describe('Domain: summaries calculations', () => {
  const categories = [
    { id: 'cat-comida', name: 'Comida', color: '#FF7A1A' },
    { id: 'cat-transporte', name: 'Transporte', color: '#FF9A45' },
    { id: 'cat-sueldo', name: 'Sueldo', color: '#FFE0C0' },
  ]

  const movements = [
    // Periodo actual (octubre 2026)
    { id: 'm1', type: 'income', amount: 1500000, currency: 'MXN', date: '2026-10-01', categoryId: 'cat-sueldo' }, // +$15,000
    { id: 'm2', type: 'expense', amount: 300000, currency: 'MXN', date: '2026-10-05', categoryId: 'cat-comida' },  // -$3,000
    { id: 'm3', type: 'expense', amount: 100000, currency: 'MXN', date: '2026-10-10', categoryId: 'cat-transporte' }, // -$1,000
    { id: 'm4', type: 'transfer', amount: 50000, currency: 'MXN', date: '2026-10-12', accountId: 'a1', toAccountId: 'a2' }, // transferencia (ignorar)
    { id: 'm5', type: 'expense', amount: 1000, currency: 'USD', fxRate: 20.0, date: '2026-10-15', categoryId: 'cat-comida' }, // $10.00 USD * 20 = +$200 MXN (20000 cents)

    // Periodo anterior (septiembre 2026)
    { id: 'm6', type: 'income', amount: 1200000, currency: 'MXN', date: '2026-09-01', categoryId: 'cat-sueldo' }, // +$12,000
    { id: 'm7', type: 'expense', amount: 200000, currency: 'MXN', date: '2026-09-15', categoryId: 'cat-comida' }, // -$2,000
  ]

  it('calculates income, expense and balance correctly excluding transfers', () => {
    const summary = calculatePeriodSummaries({
      movements,
      categories,
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      prevStartDate: '2026-09-01',
      prevEndDate: '2026-09-30',
    })

    // Income: $15,000 MXN (1,500,000 cents)
    expect(summary.totalIncome).toBe(1500000)

    // Expense: $3,000 + $1,000 + $200 (USD convertido) = $4,200 MXN (420,000 cents)
    expect(summary.totalExpense).toBe(420000)

    // Balance: $15,000 - $4,200 = $10,800 MXN (1,080,000 cents)
    expect(summary.balance).toBe(1080000)
  })

  it('calculates category breakdown percentages and sort order', () => {
    const summary = calculatePeriodSummaries({
      movements,
      categories,
      startDate: '2026-10-01',
      endDate: '2026-10-31',
    })

    expect(summary.categoryBreakdown.length).toBe(2)
    // Comida ($3,200) > Transporte ($1,000)
    expect(summary.categoryBreakdown[0].categoryId).toBe('cat-comida')
    expect(summary.categoryBreakdown[0].amount).toBe(320000)
    expect(summary.categoryBreakdown[1].categoryId).toBe('cat-transporte')
    expect(summary.categoryBreakdown[1].amount).toBe(100000)

    // Porcentajes suman ~100%
    const totalPct = summary.categoryBreakdown.reduce((acc, c) => acc + c.percentage, 0)
    expect(Math.round(totalPct)).toBe(100)
  })

  it('calculates comparison with previous period', () => {
    const summary = calculatePeriodSummaries({
      movements,
      categories,
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      prevStartDate: '2026-09-01',
      prevEndDate: '2026-09-30',
    })

    expect(summary.hasPrevPeriod).toBe(true)
    expect(summary.previous.totalIncome).toBe(1200000)
    expect(summary.previous.totalExpense).toBe(200000)

    // Ingresos subieron de 12k a 15k (+25%)
    expect(summary.comparison.income.percent).toBe(25)
    expect(summary.comparison.income.diff).toBe(300000)
    expect(summary.comparison.income.noPrevData).toBe(false)
  })

  it('marks noPrevData as true when previous period has no data (total 0) instead of +100%', () => {
    // Solo movimientos en el periodo actual, ninguno en el periodo anterior
    const currentOnlyMovements = [
      { id: 'm1', type: 'income', amount: 1000000, currency: 'MXN', date: '2026-10-01' },
      { id: 'm2', type: 'expense', amount: 500000, currency: 'MXN', date: '2026-10-05' },
    ]

    const summary = calculatePeriodSummaries({
      movements: currentOnlyMovements,
      categories,
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      prevStartDate: '2026-09-01',
      prevEndDate: '2026-09-30',
    })

    expect(summary.hasPrevPeriod).toBe(true)
    expect(summary.previous.totalIncome).toBe(0)
    expect(summary.previous.totalExpense).toBe(0)

    // Al no haber datos en el periodo anterior, no debe mostrar +100% sino noPrevData: true
    expect(summary.comparison.income.noPrevData).toBe(true)
    expect(summary.comparison.income.percent).toBe(0)
    expect(summary.comparison.income.diff).toBe(1000000)

    expect(summary.comparison.expense.noPrevData).toBe(true)
    expect(summary.comparison.expense.percent).toBe(0)
    expect(summary.comparison.expense.diff).toBe(500000)
  })
})


import { describe, it, expect } from 'vitest'
import {
  getPendingRecurringExpenses,
  createMovementFromFixedExpense,
} from '../src/domain/recurring.js'

describe('Domain: recurring fixed expenses', () => {
  const fixedExpenses = [
    {
      id: 'fix-netflix',
      name: 'Netflix',
      amount: 21900, // $219.00
      currency: 'MXN',
      categoryId: 'cat-servicios',
      accountId: 'acc-nu',
      dayOfMonth: 15,
      active: true,
    },
    {
      id: 'fix-internet',
      name: 'Internet Totalplay',
      amount: 60000, // $600.00
      currency: 'MXN',
      categoryId: 'cat-servicios',
      accountId: 'acc-bbva',
      dayOfMonth: 5,
      active: true,
    },
    {
      id: 'fix-gym',
      name: 'Gimnasio',
      amount: 50000,
      currency: 'MXN',
      categoryId: 'cat-salud',
      accountId: 'acc-nu',
      dayOfMonth: 1,
      active: false, // Inactivo
    },
  ]

  it('identifies pending fixed expenses for the month without duplicating already generated ones', () => {
    // Supongamos que hoy es 12 de octubre de 2026
    const refDate = new Date(2026, 9, 12)

    // Internet Totalplay ya fue pagado/generado el 5 de octubre de 2026
    const movements = [
      {
        id: 'mov-1',
        type: 'expense',
        amount: 60000,
        date: '2026-10-05',
        fixedId: 'fix-internet', // Ya generado este mes
      },
    ]

    const pending = getPendingRecurringExpenses({
      fixedExpenses,
      movements,
      referenceDate: refDate,
    })

    // Solo debe estar pendiente Netflix (Internet ya se pagó este mes, y Gimnasio está inactivo)
    expect(pending.length).toBe(1)
    expect(pending[0].fixedExpense.id).toBe('fix-netflix')
    expect(pending[0].dueDate).toBe('2026-10-15')
    expect(pending[0].daysRemaining).toBe(3) // 12 al 15 = 3 días
    expect(pending[0].isOverdue).toBe(false)
  })

  it('detects overdue recurring expenses', () => {
    // Supongamos que hoy es 20 de octubre de 2026 y Netflix venció el 15
    const refDate = new Date(2026, 9, 20)
    const movements = [] // Ninguno pagado

    const pending = getPendingRecurringExpenses({
      fixedExpenses,
      movements,
      referenceDate: refDate,
    })

    const netflix = pending.find(p => p.fixedExpense.id === 'fix-netflix')
    expect(netflix.isOverdue).toBe(true)
  })

  it('creates valid movement payload from fixed expense', () => {
    const fixed = fixedExpenses[0]
    const movement = createMovementFromFixedExpense(fixed, '2026-10-15')

    expect(movement.type).toBe('expense')
    expect(movement.amount).toBe(21900)
    expect(movement.categoryId).toBe('cat-servicios')
    expect(movement.accountId).toBe('acc-nu')
    expect(movement.fixedId).toBe('fix-netflix')
    expect(movement.note).toBe('Netflix')
    expect(movement.date).toBe('2026-10-15')
  })
})

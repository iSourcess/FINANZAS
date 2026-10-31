import { describe, it, expect } from 'vitest'
import { validateBackupJSON } from '../src/services/backup.js'

describe('Services: backup and validation', () => {
  it('validates a correct backup JSON with complete structure', () => {
    const validPayload = JSON.stringify({
      version: 1,
      appName: 'FINANZAS',
      exportedAt: '2026-10-18T20:00:00.000Z',
      data: {
        accounts: [{ id: 'a1', name: 'Nu' }],
        movements: [{ id: 'm1', amount: 15000, date: '2026-10-15' }],
        categories: [{ id: 'c1', name: 'Comida' }],
        budgets: [{ id: 'b1', monthlyLimit: 50000 }],
        fixedExpenses: [{ id: 'f1', name: 'Netflix', amount: 21900 }],
        holdings: [{ id: 'h1', symbol: 'BTC', quantity: 0.1 }],
      },
    })

    const result = validateBackupJSON(validPayload)

    expect(result.valid).toBe(true)
    expect(result.summary.accountsCount).toBe(1)
    expect(result.summary.movementsCount).toBe(1)
    expect(result.summary.categoriesCount).toBe(1)
    expect(result.summary.budgetsCount).toBe(1)
    expect(result.summary.fixedExpensesCount).toBe(1)
    expect(result.summary.holdingsCount).toBe(1)
    expect(result.summary.exportedAt).toBe('2026-10-18T20:00:00.000Z')
    expect(result.parsedData.movements.length).toBe(1)
  })

  it('rejects invalid JSON string', () => {
    const invalidJson = '{ version: 1, missingQuotes }'
    const result = validateBackupJSON(invalidJson)

    expect(result.valid).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('rejects JSON without financial data', () => {
    const emptyPayload = JSON.stringify({
      foo: 'bar',
      randomField: 123,
    })

    const result = validateBackupJSON(emptyPayload)

    expect(result.valid).toBe(false)
    expect(result.error).toContain('no contiene datos compatibles')
  })

  it('validates a backup JSON with interestAccruals included', () => {
    const validPayload = JSON.stringify({
      version: 1,
      appName: 'FINANZAS',
      exportedAt: '2026-10-18T20:00:00.000Z',
      data: {
        accounts: [{ id: 'a1', name: 'Nu' }],
        movements: [{ id: 'm1', amount: 15000, date: '2026-10-15' }],
        categories: [{ id: 'c1', name: 'Comida' }],
        interestAccruals: [
          {
            id: 'ia1',
            accountId: 'a1',
            date: '2026-10-14',
            amountCents: 410,
            baseCents: 1000000,
            rate: 0.15,
            carryCents: 0.95,
          },
        ],
      },
    })

    const result = validateBackupJSON(validPayload)
    expect(result.valid).toBe(true)
    expect(result.summary.interestAccrualsCount).toBe(1)
  })
})

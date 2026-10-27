import { describe, it, expect } from 'vitest'
import Dexie from 'dexie'
import { db } from '../src/db/database.js'

describe('Database: Dexie v8 migration test with fake data', () => {
  it('confirms the production db schema is at version 8', () => {
    expect(db.verno).toBe(8)

    const recurringIncomesTable = db.recurringIncomes
    expect(recurringIncomesTable).toBeDefined()
    expect(recurringIncomesTable.schema.indexes.some((idx) => idx.name === 'frequency')).toBe(true)
    expect(recurringIncomesTable.schema.indexes.some((idx) => idx.name === 'categoryId')).toBe(true)
    expect(recurringIncomesTable.schema.indexes.some((idx) => idx.name === 'accountId')).toBe(true)
    expect(recurringIncomesTable.schema.indexes.some((idx) => idx.name === 'active')).toBe(true)

    const occurrencesTable = db.recurringIncomeOccurrences
    expect(occurrencesTable).toBeDefined()
    expect(occurrencesTable.schema.indexes.some((idx) => idx.name === '[recurringId+dueDate]')).toBe(true)
    expect(occurrencesTable.schema.indexes.some((idx) => idx.name === 'status')).toBe(true)
  })

  it('migrates from v7 to v8 without data loss and preserves existing records', async () => {
    const testDbName = `test_migration_v8_${Date.now()}`
    const testDb = new Dexie(testDbName)

    // 1. Definir esquema v7
    testDb.version(7).stores({
      accounts: '++id, type, currency, parentId, sortOrder, lastReconciledAt',
      movements: '++id, accountId, toAccountId, categoryId, date, type, reason',
      categories: '++id, type',
      budgets: '++id, categoryId',
      fixedExpenses: '++id, categoryId, accountId',
      holdings: '++id, symbol, kind',
      lots: '++id, holdingId, symbol, date',
      priceCache: 'symbol',
      priceHistory: '++id, [symbol+date], symbol, date',
      settings: 'id',
      fxHistory: '++id, [pair+date], pair, date',
      goals: '++id, name, targetDate, status, createdAt',
      goalContributions: '++id, goalId, accountId, date, createdAt',
      templates: '++id, sortOrder, useCount, type, categoryId, accountId',
    })

    await testDb.open()

    // 2. Insertar datos falsos en v7
    const fakeAccount = {
      id: 'acc-v7-1',
      name: 'BBVA Débito',
      type: 'debit',
      currency: 'MXN',
      balance: 150_000,
    }
    const fakeTemplate = {
      id: 'tpl-v7-1',
      name: 'Supermercado',
      type: 'expense',
      amountCents: 120_000,
      sortOrder: 0,
      useCount: 3,
    }
    const fakeSettings = {
      id: 'global',
      baseCurrency: 'MXN',
      fxMode: 'auto',
      templateTapBehavior: 'fill',
    }

    await testDb.accounts.add(fakeAccount)
    await testDb.templates.add(fakeTemplate)
    await testDb.settings.add(fakeSettings)
    testDb.close()

    // 3. Abrir nueva instancia con versión 8
    const upgradedDb = new Dexie(testDbName)

    upgradedDb.version(7).stores({
      accounts: '++id, type, currency, parentId, sortOrder, lastReconciledAt',
      movements: '++id, accountId, toAccountId, categoryId, date, type, reason',
      categories: '++id, type',
      budgets: '++id, categoryId',
      fixedExpenses: '++id, categoryId, accountId',
      holdings: '++id, symbol, kind',
      lots: '++id, holdingId, symbol, date',
      priceCache: 'symbol',
      priceHistory: '++id, [symbol+date], symbol, date',
      settings: 'id',
      fxHistory: '++id, [pair+date], pair, date',
      goals: '++id, name, targetDate, status, createdAt',
      goalContributions: '++id, goalId, accountId, date, createdAt',
      templates: '++id, sortOrder, useCount, type, categoryId, accountId',
    })

    upgradedDb.version(8).stores({
      accounts: '++id, type, currency, parentId, sortOrder, lastReconciledAt',
      movements: '++id, accountId, toAccountId, categoryId, date, type, reason',
      categories: '++id, type',
      budgets: '++id, categoryId',
      fixedExpenses: '++id, categoryId, accountId',
      holdings: '++id, symbol, kind',
      lots: '++id, holdingId, symbol, date',
      priceCache: 'symbol',
      priceHistory: '++id, [symbol+date], symbol, date',
      settings: 'id',
      fxHistory: '++id, [pair+date], pair, date',
      goals: '++id, name, targetDate, status, createdAt',
      goalContributions: '++id, goalId, accountId, date, createdAt',
      templates: '++id, sortOrder, useCount, type, categoryId, accountId',
      recurringIncomes: '++id, frequency, categoryId, accountId, active, startDate',
      recurringIncomeOccurrences: '++id, [recurringId+dueDate], recurringId, dueDate, status',
    })

    await upgradedDb.open()

    // 4. Comprobar que los datos originales NO se perdieron
    const accountAfter = await upgradedDb.accounts.get('acc-v7-1')
    expect(accountAfter).toBeDefined()
    expect(accountAfter.balance).toBe(150_000)

    const templateAfter = await upgradedDb.templates.get('tpl-v7-1')
    expect(templateAfter).toBeDefined()
    expect(templateAfter.name).toBe('Supermercado')
    expect(templateAfter.useCount).toBe(3)

    const settingsAfter = await upgradedDb.settings.get('global')
    expect(settingsAfter.templateTapBehavior).toBe('fill')

    // 5. Comprobar que se pueden agregar y consultar ingresos recurrentes y ocurrencias en v8
    const fakeRecIncome = {
      id: 'rec-inc-1',
      name: 'Nómina Quincenal',
      amountCents: 1_800_000,
      currency: 'MXN',
      categoryId: 'cat-salario',
      accountId: 'acc-v7-1',
      frequency: 'biweekly',
      schedule: { day1: 15, day2: 'last' },
      startDate: '2026-10-01',
      active: true,
    }

    await upgradedDb.recurringIncomes.add(fakeRecIncome)

    const fakeOccurrence = {
      id: 'occ-1',
      recurringId: 'rec-inc-1',
      dueDate: '2026-10-15',
      status: 'pending',
    }

    await upgradedDb.recurringIncomeOccurrences.add(fakeOccurrence)

    const allIncomes = await upgradedDb.recurringIncomes.toArray()
    expect(allIncomes.length).toBe(1)
    expect(allIncomes[0].name).toBe('Nómina Quincenal')

    const allOccurrences = await upgradedDb.recurringIncomeOccurrences.toArray()
    expect(allOccurrences.length).toBe(1)
    expect(allOccurrences[0].status).toBe('pending')

    await upgradedDb.delete()
  })
})

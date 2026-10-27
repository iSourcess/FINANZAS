import { describe, it, expect } from 'vitest'
import Dexie from 'dexie'
import { db } from '../src/db/database.js'

describe('Database: Dexie v9 migration test with fake data', () => {
  it('confirms the production db schema is at version 9', () => {
    expect(db.verno).toBe(9)

    const debtsTable = db.debts
    expect(debtsTable).toBeDefined()
    expect(debtsTable.schema.indexes.some((idx) => idx.name === 'direction')).toBe(true)
    expect(debtsTable.schema.indexes.some((idx) => idx.name === 'person')).toBe(true)
    expect(debtsTable.schema.indexes.some((idx) => idx.name === 'status')).toBe(true)

    const debtPaymentsTable = db.debtPayments
    expect(debtPaymentsTable).toBeDefined()
    expect(debtPaymentsTable.schema.indexes.some((idx) => idx.name === 'debtId')).toBe(true)
    expect(debtPaymentsTable.schema.indexes.some((idx) => idx.name === 'date')).toBe(true)

    const movementsTable = db.movements
    expect(movementsTable.schema.indexes.some((idx) => idx.name === 'debtId')).toBe(true)
  })

  it('migrates from v8 to v9 without data loss and preserves existing records', async () => {
    const testDbName = `test_migration_v9_${Date.now()}`
    const testDb = new Dexie(testDbName)

    // 1. Definir esquema v8
    testDb.version(8).stores({
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

    await testDb.open()

    // 2. Insertar datos falsos en v8
    const fakeAccount = {
      id: 'acc-v8-1',
      name: 'Santander Nómina',
      type: 'debit',
      currency: 'MXN',
      balance: 450_000,
    }
    const fakeRecurringIncome = {
      id: 'rec-v8-1',
      name: 'Honorarios',
      amountCents: 2_500_000,
      currency: 'MXN',
      frequency: 'monthly',
      schedule: { dayOfMonth: 30 },
      active: true,
    }
    const fakeSettings = {
      id: 'global',
      baseCurrency: 'MXN',
      fxMode: 'auto',
    }

    await testDb.accounts.add(fakeAccount)
    await testDb.recurringIncomes.add(fakeRecurringIncome)
    await testDb.settings.add(fakeSettings)
    testDb.close()

    // 3. Abrir nueva instancia con versión 9
    const upgradedDb = new Dexie(testDbName)

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

    upgradedDb.version(9)
      .stores({
        accounts: '++id, type, currency, parentId, sortOrder, lastReconciledAt',
        movements: '++id, accountId, toAccountId, categoryId, date, type, reason, debtId',
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
        debts: '++id, direction, person, status, openedAt, dueDate',
        debtPayments: '++id, debtId, date, accountId, adjustmentId',
      })
      .upgrade(async (tx) => {
        const settings = await tx.table('settings').get('global')
        if (settings && settings.includeDebtsInNetWorth === undefined) {
          await tx.table('settings').update('global', { includeDebtsInNetWorth: false })
        }
      })

    await upgradedDb.open()

    // 4. Comprobar que los datos originales NO se perdieron
    const accountAfter = await upgradedDb.accounts.get('acc-v8-1')
    expect(accountAfter).toBeDefined()
    expect(accountAfter.balance).toBe(450_000)

    const recurringAfter = await upgradedDb.recurringIncomes.get('rec-v8-1')
    expect(recurringAfter).toBeDefined()
    expect(recurringAfter.amountCents).toBe(2_500_000)

    const settingsAfter = await upgradedDb.settings.get('global')
    expect(settingsAfter.includeDebtsInNetWorth).toBe(false)

    // 5. Comprobar que se pueden agregar y consultar deudas y abonos en v9
    const fakeDebt = {
      id: 'debt-v9-1',
      direction: 'owed_to_me',
      person: 'Carlos Gómez',
      principalCents: 500_000,
      currency: 'MXN',
      openedAt: '2026-10-10',
      dueDate: '2026-11-10',
      note: 'Préstamo para refacciones',
      status: 'open',
    }

    await upgradedDb.debts.add(fakeDebt)

    const fakePayment = {
      id: 'pay-v9-1',
      debtId: 'debt-v9-1',
      amountCents: 200_000,
      date: '2026-10-15',
      accountId: 'acc-v8-1',
      adjustmentId: 'adj-1',
    }

    await upgradedDb.debtPayments.add(fakePayment)

    const allDebts = await upgradedDb.debts.toArray()
    expect(allDebts.length).toBe(1)
    expect(allDebts[0].person).toBe('Carlos Gómez')

    const allPayments = await upgradedDb.debtPayments.toArray()
    expect(allPayments.length).toBe(1)
    expect(allPayments[0].amountCents).toBe(200_000)

    await upgradedDb.delete()
  })
})

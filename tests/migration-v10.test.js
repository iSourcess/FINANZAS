import { describe, it, expect } from 'vitest'
import Dexie from 'dexie'
import { db } from '../src/db/database.js'

describe('Database: Dexie v10 migration test with fake data', () => {
  it('confirms the production db schema is at version 10', () => {
    expect(db.verno).toBe(10)

    const movementsTable = db.movements
    expect(movementsTable).toBeDefined()
    expect(movementsTable.schema.indexes.some((idx) => idx.name === 'importBatchId')).toBe(true)

    const profilesTable = db.importProfiles
    expect(profilesTable).toBeDefined()
    expect(profilesTable.schema.indexes.some((idx) => idx.name === 'accountId')).toBe(true)

    const rulesTable = db.categoryRules
    expect(rulesTable).toBeDefined()
    expect(rulesTable.schema.indexes.some((idx) => idx.name === 'keyword')).toBe(true)

    const batchesTable = db.importBatches
    expect(batchesTable).toBeDefined()
    expect(batchesTable.schema.indexes.some((idx) => idx.name === 'accountId')).toBe(true)
  })

  it('migrates from v9 to v10 without data loss and preserves existing movements', async () => {
    const testDbName = `test_migration_v10_${Date.now()}`
    const testDb = new Dexie(testDbName)

    // 1. Esquema v9
    testDb.version(9).stores({
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

    await testDb.open()

    // 2. Insertar datos falsos en v9
    const fakeAccount = {
      id: 'acc-v9-1',
      name: 'BBVA Débito',
      type: 'debit',
      currency: 'MXN',
      balance: 125000,
    }
    const fakeMovement = {
      id: 'mov-v9-1',
      accountId: 'acc-v9-1',
      type: 'expense',
      amount: 4500,
      currency: 'MXN',
      date: '2026-10-15',
      note: 'Café matutino',
    }

    await testDb.accounts.add(fakeAccount)
    await testDb.movements.add(fakeMovement)

    testDb.close()

    // 3. Abrir con versión 10 y aplicar migración
    const upgradedDb = new Dexie(testDbName)
    upgradedDb.version(9).stores({
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

    upgradedDb.version(10)
      .stores({
        accounts: '++id, type, currency, parentId, sortOrder, lastReconciledAt',
        movements: '++id, accountId, toAccountId, categoryId, date, type, reason, debtId, importBatchId',
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
        importProfiles: '++id, accountId, name, updatedAt',
        categoryRules: '++id, keyword, categoryId, hitCount, createdAt',
        importBatches: '++id, accountId, date, fileName, status, createdAt',
      })
      .upgrade(async (tx) => {
        const movements = await tx.table('movements').toArray()
        for (const m of movements) {
          if (m.importBatchId === undefined) {
            await tx.table('movements').update(m.id, { importBatchId: null })
          }
        }
      })

    await upgradedDb.open()

    // 4. Verificar integridad de los datos
    const accountAfter = await upgradedDb.accounts.get('acc-v9-1')
    expect(accountAfter).toBeDefined()
    expect(accountAfter.balance).toBe(125000)

    const movementAfter = await upgradedDb.movements.get('mov-v9-1')
    expect(movementAfter).toBeDefined()
    expect(movementAfter.amount).toBe(4500)
    expect(movementAfter.importBatchId).toBeNull()

    // 5. Verificar que se pueden crear registros en las nuevas tablas
    const profileId = await upgradedDb.importProfiles.add({
      accountId: 'acc-v9-1',
      name: 'Perfil BBVA',
      updatedAt: new Date().toISOString(),
    })
    expect(profileId).toBeDefined()

    const ruleId = await upgradedDb.categoryRules.add({
      keyword: 'starbucks',
      categoryId: 'cat-cafeteria',
      hitCount: 1,
      createdAt: new Date().toISOString(),
    })
    expect(ruleId).toBeDefined()

    upgradedDb.close()
    await Dexie.delete(testDbName)
  })
})

import { describe, it, expect } from 'vitest'
import Dexie from 'dexie'
import { db } from '../src/db/database.js'

describe('Database: Dexie v7 migration test with fake data', () => {
  it('confirms the production db schema is at version 7', () => {
    expect(db.verno).toBe(7)

    const templatesTable = db.templates
    expect(templatesTable).toBeDefined()
    expect(templatesTable.schema.indexes.some((idx) => idx.name === 'sortOrder')).toBe(true)
    expect(templatesTable.schema.indexes.some((idx) => idx.name === 'useCount')).toBe(true)
  })

  it('migrates from v6 to v7 without data loss and preserves existing records', async () => {
    const testDbName = `test_migration_v7_${Date.now()}`
    const testDb = new Dexie(testDbName)

    // 1. Definir esquema v6
    testDb.version(6).stores({
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
    })

    await testDb.open()

    // 2. Insertar datos falsos en v6
    const fakeAccount = {
      id: 'acc-v6-1',
      name: 'Cuenta Nómina',
      type: 'debit',
      currency: 'MXN',
      balance: 200_000,
      lastReconciledAt: '2026-10-20',
    }
    const fakeSettings = {
      id: 'global',
      baseCurrency: 'MXN',
      fxMode: 'auto',
    }

    await testDb.accounts.add(fakeAccount)
    await testDb.settings.add(fakeSettings)
    testDb.close()

    // 3. Abrir nueva instancia con versión 7 y handler .upgrade()
    const upgradedDb = new Dexie(testDbName)

    upgradedDb.version(6).stores({
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
    })

    upgradedDb.version(7)
      .stores({
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
      .upgrade(async (tx) => {
        const settings = await tx.table('settings').get('global')
        if (settings && settings.templateTapBehavior === undefined) {
          await tx.table('settings').update('global', { templateTapBehavior: 'fill' })
        }
      })

    await upgradedDb.open()

    // 4. Comprobar que los datos originales NO se perdieron
    const accountAfter = await upgradedDb.accounts.get('acc-v6-1')
    expect(accountAfter).toBeDefined()
    expect(accountAfter.balance).toBe(200_000)
    expect(accountAfter.lastReconciledAt).toBe('2026-10-20')

    const settingsAfter = await upgradedDb.settings.get('global')
    expect(settingsAfter.templateTapBehavior).toBe('fill')

    // 5. Comprobar que se pueden agregar y consultar plantillas
    await upgradedDb.templates.add({
      id: 'tpl-1',
      name: 'Cafetería',
      type: 'expense',
      amountCents: 6500,
      sortOrder: 0,
      useCount: 1,
    })

    const allTemplates = await upgradedDb.templates.toArray()
    expect(allTemplates.length).toBe(1)
    expect(allTemplates[0].name).toBe('Cafetería')

    await upgradedDb.delete()
  })
})

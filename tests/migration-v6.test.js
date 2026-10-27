import { describe, it, expect } from 'vitest'
import Dexie from 'dexie'
import { db } from '../src/db/database.js'

describe('Database: Dexie v6 migration test with fake data', () => {
  it('confirms the production db schema is at version 6', () => {
    expect(db.verno).toBe(6)

    // Verificar índices de la versión 6
    const accountsTable = db.accounts
    const movementsTable = db.movements

    expect(accountsTable.schema.indexes.some((idx) => idx.name === 'lastReconciledAt')).toBe(true)
    expect(movementsTable.schema.indexes.some((idx) => idx.name === 'reason')).toBe(true)
  })

  it('migrates from v5 to v6 without data loss and initializes lastReconciledAt', async () => {
    const testDbName = `test_migration_${Date.now()}`
    const testDb = new Dexie(testDbName)

    // 1. Definir esquema v5
    testDb.version(5).stores({
      accounts: '++id, type, currency, parentId, sortOrder',
      movements: '++id, accountId, toAccountId, categoryId, date, type',
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

    // 2. Insertar datos falsos en v5
    const fakeAccount1 = {
      id: 'acc-fake-1',
      name: 'Nu Débito Test',
      type: 'debit',
      currency: 'MXN',
      balance: 150_000,
      sortOrder: 1,
      createdAt: '2026-10-01T10:00:00.000Z',
    }
    const fakeAccount2 = {
      id: 'acc-fake-2',
      name: 'Tarjeta Crédito Test',
      type: 'credit',
      currency: 'MXN',
      balance: 50_000,
      sortOrder: 2,
      createdAt: '2026-10-02T10:00:00.000Z',
    }

    await testDb.accounts.bulkAdd([fakeAccount1, fakeAccount2])
    testDb.close()

    // 3. Abrir nueva instancia con versión 6 y handler .upgrade()
    const upgradedDb = new Dexie(testDbName)

    upgradedDb.version(5).stores({
      accounts: '++id, type, currency, parentId, sortOrder',
      movements: '++id, accountId, toAccountId, categoryId, date, type',
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

    upgradedDb.version(6)
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
      })
      .upgrade(async (tx) => {
        const accounts = await tx.table('accounts').toArray()
        for (const acc of accounts) {
          if (acc.lastReconciledAt === undefined) {
            await tx.table('accounts').update(acc.id, { lastReconciledAt: null })
          }
        }
      })

    await upgradedDb.open()

    // 4. Comprobar que los datos originales NO se perdieron
    const accountsAfter = await upgradedDb.accounts.toArray()
    expect(accountsAfter.length).toBe(2)

    const acc1 = accountsAfter.find((a) => a.id === 'acc-fake-1')
    expect(acc1).toBeDefined()
    expect(acc1.name).toBe('Nu Débito Test')
    expect(acc1.balance).toBe(150_000)
    expect(acc1.lastReconciledAt).toBeNull() // Inicializado por migración

    const acc2 = accountsAfter.find((a) => a.id === 'acc-fake-2')
    expect(acc2).toBeDefined()
    expect(acc2.balance).toBe(50_000)
    expect(acc2.lastReconciledAt).toBeNull()

    // 5. Comprobar que se pueden guardar ajustes con reason indexado
    await upgradedDb.movements.add({
      id: 'mov-adj-1',
      type: 'adjustment',
      accountId: 'acc-fake-1',
      deltaCents: 20_000,
      amount: 20_000,
      reason: 'reconcile',
      date: '2026-10-26',
    })

    const foundByReason = await upgradedDb.movements.where('reason').equals('reconcile').toArray()
    expect(foundByReason.length).toBe(1)
    expect(foundByReason[0].deltaCents).toBe(20_000)

    await upgradedDb.delete()
  })
})

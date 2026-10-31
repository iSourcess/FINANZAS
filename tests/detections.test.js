/**
 * tests/detections.test.js
 *
 * Pruebas unitarias para la lógica pura de domain/detections.js:
 *   - applyDetection: generación de borrador de movimiento.
 *   - detectDuplicatesAgainstMovements: detección de movimientos idénticos (±1 día).
 *   - matchFixedExpense: emparejamiento con gastos fijos pendientes (±1%, ±3 días).
 *   - matchRecurringIncome: emparejamiento con ingresos recurrentes pendientes.
 *   - detectTransferPairs: vinculación de pares de transferencia propia en ventana de 10 min.
 *   - isDetectionOlderThanDays / countDetectionsOlderThanDays.
 */

import { describe, it, expect } from 'vitest'
import {
  applyDetection,
  suggestCategoryForDetection,
  detectDuplicatesAgainstMovements,
  matchFixedExpense,
  matchRecurringIncome,
  detectTransferPairs,
  isDetectionOlderThanDays,
  countDetectionsOlderThanDays,
} from '../src/domain/detections.js'

describe('domain/detections.js', () => {
  const mockCategories = [
    { id: 'cat-food', name: 'Comida', type: 'expense' },
    { id: 'cat-transport', name: 'Transporte', type: 'expense' },
    { id: 'cat-health', name: 'Salud', type: 'expense' },
    { id: 'cat-salary', name: 'Sueldo', type: 'income' },
  ]

  const mockAccounts = [
    { id: 'acc-nu', name: 'Nu Débito', type: 'debit', last4: '1234' },
    { id: 'acc-bbva', name: 'BBVA Nómina', type: 'debit', last4: '5678' },
    { id: 'acc-amex', name: 'Amex Gold', type: 'credit', last4: '9999' },
  ]

  describe('suggestCategoryForDetection', () => {
    it('sugiere categoría por palabras clave de comercio', () => {
      const catFood = suggestCategoryForDetection('Starbucks Insurgentes', mockCategories, 'expense')
      expect(catFood?.id).toBe('cat-food')

      const catTransport = suggestCategoryForDetection('Uber Trip 123', mockCategories, 'expense')
      expect(catTransport?.id).toBe('cat-transport')

      const catHealth = suggestCategoryForDetection('Farmacia San Pablo', mockCategories, 'expense')
      expect(catHealth?.id).toBe('cat-health')
    })

    it('sugiere categoría de ingreso para depósitos', () => {
      const catSalary = suggestCategoryForDetection('Depósito de Nómina', mockCategories, 'income')
      expect(catSalary?.id).toBe('cat-salary')
    })
  })

  describe('applyDetection', () => {
    it('convierte una detección en borrador de movimiento con montos en centavos y campos correctos', () => {
      const detection = {
        id: 'det-1',
        packageName: 'com.nu.production',
        postedAt: 1730311200000,
        amountCents: 24500,
        currency: 'MXN',
        kind: 'expense',
        merchant: 'Uber Trip',
        accountId: 'acc-nu',
      }

      const draft = applyDetection(detection, mockAccounts, mockCategories)
      expect(draft).toBeDefined()
      expect(draft.type).toBe('expense')
      expect(draft.amount).toBe(24500)
      expect(draft.currency).toBe('MXN')
      expect(draft.accountId).toBe('acc-nu')
      expect(draft.categoryId).toBe('cat-transport')
      expect(draft.note).toBe('Uber Trip')
      expect(draft.detectionId).toBe('det-1')
      expect(draft.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('resuelve cuenta por últimos 4 dígitos si la detección no trae accountId', () => {
      const detection = {
        id: 'det-2',
        amountCents: 15000,
        last4: '5678',
        merchant: 'Super',
      }

      const draft = applyDetection(detection, mockAccounts, mockCategories)
      expect(draft.accountId).toBe('acc-bbva')
    })
  })

  describe('detectDuplicatesAgainstMovements', () => {
    const movements = [
      { id: 'mov-1', accountId: 'acc-nu', amount: 35000, date: '2026-10-25', note: 'Walmart' },
      { id: 'mov-2', accountId: 'acc-bbva', amount: 15000, date: '2026-10-20', note: 'Café' },
    ]

    it('detecta duplicado si coincide cuenta, monto y fecha exacta', () => {
      const detection = {
        id: 'det-dup-1',
        accountId: 'acc-nu',
        amountCents: 35000,
        postedAt: '2026-10-25T12:00:00Z',
      }

      const res = detectDuplicatesAgainstMovements(detection, movements)
      expect(res.isDuplicate).toBe(true)
      expect(res.duplicateMovement.id).toBe('mov-1')
    })

    it('detecta duplicado en ventana de ±1 día', () => {
      const detection = {
        id: 'det-dup-2',
        accountId: 'acc-nu',
        amountCents: 35000,
        postedAt: '2026-10-26T02:00:00Z', // 1 día después
      }

      const res = detectDuplicatesAgainstMovements(detection, movements)
      expect(res.isDuplicate).toBe(true)
    })

    it('no marca duplicado si la cuenta es distinta', () => {
      const detection = {
        id: 'det-diff-acc',
        accountId: 'acc-amex',
        amountCents: 35000,
        postedAt: '2026-10-25T12:00:00Z',
      }

      const res = detectDuplicatesAgainstMovements(detection, movements)
      expect(res.isDuplicate).toBe(false)
    })

    it('no marca duplicado si el monto es distinto', () => {
      const detection = {
        id: 'det-diff-amt',
        accountId: 'acc-nu',
        amountCents: 35001,
        postedAt: '2026-10-25T12:00:00Z',
      }

      const res = detectDuplicatesAgainstMovements(detection, movements)
      expect(res.isDuplicate).toBe(false)
    })

    it('no marca duplicado si la fecha difiere por más de 1 día', () => {
      const detection = {
        id: 'det-diff-date',
        accountId: 'acc-nu',
        amountCents: 35000,
        postedAt: '2026-10-28T12:00:00Z',
      }

      const res = detectDuplicatesAgainstMovements(detection, movements)
      expect(res.isDuplicate).toBe(false)
    })
  })

  describe('matchFixedExpense', () => {
    const fixedExpenses = [
      { id: 'fix-netflix', name: 'Netflix', amount: 21900, dueDay: 15 },
      { id: 'fix-internet', name: 'Totalplay', amount: 69900, dueDay: 5 },
    ]

    it('empareja si el monto está dentro del ±1% y fecha dentro de ±3 días', () => {
      const detection = {
        kind: 'expense',
        amountCents: 21900,
        postedAt: '2026-10-16T10:00:00Z', // día 16 vs dueDay 15
      }

      const res = matchFixedExpense(detection, fixedExpenses, [], '2026-10-16')
      expect(res.isMatch).toBe(true)
      expect(res.fixedExpense.id).toBe('fix-netflix')
    })

    it('acepta variación de monto de hasta 1%', () => {
      // 21900 * 0.01 = 219 centavos de tolerancia
      const detection = {
        kind: 'expense',
        amountCents: 22000, // +100 centavos
        postedAt: '2026-10-15T10:00:00Z',
      }

      const res = matchFixedExpense(detection, fixedExpenses, [], '2026-10-15')
      expect(res.isMatch).toBe(true)
      expect(res.fixedExpense.id).toBe('fix-netflix')
    })

    it('ignora gastos fijos que ya fueron pagados en el periodo', () => {
      const detection = {
        kind: 'expense',
        amountCents: 21900,
        postedAt: '2026-10-15T10:00:00Z',
      }

      const res = matchFixedExpense(detection, fixedExpenses, ['fix-netflix'], '2026-10-15')
      expect(res.isMatch).toBe(false)
    })

    it('no empareja si la diferencia de días excede 3 días', () => {
      const detection = {
        kind: 'expense',
        amountCents: 21900,
        postedAt: '2026-10-25T10:00:00Z', // día 25 vs 15 -> 10 días
      }

      const res = matchFixedExpense(detection, fixedExpenses, [], '2026-10-25')
      expect(res.isMatch).toBe(false)
    })
  })

  describe('matchRecurringIncome', () => {
    const recurringIncomes = [
      { id: 'rec-nomina', name: 'Nómina Quincenal', amountCents: 1500000, dayOfMonth: 15, active: true },
    ]

    it('empareja ingreso si coincide monto (±1%) y ventana de ±3 días', () => {
      const detection = {
        kind: 'income',
        amountCents: 1500000,
        postedAt: '2026-10-15T09:00:00Z',
      }

      const res = matchRecurringIncome(detection, recurringIncomes, [], '2026-10-15')
      expect(res.isMatch).toBe(true)
      expect(res.recurringIncome.id).toBe('rec-nomina')
    })

    it('no empareja si la detección es un gasto', () => {
      const detection = {
        kind: 'expense',
        amountCents: 1500000,
        postedAt: '2026-10-15T09:00:00Z',
      }

      const res = matchRecurringIncome(detection, recurringIncomes, [], '2026-10-15')
      expect(res.isMatch).toBe(false)
    })
  })

  describe('detectTransferPairs', () => {
    it('detecta par de transferencia propia en ventana de 10 minutos', () => {
      const baseTime = 1730310000000
      const detections = [
        {
          id: 'det-out',
          kind: 'expense',
          amountCents: 50000,
          accountId: 'acc-bbva',
          packageName: 'com.bbva.mexico',
          postedAt: baseTime,
        },
        {
          id: 'det-in',
          kind: 'income',
          amountCents: 50000,
          accountId: 'acc-nu',
          packageName: 'com.nu.production',
          postedAt: baseTime + (3 * 60 * 1000), // 3 minutos después
        },
      ]

      const pairs = detectTransferPairs(detections)
      expect(pairs).toHaveLength(1)
      expect(pairs[0].amountCents).toBe(50000)
      expect(pairs[0].fromDetection.id).toBe('det-out')
      expect(pairs[0].toDetection.id).toBe('det-in')
      expect(pairs[0].fromAccountId).toBe('acc-bbva')
      expect(pairs[0].toAccountId).toBe('acc-nu')
    })

    it('no empareja si la diferencia de tiempo es mayor a 10 minutos', () => {
      const baseTime = 1730310000000
      const detections = [
        {
          id: 'det-out',
          kind: 'expense',
          amountCents: 50000,
          accountId: 'acc-bbva',
          postedAt: baseTime,
        },
        {
          id: 'det-in',
          kind: 'income',
          amountCents: 50000,
          accountId: 'acc-nu',
          postedAt: baseTime + (15 * 60 * 1000), // 15 minutos después
        },
      ]

      const pairs = detectTransferPairs(detections)
      expect(pairs).toHaveLength(0)
    })

    it('no empareja si es la misma cuenta', () => {
      const baseTime = 1730310000000
      const detections = [
        {
          id: 'det-1',
          kind: 'expense',
          amountCents: 50000,
          accountId: 'acc-nu',
          packageName: 'com.nu.production',
          postedAt: baseTime,
        },
        {
          id: 'det-2',
          kind: 'income',
          amountCents: 50000,
          accountId: 'acc-nu',
          packageName: 'com.nu.production',
          postedAt: baseTime + (1 * 60 * 1000),
        },
      ]

      const pairs = detectTransferPairs(detections)
      expect(pairs).toHaveLength(0)
    })
  })

  describe('isDetectionOlderThanDays y countDetectionsOlderThanDays', () => {
    it('identifica correctamente detecciones con más de 2 días', () => {
      const now = new Date('2026-10-30T12:00:00Z').getTime()
      const oneDayAgo = now - (24 * 60 * 60 * 1000)
      const threeDaysAgo = now - (3 * 24 * 60 * 60 * 1000)

      const recent = { id: 'r1', postedAt: oneDayAgo, status: 'pending' }
      const old = { id: 'o1', postedAt: threeDaysAgo, status: 'pending' }

      expect(isDetectionOlderThanDays(recent, 2, now)).toBe(false)
      expect(isDetectionOlderThanDays(old, 2, now)).toBe(true)

      const count = countDetectionsOlderThanDays([recent, old], 2, now)
      expect(count).toBe(1)
    })
  })
})

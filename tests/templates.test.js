import { describe, it, expect } from 'vitest'
import {
  sortTemplates,
  applyTemplate,
  validateTemplate,
  reorderTemplates,
} from '../src/domain/templates.js'

describe('Domain: frequent movement templates', () => {
  const sampleTemplates = [
    { id: 't1', name: 'Café matutino', useCount: 5, sortOrder: 2, amountCents: 6500 },
    { id: 't2', name: 'Gasolina', useCount: 12, sortOrder: 1, amountCents: 50000 },
    { id: 't3', name: 'Supermercado', useCount: 1, sortOrder: 0, amountCents: null },
  ]

  describe('sortTemplates', () => {
    it('sorts by useCount descending in "usage" mode', () => {
      const sorted = sortTemplates(sampleTemplates, 'usage')
      expect(sorted[0].id).toBe('t2') // 12 uses
      expect(sorted[1].id).toBe('t1') // 5 uses
      expect(sorted[2].id).toBe('t3') // 1 use
    })

    it('sorts by sortOrder ascending in "manual" mode', () => {
      const sorted = sortTemplates(sampleTemplates, 'manual')
      expect(sorted[0].id).toBe('t3') // sortOrder 0
      expect(sorted[1].id).toBe('t2') // sortOrder 1
      expect(sorted[2].id).toBe('t1') // sortOrder 2
    })
  })

  describe('applyTemplate', () => {
    it('creates a movement draft with today date and specified amount in cents', () => {
      const template = {
        id: 't-lunch',
        name: 'Comida corrida',
        type: 'expense',
        amountCents: 12000, // $120.00
        currency: 'MXN',
        categoryId: 'cat-food',
        accountId: 'acc-debit',
        note: 'Menú del día',
      }

      const draft = applyTemplate(template, { todayStr: '2026-10-26' })
      expect(draft.type).toBe('expense')
      expect(draft.amount).toBe(12000)
      expect(draft.currency).toBe('MXN')
      expect(draft.categoryId).toBe('cat-food')
      expect(draft.accountId).toBe('acc-debit')
      expect(draft.note).toBe('Menú del día')
      expect(draft.date).toBe('2026-10-26')
    })

    it('handles template without amount (amountCents = null)', () => {
      const template = {
        id: 't-uber',
        name: 'Uber',
        type: 'expense',
        amountCents: null,
        currency: 'MXN',
        categoryId: 'cat-transport',
        accountId: 'acc-credit',
        note: '',
      }

      const draft = applyTemplate(template, { todayStr: '2026-10-26' })
      expect(draft.amount).toBeNull()
      expect(draft.categoryId).toBe('cat-transport')
    })
  })

  describe('validateTemplate', () => {
    const accounts = [{ id: 'acc-1', name: 'Nu' }]
    const categories = [{ id: 'cat-1', name: 'Comida' }]

    it('validates template with active account and category', () => {
      const template = {
        id: 't1',
        accountId: 'acc-1',
        categoryId: 'cat-1',
        type: 'expense',
      }

      const res = validateTemplate(template, { accounts, categories })
      expect(res.isValid).toBe(true)
      expect(res.missingAccount).toBe(false)
      expect(res.missingCategory).toBe(false)
      expect(res.warningMessage).toBeNull()
    })

    it('detects missing/deleted account', () => {
      const template = {
        id: 't1',
        accountId: 'acc-deleted',
        categoryId: 'cat-1',
        type: 'expense',
      }

      const res = validateTemplate(template, { accounts, categories })
      expect(res.isValid).toBe(false)
      expect(res.missingAccount).toBe(true)
      expect(res.warningMessage).toContain('cuenta asociada')
    })

    it('detects missing/deleted category', () => {
      const template = {
        id: 't1',
        accountId: 'acc-1',
        categoryId: 'cat-deleted',
        type: 'expense',
      }

      const res = validateTemplate(template, { accounts, categories })
      expect(res.isValid).toBe(false)
      expect(res.missingCategory).toBe(true)
      expect(res.warningMessage).toContain('categoría asociada')
    })
  })

  describe('reorderTemplates', () => {
    it('moves item up and down pure without mutation', () => {
      const list = [
        { id: 'a', sortOrder: 0 },
        { id: 'b', sortOrder: 1 },
        { id: 'c', sortOrder: 2 },
      ]

      const movedUp = reorderTemplates(list, 'b', 'up')
      expect(movedUp.map((x) => x.id)).toEqual(['b', 'a', 'c'])
      expect(movedUp.map((x) => x.sortOrder)).toEqual([0, 1, 2])

      const movedDown = reorderTemplates(list, 'a', 'down')
      expect(movedDown.map((x) => x.id)).toEqual(['b', 'a', 'c'])
    })

    it('does not reorder when moving top item up or bottom item down', () => {
      const list = [
        { id: 'a', sortOrder: 0 },
        { id: 'b', sortOrder: 1 },
      ]

      expect(reorderTemplates(list, 'a', 'up').map((x) => x.id)).toEqual(['a', 'b'])
      expect(reorderTemplates(list, 'b', 'down').map((x) => x.id)).toEqual(['a', 'b'])
    })
  })
})

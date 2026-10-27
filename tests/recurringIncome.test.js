import { describe, it, expect } from 'vitest'
import {
  clipDayOfMonth,
  getDaysInMonth,
  getTwoMonthsAgo,
  diffInDays,
  generateCandidateDueDates,
  generatePendingIncomeOccurrences,
  findMatchingManualIncome,
  createMovementFromRecurringIncome,
} from '../src/domain/recurringIncome.js'

describe('Domain: recurringIncome logic', () => {
  describe('clipDayOfMonth & getDaysInMonth', () => {
    it('handles February leap year vs non-leap year', () => {
      // 2024 es bisiesto (febrero = mes index 1 -> 29 días)
      expect(getDaysInMonth(2024, 1)).toBe(29)
      expect(clipDayOfMonth(2024, 1, 31)).toBe(29)

      // 2025 no es bisiesto (febrero = mes index 1 -> 28 días)
      expect(getDaysInMonth(2025, 1)).toBe(28)
      expect(clipDayOfMonth(2025, 1, 31)).toBe(28)
    })

    it('clips day 31 to 30 in 30-day months (April, June, Sept, Nov)', () => {
      // Abril (mes index 3)
      expect(clipDayOfMonth(2026, 3, 31)).toBe(30)
      // Junio (mes index 5)
      expect(clipDayOfMonth(2026, 5, 31)).toBe(30)
      // Septiembre (mes index 8)
      expect(clipDayOfMonth(2026, 8, 31)).toBe(30)
    })

    it('supports "last" and "último" to get the exact last day of any month', () => {
      expect(clipDayOfMonth(2026, 1, 'last')).toBe(28) // Feb 2026
      expect(clipDayOfMonth(2026, 3, 'último')).toBe(30) // Abr 2026
      expect(clipDayOfMonth(2026, 4, 'last')).toBe(31) // May 2026
    })
  })

  describe('generateCandidateDueDates', () => {
    it('generates monthly dates correctly with clipping', () => {
      const rec = {
        id: 'rec-1',
        frequency: 'monthly',
        schedule: { dayOfMonth: 31 },
        startDate: '2026-01-01',
        active: true,
      }
      // De enero a abril 2026
      const dates = generateCandidateDueDates(rec, '2026-01-01', '2026-04-30')
      expect(dates).toEqual([
        '2026-01-31',
        '2026-02-28', // Febrero recortado a 28
        '2026-03-31',
        '2026-04-30', // Abril recortado a 30
      ])
    })

    it('generates biweekly dates (15 and last day) by default', () => {
      const rec = {
        id: 'rec-bi',
        frequency: 'biweekly',
        schedule: { day1: 15, day2: 'last' },
        startDate: '2026-02-01',
        active: true,
      }
      const dates = generateCandidateDueDates(rec, '2026-02-01', '2026-03-31')
      expect(dates).toEqual([
        '2026-02-15',
        '2026-02-28', // Fin de feb
        '2026-03-15',
        '2026-03-31', // Fin de mar
      ])
    })

    it('generates weekly dates for a specific day of the week', () => {
      const rec = {
        id: 'rec-week',
        frequency: 'weekly',
        schedule: { dayOfWeek: 5 }, // Viernes
        startDate: '2026-10-01', // Jueves 1 oct 2026
        active: true,
      }
      const dates = generateCandidateDueDates(rec, '2026-10-01', '2026-10-23')
      // Viernes en ese rango: 2 oct, 9 oct, 16 oct, 23 oct
      expect(dates).toEqual([
        '2026-10-02',
        '2026-10-09',
        '2026-10-16',
        '2026-10-23',
      ])
    })

    it('returns empty array when active is false or startDate is in the future', () => {
      const inactive = {
        id: 'rec-inact',
        frequency: 'monthly',
        schedule: { dayOfMonth: 15 },
        startDate: '2026-01-01',
        active: false,
      }
      expect(generateCandidateDueDates(inactive, '2026-01-01', '2026-10-01')).toEqual([])

      const future = {
        id: 'rec-fut',
        frequency: 'monthly',
        schedule: { dayOfMonth: 15 },
        startDate: '2026-12-01',
        active: true,
      }
      expect(generateCandidateDueDates(future, '2026-01-01', '2026-10-26')).toEqual([])
    })
  })

  describe('generatePendingIncomeOccurrences', () => {
    it('generates pending occurrences from max(startDate, hace 2 meses) without duplicates', () => {
      const refDate = new Date(2026, 9, 26) // 26 de octubre de 2026
      // Hace 2 meses = 2026-08-26
      const recurringIncomes = [
        {
          id: 'rec-salary',
          name: 'Nómina',
          amountCents: 1500000,
          frequency: 'monthly',
          schedule: { dayOfMonth: 15 },
          startDate: '2025-01-01', // Fecha muy antigua, debe recortarse a hace 2 meses (26 ago 2026)
          active: true,
        },
      ]

      // Supongamos que la ocurrencia de septiembre ya fue recibida
      const existingOccurrences = [
        {
          recurringId: 'rec-salary',
          dueDate: '2026-09-15',
          status: 'received',
        },
      ]

      const newOccurrences = generatePendingIncomeOccurrences({
        recurringIncomes,
        existingOccurrences,
        todayStr: '2026-10-26',
        referenceDate: refDate,
      })

      // En el rango 2026-08-26 a 2026-10-26, los días 15 son:
      // - 2026-09-15 (ya en existingOccurrences -> no se duplica)
      // - 2026-10-15 (nuevo)
      expect(newOccurrences).toHaveLength(1)
      expect(newOccurrences[0]).toEqual({
        recurringId: 'rec-salary',
        dueDate: '2026-10-15',
        status: 'pending',
      })
    })

    it('respects startDate if it is more recent than 2 months ago', () => {
      const refDate = new Date(2026, 9, 26) // 26 oct 2026
      const recurringIncomes = [
        {
          id: 'rec-rent',
          name: 'Renta cobrada',
          amountCents: 800000,
          frequency: 'monthly',
          schedule: { dayOfMonth: 5 },
          startDate: '2026-10-01', // Inicio reciente
          active: true,
        },
      ]

      const newOccurrences = generatePendingIncomeOccurrences({
        recurringIncomes,
        existingOccurrences: [],
        todayStr: '2026-10-26',
        referenceDate: refDate,
      })

      // Solo debe generar la del 5 de octubre de 2026 (no meses anteriores)
      expect(newOccurrences).toEqual([
        {
          recurringId: 'rec-rent',
          dueDate: '2026-10-05',
          status: 'pending',
        },
      ])
    })
  })

  describe('findMatchingManualIncome', () => {
    const recurringIncome = {
      id: 'rec-nomina',
      name: 'Nómina',
      amountCents: 1500000, // $15,000.00
      accountId: 'acc-bbva',
      currency: 'MXN',
    }

    const occurrence = {
      recurringId: 'rec-nomina',
      dueDate: '2026-10-15',
    }

    it('finds a matching manual movement within ±3 days', () => {
      const manualMovements = [
        {
          id: 'mov-1',
          type: 'income',
          amount: 1500000,
          accountId: 'acc-bbva',
          date: '2026-10-14', // -1 día de diferencia
        },
        {
          id: 'mov-other',
          type: 'income',
          amount: 1500000,
          accountId: 'acc-other',
          date: '2026-10-15',
        },
      ]

      const match = findMatchingManualIncome({
        occurrence,
        recurringIncome,
        manualMovements,
      })

      expect(match).toBeDefined()
      expect(match.id).toBe('mov-1')
    })

    it('ignores movements with different amount, account or > 3 days diff', () => {
      const manualMovements = [
        {
          id: 'mov-late',
          type: 'income',
          amount: 1500000,
          accountId: 'acc-bbva',
          date: '2026-10-19', // 4 días de diferencia (> 3)
        },
        {
          id: 'mov-wrong-amount',
          type: 'income',
          amount: 1200000,
          accountId: 'acc-bbva',
          date: '2026-10-15',
        },
        {
          id: 'mov-already-linked',
          type: 'income',
          amount: 1500000,
          accountId: 'acc-bbva',
          date: '2026-10-15',
          recurringIncomeId: 'rec-other',
        },
      ]

      const match = findMatchingManualIncome({
        occurrence,
        recurringIncome,
        manualMovements,
      })

      expect(match).toBeNull()
    })
  })

  describe('createMovementFromRecurringIncome', () => {
    it('creates movement payload with default values and allows amount/date overrides', () => {
      const rec = {
        id: 'rec-1',
        name: 'Sueldo',
        amountCents: 2000000,
        currency: 'MXN',
        accountId: 'acc-nu',
        categoryId: 'cat-salario',
      }
      const occ = {
        dueDate: '2026-10-15',
      }

      const defaultPayload = createMovementFromRecurringIncome({
        recurringIncome: rec,
        occurrence: occ,
      })

      expect(defaultPayload).toEqual({
        type: 'income',
        amount: 2000000,
        currency: 'MXN',
        accountId: 'acc-nu',
        categoryId: 'cat-salario',
        date: '2026-10-15',
        note: 'Sueldo',
        recurringIncomeId: 'rec-1',
        recurringDueDate: '2026-10-15',
      })

      // Con monto y fecha editada
      const customPayload = createMovementFromRecurringIncome({
        recurringIncome: rec,
        occurrence: occ,
        customAmountCents: 2150050,
        customDate: '2026-10-16',
        customAccountId: 'acc-bbva',
      })

      expect(customPayload.amount).toBe(2150050)
      expect(customPayload.date).toBe('2026-10-16')
      expect(customPayload.accountId).toBe('acc-bbva')
    })
  })
})

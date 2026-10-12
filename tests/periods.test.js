import { describe, it, expect } from 'vitest'
import {
  getPeriodRange,
  getPreviousPeriodRange,
  isDateInRange,
  toISODate,
} from '../src/domain/periods.js'

describe('Domain: periods calculations', () => {
  describe('Week period (Monday to Sunday)', () => {
    it('calculates week range with Monday as start', () => {
      // 2026-10-14 es miércoles
      const wednesday = new Date(2026, 9, 14, 12, 0, 0)
      const range = getPeriodRange('week', wednesday)

      expect(range.startDate).toBe('2026-10-12') // Lunes 12 de oct
      expect(range.endDate).toBe('2026-10-18')   // Domingo 18 de oct
    })

    it('calculates Sunday as end of same week', () => {
      // 2026-10-18 es domingo
      const sunday = new Date(2026, 9, 18, 12, 0, 0)
      const range = getPeriodRange('week', sunday)

      expect(range.startDate).toBe('2026-10-12')
      expect(range.endDate).toBe('2026-10-18')
    })

    it('calculates previous week correctly', () => {
      const wednesday = new Date(2026, 9, 14, 12, 0, 0)
      const prevRange = getPreviousPeriodRange('week', wednesday)

      expect(prevRange.startDate).toBe('2026-10-05')
      expect(prevRange.endDate).toBe('2026-10-11')
    })
  })

  describe('Month period', () => {
    it('calculates first and last day of month', () => {
      const date = new Date(2026, 9, 14, 12, 0, 0) // Octubre (mes 9 en 0-index)
      const range = getPeriodRange('month', date)

      expect(range.startDate).toBe('2026-10-01')
      expect(range.endDate).toBe('2026-10-31')
    })

    it('calculates previous month correctly', () => {
      const date = new Date(2026, 9, 14, 12, 0, 0) // Octubre
      const prevRange = getPreviousPeriodRange('month', date)

      expect(prevRange.startDate).toBe('2026-09-01')
      expect(prevRange.endDate).toBe('2026-09-30')
    })
  })

  describe('Year period', () => {
    it('calculates Jan 1 to Dec 31', () => {
      const date = new Date(2026, 5, 10, 12, 0, 0)
      const range = getPeriodRange('year', date)

      expect(range.startDate).toBe('2026-01-01')
      expect(range.endDate).toBe('2026-12-31')
    })

    it('calculates previous year correctly', () => {
      const date = new Date(2026, 5, 10, 12, 0, 0)
      const prevRange = getPreviousPeriodRange('year', date)

      expect(prevRange.startDate).toBe('2025-01-01')
      expect(prevRange.endDate).toBe('2025-12-31')
    })
  })

  describe('Custom range and isDateInRange', () => {
    it('calculates equivalent previous custom range with same day count', () => {
      const custom = { startDate: '2026-10-10', endDate: '2026-10-14' } // 5 días
      const prevRange = getPreviousPeriodRange('custom', new Date(), custom)

      expect(prevRange.endDate).toBe('2026-10-09')
      expect(prevRange.startDate).toBe('2026-10-05') // 5 días antes
    })

    it('validates dates in range', () => {
      expect(isDateInRange('2026-10-12', '2026-10-01', '2026-10-31')).toBe(true)
      expect(isDateInRange('2026-09-30', '2026-10-01', '2026-10-31')).toBe(false)
      expect(isDateInRange('2026-11-01', '2026-10-01', '2026-10-31')).toBe(false)
      expect(isDateInRange('2026-10-12', null, null)).toBe(true) // all
    })
  })
})

import { describe, it, expect } from 'vitest'
import {
  calculateFxChange,
  formatFxRate,
  formatRelativeTime,
} from '../src/domain/fx.js'

describe('Domain: FX calculations and formatters', () => {
  describe('calculateFxChange', () => {
    it('calculates positive percent change and direction correctly', () => {
      // De 18.00 a 18.90 (+5.00%)
      const result = calculateFxChange(18.9, 18.0)
      expect(result.hasPrev).toBe(true)
      expect(result.change).toBe(0.9)
      expect(result.changePct).toBe(5)
      expect(result.direction).toBe('up')
    })

    it('calculates negative percent change and direction correctly', () => {
      // De 20.00 a 19.50 (-2.50%)
      const result = calculateFxChange(19.5, 20.0)
      expect(result.hasPrev).toBe(true)
      expect(result.change).toBe(-0.5)
      expect(result.changePct).toBe(-2.5)
      expect(result.direction).toBe('down')
    })

    it('returns neutral direction when rates are identical', () => {
      const result = calculateFxChange(18.5, 18.5)
      expect(result.hasPrev).toBe(true)
      expect(result.change).toBe(0)
      expect(result.changePct).toBe(0)
      expect(result.direction).toBe('neutral')
    })

    it('handles null or missing prevRate gracefully without breaking', () => {
      const resultNull = calculateFxChange(18.5, null)
      expect(resultNull.hasPrev).toBe(false)
      expect(resultNull.change).toBe(0)
      expect(resultNull.changePct).toBe(0)
      expect(resultNull.direction).toBe('neutral')

      const resultUndefined = calculateFxChange(18.5, undefined)
      expect(resultUndefined.hasPrev).toBe(false)
      expect(resultUndefined.changePct).toBe(0)

      const resultZero = calculateFxChange(18.5, 0)
      expect(resultZero.hasPrev).toBe(false)
      expect(resultZero.changePct).toBe(0)
    })

    it('handles null or missing currentRate gracefully', () => {
      const result = calculateFxChange(null, 18.0)
      expect(result.hasPrev).toBe(false)
      expect(result.changePct).toBe(0)
      expect(result.direction).toBe('neutral')
    })
  })

  describe('formatFxRate', () => {
    it('formats rates with 2 decimal places when trailing zeros exist', () => {
      expect(formatFxRate(18.5)).toBe('18.50')
      expect(formatFxRate(20)).toBe('20.00')
    })

    it('formats rates with up to 4 decimal places when significant', () => {
      expect(formatFxRate(18.6155)).toBe('18.6155')
      expect(formatFxRate(20.123)).toBe('20.1230')
    })

    it('handles invalid or zero values safely', () => {
      expect(formatFxRate(0)).toBe('0.00')
      expect(formatFxRate(null)).toBe('0.00')
      expect(formatFxRate(undefined)).toBe('0.00')
    })
  })

  describe('formatRelativeTime', () => {
    it('formats seconds difference as "hace un momento"', () => {
      const now = new Date(2026, 9, 26, 12, 0, 30)
      const date = new Date(2026, 9, 26, 12, 0, 10) // 20s atrás
      expect(formatRelativeTime(date, now)).toBe('hace un momento')
    })

    it('formats minutes difference as "hace X min"', () => {
      const now = new Date(2026, 9, 26, 12, 15, 0)
      const date = new Date(2026, 9, 26, 12, 10, 0) // 5 min atrás
      expect(formatRelativeTime(date, now)).toBe('hace 5 min')

      const date45 = new Date(2026, 9, 26, 11, 30, 0) // 45 min atrás
      expect(formatRelativeTime(date45, now)).toBe('hace 45 min')
    })

    it('formats hours difference as "hace 1 hora" o "hace X h"', () => {
      const now = new Date(2026, 9, 26, 15, 0, 0)
      const date1h = new Date(2026, 9, 26, 14, 0, 0)
      expect(formatRelativeTime(date1h, now)).toBe('hace 1 hora')

      const date3h = new Date(2026, 9, 26, 12, 0, 0)
      expect(formatRelativeTime(date3h, now)).toBe('hace 3 h')
    })

    it('formats days difference as "hace 1 día" o "hace X días"', () => {
      const now = new Date(2026, 9, 26, 12, 0, 0)
      const yesterday = new Date(2026, 9, 25, 12, 0, 0)
      expect(formatRelativeTime(yesterday, now)).toBe('hace 1 día')

      const threeDaysAgo = new Date(2026, 9, 23, 12, 0, 0)
      expect(formatRelativeTime(threeDaysAgo, now)).toBe('hace 3 días')
    })

    it('handles ISO strings and edge cases', () => {
      const now = new Date('2026-10-26T12:10:00Z')
      const isoStr = '2026-10-26T12:05:00Z'
      expect(formatRelativeTime(isoStr, now)).toBe('hace 5 min')

      expect(formatRelativeTime(null)).toBe('Sin fecha')
      expect(formatRelativeTime('invalid-date')).toBe('Fecha inválida')
    })
  })
})

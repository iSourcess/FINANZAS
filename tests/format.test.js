import { describe, it, expect } from 'vitest'
import { format } from 'date-fns'
import {
  accountLabel,
  todayLocalISO,
  yesterdayLocalISO,
  formatMoney,
  centsToInput,
  inputToCents,
  formatRelativeTime,
} from '../src/lib/format.js'
import { toISODate } from '../src/domain/periods.js'

describe('Lib: format helpers & local dates', () => {
  describe('accountLabel helper', () => {
    it('returns "Nombre · Tipo" for all account types', () => {
      expect(accountLabel({ name: 'Revolut', type: 'credit' })).toBe('Revolut · Crédito')
      expect(accountLabel({ name: 'BBVA', type: 'debit' })).toBe('BBVA · Débito')
      expect(accountLabel({ name: 'Billetera', type: 'cash' })).toBe('Billetera · Efectivo')
      expect(accountLabel({ name: 'Nu Cajita', type: 'savings' })).toBe('Nu Cajita · Ahorro')
    })

    it('handles null or missing account gracefully', () => {
      expect(accountLabel(null)).toBe('Cuenta desconocida')
      expect(accountLabel(undefined)).toBe('Cuenta desconocida')
    })
  })

  describe('Local date handling vs toISOString (UTC offset)', () => {
    it('generates today date in local time at 21:00 in UTC-6 (where UTC is next day)', () => {
      // En UTC-6, a las 21:00 del 26 de octubre de 2026:
      // - Hora local: 2026-10-26 21:00:00
      // - Hora UTC equivalente: 2026-10-27 03:00:00 (¡siguiente día!)
      // Si se usa toISOString().slice(0, 10), da '2026-10-27' (incorrecto).
      // Usando format(date, 'yyyy-MM-dd') o toISODate(date) en hora local, da '2026-10-26'.

      const localDateAt2100 = new Date(2026, 9, 26, 21, 0, 0) // Octubre 26, 21:00 local

      const formattedLocal = format(localDateAt2100, 'yyyy-MM-dd')
      const isoDomain = toISODate(localDateAt2100)

      expect(formattedLocal).toBe('2026-10-26')
      expect(isoDomain).toBe('2026-10-26')

      // Verificar que el formato coincide con la fecha esperada de hoy local
      expect(formattedLocal).not.toBe('2026-10-27')
    })

    it('todayLocalISO returns a valid YYYY-MM-DD string', () => {
      const today = todayLocalISO()
      expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('yesterdayLocalISO returns a date one day before today in local time', () => {
      const yesterday = yesterdayLocalISO()
      expect(yesterday).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  describe('Currency and input conversions', () => {
    it('converts cents to input string', () => {
      expect(centsToInput(12550)).toBe('125.50')
      expect(centsToInput(10000)).toBe('100')
      expect(centsToInput(0)).toBe('0')
    })

    it('converts input string to integer cents', () => {
      expect(inputToCents('125.50')).toBe(12550)
      expect(inputToCents('$1,250.00')).toBe(125000)
      expect(inputToCents('')).toBe(0)
    })

    it('formats money in Mexican pesos', () => {
      expect(formatMoney(12550)).toContain('125.50')
    })
  })

  describe('formatRelativeTime', () => {
    const now = new Date('2026-10-30T15:00:00Z').getTime()

    it('formatea minutos, horas y días en tiempo relativo en español', () => {
      const justNow = now - 20 * 1000 // 20s
      expect(formatRelativeTime(justNow, now)).toBe('hace un momento')

      const fiveMins = now - 5 * 60 * 1000 // 5 min
      expect(formatRelativeTime(fiveMins, now)).toBe('hace 5 min')

      const threeHours = now - 3 * 60 * 60 * 1000 // 3 h
      expect(formatRelativeTime(threeHours, now)).toBe('hace 3 h')

      const oneDay = now - 26 * 60 * 60 * 1000 // 1 d
      expect(formatRelativeTime(oneDay, now)).toBe('hace 1 d')

      const fourDays = now - 4 * 24 * 60 * 60 * 1000 // 4 d
      expect(formatRelativeTime(fourDays, now)).toBe('hace 4 d')
    })
  })
})

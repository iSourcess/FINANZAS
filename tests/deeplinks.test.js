import { describe, it, expect } from 'vitest'
import { parseDeepLink } from '../src/domain/deeplinks.js'

describe('Domain: Deeplinks parser (finanzas://)', () => {
  it('parses finanzas://register?type=expense correctly', () => {
    const res = parseDeepLink('finanzas://register?type=expense')
    expect(res.isValid).toBe(true)
    expect(res.route).toBe('/registrar')
    expect(res.movementType).toBe('expense')
    expect(res.fullPath).toBe('/registrar?type=expense')
    expect(res.searchParams).toEqual({ type: 'expense' })
  })

  it('parses finanzas://registrar?type=income correctly', () => {
    const res = parseDeepLink('finanzas://registrar?type=income')
    expect(res.isValid).toBe(true)
    expect(res.route).toBe('/registrar')
    expect(res.movementType).toBe('income')
    expect(res.fullPath).toBe('/registrar?type=income')
  })

  it('supports Spanish aliases like type=gasto and type=ingreso', () => {
    const expense = parseDeepLink('finanzas://registrar?type=gasto')
    expect(expense.movementType).toBe('expense')

    const income = parseDeepLink('finanzas://registrar?type=ingreso')
    expect(income.movementType).toBe('income')
  })

  it('parses finanzas://overview into /panorama', () => {
    const res = parseDeepLink('finanzas://overview')
    expect(res.isValid).toBe(true)
    expect(res.route).toBe('/panorama')
    expect(res.fullPath).toBe('/panorama')
  })

  it('parses finanzas://cuentas and finanzas://accounts into /cuentas', () => {
    const res1 = parseDeepLink('finanzas://cuentas')
    expect(res1.route).toBe('/cuentas')

    const res2 = parseDeepLink('finanzas://accounts')
    expect(res2.route).toBe('/cuentas')
  })

  it('parses finanzas://settings and finanzas://ajustes into /ajustes', () => {
    const res = parseDeepLink('finanzas://settings')
    expect(res.route).toBe('/ajustes')
  })

  it('handles shortcuts with extra slashes finanzas:///registrar?type=expense', () => {
    const res = parseDeepLink('finanzas:///registrar?type=expense')
    expect(res.isValid).toBe(true)
    expect(res.route).toBe('/registrar')
    expect(res.movementType).toBe('expense')
  })

  it('handles direct paths like /registrar?type=expense or #/registrar', () => {
    const res1 = parseDeepLink('/registrar?type=expense')
    expect(res1.isValid).toBe(true)
    expect(res1.route).toBe('/registrar')
    expect(res1.movementType).toBe('expense')

    const res2 = parseDeepLink('#/panorama')
    expect(res2.isValid).toBe(true)
    expect(res2.route).toBe('/panorama')
  })

  it('handles shortcut paths like finanzas://gasto and finanzas://ingreso directly', () => {
    const resGasto = parseDeepLink('finanzas://gasto')
    expect(resGasto.route).toBe('/registrar')
    expect(resGasto.movementType).toBe('expense')

    const resIngreso = parseDeepLink('finanzas://ingreso')
    expect(resIngreso.route).toBe('/registrar')
    expect(resIngreso.movementType).toBe('income')
  })

  it('returns fallback for invalid or empty urls', () => {
    expect(parseDeepLink('')).toEqual({
      isValid: false,
      route: '/registrar',
      fullPath: '/registrar',
      searchParams: {},
      movementType: null,
    })

    expect(parseDeepLink(null).isValid).toBe(false)
    expect(parseDeepLink('https://google.com').isValid).toBe(false)
  })

  it('preserves additional query parameters', () => {
    const res = parseDeepLink('finanzas://registrar?type=expense&amount=250.00&note=Comida')
    expect(res.searchParams.amount).toBe('250.00')
    expect(res.searchParams.note).toBe('Comida')
    expect(res.movementType).toBe('expense')
  })
})

import { describe, it, expect } from 'vitest'
import { convertCurrency } from '../src/domain/currency.js'

describe('Domain: currency conversion', () => {
  it('returns same amount if currencies are identical', () => {
    expect(convertCurrency(5000, 20.0, 'MXN', 'MXN')).toBe(5000)
    expect(convertCurrency(1000, 20.0, 'USD', 'USD')).toBe(1000)
  })

  it('converts USD to MXN with decimal rate', () => {
    // $10.00 USD (1000 cents) at 20.0 MXN/USD = $200.00 MXN (20000 cents)
    expect(convertCurrency(1000, 20.0, 'USD', 'MXN')).toBe(20000)
  })

  it('converts USD to MXN with rate in cents', () => {
    // fxRate 1950 (19.50) -> $10.00 USD = $195.00 MXN
    expect(convertCurrency(1000, 1950, 'USD', 'MXN')).toBe(19500)
  })

  it('converts MXN to USD with rounding to integer cents', () => {
    // $200.00 MXN (20000 cents) at 20.0 MXN/USD = $10.00 USD (1000 cents)
    expect(convertCurrency(20000, 20.0, 'MXN', 'USD')).toBe(1000)
  })

  it('handles 0 or null cleanly', () => {
    expect(convertCurrency(0, 20.0, 'USD', 'MXN')).toBe(0)
    expect(convertCurrency(null, 20.0, 'USD', 'MXN')).toBe(0)
  })

  it('uses active rate provider when fxRate is not provided', async () => {
    const { setRateProvider } = await import('../src/domain/currency.js')
    setRateProvider((curr) => (curr === 'USD' ? 19.0 : 21.0))

    // Sin pasar fxRate (o pasando null), debe resolver con la tasa del provider
    expect(convertCurrency(1000, null, 'USD', 'MXN')).toBe(19000)
    expect(convertCurrency(1000, undefined, 'EUR', 'MXN')).toBe(21000)
  })
})


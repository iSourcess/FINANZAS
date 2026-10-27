import { describe, it, expect } from 'vitest'
import { calculateWidgetSnapshot, formatWidgetAmount } from '../src/domain/widgetSnapshot.js'

describe('Domain: widgetSnapshot', () => {
  const fakeMovements = [
    // Movimientos de hoy (2026-10-27)
    { id: '1', date: '2026-10-27', type: 'expense', amount: 15000 }, // $150.00
    { id: '2', date: '2026-10-27', type: 'expense', amount: 4550 },  // $45.50
    { id: '3', date: '2026-10-27', type: 'income', amount: 50000 },   // $500.00
    // Transferencia de hoy (no debe afectar balance)
    { id: '4', date: '2026-10-27', type: 'transfer', amount: 20000 },
    // Movimientos del mismo mes pero otros días
    { id: '5', date: '2026-10-15', type: 'expense', amount: 30000 }, // $300.00
    { id: '6', date: '2026-10-01', type: 'income', amount: 120000 }, // $1,200.00
    // Movimiento de otro mes anterior (2026-09)
    { id: '7', date: '2026-09-28', type: 'expense', amount: 80000 },
  ]

  it('calculates todaySpentCents and monthBalanceCents accurately in cents', () => {
    const snapshot = calculateWidgetSnapshot({
      movements: fakeMovements,
      todayDateStr: '2026-10-27',
      currentMonthPrefix: '2026-10',
      showAmountsOnWidget: true,
      hideAmounts: false,
    })

    // Gastado hoy: 15000 + 4550 = 19550
    expect(snapshot.todaySpentCents).toBe(19550)

    // Mes en curso:
    // Ingresos: 50000 (hoy) + 120000 (día 1) = 170000
    // Gastos: 15000 + 4550 + 30000 = 49550
    // Balance: 170000 - 49550 = 120450
    expect(snapshot.monthBalanceCents).toBe(120450)
    expect(snapshot.currency).toBe('MXN')
    expect(snapshot.showAmounts).toBe(true)
  })

  it('keeps showAmounts as false if showAmountsOnWidget is false (default privacy)', () => {
    const snapshot = calculateWidgetSnapshot({
      movements: fakeMovements,
      todayDateStr: '2026-10-27',
      showAmountsOnWidget: false,
      hideAmounts: false,
    })

    expect(snapshot.showAmounts).toBe(false)
  })

  it('forces showAmounts to false if private mode (hideAmounts) is enabled even if widget setting is on', () => {
    const snapshot = calculateWidgetSnapshot({
      movements: fakeMovements,
      todayDateStr: '2026-10-27',
      showAmountsOnWidget: true,
      hideAmounts: true, // Modo privado activo en la app
    })

    expect(snapshot.showAmounts).toBe(false)
  })

  it('ignores invalid or non-positive movements gracefully', () => {
    const dirtyMovements = [
      null,
      undefined,
      { amount: 0, date: '2026-10-27', type: 'expense' },
      { amount: -500, date: '2026-10-27', type: 'expense' },
      { amount: 5000, date: '2026-10-27', type: 'expense' },
    ]

    const snapshot = calculateWidgetSnapshot({
      movements: dirtyMovements,
      todayDateStr: '2026-10-27',
      showAmountsOnWidget: true,
    })

    expect(snapshot.todaySpentCents).toBe(5000)
    expect(snapshot.monthBalanceCents).toBe(-5000)
  })

  describe('formatWidgetAmount', () => {
    it('returns masked string when showAmounts is false', () => {
      expect(formatWidgetAmount(19550, false)).toBe('••••')
      expect(formatWidgetAmount(-120450, false)).toBe('••••')
    })

    it('formats positive and negative amounts cleanly when showAmounts is true', () => {
      expect(formatWidgetAmount(19550, true)).toBe('$195.50')
      expect(formatWidgetAmount(-4500, true)).toBe('-$45.00')
      expect(formatWidgetAmount(120450, true, 'MXN', true)).toBe('+$1,204.50')
    })
  })
})

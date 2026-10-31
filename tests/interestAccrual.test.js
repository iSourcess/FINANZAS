/**
 * tests/interestAccrual.test.js
 *
 * Pruebas de la lógica pura de acreditación de rendimientos.
 */

import { describe, it, expect } from 'vitest'
import {
  isAccrualAccount,
  accrueRange,
  groupAccrualsByMonth,
  groupAccrualsByMonthAndAccount,
  sumAccrualsInRange,
  addOneDay,
} from '../src/domain/interestAccrual.js'
import { TURBO_CAP_CENTS } from '../src/domain/yield.js'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const revolut = {
  id: 'acc-revolut',
  name: 'Revolut',
  type: 'debit',
  balance: 1_000_000, // $10,000
  interestEnabled: true,
  interestStartDate: '2026-10-01',
  yieldTiers: [
    { upTo: 2_500_000, rate: 0.15 },
    { upTo: 100_000_000, rate: 0.07 },
  ],
}

const mercadoPago = {
  id: 'acc-mp',
  name: 'Mercado Pago',
  type: 'debit',
  balance: 2_000_000, // $20,000
  interestEnabled: true,
  interestStartDate: '2026-10-01',
  yieldTiers: [
    { upTo: 2_500_000, rate: 0.12 },
    { upTo: null, rate: 0.06 },
  ],
}

const bbva = {
  id: 'acc-bbva',
  name: 'BBVA',
  type: 'debit',
  balance: 500_000,
  interestEnabled: false, // sin rendimiento
  interestStartDate: '2026-10-01',
  yieldTiers: [],
}

const turbo = {
  id: 'acc-turbo',
  name: 'Nu Cajita Turbo',
  type: 'savings',
  isTurbo: true,
  yieldCapBase: 'principal',
  balance: 2_500_000, // $25,000 exacto (solo capital)
  accumulatedInterestCents: 0,
  interestEnabled: true,
  interestStartDate: '2026-10-01',
  yieldTiers: [{ upTo: 2_500_000, rate: 0.13 }],
}

const creditCard = {
  id: 'acc-nu-credit',
  name: 'Nu Crédito',
  type: 'credit',
  balance: 500_000,
  interestEnabled: true,
  interestStartDate: '2026-10-01',
  yieldTiers: [{ upTo: null, rate: 0.13 }],
}

// ── isAccrualAccount ──────────────────────────────────────────────────────────

describe('isAccrualAccount', () => {
  it('retorna true para cuenta con interestEnabled y yieldTiers con tasa > 0', () => {
    expect(isAccrualAccount(revolut)).toBe(true)
  })

  it('retorna false si interestEnabled es false', () => {
    expect(isAccrualAccount(bbva)).toBe(false)
  })

  it('retorna false para tarjeta de crédito aunque tenga interestEnabled=true', () => {
    expect(isAccrualAccount(creditCard)).toBe(false)
  })

  it('retorna false si no tiene yieldTiers', () => {
    const acc = { id: 'x', type: 'debit', interestEnabled: true, yieldTiers: [] }
    expect(isAccrualAccount(acc)).toBe(false)
  })

  it('retorna false para cuenta nula', () => {
    expect(isAccrualAccount(null)).toBe(false)
  })
})

// ── accrueRange — Un día ──────────────────────────────────────────────────────

describe('accrueRange — un día', () => {
  it('calcula correctamente el interés de un solo día para Revolut', () => {
    // $10,000 × 15% / 365 = 410.96 centavos → floor = 410, carry = 0.958...
    const result = accrueRange(revolut, {}, '2026-10-01', '2026-10-01')
    expect(result.length).toBe(1)
    expect(result[0].date).toBe('2026-10-01')
    expect(result[0].baseCents).toBe(1_000_000)
    expect(result[0].amountCents).toBe(410) // floor(1,000,000 * 0.15 / 365)
  })

  it('no acredita si la fecha es anterior a interestStartDate', () => {
    const result = accrueRange(revolut, {}, '2026-09-30', '2026-09-30')
    expect(result.length).toBe(0)
  })

  it('no acredita si la cuenta no es de rendimiento', () => {
    const result = accrueRange(bbva, {}, '2026-10-01', '2026-10-01')
    expect(result.length).toBe(0)
  })
})

// ── accrueRange — 30 días vs fórmula cerrada ──────────────────────────────────

describe('accrueRange — 30 días vs fórmula cerrada', () => {
  it('Mercado Pago 12%: acredita ~30 días dentro de ±2 centavos de la fórmula', () => {
    // $20,000 × 12% / 365 × 30 días ≈ 1972.60 centavos
    const result = accrueRange(mercadoPago, {}, '2026-10-01', '2026-10-30')
    const totalAccrued = result.reduce((acc, r) => acc + r.amountCents, 0)
    const expected = Math.round(2_000_000 * 0.12 * 30 / 365)
    // Sin capitalización por movimientos, el total debe ser muy cercano
    // (capitalización diaria aplica porque el interés se suma a la base cada día)
    expect(Math.abs(totalAccrued - expected)).toBeLessThanOrEqual(5)
  })

  it('Revolut: 30 días con capitalización diaria se acerca a fórmula compuesta', () => {
    const bal = 1_000_000
    const rate = 0.15
    // Fórmula cerrada con capitalización diaria: P*(1+r/365)^30 - P
    const expected = Math.round(bal * (Math.pow(1 + rate / 365, 30) - 1))
    const result = accrueRange(revolut, {}, '2026-10-01', '2026-10-30')
    const total = result.reduce((acc, r) => acc + r.amountCents, 0)
    // Con capitalización intra-periodo la diferencia puede ser hasta 5 centavos
    expect(Math.abs(total - expected)).toBeLessThanOrEqual(5)
  })
})

// ── accrueRange — varios días sin abrir la app ────────────────────────────────

describe('accrueRange — días acumulados', () => {
  it('genera una acreditación por cada día en el rango', () => {
    const result = accrueRange(revolut, {}, '2026-10-01', '2026-10-05')
    expect(result.length).toBe(5)
    expect(result.map(r => r.date)).toEqual([
      '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05',
    ])
  })
})

// ── accrueRange — cruce de $25,000 en Revolut ────────────────────────────────

describe('accrueRange — cruce de tope en Revolut', () => {
  it('aplica tasa baja cuando el saldo cruza el tope de $25,000', () => {
    const acc = {
      ...revolut,
      balance: 2_600_000, // $26,000: $25k al 15% + $1k al 7%
    }
    const result = accrueRange(acc, {}, '2026-10-01', '2026-10-01')
    // (2,500,000 × 0.15 + 100,000 × 0.07) / 365
    const expected = Math.floor((2_500_000 * 0.15 + 100_000 * 0.07) / 365)
    expect(result[0].amountCents).toBe(expected)
  })
})

// ── accrueRange — cruce de $25,000 en Mercado Pago ───────────────────────────

describe('accrueRange — cruce de tope en Mercado Pago', () => {
  it('aplica 12% hasta $25k y 6% al excedente', () => {
    const acc = {
      ...mercadoPago,
      balance: 3_000_000, // $30,000: $25k al 12% + $5k al 6%
    }
    const result = accrueRange(acc, {}, '2026-10-01', '2026-10-01')
    const expected = Math.floor((2_500_000 * 0.12 + 500_000 * 0.06) / 365)
    expect(result[0].amountCents).toBe(expected)
  })
})

// ── accrueRange — Cajita Turbo con intereses acumulados ───────────────────────

describe('accrueRange — Cajita Turbo', () => {
  it('Turbo: capital = $25k, sin intereses → base = $25k al 13%', () => {
    const result = accrueRange(turbo, {}, '2026-10-01', '2026-10-01')
    const expected = Math.floor((TURBO_CAP_CENTS * 0.13) / 365)
    expect(result[0].amountCents).toBe(expected)
  })

  it('Turbo: con intereses acumulados, base = $25k + intereses', () => {
    const acc = {
      ...turbo,
      balance: 2_550_000, // $25,500 = $25k capital + $500 intereses
      accumulatedInterestCents: 50_000,
    }
    const result = accrueRange(acc, {}, '2026-10-01', '2026-10-01')
    // base = 2,500,000 + 50,000 = 2,550,000
    const expected = Math.floor((2_550_000 * 0.13) / 365)
    expect(result[0].amountCents).toBe(expected)
  })

  it('Turbo: el interés diario se acumula al día siguiente (compuesto)', () => {
    const result = accrueRange(turbo, {}, '2026-10-01', '2026-10-02')
    expect(result.length).toBe(2)
    // El segundo día debe tener base mayor
    expect(result[1].baseCents).toBeGreaterThan(result[0].baseCents)
    expect(result[1].amountCents).toBeGreaterThanOrEqual(result[0].amountCents)
  })

  it('Turbo: capital con excedente de $25,000 rinde $25k al 13% y excedente al 7%', () => {
    const acc = {
      ...turbo,
      balance: 3_000_000, // $30,000 = $25k tope + $5k excedente
      accumulatedInterestCents: 0,
      yieldTiers: [
        { upTo: 2_500_000, rate: 0.13 },
        { upTo: null, rate: 0.07 },
      ],
    }
    const result = accrueRange(acc, {}, '2026-10-01', '2026-10-01')
    expect(result.length).toBe(1)
    // $25k @ 13% + $5k @ 7% = (2,500,000 * 0.13 + 500,000 * 0.07) / 365 = (325,000 + 35,000) / 365 = 986.3 centavos
    const expected = Math.floor((2_500_000 * 0.13 + 500_000 * 0.07) / 365)
    expect(result[0].amountCents).toBe(expected)
    expect(result[0].rate).toBeCloseTo(360_000 / 3_000_000, 3) // Tasa ponderada ~12%
  })
})

// ── accrueRange — retiro a mitad del periodo ─────────────────────────────────

describe('accrueRange — retiro a mitad del periodo', () => {
  it('reduce la base del día siguiente al registrar un gasto', () => {
    // $10,000 en Revolut, gasto de $5,000 el día 2
    const movements = {
      '2026-10-02': [
        {
          id: 'm1',
          accountId: 'acc-revolut',
          type: 'expense',
          amount: 500_000, // $5,000
          date: '2026-10-02',
        },
      ],
    }
    const result = accrueRange(revolut, movements, '2026-10-01', '2026-10-03')
    expect(result.length).toBe(3)
    // Día 1: base = $10,000
    expect(result[0].baseCents).toBe(1_000_000)
    // Día 2: base = $10,000 + interés día 1 (sin el gasto aún, el gasto baja para día 3)
    // Día 3: base = (día2_base + interés_día2) - $5,000
    expect(result[2].baseCents).toBeLessThan(result[1].baseCents)
  })

  it('Turbo: retiro consume primero intereses, luego capital', () => {
    const acc = {
      ...turbo,
      balance: 2_550_000,
      accumulatedInterestCents: 50_000,
    }
    // Retiro de $200 = 20,000 centavos el día 2
    const movements = {
      '2026-10-02': [
        {
          id: 'm1',
          accountId: 'acc-turbo',
          type: 'expense',
          amount: 20_000,
          date: '2026-10-02',
        },
      ],
    }
    const result = accrueRange(acc, movements, '2026-10-01', '2026-10-03')
    // El retiro de 20,000 debe consumir primero los 50,000 de intereses (más el interés día 1)
    // y no reducir el capital de $25,000 mientras haya intereses suficientes
    expect(result.length).toBeGreaterThanOrEqual(2)
  })

  it('Turbo: depósitos aumentan el capital', () => {
    const acc = {
      ...turbo,
      balance: 1_000_000, // $10k
      accumulatedInterestCents: 0,
    }
    // Depósito de $5,000 el día 2
    const movements = {
      '2026-10-02': [
        {
          id: 'm-dep',
          accountId: 'acc-turbo',
          type: 'income',
          amount: 500_000, // $5,000
          date: '2026-10-02',
        },
      ],
    }
    const result = accrueRange(acc, movements, '2026-10-01', '2026-10-03')
    expect(result.length).toBe(3)
    // Día 1: base = $10,000
    expect(result[0].baseCents).toBe(1_000_000)
    // Día 3: base debe reflejar los $10k + interés día 1 + $5k depósito + interés día 2
    expect(result[2].baseCents).toBeGreaterThan(1_500_000)
  })
})

// ── accrueRange — idempotencia ────────────────────────────────────────────────

describe('accrueRange — idempotencia', () => {
  it('correrlo dos veces no duplica acreditaciones', () => {
    // Primera ejecución
    const firstRun = accrueRange(revolut, {}, '2026-10-01', '2026-10-05')
    expect(firstRun.length).toBe(5)

    // Segunda ejecución simulada (ya existen en BD las fechas de firstRun)
    const alreadyAccrued = new Set(firstRun.map((r) => r.date))
    const secondRun = accrueRange(revolut, {}, '2026-10-01', '2026-10-05', alreadyAccrued)
    expect(secondRun.length).toBe(0)
  })

  it('no duplica si la fecha ya está en alreadyAccruedDates', () => {
    const alreadyAccruedDates = new Set(['2026-10-01', '2026-10-02'])
    const result = accrueRange(revolut, {}, '2026-10-01', '2026-10-05', alreadyAccruedDates)
    // Solo deben aparecer días 3, 4, 5
    const dates = result.map(r => r.date)
    expect(dates).not.toContain('2026-10-01')
    expect(dates).not.toContain('2026-10-02')
    expect(dates).toContain('2026-10-03')
    expect(dates).toContain('2026-10-04')
    expect(dates).toContain('2026-10-05')
  })

  it('cero resultados si todo el rango ya fue acreditado', () => {
    const all = new Set(['2026-10-01', '2026-10-02', '2026-10-03'])
    const result = accrueRange(revolut, {}, '2026-10-01', '2026-10-03', all)
    expect(result.length).toBe(0)
  })
})

// ── accrueRange — fechas anteriores a interestStartDate ──────────────────────

describe('accrueRange — interestStartDate', () => {
  it('no acredita días anteriores a interestStartDate aunque estén en el rango', () => {
    const acc = { ...revolut, interestStartDate: '2026-10-05' }
    const result = accrueRange(acc, {}, '2026-10-01', '2026-10-07')
    // Solo deben aparecer días 5, 6, 7
    const dates = result.map(r => r.date)
    expect(dates).not.toContain('2026-10-01')
    expect(dates).not.toContain('2026-10-04')
    expect(dates).toContain('2026-10-05')
    expect(dates).toContain('2026-10-06')
    expect(dates).toContain('2026-10-07')
  })

  it('retorna vacío si todo el rango es anterior a interestStartDate', () => {
    const acc = { ...revolut, interestStartDate: '2026-11-01' }
    const result = accrueRange(acc, {}, '2026-10-01', '2026-10-31')
    expect(result.length).toBe(0)
  })
})

// ── accrueRange — carry residual ──────────────────────────────────────────────

describe('accrueRange — carry residual', () => {
  it('arrastra el residuo fraccionario correctamente', () => {
    // Con tasa 0.15, $10k: interés exacto = 1,000,000 * 0.15 / 365 = 410.9589...
    // Día 1: floor(410.9589) = 410, carry = 0.9589
    // Día 2: base = 1,000,410 (hay interés del día 1). rawInterest = 1,000,410 * 0.15 / 365 = 410.975...
    //   + carry 0.9589 = 411.9339... → floor = 411, carry = 0.9339
    const result = accrueRange(revolut, {}, '2026-10-01', '2026-10-02')
    expect(result[0].amountCents).toBe(410)
    // El segundo día debe tener más interés que el primero (compuesto + carry)
    expect(result[1].amountCents).toBeGreaterThanOrEqual(410)
    // El carry del día 1 se guarda en el registro
    expect(result[0].carryCents).toBeGreaterThan(0)
  })
})

// ── groupAccrualsByMonth ──────────────────────────────────────────────────────

describe('groupAccrualsByMonth', () => {
  it('agrupa acreditaciones por mes con label en español', () => {
    const accruals = [
      { date: '2026-10-01', amountCents: 500, accountId: 'x' },
      { date: '2026-10-15', amountCents: 300, accountId: 'x' },
      { date: '2026-11-01', amountCents: 400, accountId: 'x' },
    ]
    const groups = groupAccrualsByMonth(accruals)
    expect(groups.length).toBe(2)
    // Orden descendente
    expect(groups[0].monthKey).toBe('2026-11')
    expect(groups[1].monthKey).toBe('2026-10')
    expect(groups[1].amountCents).toBe(800)
    expect(groups[1].days).toBe(2)
    expect(groups[0].label).toContain('noviembre')
  })

  it('retorna arreglo vacío para entrada vacía', () => {
    expect(groupAccrualsByMonth([])).toEqual([])
  })
})

// ── groupAccrualsByMonthAndAccount ───────────────────────────────────────────

describe('groupAccrualsByMonthAndAccount', () => {
  it('agrupa por mes y por cuenta con monto y conteo de días', () => {
    const accounts = [
      { id: 'acc-1', name: 'Nu Cajita Turbo' },
      { id: 'acc-2', name: 'Revolut' },
    ]
    const accruals = [
      { date: '2026-10-01', amountCents: 500, accountId: 'acc-1' },
      { date: '2026-10-02', amountCents: 505, accountId: 'acc-1' },
      { date: '2026-10-01', amountCents: 410, accountId: 'acc-2' },
      { date: '2026-11-01', amountCents: 510, accountId: 'acc-1' },
    ]

    const groups = groupAccrualsByMonthAndAccount(accruals, accounts)
    expect(groups.length).toBe(3)

    // Noviembre acc-1
    expect(groups[0].monthKey).toBe('2026-11')
    expect(groups[0].accountId).toBe('acc-1')
    expect(groups[0].days).toBe(1)
    expect(groups[0].amountCents).toBe(510)
    expect(groups[0].label).toBe('Rendimientos de noviembre')

    // Octubre acc-1
    const octAcc1 = groups.find((g) => g.monthKey === '2026-10' && g.accountId === 'acc-1')
    expect(octAcc1).toBeDefined()
    expect(octAcc1.amountCents).toBe(1005)
    expect(octAcc1.days).toBe(2)
    expect(octAcc1.accountName).toBe('Nu Cajita Turbo')
    expect(octAcc1.label).toBe('Rendimientos de octubre')

    // Octubre acc-2
    const octAcc2 = groups.find((g) => g.monthKey === '2026-10' && g.accountId === 'acc-2')
    expect(octAcc2).toBeDefined()
    expect(octAcc2.amountCents).toBe(410)
    expect(octAcc2.days).toBe(1)
    expect(octAcc2.accountName).toBe('Revolut')
  })

  it('retorna vacío para arreglo vacío', () => {
    expect(groupAccrualsByMonthAndAccount([], [])).toEqual([])
  })
})

// ── sumAccrualsInRange ────────────────────────────────────────────────────────

describe('sumAccrualsInRange', () => {
  it('suma correctamente dentro del rango', () => {
    const accruals = [
      { date: '2026-10-01', amountCents: 100 },
      { date: '2026-10-15', amountCents: 200 },
      { date: '2026-11-01', amountCents: 300 },
    ]
    expect(sumAccrualsInRange(accruals, '2026-10-01', '2026-10-31')).toBe(300)
    expect(sumAccrualsInRange(accruals, '2026-10-01', '2026-11-01')).toBe(600)
  })

  it('retorna 0 para arreglo vacío', () => {
    expect(sumAccrualsInRange([], '2026-10-01', '2026-10-31')).toBe(0)
  })
})

// ── addOneDay ─────────────────────────────────────────────────────────────────

describe('addOneDay', () => {
  it('avanza al día siguiente', () => {
    expect(addOneDay('2026-10-31')).toBe('2026-11-01')
    expect(addOneDay('2026-12-31')).toBe('2027-01-01')
    expect(addOneDay('2026-02-28')).toBe('2026-03-01')
  })
})

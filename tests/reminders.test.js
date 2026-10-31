/**
 * tests/reminders.test.js
 *
 * Pruebas unitarias para la lógica pura del Sistema de Recordatorios (domain/reminders.js).
 */

import { describe, it, expect } from 'vitest'
import {
  computeSchedule,
  DEFAULT_REMINDER_SETTINGS,
  REMINDER_CHANNELS,
} from '../src/domain/reminders.js'

describe('domain/reminders.js — computeSchedule', () => {
  const refDate = '2026-10-26' // Lunes 26 de octubre de 2026

  it('respeta la configuración por defecto (diario apagado, cortes/pagos/gastos activos)', () => {
    const schedule = computeSchedule({}, {}, refDate)
    // Con estado vacío y ajustes default, no hay recordatorios excepto quizá backup el domingo
    const daily = schedule.filter(s => s.channelId === REMINDER_CHANNELS.DAILY_LOG)
    expect(daily.length).toBe(0) // Default está apagado
  })

  it('genera recordatorio de registro diario para los 7 días si está activado y no hay movimientos hoy', () => {
    const settings = {
      reminders: {
        dailyLog: { enabled: true, time: '21:00' },
      },
    }
    const state = {
      hasMovementToday: false,
      movementsToday: [],
    }

    const schedule = computeSchedule(settings, state, refDate)
    const daily = schedule.filter(s => s.channelId === REMINDER_CHANNELS.DAILY_LOG)
    expect(daily.length).toBe(7)
    expect(daily[0].dateStr).toBe('2026-10-26')
    expect(daily[0].title).toBe('¿Registraste tus gastos de hoy?')
    expect(daily[0].route).toBe('/registrar')
  })

  it('omite el recordatorio diario de hoy si ya se registró al menos un movimiento hoy', () => {
    const settings = {
      reminders: {
        dailyLog: { enabled: true, time: '21:00' },
      },
    }
    const state = {
      hasMovementToday: true,
      movementsToday: [{ id: 'mov-1', amount: 5000 }],
    }

    const schedule = computeSchedule(settings, state, refDate)
    const daily = schedule.filter(s => s.channelId === REMINDER_CHANNELS.DAILY_LOG)
    // Debe haber 6 (del día 27 al día 1 de nov), excluyendo el del 26
    expect(daily.length).toBe(6)
    expect(daily[0].dateStr).toBe('2026-10-27')
    expect(daily.find(d => d.dateStr === '2026-10-26')).toBeUndefined()
  })

  it('agenda corte y límite de pago de tarjetas de crédito si caen dentro de la ventana de 7 días', () => {
    const settings = {
      reminders: {
        creditCards: { enabled: true, time: '09:00' },
      },
      privacyMode: false,
    }
    const state = {
      accounts: [
        {
          id: 'card-nu',
          name: 'Nu Moradita',
          type: 'credit',
          balance: 150000, // $1,500.00
          credit: { cutDay: 28, payDay: 5 }, // Corte cae el 28 de oct (dentro de la ventana 26 oct - 1 nov)
        },
      ],
    }

    const schedule = computeSchedule(settings, state, refDate)
    const cuts = schedule.filter(s => s.extra?.type === 'credit_cut')
    expect(cuts.length).toBe(1)
    expect(cuts[0].dateStr).toBe('2026-10-28')
    expect(cuts[0].title).toContain('Nu Moradita')
    expect(cuts[0].channelId).toBe(REMINDER_CHANNELS.PAYMENTS)
  })

  it('agenda gastos fijos pendientes y omite los que ya fueron pagados en el mes', () => {
    const settings = {
      reminders: {
        fixedExpenses: { enabled: true, time: '10:00' },
      },
      privacyMode: false,
    }
    const state = {
      fixedExpenses: [
        { id: 'f-netflix', name: 'Netflix', amount: 21900, dayOfMonth: 29, active: true },
        { id: 'f-spotify', name: 'Spotify', amount: 12900, dayOfMonth: 30, active: true },
      ],
      paidFixedExpenseIdsThisMonth: ['f-netflix'], // Netflix ya pagado
    }

    const schedule = computeSchedule(settings, state, refDate)
    const fixed = schedule.filter(s => s.extra?.type === 'fixed_expense')
    expect(fixed.length).toBe(1)
    expect(fixed[0].title).toContain('Spotify')
    expect(fixed[0].body).toContain('$129.00')
    expect(fixed.find(f => f.title.includes('Netflix'))).toBeUndefined()
  })

  it('agenda ingresos recurrentes previstos dentro de los 7 días', () => {
    const settings = {
      reminders: {
        expectedIncomes: { enabled: true, time: '09:00' },
      },
      privacyMode: false,
    }
    const state = {
      recurringIncomes: [
        {
          id: 'inc-quincena',
          name: 'Quincena',
          amountCents: 1500000,
          frequency: 'biweekly',
          schedule: { day1: 15, day2: 31 }, // 31 de octubre cae dentro de la ventana
          active: true,
          startDate: '2026-01-01',
        },
      ],
    }

    const schedule = computeSchedule(settings, state, refDate)
    const incomes = schedule.filter(s => s.extra?.type === 'expected_income')
    expect(incomes.length).toBe(1)
    expect(incomes[0].dateStr).toBe('2026-10-31')
    expect(incomes[0].title).toBe('Ingreso esperado: Quincena')
    expect(incomes[0].body).toContain('$15,000.00')
  })

  it('agenda recordatorios de deudas por vencer (me deben y debo)', () => {
    const settings = {
      reminders: {
        debts: { enabled: true, time: '09:00' },
      },
      privacyMode: false,
    }
    const state = {
      debts: [
        {
          id: 'd-1',
          person: 'Carlos',
          direction: 'owed_to_me',
          principalCents: 50000,
          currency: 'MXN',
          dueDate: '2026-10-30',
          status: 'open',
        },
        {
          id: 'd-2',
          person: 'Mamá',
          direction: 'i_owe',
          principalCents: 100000,
          currency: 'MXN',
          dueDate: '2026-10-27',
          status: 'open',
        },
      ],
      debtPayments: [
        { id: 'p-1', debtId: 'd-1', amountCents: 10000 }, // restan $400
      ],
    }

    const schedule = computeSchedule(settings, state, refDate)
    const debtNotifs = schedule.filter(s => s.channelId === REMINDER_CHANNELS.DEBTS)
    expect(debtNotifs.length).toBe(2)

    const carlosNotif = debtNotifs.find(d => d.extra.debtId === 'd-1')
    expect(carlosNotif.title).toContain('Recordatorio de cobro: Carlos')
    expect(carlosNotif.body).toContain('$400.00')

    const mamaNotif = debtNotifs.find(d => d.extra.debtId === 'd-2')
    expect(mamaNotif.title).toContain('Vence préstamo con Mamá')
    expect(mamaNotif.body).toContain('$1,000.00')
  })

  it('respeta el modo privado ocultando montos de dinero en el cuerpo de las notificaciones', () => {
    const settings = {
      reminders: {
        fixedExpenses: { enabled: true, time: '10:00' },
        debts: { enabled: true, time: '09:00' },
      },
      privacyMode: true, // Modo privado activo
    }
    const state = {
      fixedExpenses: [
        { id: 'f-1', name: 'Gimnasio', amount: 80000, dayOfMonth: 28, active: true },
      ],
      debts: [
        { id: 'd-1', person: 'Pedro', direction: 'owed_to_me', principalCents: 50000, dueDate: '2026-10-28', status: 'open' },
      ],
      debtPayments: [],
    }

    const schedule = computeSchedule(settings, state, refDate)
    for (const notif of schedule) {
      expect(notif.body).not.toContain('$')
      expect(notif.body).not.toContain('800')
      expect(notif.body).not.toContain('500')
    }
  })

  it('agenda recordatorio de respaldo semanal el domingo', () => {
    const settings = {
      reminders: {
        weeklyBackup: { enabled: true, time: '12:00', dayOfWeek: 0 },
      },
    }
    // Del 26 de oct (lunes) al 1 de nov (domingo)
    const state = {
      lastBackupAt: '2026-10-15T10:00:00.000Z', // Hace más de 7 días
    }

    const schedule = computeSchedule(settings, state, refDate)
    const backup = schedule.filter(s => s.channelId === REMINDER_CHANNELS.BACKUP)
    expect(backup.length).toBe(1)
    expect(backup[0].dateStr).toBe('2026-11-01') // Domingo 1 de noviembre
    expect(backup[0].title).toBe('Respaldo semanal recomendado')
    expect(backup[0].route).toBe('/ajustes')
  })

  it('incluye aviso de detecciones con más de 2 días en el recordatorio diario', () => {
    const settings = {
      reminders: {
        dailyLog: { enabled: true, time: '21:00' },
      },
    }
    const threeDaysAgo = new Date('2026-10-23T10:00:00Z').getTime()
    const state = {
      hasMovementToday: false,
      movementsToday: [],
      pendingDetections: [
        { id: 'det-old', postedAt: threeDaysAgo, status: 'pending' },
      ],
    }

    const schedule = computeSchedule(settings, state, refDate)
    const daily = schedule.filter(s => s.channelId === REMINDER_CHANNELS.DAILY_LOG)
    expect(daily.length).toBe(7)
    expect(daily[0].body).toContain('1 movimiento detectado de hace más de 2 días por confirmar')
  })
})

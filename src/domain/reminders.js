/**
 * src/domain/reminders.js
 *
 * Lógica pura del Sistema Unificado de Recordatorios.
 *
 * Reglas de negocio:
 *   - Lógica pura sin React, sin Dexie, sin efectos secundarios.
 *   - Manejo de fechas en hora local (nada de toISOString).
 *   - Montos en centavos enteros con formateo condicional según privacyMode.
 *   - Genera la agenda de notificaciones para los próximos 7 días a partir de hoy.
 *   - Canales soportados:
 *       1. 'daily_log'  -> Registro diario (si no se ha registrado movimiento hoy).
 *       2. 'payments'   -> Corte y pago de tarjetas, gastos fijos pendientes, ingresos esperados.
 *       3. 'debts'      -> Préstamos y deudas por vencer.
 *       4. 'backup'     -> Respaldo semanal (domingo).
 */

import { toISODate, fromISODate } from './periods.js'
import { getNextCutDate, getNextPayDate } from './creditCards.js'
import { clipDayOfMonth, generateCandidateDueDates } from './recurringIncome.js'
import { calculateDebtRemainingCents, calculateDebtStatus } from './debts.js'
import { formatMoney } from '../lib/format.js'

export const REMINDER_CHANNELS = {
  DAILY_LOG: 'daily_log',
  PAYMENTS: 'payments',
  DEBTS: 'debts',
  BACKUP: 'backup',
}

export const DEFAULT_REMINDER_SETTINGS = {
  dailyLog: { enabled: false, time: '21:00' },
  creditCards: { enabled: true, time: '09:00' },
  fixedExpenses: { enabled: true, time: '10:00' },
  expectedIncomes: { enabled: true, time: '09:00' },
  debts: { enabled: true, time: '09:00' },
  weeklyBackup: { enabled: true, time: '12:00', dayOfWeek: 0 }, // 0 = Domingo
}

/**
 * Parsea un string "HH:mm" a horas y minutos enteros.
 * @param {string} timeStr
 * @param {number} defaultH
 * @param {number} defaultM
 * @returns {{ hours: number, minutes: number }}
 */
function parseTime(timeStr, defaultH = 9, defaultM = 0) {
  if (!timeStr || typeof timeStr !== 'string') {
    return { hours: defaultH, minutes: defaultM }
  }
  const parts = timeStr.split(':')
  const h = parseInt(parts[0], 10)
  const m = parseInt(parts[1], 10)
  return {
    hours: isNaN(h) ? defaultH : Math.max(0, Math.min(23, h)),
    minutes: isNaN(m) ? defaultM : Math.max(0, Math.min(59, m)),
  }
}

/**
 * Combina una fecha 'YYYY-MM-DD' con una hora 'HH:mm' en hora local.
 * @param {string} dateStr
 * @param {string} timeStr
 * @returns {Date}
 */
export function buildScheduledDate(dateStr, timeStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const { hours, minutes } = parseTime(timeStr)
  return new Date(y, m - 1, d, hours, minutes, 0, 0)
}

/**
 * Genera la lista de notificaciones programables para los próximos 7 días.
 *
 * @param {Object} [settings={}] - Ajustes globales y de recordatorios
 * @param {Object} [state={}] - Estado financiero actual
 * @param {Array<Object>} [state.accounts=[]] - Cuentas bancarias
 * @param {Array<Object>} [state.fixedExpenses=[]] - Gastos fijos
 * @param {Array<string>} [state.paidFixedExpenseIdsThisMonth=[]] - Gastos fijos ya pagados en el mes
 * @param {Array<Object>} [state.recurringIncomes=[]] - Ingresos recurrentes
 * @param {Array<Object>} [state.debts=[]] - Deudas y préstamos
 * @param {Array<Object>} [state.debtPayments=[]] - Abonos registrados a deudas
 * @param {Array<Object>} [state.movementsToday=[]] - Movimientos registrados en la fecha de hoy
 * @param {boolean} [state.hasMovementToday=false] - Indica si ya se registró algún movimiento hoy
 * @param {string|null} [state.lastBackupAt=null] - Timestamp ISO del último respaldo
 * @param {Date|string} [refDate=new Date()] - Fecha base de referencia
 * @returns {Array<Object>} Lista ordenada de notificaciones
 */
export function computeSchedule(settings = {}, state = {}, refDate = new Date()) {
  const reminderCfg = {
    dailyLog: { ...DEFAULT_REMINDER_SETTINGS.dailyLog, ...(settings.reminders?.dailyLog || {}) },
    creditCards: { ...DEFAULT_REMINDER_SETTINGS.creditCards, ...(settings.reminders?.creditCards || {}) },
    fixedExpenses: { ...DEFAULT_REMINDER_SETTINGS.fixedExpenses, ...(settings.reminders?.fixedExpenses || {}) },
    expectedIncomes: { ...DEFAULT_REMINDER_SETTINGS.expectedIncomes, ...(settings.reminders?.expectedIncomes || {}) },
    debts: { ...DEFAULT_REMINDER_SETTINGS.debts, ...(settings.reminders?.debts || {}) },
    weeklyBackup: { ...DEFAULT_REMINDER_SETTINGS.weeklyBackup, ...(settings.reminders?.weeklyBackup || {}) },
  }

  const isPrivate = Boolean(settings.privacyMode)

  const baseDateObj = typeof refDate === 'string' ? fromISODate(refDate) : new Date(refDate)
  const todayStr = toISODate(baseDateObj)

  // Ventana de 7 días: [Día 0, Día 1, ..., Día 6]
  const windowDays = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(baseDateObj.getFullYear(), baseDateObj.getMonth(), baseDateObj.getDate() + i, 12, 0, 0)
    windowDays.push(toISODate(d))
  }
  const windowStart = windowDays[0]
  const windowEnd = windowDays[windowDays.length - 1]

  const {
    accounts = [],
    fixedExpenses = [],
    paidFixedExpenseIdsThisMonth = [],
    recurringIncomes = [],
    debts = [],
    debtPayments = [],
    movementsToday = [],
    hasMovementToday = false,
    lastBackupAt = null,
  } = state

  const movementRegisteredToday = hasMovementToday || (Array.isArray(movementsToday) && movementsToday.length > 0)
  const paidFixedSet = new Set(paidFixedExpenseIdsThisMonth || [])

  const scheduledList = []

  // ── 1. REGISTRO DIARIO (Canal: daily_log) ──
  if (reminderCfg.dailyLog.enabled) {
    const time = reminderCfg.dailyLog.time || '21:00'
    for (const dateStr of windowDays) {
      // Si es hoy y ya se registró un movimiento hoy, se cancela/omite el recordatorio de hoy
      if (dateStr === todayStr && movementRegisteredToday) {
        continue
      }

      const scheduledAt = buildScheduledDate(dateStr, time)
      scheduledList.push({
        id: `daily-${dateStr}`,
        channelId: REMINDER_CHANNELS.DAILY_LOG,
        dateStr,
        scheduledAt,
        title: '¿Registraste tus gastos de hoy?',
        body: 'Mantén tu control financiero al día. Toca aquí para registrar tus movimientos de hoy.',
        route: '/registrar',
        extra: { type: 'daily_log', dateStr, route: '/registrar' },
      })
    }
  }

  // ── 2. TARJETAS DE CRÉDITO: CORTE Y PAGO (Canal: payments) ──
  if (reminderCfg.creditCards.enabled) {
    const time = reminderCfg.creditCards.time || '09:00'
    const creditCards = accounts.filter(a => a.type === 'credit' && a.credit)

    for (const card of creditCards) {
      const { cutDay, payDay } = card.credit

      if (cutDay >= 1 && cutDay <= 31) {
        const nextCut = getNextCutDate(cutDay, baseDateObj)
        if (nextCut >= windowStart && nextCut <= windowEnd) {
          scheduledList.push({
            id: `cut-${card.id}-${nextCut}`,
            channelId: REMINDER_CHANNELS.PAYMENTS,
            dateStr: nextCut,
            scheduledAt: buildScheduledDate(nextCut, time),
            title: `Corte de tarjeta: ${card.name}`,
            body: `Hoy es el día de corte de tu tarjeta ${card.name}. Las compras a partir de mañana entrarán en tu siguiente periodo.`,
            route: '/cuentas',
            extra: { type: 'credit_cut', cardId: card.id, route: '/cuentas' },
          })
        }
      }

      if (payDay >= 1 && payDay <= 31 && cutDay) {
        const nextPay = getNextPayDate(payDay, cutDay, baseDateObj)
        if (nextPay >= windowStart && nextPay <= windowEnd) {
          const balanceCents = card.balance || 0
          const amountText = (!isPrivate && balanceCents > 0)
            ? ` (Saldo a pagar: ${formatMoney(balanceCents)})`
            : ''

          scheduledList.push({
            id: `pay-${card.id}-${nextPay}`,
            channelId: REMINDER_CHANNELS.PAYMENTS,
            dateStr: nextPay,
            scheduledAt: buildScheduledDate(nextPay, time),
            title: `Límite de pago: ${card.name}`,
            body: `Hoy es el último día para pagar tu tarjeta ${card.name}${amountText}. Evita intereses y cargos por mora.`,
            route: '/cuentas',
            extra: { type: 'credit_pay', cardId: card.id, route: '/cuentas' },
          })
        }
      }
    }
  }

  // ── 3. GASTOS FIJOS (Canal: payments) ──
  if (reminderCfg.fixedExpenses.enabled) {
    const time = reminderCfg.fixedExpenses.time || '10:00'
    const activeFixed = fixedExpenses.filter(f => f.active !== false)

    for (const fixed of activeFixed) {
      if (paidFixedSet.has(fixed.id)) continue

      const rawDay = fixed.dayOfMonth || 1
      for (const dateStr of windowDays) {
        const [y, m] = dateStr.split('-').map(Number)
        const targetDay = clipDayOfMonth(y, m - 1, rawDay)
        const expectedDateStr = toISODate(new Date(y, m - 1, targetDay, 12, 0, 0))

        if (expectedDateStr === dateStr) {
          const amountText = (!isPrivate && fixed.amount > 0)
            ? ` (${formatMoney(fixed.amount, fixed.currency || 'MXN')})`
            : ''

          scheduledList.push({
            id: `fixed-${fixed.id}-${dateStr}`,
            channelId: REMINDER_CHANNELS.PAYMENTS,
            dateStr,
            scheduledAt: buildScheduledDate(dateStr, time),
            title: `Gasto fijo por pagar: ${fixed.name}`,
            body: `Hoy vence ${fixed.name}${amountText}. Confirma tu pago en Finanzas.`,
            route: '/ajustes',
            extra: { type: 'fixed_expense', fixedId: fixed.id, route: '/ajustes' },
          })
        }
      }
    }
  }

  // ── 4. INGRESOS ESPERADOS (Canal: payments) ──
  if (reminderCfg.expectedIncomes.enabled) {
    const time = reminderCfg.expectedIncomes.time || '09:00'
    const activeIncomes = recurringIncomes.filter(inc => inc.active !== false)

    for (const inc of activeIncomes) {
      const candidates = generateCandidateDueDates(inc, windowStart, windowEnd)
      for (const dateStr of candidates) {
        const amountCents = inc.amountCents || 0
        const amountText = (!isPrivate && amountCents > 0)
          ? ` (${formatMoney(amountCents, inc.currency || 'MXN')})`
          : ''

        scheduledList.push({
          id: `income-${inc.id}-${dateStr}`,
          channelId: REMINDER_CHANNELS.PAYMENTS,
          dateStr,
          scheduledAt: buildScheduledDate(dateStr, time),
          title: `Ingreso esperado: ${inc.name}`,
          body: `Hoy está previsto recibir ${inc.name}${amountText}. Registra tu depósito cuando se acredite.`,
          route: '/registrar',
          extra: { type: 'expected_income', incomeId: inc.id, route: '/registrar' },
        })
      }
    }
  }

  // ── 5. DEUDAS Y PRÉSTAMOS POR VENCER (Canal: debts) ──
  if (reminderCfg.debts.enabled) {
    const time = reminderCfg.debts.time || '09:00'
    const openDebts = debts.filter(d => calculateDebtStatus(d, debtPayments) === 'open' && d.dueDate)

    for (const debt of openDebts) {
      const remainingCents = calculateDebtRemainingCents(debt, debtPayments)
      if (remainingCents <= 0) continue

      const isOwedToMe = debt.direction === 'owed_to_me'
      const amountText = !isPrivate
        ? ` (${formatMoney(remainingCents, debt.currency || 'MXN')})`
        : ''

      // Si vence en alguno de los días de la ventana
      if (debt.dueDate >= windowStart && debt.dueDate <= windowEnd) {
        const dateStr = debt.dueDate
        scheduledList.push({
          id: `debt-${debt.id}-${dateStr}`,
          channelId: REMINDER_CHANNELS.DEBTS,
          dateStr,
          scheduledAt: buildScheduledDate(dateStr, time),
          title: isOwedToMe
            ? `Recordatorio de cobro: ${debt.person}`
            : `Vence préstamo con ${debt.person}`,
          body: isOwedToMe
            ? `Hoy vence el préstamo otorgado a ${debt.person}${amountText}.`
            : `Hoy es la fecha límite para pagar a ${debt.person}${amountText}.`,
          route: '/cuentas',
          extra: { type: 'debt_due', debtId: debt.id, route: '/cuentas' },
        })
      }
    }
  }

  // ── 6. RESPALDO SEMANAL (Canal: backup) ──
  if (reminderCfg.weeklyBackup.enabled) {
    const time = reminderCfg.weeklyBackup.time || '12:00'
    const targetDayOfWeek = reminderCfg.weeklyBackup.dayOfWeek ?? 0 // 0 = Domingo

    for (const dateStr of windowDays) {
      const dObj = fromISODate(dateStr)
      if (dObj.getDay() === targetDayOfWeek) {
        // Verificar si han pasado al menos 5 días desde el último respaldo
        let shouldRemind = true
        if (lastBackupAt) {
          const lastBackupDateStr = lastBackupAt.slice(0, 10)
          const [ly, lm, ld] = lastBackupDateStr.split('-').map(Number)
          const lastBackupDate = new Date(ly, lm - 1, ld, 12, 0, 0)
          const diffDays = Math.round((dObj.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24))
          if (diffDays < 5) {
            shouldRemind = false
          }
        }

        if (shouldRemind) {
          scheduledList.push({
            id: `backup-${dateStr}`,
            channelId: REMINDER_CHANNELS.BACKUP,
            dateStr,
            scheduledAt: buildScheduledDate(dateStr, time),
            title: 'Respaldo semanal recomendado',
            body: 'Protege tu información financiera. Exporta una copia de seguridad para mantener tus datos a salvo.',
            route: '/ajustes',
            extra: { type: 'weekly_backup', route: '/ajustes' },
          })
        }
      }
    }
  }

  // Ordenar cronológicamente por fecha y hora programada
  scheduledList.sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())

  return scheduledList
}

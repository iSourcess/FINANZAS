/**
 * src/services/notifications.js
 *
 * Servicio de notificaciones locales para recordatorios financieros:
 *   - Fecha de corte de tarjetas de crédito.
 *   - Fecha límite de pago de tarjetas de crédito.
 *   - Gastos fijos pendientes de cobro en el mes.
 *
 * Compatible con Capacitor Local Notifications (@capacitor/local-notifications)
 * con fallback a Web Notification API o degradación elegante sin romper la app.
 */

import { formatMoney } from '../lib/format.js'

/**
 * Genera un ID numérico entero de 32 bits a partir de un string para Capacitor.
 * @param {string} str
 * @returns {number}
 */
function hashToInteger(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 2147483647
}

/**
 * Solicita permisos de notificación al usuario.
 * @returns {Promise<boolean>}
 */
export async function requestNotificationPermissions() {
  try {
    const notifPkg = '@capacitor/local-notifications'
    const notifModule = await import(/* @vite-ignore */ notifPkg).catch(() => null)
    const LocalNotifications = notifModule?.LocalNotifications || (typeof window !== 'undefined' ? window.Capacitor?.Plugins?.LocalNotifications : null)
    if (!LocalNotifications) return false

    const status = await LocalNotifications.checkPermissions()
    if (status.display === 'granted') return true

    const req = await LocalNotifications.requestPermissions()
    return req.display === 'granted'
  } catch {
    // Fallback a Web Notifications si está disponible
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission()
      return perm === 'granted'
    }
  }
  return false
}

/**
 * Programa los recordatorios de fecha de corte y pago de tarjetas de crédito,
 * así como los gastos fijos mensuales pendientes.
 *
 * @param {Object} params
 * @param {Array<Object>} [params.accounts=[]] - Cuentas de crédito con campo credit { cutDay, payDay }
 * @param {Array<Object>} [params.pendingRecurring=[]] - Elementos de pendingRecurring con dueDate y fixedExpense
 * @returns {Promise<{ scheduledCount: number, error?: string }>}
 */
export async function scheduleFinancialReminders({
  accounts = [],
  pendingRecurring = [],
} = {}) {
  try {
    const notifPkg = '@capacitor/local-notifications'
    const notifModule = await import(/* @vite-ignore */ notifPkg).catch(() => null)
    const LocalNotifications = notifModule?.LocalNotifications || (typeof window !== 'undefined' ? window.Capacitor?.Plugins?.LocalNotifications : null)
    if (!LocalNotifications) {
      return { scheduledCount: 0, error: 'Módulo de notificaciones locales no disponible.' }
    }

    const hasPerm = await requestNotificationPermissions()
    if (!hasPerm) {
      return { scheduledCount: 0, error: 'Permisos de notificación no otorgados.' }
    }

    const notificationsToSchedule = []
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    // 1. Recordatorios para tarjetas de crédito (Corte y Pago)
    const creditCards = accounts.filter(a => a.type === 'credit' && a.credit)

    for (const card of creditCards) {
      const { cutDay, payDay } = card.credit

      // Recordatorio de corte
      if (cutDay >= 1 && cutDay <= 31) {
        const cutDate = new Date(currentYear, currentMonth, cutDay, 9, 0, 0)
        // Si ya pasó este mes, programar para el mes siguiente
        if (cutDate < now) {
          cutDate.setMonth(cutDate.getMonth() + 1)
        }

        notificationsToSchedule.push({
          id: hashToInteger(`cut-${card.id}-${cutDay}`),
          title: `Corte de tarjeta: ${card.name}`,
          body: `Hoy es el corte de tu tarjeta ${card.name}. Revisa tus movimientos para el nuevo periodo.`,
          schedule: { at: cutDate },
          sound: null,
          extra: { type: 'credit_cut', cardId: card.id },
        })
      }

      // Recordatorio de fecha límite de pago
      if (payDay >= 1 && payDay <= 31) {
        const payDate = new Date(currentYear, currentMonth, payDay, 9, 0, 0)
        if (payDate < now) {
          payDate.setMonth(payDate.getMonth() + 1)
        }

        const balanceText = card.balance > 0 ? ` (Deuda actual: ${formatMoney(card.balance)})` : ''
        notificationsToSchedule.push({
          id: hashToInteger(`pay-${card.id}-${payDay}`),
          title: `Fecha límite de pago: ${card.name}`,
          body: `Hoy es el día límite para pagar tu tarjeta ${card.name}${balanceText}.`,
          schedule: { at: payDate },
          sound: null,
          extra: { type: 'credit_pay', cardId: card.id },
        })
      }
    }

    // 2. Recordatorios de gastos fijos pendientes
    for (const item of pendingRecurring) {
      const fixed = item.fixedExpense
      const day = fixed.dayOfMonth || 1
      const dueDate = new Date(currentYear, currentMonth, day, 10, 0, 0)

      if (dueDate >= now) {
        notificationsToSchedule.push({
          id: hashToInteger(`fixed-${fixed.id}-${item.dueDate}`),
          title: `Gasto fijo pendiente: ${fixed.name}`,
          body: `Hoy vence ${fixed.name} (${formatMoney(fixed.amount)}). Confirma tu pago en Finanzas.`,
          schedule: { at: dueDate },
          sound: null,
          extra: { type: 'fixed_expense', fixedId: fixed.id },
        })
      }
    }

    // Cancelar previas y programar nuevas si hay
    if (notificationsToSchedule.length > 0) {
      // Cancelar notificaciones pendientes existentes
      const pendingList = await LocalNotifications.getPending()
      if (pendingList?.notifications?.length > 0) {
        await LocalNotifications.cancel({ notifications: pendingList.notifications })
      }

      await LocalNotifications.schedule({
        notifications: notificationsToSchedule,
      })
    }

    return { scheduledCount: notificationsToSchedule.length }
  } catch (err) {
    console.warn('[notificationsService] No se pudieron programar recordatorios nativos:', err.message)
    return { scheduledCount: 0, error: err.message }
  }
}

/**
 * src/services/notifications.js
 *
 * Servicio de notificaciones locales y recordatorios financieros unificados:
 *   - Registro diario
 *   - Fecha de corte y límite de pago de tarjetas de crédito
 *   - Gastos fijos pendientes
 *   - Ingresos recurrentes esperados
 *   - Deudas y préstamos por vencer (upcomingDebtDue)
 *   - Respaldo semanal
 *
 * Canales en Android (para silenciarlos por separado):
 *   1. 'daily_log' -> Registro diario
 *   2. 'payments'  -> Cortes, pagos y gastos fijos
 *   3. 'debts'     -> Deudas y préstamos
 *   4. 'backup'    -> Copia de seguridad semanal
 *
 * Programación no exacta:
 *   Usa allowWhileIdle: true sin requerir permiso de alarmas exactas (SCHEDULE_EXACT_ALARM).
 *   Los avisos pueden diferir unos minutos según las políticas de reposo de Android (Doze).
 *   El plugin @capacitor/local-notifications restaura las notificaciones pendientes
 *   tras reiniciar el celular mediante LocalNotificationRestoreReceiver (BOOT_COMPLETED).
 */

import { computeSchedule, REMINDER_CHANNELS } from '../domain/reminders.js'
import { toISODate } from '../domain/periods.js'
import { db } from '../db/database.js'

/**
 * Canales de notificación configurados para Android 8.0+ (API 26+)
 */
export const NOTIFICATION_CHANNELS = [
  {
    id: REMINDER_CHANNELS.DAILY_LOG,
    name: 'Registro diario',
    description: 'Recordatorio nocturno para registrar tus gastos del día',
    importance: 3, // Default
    visibility: 1, // Private
  },
  {
    id: REMINDER_CHANNELS.PAYMENTS,
    name: 'Pagos y Cortes',
    description: 'Fechas de corte, límites de pago de tarjetas y gastos fijos',
    importance: 4, // High
    visibility: 1,
  },
  {
    id: REMINDER_CHANNELS.DEBTS,
    name: 'Deudas y Préstamos',
    description: 'Recordatorios de cobros pendientes y fechas de pago de préstamos',
    importance: 4, // High
    visibility: 1,
  },
  {
    id: REMINDER_CHANNELS.BACKUP,
    name: 'Respaldo',
    description: 'Recordatorio semanal para respaldar tu información financiera',
    importance: 2, // Low
    visibility: 1,
  },
]

/**
 * Genera un ID numérico entero determinista de 32 bits a partir de un string para Capacitor.
 * @param {string} str
 * @returns {number}
 */
export function hashToInteger(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash) % 2147483647
}

/**
 * Obtiene la referencia al plugin de Capacitor LocalNotifications de forma segura.
 * @returns {Promise<Object|null>}
 */
async function getLocalNotificationsPlugin() {
  try {
    const notifPkg = '@capacitor/local-notifications'
    const notifModule = await import(/* @vite-ignore */ notifPkg).catch(() => null)
    return notifModule?.LocalNotifications || (typeof window !== 'undefined' ? window.Capacitor?.Plugins?.LocalNotifications : null)
  } catch {
    return null
  }
}

/**
 * Crea y actualiza los canales de notificación en Android.
 * @returns {Promise<void>}
 */
export async function ensureNotificationChannels() {
  const LocalNotifications = await getLocalNotificationsPlugin()
  if (!LocalNotifications || typeof LocalNotifications.createChannel !== 'function') {
    return
  }

  try {
    for (const channel of NOTIFICATION_CHANNELS) {
      await LocalNotifications.createChannel(channel)
    }
  } catch (err) {
    console.warn('[notifications] Error al crear canales de notificación:', err)
  }
}

/**
 * Consulta el estado actual de los permisos de notificación.
 * @returns {Promise<'granted'|'denied'|'prompt'|'unavailable'>}
 */
export async function checkNotificationPermissions() {
  const LocalNotifications = await getLocalNotificationsPlugin()
  if (LocalNotifications && typeof LocalNotifications.checkPermissions === 'function') {
    try {
      const status = await LocalNotifications.checkPermissions()
      return status?.display || 'prompt'
    } catch {
      // Ignorar y pasar a fallback
    }
  }

  // Fallback web
  if (typeof window !== 'undefined' && 'Notification' in window) {
    if (Notification.permission === 'granted') return 'granted'
    if (Notification.permission === 'denied') return 'denied'
    return 'prompt'
  }

  return 'unavailable'
}

/**
 * Solicita permisos de notificación al sistema operativo.
 * @returns {Promise<boolean>}
 */
export async function requestNotificationPermissions() {
  const LocalNotifications = await getLocalNotificationsPlugin()
  if (LocalNotifications && typeof LocalNotifications.requestPermissions === 'function') {
    try {
      const req = await LocalNotifications.requestPermissions()
      return req?.display === 'granted'
    } catch (err) {
      console.warn('[notifications] Error solicitando permisos nativos:', err)
    }
  }

  // Fallback a Web Notifications si está disponible
  if (typeof window !== 'undefined' && 'Notification' in window) {
    try {
      const perm = await Notification.requestPermission()
      return perm === 'granted'
    } catch {
      return false
    }
  }

  return false
}

/**
 * Reprograma todo el calendario de recordatorios para los próximos 7 días.
 * Cancela las notificaciones previas y programa las nuevas con IDs únicos sin duplicación.
 *
 * Se invoca:
 *   1. Al abrir la app.
 *   2. Al registrar un nuevo movimiento (cancela el diario de hoy).
 *   3. Al cambiar los ajustes de recordatorios.
 *   4. Al modificar gastos fijos, tarjetas, deudas o ingresos recurrentes.
 *
 * @param {Object} [customState] - Estado opcional para omitir lecturas a Dexie
 * @returns {Promise<{ scheduledCount: number, error?: string }>}
 */
export async function rescheduleAll(customState = null) {
  try {
    const LocalNotifications = await getLocalNotificationsPlugin()
    if (!LocalNotifications) {
      return { scheduledCount: 0, error: 'Módulo de notificaciones locales no disponible.' }
    }

    // Asegurar que los canales de Android existan
    await ensureNotificationChannels()

    // Verificar permisos
    const permStatus = await checkNotificationPermissions()
    if (permStatus !== 'granted') {
      return { scheduledCount: 0, error: 'Permisos de notificación no otorgados.' }
    }

    // Cargar estado desde Dexie si no se proporcionó
    let state = customState
    let settings = customState?.settings || null

    if (!state) {
      const todayStr = toISODate(new Date())
      const currentMonthPrefix = todayStr.slice(0, 7) // 'YYYY-MM'

      const [
        accounts,
        fixedExpenses,
        recurringIncomes,
        debts,
        debtPayments,
        todayMovements,
        monthMovements,
        dbSettings,
      ] = await Promise.all([
        db.accounts.toArray().catch(() => []),
        db.fixedExpenses.toArray().catch(() => []),
        db.recurringIncomes ? db.recurringIncomes.toArray().catch(() => []) : [],
        db.debts ? db.debts.toArray().catch(() => []) : [],
        db.debtPayments ? db.debtPayments.toArray().catch(() => []) : [],
        db.movements.where('date').equals(todayStr).toArray().catch(() => []),
        db.movements.where('date').between(`${currentMonthPrefix}-01`, `${currentMonthPrefix}-31`, true, true).toArray().catch(() => []),
        db.settings.get('global').catch(() => null),
      ])

      // Identificar gastos fijos ya pagados en el mes actual
      const paidFixedExpenseIdsThisMonth = monthMovements
        .filter(m => m.fixedId)
        .map(m => m.fixedId)

      settings = dbSettings || {}
      state = {
        accounts,
        fixedExpenses,
        paidFixedExpenseIdsThisMonth,
        recurringIncomes,
        debts,
        debtPayments,
        movementsToday: todayMovements,
        hasMovementToday: todayMovements.length > 0,
        lastBackupAt: settings.lastBackupAt || null,
        settings,
      }
    }

    // Generar la agenda pura de los próximos 7 días
    const scheduleItems = computeSchedule(settings || state.settings || {}, state, new Date())

    // Convertir al formato de Capacitor LocalNotifications
    const notificationsToSchedule = scheduleItems.map(item => ({
      id: hashToInteger(item.id),
      title: item.title,
      body: item.body,
      channelId: item.channelId,
      schedule: {
        at: item.scheduledAt,
        allowWhileIdle: true, // Programación no exacta, no requiere SCHEDULE_EXACT_ALARM
      },
      sound: null,
      extra: {
        ...item.extra,
        route: item.route,
      },
    }))

    // Cancelar todas las notificaciones pendientes existentes para no duplicar
    const pendingList = await LocalNotifications.getPending().catch(() => null)
    if (pendingList?.notifications?.length > 0) {
      await LocalNotifications.cancel({ notifications: pendingList.notifications }).catch(() => null)
    }

    // Programar nuevas notificaciones
    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({
        notifications: notificationsToSchedule,
      })
    }

    return { scheduledCount: notificationsToSchedule.length }
  } catch (err) {
    console.warn('[notifications] Error al reprogramar recordatorios:', err)
    return { scheduledCount: 0, error: err.message }
  }
}

/**
 * Envía una notificación de prueba inmediata para validar que el sistema funcione.
 *
 * @param {string} [channelId='daily_log']
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
export async function sendTestNotification(channelId = REMINDER_CHANNELS.DAILY_LOG) {
  try {
    const LocalNotifications = await getLocalNotificationsPlugin()
    if (!LocalNotifications) {
      return { success: false, error: 'Módulo de notificaciones locales no disponible.' }
    }

    const hasPerm = await requestNotificationPermissions()
    if (!hasPerm) {
      return { success: false, error: 'Permisos de notificación no otorgados.' }
    }

    await ensureNotificationChannels()

    const channelObj = NOTIFICATION_CHANNELS.find(c => c.id === channelId) || NOTIFICATION_CHANNELS[0]

    await LocalNotifications.schedule({
      notifications: [
        {
          id: hashToInteger(`test-${Date.now()}`),
          title: 'Notificación de prueba · Finanzas',
          body: `El canal "${channelObj.name}" está activo y funcionando en tu dispositivo.`,
          channelId: channelObj.id,
          schedule: { at: new Date(Date.now() + 1000) }, // 1 segundo después
          extra: { route: '/ajustes' },
        },
      ],
    })

    return { success: true }
  } catch (err) {
    console.warn('[notifications] Error al enviar notificación de prueba:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Configura el listener global que maneja el toque sobre una notificación
 * y redirige a la pantalla correspondiente.
 *
 * @param {Function} navigate - Función navigate de react-router
 * @param {Function} [isAppLockedFn] - Función opcional que retorna si la app está bloqueada
 * @returns {Promise<Function>} Función para remover el listener al desmontar
 */
let pendingNotificationRoute = null

export function getPendingNotificationRoute() {
  return pendingNotificationRoute
}

export function clearPendingNotificationRoute() {
  pendingNotificationRoute = null
}

export async function setupNotificationNavigationListener(navigate, isAppLockedFn = null) {
  const LocalNotifications = await getLocalNotificationsPlugin()
  if (!LocalNotifications || typeof LocalNotifications.addListener !== 'function') {
    return () => {}
  }

  try {
    const handle = await LocalNotifications.addListener(
      'localNotificationActionPerformed',
      (notificationAction) => {
        const route = notificationAction?.notification?.extra?.route || '/registrar'

        // Si la app está bloqueada, guardar la ruta pendiente y esperar al desbloqueo
        if (typeof isAppLockedFn === 'function' && isAppLockedFn()) {
          pendingNotificationRoute = route
          return
        }

        if (typeof navigate === 'function') {
          navigate(route)
        }
      }
    )

    return () => {
      handle.remove?.()
    }
  } catch (err) {
    console.warn('[notifications] No se pudo registrar el listener de navegación:', err)
    return () => {}
  }
}

// Mantener compatibilidad hacia atrás
export const scheduleFinancialReminders = rescheduleAll

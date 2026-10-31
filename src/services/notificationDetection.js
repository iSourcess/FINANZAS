/**
 * src/services/notificationDetection.js
 *
 * Servicio web para interactuar con el plugin nativo NotificationDetection
 * y la base de datos Dexie (tablas rawSamples, detectionRules y pendingDetections).
 *
 * Reglas de AGENTS.md:
 *   - Manejo seguro si el plugin no está disponible (modo navegador / web).
 *   - Toda lectura/escritura a base de datos envuelta en try/catch.
 *   - Respeto estricto de privacidad y modo captura opt-in.
 */

import { db } from '../db/database.js'
import { isSampleExpired } from '../domain/notificationDetection.js'
import {
  resolveAccountForDetection,
  deduplicatePendingDetection,
} from '../domain/detectionParser.js'

let NotificationDetectionPlugin = null

/**
 * Obtiene de forma perezosa la instancia del plugin de Capacitor.
 */
async function getPlugin() {
  if (NotificationDetectionPlugin) return NotificationDetectionPlugin

  try {
    const corePkg = '@capacitor/core'
    const coreModule = await import(/* @vite-ignore */ corePkg).catch(() => null)
    const Capacitor = coreModule?.Capacitor || (typeof window !== 'undefined' ? window.Capacitor : null)

    if (Capacitor && typeof Capacitor.registerPlugin === 'function') {
      NotificationDetectionPlugin = Capacitor.registerPlugin('NotificationDetection')
    }
  } catch (err) {
    console.warn('[notificationDetection] No se pudo cargar el plugin Capacitor:', err)
  }

  return NotificationDetectionPlugin
}

/**
 * Consulta el estado actual del servicio nativo de notificaciones.
 * @returns {Promise<{ isPermissionGranted: boolean, isConnected: boolean, isDetectionEnabled: boolean }>}
 */
export async function getListenerStatus() {
  const plugin = await getPlugin()
  if (!plugin) {
    return { isPermissionGranted: false, isConnected: false, isDetectionEnabled: false }
  }

  try {
    const res = await plugin.getListenerStatus()
    return {
      isPermissionGranted: Boolean(res?.isPermissionGranted),
      isConnected: Boolean(res?.isConnected),
      isDetectionEnabled: Boolean(res?.isDetectionEnabled),
    }
  } catch (err) {
    console.warn('[notificationDetection] Error en getListenerStatus:', err)
    return { isPermissionGranted: false, isConnected: false, isDetectionEnabled: false }
  }
}

/**
 * Abre la pantalla de ajustes de acceso a notificaciones del sistema Android.
 */
export async function openListenerSettings() {
  const plugin = await getPlugin()
  if (!plugin) return false

  try {
    await plugin.openListenerSettings()
    return true
  } catch (err) {
    console.error('[notificationDetection] Error abriendo ajustes de listener:', err)
    return false
  }
}

/**
 * Abre la pantalla de ajustes de optimización de batería.
 */
export async function openBatteryOptimizationSettings() {
  const plugin = await getPlugin()
  if (!plugin) return false

  try {
    await plugin.openBatteryOptimizationSettings()
    return true
  } catch (err) {
    console.error('[notificationDetection] Error abriendo ajustes de batería:', err)
    return false
  }
}

/**
 * Solicita reconectar el servicio de notificaciones tras suspensión del sistema.
 */
export async function requestRebindService() {
  const plugin = await getPlugin()
  if (!plugin) return false

  try {
    const res = await plugin.requestRebind()
    return Boolean(res?.success)
  } catch (err) {
    console.warn('[notificationDetection] Error solicitando rebind:', err)
    return false
  }
}

/**
 * Sincroniza la lista de aplicaciones bancarias permitidas con el servicio nativo.
 *
 * @param {string[]} packages - Lista de nombres de paquetes permitidos.
 * @param {boolean} enabled - Si la detección general está encendida.
 */
export async function syncAllowlist(packages = [], enabled = false) {
  const plugin = await getPlugin()
  if (!plugin) return false

  try {
    await plugin.setAllowlist({ packages, enabled })
    return true
  } catch (err) {
    console.error('[notificationDetection] Error sincronizando allowlist:', err)
    return false
  }
}

/**
 * Sincroniza las reglas de detección y opciones de notificación con el servicio nativo.
 */
export async function syncDetectionRules({
  rules = [],
  showAmountInNotification = true,
  hideAmounts = false,
  genericOptions = {},
  bankAccountMappings = {},
}) {
  const plugin = await getPlugin()
  if (!plugin) return false

  try {
    await plugin.syncRules({
      rules,
      showAmountInNotification,
      hideAmounts,
      genericOptions,
      bankAccountMappings,
    })
    return true
  } catch (err) {
    console.error('[notificationDetection] Error sincronizando reglas nativas:', err)
    return false
  }
}

/**
 * Consulta la lista de aplicaciones vistas detectadas por el servicio nativo.
 * @returns {Promise<Array<{ packageName: string, appLabel: string, lastSeenAt: string }>>}
 */
export async function fetchSeenApps() {
  const plugin = await getPlugin()
  if (!plugin) return []

  try {
    const res = await plugin.listSeenApps()
    return Array.isArray(res?.apps) ? res.apps : []
  } catch (err) {
    console.warn('[notificationDetection] Error listando apps vistas:', err)
    return []
  }
}

/**
 * Limpia el registro de aplicaciones vistas en el dispositivo.
 */
export async function clearSeenApps() {
  const plugin = await getPlugin()
  if (!plugin) return false

  try {
    await plugin.clearSeenApps()
    return true
  } catch (err) {
    console.warn('[notificationDetection] Error limpiando apps vistas:', err)
    return false
  }
}

/**
 * Drena la cola persistente de notificaciones brutas acumuladas en el servicio nativo.
 * @returns {Promise<Array<Object>>}
 */
export async function drainNotificationQueue() {
  const plugin = await getPlugin()
  if (!plugin) return []

  try {
    const res = await plugin.drainQueue()
    return Array.isArray(res?.notifications) ? res.notifications : []
  } catch (err) {
    console.warn('[notificationDetection] Error al drenar cola:', err)
    return []
  }
}

/**
 * Drena las detecciones pendientes parseadas nativamente acumuladas con la app cerrada.
 * @returns {Promise<Array<Object>>}
 */
export async function drainPendingDetections() {
  const plugin = await getPlugin()
  if (!plugin) return []

  try {
    const res = await plugin.drainPendingDetections()
    return Array.isArray(res?.detections) ? res.detections : []
  } catch (err) {
    console.warn('[notificationDetection] Error al drenar detecciones pendientes:', err)
    return []
  }
}

/**
 * Configura un listener para notificaciones entrantes cuando la app está en primer plano.
 * @param {Function} callback
 * @returns {Promise<Function>}
 */
export async function setupNotificationListener(callback) {
  const plugin = await getPlugin()
  if (!plugin || typeof plugin.addListener !== 'function') {
    return () => {}
  }

  try {
    const handle = await plugin.addListener('notificationReceived', (notif) => {
      if (typeof callback === 'function') {
        callback(notif)
      }
    })

    return () => {
      if (handle && typeof handle.remove === 'function') {
        handle.remove()
      }
    }
  } catch (err) {
    console.warn('[notificationDetection] Error registrando listener de notificaciones:', err)
    return () => {}
  }
}

/**
 * Configura un listener para detecciones procesadas en tiempo real.
 * @param {Function} callback
 * @returns {Promise<Function>}
 */
export async function setupDetectionListener(callback) {
  const plugin = await getPlugin()
  if (!plugin || typeof plugin.addListener !== 'function') {
    return () => {}
  }

  try {
    const handle = await plugin.addListener('detectionReceived', (detection) => {
      if (typeof callback === 'function') {
        callback(detection)
      }
    })

    return () => {
      if (handle && typeof handle.remove === 'function') {
        handle.remove()
      }
    }
  } catch (err) {
    console.warn('[notificationDetection] Error registrando listener de detecciones:', err)
    return () => {}
  }
}

/**
 * Configura un listener para cambios en el estado de conexión del servicio nativo.
 * @param {Function} callback
 * @returns {Promise<Function>}
 */
export async function setupListenerStateChanged(callback) {
  const plugin = await getPlugin()
  if (!plugin || typeof plugin.addListener !== 'function') {
    return () => {}
  }

  try {
    const handle = await plugin.addListener('listenerStateChanged', (state) => {
      if (typeof callback === 'function') {
        callback(state)
      }
    })

    return () => {
      if (handle && typeof handle.remove === 'function') {
        handle.remove()
      }
    }
  } catch (err) {
    console.warn('[notificationDetection] Error registrando listener de estado:', err)
    return () => {}
  }
}

/**
 * Guarda una muestra bruta en rawSamples si el modo captura está habilitado.
 *
 * @param {Object} notif
 * @returns {Promise<number|null>}
 */
export async function saveRawSample(notif) {
  if (!notif) return null

  try {
    const record = {
      packageName: notif.packageName || '',
      appLabel: notif.appLabel || notif.packageName || '',
      title: notif.title || '',
      text: notif.text || '',
      bigText: notif.bigText || '',
      subText: notif.subText || '',
      postTime: Number(notif.postTime) || Date.now(),
      createdAt: notif.createdAt || new Date().toISOString(),
    }

    const id = await db.rawSamples.add(record)
    return id
  } catch (err) {
    console.error('[notificationDetection] Error guardando muestra en rawSamples:', err)
    return null
  }
}

/**
 * Guarda o fusiona una detección pendiente en la tabla pendingDetections de Dexie.
 * Realiza deduplicación (5 minutos) y resolución de cuenta.
 *
 * @param {Object} rawDet
 * @param {Array<Object>} [accounts=[]]
 * @param {Object} [bankAccountMappings={}]
 * @returns {Promise<Object>}
 */
export async function savePendingDetection(rawDet, accounts = [], bankAccountMappings = {}) {
  if (!rawDet) return null

  try {
    // 1. Resolver cuenta si viene nula
    let accountId = rawDet.accountId || null
    if (!accountId) {
      accountId = resolveAccountForDetection(rawDet, accounts, bankAccountMappings)
    }

    const detectionCandidate = {
      packageName: rawDet.packageName || '',
      postedAt: rawDet.postedAt || new Date().toISOString(),
      detectedAt: rawDet.detectedAt || new Date().toISOString(),
      amountCents: rawDet.amountCents != null ? Number(rawDet.amountCents) : null,
      currency: rawDet.currency || 'MXN',
      kind: rawDet.kind || null,
      merchant: rawDet.merchant || null,
      last4: rawDet.last4 || null,
      accountId,
      status: 'pending',
      sources: Array.isArray(rawDet.sources) ? rawDet.sources : [{ packageName: rawDet.packageName }],
      duplicateOf: null,
      matchedFixedId: null,
      parseConfidence: rawDet.parseConfidence || 'medium',
    }

    // 2. Comprobar deduplicación en la base de datos (últimos 10 registros pendientes)
    const existingPending = await db.pendingDetections
      .where('status')
      .equals('pending')
      .reverse()
      .limit(20)
      .toArray()

    const dedup = deduplicatePendingDetection(existingPending, detectionCandidate, 300000)

    if (dedup.isDuplicate && dedup.mergedDetection) {
      await db.pendingDetections.update(dedup.mergedDetection.id, {
        sources: dedup.mergedDetection.sources,
        merchant: dedup.mergedDetection.merchant,
        accountId: dedup.mergedDetection.accountId,
      })
      return dedup.mergedDetection
    }

    // Insertar nueva detección pendiente
    const id = await db.pendingDetections.add(detectionCandidate)
    return { ...detectionCandidate, id }
  } catch (err) {
    console.error('[notificationDetection] Error guardando pendingDetection:', err)
    return null
  }
}

/**
 * Elimina automáticamente las muestras con más de 7 días de antigüedad.
 * @param {number} [maxDays=7]
 * @returns {Promise<number>}
 */
export async function purgeExpiredSamples(maxDays = 7) {
  try {
    const now = Date.now()
    const allSamples = await db.rawSamples.toArray()
    const expiredIds = allSamples
      .filter((sample) => isSampleExpired(sample, maxDays, now))
      .map((s) => s.id)

    if (expiredIds.length > 0) {
      await db.rawSamples.bulkDelete(expiredIds)
    }

    return expiredIds.length
  } catch (err) {
    console.error('[notificationDetection] Error purgando muestras antiguas:', err)
    return 0
  }
}

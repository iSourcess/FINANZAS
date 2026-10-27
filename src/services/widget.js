/**
 * src/services/widget.js
 *
 * Servicio para sincronizar los datos de la app con el widget nativo
 * de la pantalla de inicio (Android AppWidget).
 *
 * Utiliza Capacitor Preferences (SharedPreferences "CapacitorStorage") y
 * el plugin WidgetBridge para redibujar de inmediato.
 */

import { calculateWidgetSnapshot } from '../domain/widgetSnapshot.js'
import { todayLocalISO } from '../lib/format.js'

/**
 * Obtiene el plugin Preferences de Capacitor dinámicamente con fallback.
 */
async function getCapacitorPreferencesPlugin() {
  try {
    const pkg = '@capacitor/preferences'
    const mod = await import(/* @vite-ignore */ pkg)
    return mod.Preferences || mod.default || mod
  } catch {
    if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.Preferences) {
      return window.Capacitor.Plugins.Preferences
    }
    return null
  }
}

/**
 * Obtiene el plugin nativo WidgetBridge registrado en MainActivity.
 */
function getWidgetBridgePlugin() {
  if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.WidgetBridge) {
    return window.Capacitor.Plugins.WidgetBridge
  }
  return null
}

/**
 * Sincroniza el snapshot actual de finanzas con el widget de la pantalla de inicio.
 *
 * @param {Object} params
 * @param {Array<Object>} params.movements - Lista de movimientos
 * @param {Object} [params.settings] - Ajustes actuales de la app
 * @returns {Promise<Object>} Snapshot generado
 */
export async function syncWidgetSnapshot({ movements = [], settings = {} }) {
  const todayDateStr = todayLocalISO()
  const snapshot = calculateWidgetSnapshot({
    movements,
    todayDateStr,
    currentMonthPrefix: todayDateStr.slice(0, 7),
    currency: 'MXN',
    showAmountsOnWidget: Boolean(settings?.showAmountsOnWidget),
    hideAmounts: Boolean(settings?.hideAmounts),
  })

  // 1. Guardar en Capacitor Preferences (archivo SharedPreferences "CapacitorStorage")
  try {
    const Preferences = await getCapacitorPreferencesPlugin()
    if (Preferences && typeof Preferences.set === 'function') {
      await Preferences.set({
        key: 'widget_snapshot',
        value: JSON.stringify(snapshot),
      })
    }
  } catch (err) {
    console.warn('[widget] No se pudo guardar en Preferences:', err)
  }

  // 2. Notificar al plugin nativo WidgetBridge para redibujar las RemoteViews de inmediato
  try {
    const bridge = getWidgetBridgePlugin()
    if (bridge && typeof bridge.refresh === 'function') {
      await bridge.refresh({ snapshot })
    }
  } catch (err) {
    console.warn('[widget] No se pudo invocar WidgetBridge.refresh:', err)
  }

  return snapshot
}

/**
 * Solicita anclar el widget a la pantalla de inicio mediante requestPinAppWidget (Android 8+).
 *
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
export async function requestPinHomeScreenWidget() {
  const bridge = getWidgetBridgePlugin()
  if (!bridge || typeof bridge.requestPinWidget !== 'function') {
    return {
      success: false,
      message: 'La función para anclar widgets no está disponible en este entorno.',
    }
  }

  try {
    const res = await bridge.requestPinWidget()
    return {
      success: Boolean(res?.success),
    }
  } catch (err) {
    return {
      success: false,
      message: err?.message || 'No fue posible anclar el widget automáticamente.',
    }
  }
}

/**
 * Comprueba si el dispositivo soporta anclar widgets programáticamente.
 */
export async function isPinHomeScreenWidgetSupported() {
  const bridge = getWidgetBridgePlugin()
  if (!bridge || typeof bridge.isPinSupported !== 'function') return false

  try {
    const res = await bridge.isPinSupported()
    return Boolean(res?.supported)
  } catch {
    return false
  }
}

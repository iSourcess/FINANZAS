/**
 * src/services/deeplinks.js
 *
 * Servicio para inicializar y gestionar deep links (finanzas://) en Capacitor.
 * Se encarga de:
 *   - Manejar el arranque en frío (cold start) mediante App.getLaunchUrl().
 *   - Escuchar aperturas en caliente (warm start) mediante App.addListener('appUrlOpen').
 *   - Traducir la URL a la ruta canónica con parseDeepLink().
 *   - Reutilizar la cola de espera de desbloqueo (si la app tiene bloqueo activo).
 *   - Comunicación con el plugin nativo QuickSettingsTile para solicitar agregar el mosaico.
 */

import { parseDeepLink } from '../domain/deeplinks.js'
import {
  getPendingNotificationRoute,
  clearPendingNotificationRoute,
} from './notifications.js'

// Cola de ruta pendiente específica para deep links
let pendingDeepLinkRoute = null

export function getPendingDeepLinkRoute() {
  return pendingDeepLinkRoute || getPendingNotificationRoute()
}

export function clearPendingDeepLinkRoute() {
  pendingDeepLinkRoute = null
  clearPendingNotificationRoute()
}

/**
 * Obtiene el plugin App de Capacitor dinámicamente con fallback seguro.
 */
async function getCapacitorAppPlugin() {
  try {
    const appPkg = '@capacitor/app'
    const mod = await import(/* @vite-ignore */ appPkg)
    return mod.App || mod.default || mod
  } catch {
    if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.App) {
      return window.Capacitor.Plugins.App
    }
    return null
  }
}

/**
 * Obtiene el plugin nativo QuickSettingsTile registrado en Android.
 */
function getQuickSettingsTilePlugin() {
  if (typeof window !== 'undefined' && window.Capacitor?.Plugins?.QuickSettingsTile) {
    return window.Capacitor.Plugins.QuickSettingsTile
  }
  return null
}

/**
 * Solicita al sistema operativo agregar el mosaico al panel de Ajustes Rápidos.
 * Disponible en Android 13+ (API 33+).
 *
 * @returns {Promise<{ success: boolean, message?: string }>}
 */
export async function requestAddQuickSettingsTile() {
  const plugin = getQuickSettingsTilePlugin()
  if (!plugin) {
    return {
      success: false,
      message: 'El plugin nativo no está disponible en este entorno.',
    }
  }

  try {
    const res = await plugin.requestAddTile()
    return {
      success: true,
      resultCode: res?.resultCode,
    }
  } catch (err) {
    return {
      success: false,
      message: err?.message || 'No fue posible agregar el mosaico automáticamente.',
    }
  }
}

/**
 * Consulta si el dispositivo soporta la adición programática de mosaicos (Android 13+).
 */
export async function isQuickSettingsTileSupported() {
  const plugin = getQuickSettingsTilePlugin()
  if (!plugin) return false

  try {
    const res = await plugin.isSupported()
    return Boolean(res?.supported)
  } catch {
    return false
  }
}

/**
 * Configura los escuchas de deep links tanto para arranque en frío como en caliente.
 *
 * @param {Function} navigate - Función navigate de react-router
 * @param {Function} [isAppLockedFn] - Función opcional que indica si la app está bloqueada
 * @returns {Promise<Function>} Función de limpieza para remover el listener
 */
export async function setupDeepLinkListener(navigate, isAppLockedFn = null) {
  const App = await getCapacitorAppPlugin()
  if (!App) {
    return () => {}
  }

  const handleDeepLinkUrl = (rawUrl) => {
    if (!rawUrl) return

    const parsed = parseDeepLink(rawUrl)
    if (!parsed.isValid) return

    // Si la app está bloqueada, almacenar la ruta para navegar tras el desbloqueo
    if (typeof isAppLockedFn === 'function' && isAppLockedFn()) {
      pendingDeepLinkRoute = parsed.fullPath
      return
    }

    if (typeof navigate === 'function') {
      navigate(parsed.fullPath)
    }
  }

  try {
    // 1. Manejo de arranque en frío (Cold start)
    if (typeof App.getLaunchUrl === 'function') {
      App.getLaunchUrl()
        .then((launchUrl) => {
          if (launchUrl && launchUrl.url) {
            handleDeepLinkUrl(launchUrl.url)
          }
        })
        .catch((err) => {
          console.warn('[deeplinks] Error verificando getLaunchUrl:', err)
        })
    }

    // 2. Manejo de apertura en caliente (Warm start)
    let listenerHandle = null
    if (typeof App.addListener === 'function') {
      listenerHandle = await App.addListener('appUrlOpen', (event) => {
        if (event && event.url) {
          handleDeepLinkUrl(event.url)
        }
      })
    }

    return () => {
      listenerHandle?.remove?.()
    }
  } catch (err) {
    console.warn('[deeplinks] Error inicializando listener de deep links:', err)
    return () => {}
  }
}

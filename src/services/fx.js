/**
 * src/services/fx.js
 *
 * Servicio de tipo de cambio USD / MXN.
 *
 * Reglas (AGENTS.md y PLAN.md):
 *   - Toda llamada a internet maneja sin conexión, errores y timeouts.
 *   - Si la llamada falla o no hay conexión, usa el valor manual de respaldo guardado en Dexie (settings).
 *   - Nunca rompe la app ni lanza excepciones no controladas.
 */

import { db } from '../db/database.js'

const DEFAULT_FALLBACK_FX = 18.0

/**
 * Obtiene el tipo de cambio USD a MXN.
 *
 * @param {Object} [options]
 * @param {boolean} [options.forceManual=false] - Forzar uso del valor manual
 * @returns {Promise<{
 *   rate: number,
 *   source: 'api' | 'manual' | 'default',
 *   fetchedAt: string,
 *   isFallback: boolean
 * }>}
 */
export async function getUsdMxnRate({ forceManual = false } = {}) {
  // 1. Obtener settings locales de Dexie para tener siempre el valor manual listo
  let manualRate = DEFAULT_FALLBACK_FX
  let fxMode = 'auto'

  try {
    const settings = await db.settings.get('global')
    if (settings) {
      if (settings.fxMode) fxMode = settings.fxMode
      if (settings.fxRateManual != null) {
        // Puede estar guardado como centavos (1700 -> 17.00) o decimal directo (17.5)
        const raw = Number(settings.fxRateManual)
        manualRate = raw > 100 ? raw / 100 : raw
      }
    }
  } catch (err) {
    console.warn('[fxService] No se pudieron leer los ajustes de Dexie:', err)
  }

  // Si el usuario configuró modo manual explícito o se solicita forceManual
  if (forceManual || fxMode === 'manual') {
    return {
      rate: manualRate,
      source: 'manual',
      fetchedAt: new Date().toISOString(),
      isFallback: true,
    }
  }

  // 2. Intentar consultar API en vivo (Frankfurter / Open ER-API) con timeout de 4s
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)

    // Intentar primero con Frankfurter (datos abiertos del Banco Central Europeo)
    const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=MXN', {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      const apiRate = data?.rates?.MXN
      if (typeof apiRate === 'number' && apiRate > 0) {
        return {
          rate: Number(apiRate.toFixed(4)),
          source: 'api',
          fetchedAt: new Date().toISOString(),
          isFallback: false,
        }
      }
    }
  } catch {
    // Si falla o timeout, intentar endpoint de respaldo ligero open.er-api
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3500)

      const response = await fetch('https://open.er-api.com/v6/latest/USD', {
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      if (response.ok) {
        const data = await response.json()
        const apiRate = data?.rates?.MXN
        if (typeof apiRate === 'number' && apiRate > 0) {
          return {
            rate: Number(apiRate.toFixed(4)),
            source: 'api',
            fetchedAt: new Date().toISOString(),
            isFallback: false,
          }
        }
      }
    } catch {
      // Sin internet o error de red
    }
  }

  // 3. Fallback a valor manual si la red falla
  return {
    rate: manualRate,
    source: 'manual',
    fetchedAt: new Date().toISOString(),
    isFallback: true,
  }
}

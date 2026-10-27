/**
 * src/services/fx.js
 *
 * Servicio de tipos de cambio multimoneda (USD/MXN, EUR/MXN).
 *
 * Proveedores:
 *   1. Principal: Frankfurter API (https://api.frankfurter.dev)
 *      - Gratuito, sin API key, datos oficiales de Banco Central Europeo / Banxico.
 *      - Actualización: diaria en días hábiles (~16:00 CET).
 *   2. Respaldo: open.er-api.com (ExchangeRate-API)
 *      - Gratuito, sin API key.
 *      - Actualización: diaria (00:00 UTC).
 *
 * Resiliencia offline y errores:
 *   - Si no hay conexión o falla la red, lee el último valor en Dexie (fxHistory) con `stale: true`.
 *   - Si no hay caché, usa el valor manual de Ajustes (o constante de respaldo).
 *   - Nunca rompe la app ni arroja excepciones no controladas.
 */

import { db } from '../db/database.js'
import { calculateFxChange } from '../domain/fx.js'
import { todayLocalISO } from '../lib/format.js'
import { DEFAULT_FALLBACK_FX_RATES } from '../lib/constants.js'

/**
 * Consulta un par individual contra MXN en Frankfurter.
 * @param {string} base - 'USD' | 'EUR'
 * @param {AbortSignal} signal
 * @returns {Promise<{ rate: number, date: string } | null>}
 */
async function fetchFromFrankfurter(base, signal) {
  const hosts = ['https://api.frankfurter.dev', 'https://api.frankfurter.app']

  for (const host of hosts) {
    try {
      const response = await fetch(`${host}/v1/latest?base=${base}&symbols=MXN`, { signal })
      if (response.ok) {
        const data = await response.json()
        const rate = data?.rates?.MXN
        if (typeof rate === 'number' && rate > 0) {
          return {
            rate: Number(rate.toFixed(4)),
            date: data.date || todayLocalISO(),
          }
        }
      }
    } catch {
      // Intentar siguiente host si es fallo de red
    }
  }
  return null
}

/**
 * Consulta de respaldo un par contra MXN en open.er-api.com.
 * @param {string} base - 'USD' | 'EUR'
 * @param {AbortSignal} signal
 * @returns {Promise<{ rate: number, date: string } | null>}
 */
async function fetchFromOpenErApi(base, signal) {
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${base}`, { signal })
    if (response.ok) {
      const data = await response.json()
      const rate = data?.rates?.MXN
      if (typeof rate === 'number' && rate > 0) {
        return {
          rate: Number(rate.toFixed(4)),
          date: data.time_last_update_utc
            ? new Date(data.time_last_update_utc).toISOString().slice(0, 10)
            : todayLocalISO(),
        }
      }
    }
  } catch {
    // Falla de red o límite alcanzado
  }
  return null
}

/**
 * Obtiene los registros históricos previos más recientes para un par en Dexie.
 * @param {string} pair - 'USD/MXN' | 'EUR/MXN'
 * @returns {Promise<{ latest: Object|null, prev: Object|null }>}
 */
async function getCachedHistory(pair) {
  try {
    if (!db.fxHistory) return { latest: null, prev: null }
    const records = await db.fxHistory
      .where('pair')
      .equals(pair)
      .sortBy('date')

    if (!records || records.length === 0) return { latest: null, prev: null }

    const latest = records[records.length - 1]
    const prev = records.length > 1 ? records[records.length - 2] : null
    return { latest, prev }
  } catch {
    return { latest: null, prev: null }
  }
}

/**
 * Guarda una tasa en la tabla fxHistory de Dexie (un registro por día por par).
 * @param {string} pair
 * @param {string} date
 * @param {number} rate
 */
async function saveToFxHistory(pair, date, rate) {
  try {
    if (!db.fxHistory) return
    const existing = await db.fxHistory
      .where('[pair+date]')
      .equals([pair, date])
      .first()

    const record = {
      pair,
      date,
      rate: Number(rate),
      updatedAt: new Date().toISOString(),
    }

    if (existing) {
      await db.fxHistory.update(existing.id, record)
    } else {
      await db.fxHistory.add(record)
    }
  } catch (err) {
    console.warn('[fxService] No se pudo guardar en fxHistory:', err)
  }
}

/**
 * Obtiene las cotizaciones para una lista de divisas base contra MXN.
 *
 * @param {string[]} [currencies=['USD', 'EUR']] - Códigos de moneda base
 * @returns {Promise<Record<string, {
 *   rate: number,
 *   prevRate: number|null,
 *   changePct: number,
 *   updatedAt: string,
 *   stale: boolean,
 *   source: 'api' | 'cache' | 'manual' | 'default'
 * }>>}
 */
export async function getRates(currencies = ['USD', 'EUR']) {
  const result = {}
  const todayStr = todayLocalISO()

  // 1. Verificar si hay modo manual configurado en Ajustes
  let manualRates = {}
  let fxMode = 'auto'

  try {
    const settings = await db.settings.get('global')
    if (settings) {
      if (settings.fxMode) fxMode = settings.fxMode
      if (settings.fxRateManual != null) {
        const raw = Number(settings.fxRateManual)
        manualRates['USD'] = raw > 100 ? raw / 100 : raw
      }
      if (settings.fxRateManualEur != null) {
        const raw = Number(settings.fxRateManualEur)
        manualRates['EUR'] = raw > 100 ? raw / 100 : raw
      }
    }
  } catch {
    // Si falla Dexie continuar con defaults
  }

  // 2. Procesar cada divisa solicitada
  for (const base of currencies) {
    const pair = `${base}/MXN`
    const { latest: cachedLatest, prev: cachedPrev } = await getCachedHistory(pair)
    const fallbackRate = manualRates[base] || DEFAULT_FALLBACK_FX_RATES[base] || 18.0

    // Si el usuario forzó modo manual en Ajustes
    if (fxMode === 'manual') {
      const { changePct } = calculateFxChange(fallbackRate, cachedPrev?.rate)
      result[base] = {
        rate: fallbackRate,
        prevRate: cachedPrev?.rate || null,
        changePct,
        updatedAt: new Date().toISOString(),
        stale: false,
        source: 'manual',
      }
      continue
    }

    // Intentar consulta en vivo a Frankfurter (Principal) y open.er-api (Respaldo)
    let liveData = null

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)

      liveData = await fetchFromFrankfurter(base, controller.signal)
      clearTimeout(timeoutId)

      // Si falló Frankfurter, probar respaldo con open.er-api
      if (!liveData) {
        const controllerBackup = new AbortController()
        const timeoutBackup = setTimeout(() => controllerBackup.abort(), 3500)
        liveData = await fetchFromOpenErApi(base, controllerBackup.signal)
        clearTimeout(timeoutBackup)
      }
    } catch {
      liveData = null
    }

    if (liveData && liveData.rate > 0) {
      // Éxito con API en vivo
      const nowIso = new Date().toISOString()
      await saveToFxHistory(pair, liveData.date || todayStr, liveData.rate)

      // Calcular variación frente al registro del día anterior
      const effectivePrev = (cachedLatest && cachedLatest.date !== liveData.date)
        ? cachedLatest.rate
        : cachedPrev?.rate || null

      const { changePct } = calculateFxChange(liveData.rate, effectivePrev)

      result[base] = {
        rate: liveData.rate,
        prevRate: effectivePrev,
        changePct,
        updatedAt: nowIso,
        stale: false,
        source: 'api',
      }
    } else if (cachedLatest && cachedLatest.rate > 0) {
      // Sin internet / error: usar último valor en caché marcado como stale
      const { changePct } = calculateFxChange(cachedLatest.rate, cachedPrev?.rate)
      result[base] = {
        rate: cachedLatest.rate,
        prevRate: cachedPrev?.rate || null,
        changePct,
        updatedAt: cachedLatest.updatedAt || new Date().toISOString(),
        stale: true,
        source: 'cache',
      }
    } else {
      // Sin caché ni red: usar valor manual de respaldo
      result[base] = {
        rate: fallbackRate,
        prevRate: null,
        changePct: 0,
        updatedAt: new Date().toISOString(),
        stale: true,
        source: manualRates[base] ? 'manual' : 'default',
      }
    }
  }

  return result
}

/**
 * Helper de compatibilidad para código existente que consulta solo USD/MXN.
 * @param {Object} [options]
 * @param {boolean} [options.forceManual=false]
 * @returns {Promise<{ rate: number, source: string, fetchedAt: string, isFallback: boolean }>}
 */
export async function getUsdMxnRate({ forceManual = false } = {}) {
  const rates = await getRates(['USD'])
  const usdData = rates['USD'] || { rate: 18.0, source: 'default', updatedAt: new Date().toISOString(), stale: true }

  return {
    rate: usdData.rate,
    source: usdData.source,
    fetchedAt: usdData.updatedAt,
    isFallback: usdData.stale || usdData.source !== 'api',
  }
}

/**
 * Obtiene el mapa completo de tipos de cambio históricos para un par.
 * @param {string} [pair='USD/MXN']
 * @returns {Promise<Map<string, number>>} Map<dateStr, rate>
 */
export async function getFxHistoryMap(pair = 'USD/MXN') {
  try {
    if (!db.fxHistory) return new Map()
    const records = await db.fxHistory.where('pair').equals(pair).toArray()
    const map = new Map()
    records.forEach((r) => map.set(r.date, r.rate))
    return map
  } catch {
    return new Map()
  }
}

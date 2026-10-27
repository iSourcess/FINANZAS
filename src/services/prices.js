/**
 * src/services/prices.js
 *
 * Servicio de cotización de activos:
 *   - Criptomonedas (BTC, ETH): CoinGecko (gratuito, sin llave).
 *   - Acciones (NFLX, INTC, AMD, NVDA): Finnhub (requiere API key del usuario guardada en Ajustes).
 *   - Caché en Dexie (priceCache): ante falta de conexión, error o límite de uso (429),
 *     devuelve el último precio registrado marcado con isStale: true.
 *
 * Reglas de AGENTS.md:
 *   - Maneja sin conexión, errores y rate limits sin romper la app.
 *   - La API key de Finnhub se lee de db.settings (solo en el dispositivo).
 */

import { db } from '../db/database.js'
import { todayLocalISO } from '../lib/format.js'

// Mapeo de símbolos cripto a IDs de CoinGecko
const COINGECKO_MAP = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
}

const DEFAULT_STOCKS = ['NFLX', 'INTC', 'AMD', 'NVDA']

/**
 * Carga todos los precios almacenados en caché en Dexie.
 * @returns {Promise<Map<string, Object>>}
 */
export async function getCachedPrices() {
  const cacheMap = new Map()
  try {
    const records = await db.priceCache.toArray()
    for (const rec of records) {
      cacheMap.set(rec.symbol.toUpperCase(), {
        symbol: rec.symbol.toUpperCase(),
        price: rec.price,
        currency: rec.currency || 'USD',
        change24h: rec.change24h ?? 0,
        fetchedAt: rec.fetchedAt,
        isStale: true,
      })
    }
  } catch (err) {
    console.warn('[pricesService] Error al leer priceCache:', err)
  }
  return cacheMap
}

/**
 * Consulta precios de criptomonedas usando CoinGecko (público sin llave).
 * Endpoint: /simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_24hr_change=true
 *
 * @param {Array<string>} [symbols=['BTC', 'ETH']]
 * @returns {Promise<Map<string, Object>>}
 */
export async function fetchCryptoPrices(symbols = ['BTC', 'ETH']) {
  const results = new Map()
  const validSymbols = symbols.filter(s => COINGECKO_MAP[s.toUpperCase()])
  if (validSymbols.length === 0) return results

  const ids = validSymbols.map(s => COINGECKO_MAP[s.toUpperCase()]).join(',')
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      const nowIso = new Date().toISOString()

      for (const sym of validSymbols) {
        const id = COINGECKO_MAP[sym.toUpperCase()]
        const coinData = data?.[id]
        if (coinData && typeof coinData.usd === 'number') {
          const item = {
            symbol: sym.toUpperCase(),
            price: coinData.usd,
            currency: 'USD',
            change24h: coinData.usd_24h_change != null ? Number(coinData.usd_24h_change.toFixed(2)) : 0,
            fetchedAt: nowIso,
            isStale: false,
          }
          results.set(sym.toUpperCase(), item)

          // Guardar en caché local y en histórico diario
          try {
            await db.priceCache.put({
              symbol: sym.toUpperCase(),
              price: item.price,
              currency: item.currency,
              change24h: item.change24h,
              fetchedAt: item.fetchedAt,
            })
            if (db.priceHistory) {
              const todayStr = todayLocalISO()
              await db.priceHistory.put({
                symbol: sym.toUpperCase(),
                date: todayStr,
                price: item.price,
                updatedAt: item.fetchedAt,
              })
            }
          } catch (cacheErr) {
            console.warn('[pricesService] Error actualizando caché cripto:', cacheErr)
          }
        }
      }
    } else if (res.status === 429) {
      console.warn('[pricesService] CoinGecko rate limit (429) alcanzado.')
    }
  } catch (err) {
    console.warn('[pricesService] Fallo al consultar CoinGecko:', err.message)
  }

  return results
}

/**
 * Consulta precios de acciones usando Finnhub.
 * Endpoint: /api/v1/quote?symbol={symbol}&token={apiKey}
 *
 * @param {Array<string>} [symbols=DEFAULT_STOCKS]
 * @param {string} [apiKeyOverride=null]
 * @returns {Promise<Map<string, Object>>}
 */
export async function fetchStockPrices(symbols = DEFAULT_STOCKS, apiKeyOverride = null) {
  const results = new Map()

  // 1. Obtener API key de Finnhub desde settings si no se pasó override
  let apiKey = apiKeyOverride
  if (!apiKey) {
    try {
      const settings = await db.settings.get('global')
      apiKey = settings?.finnhubApiKey?.trim() || null
    } catch {
      apiKey = null
    }
  }

  if (!apiKey) {
    // Sin API key configurada: no intentar llamadas fallidas
    return results
  }

  const nowIso = new Date().toISOString()

  // 2. Consultar cada acción (máx 60 llamadas/min, 4 acciones es seguro)
  for (const sym of symbols) {
    const symbolClean = sym.toUpperCase().trim()
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 4000)

      const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbolClean)}&token=${encodeURIComponent(apiKey)}`
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeoutId)

      if (res.ok) {
        const data = await res.json()
        // Finnhub devuelve { c: precio_actual, dp: cambio_porcentual, ... }
        if (typeof data?.c === 'number' && data.c > 0) {
          const item = {
            symbol: symbolClean,
            price: data.c,
            currency: 'USD',
            change24h: data.dp != null ? Number(data.dp.toFixed(2)) : 0,
            fetchedAt: nowIso,
            isStale: false,
          }
          results.set(symbolClean, item)

          // Guardar en caché local y en histórico diario
          try {
            await db.priceCache.put({
              symbol: symbolClean,
              price: item.price,
              currency: item.currency,
              change24h: item.change24h,
              fetchedAt: item.fetchedAt,
            })
            if (db.priceHistory) {
              const todayStr = todayLocalISO()
              await db.priceHistory.put({
                symbol: symbolClean,
                date: todayStr,
                price: item.price,
                updatedAt: item.fetchedAt,
              })
            }
          } catch (cacheErr) {
            console.warn('[pricesService] Error actualizando caché acción:', cacheErr)
          }
        }
      } else if (res.status === 429) {
        console.warn(`[pricesService] Finnhub rate limit (429) en ${symbolClean}`)
      }
    } catch (err) {
      console.warn(`[pricesService] Error consultando ${symbolClean}:`, err.message)
    }
  }

  return results
}

/**
 * Obtiene todos los precios requeridos (criptos y acciones) combinando
 * APIs en vivo con fallback al caché local.
 *
 * @param {Array<string>} [symbols=['BTC', 'ETH', 'NFLX', 'INTC', 'AMD', 'NVDA']]
 * @returns {Promise<{
 *   priceMap: Map<string, Object>,
 *   isAnyStale: boolean,
 *   hasFinnhubKey: boolean
 * }>}
 */
export async function getAllPrices(symbols = ['BTC', 'ETH', 'NFLX', 'INTC', 'AMD', 'NVDA']) {
  // 1. Cargar caché existente como base
  const cachedMap = await getCachedPrices()

  // 2. Verificar si hay llave de Finnhub
  let hasFinnhubKey = false
  try {
    const settings = await db.settings.get('global')
    hasFinnhubKey = Boolean(settings?.finnhubApiKey?.trim())
  } catch {
    hasFinnhubKey = false
  }

  // 3. Separar símbolos en criptos y acciones
  const cryptoSymbols = symbols.filter(s => COINGECKO_MAP[s.toUpperCase()])
  const stockSymbols = symbols.filter(s => !COINGECKO_MAP[s.toUpperCase()])

  // 4. Ejecutar consultas en paralelo sin romper si alguna falla
  const [cryptoResults, stockResults] = await Promise.all([
    fetchCryptoPrices(cryptoSymbols),
    fetchStockPrices(stockSymbols),
  ])

  // 5. Unificar resultados: prioridad en vivo > caché
  const priceMap = new Map()
  let isAnyStale = false

  for (const sym of symbols) {
    const symUpper = sym.toUpperCase()
    const live = cryptoResults.get(symUpper) || stockResults.get(symUpper)

    if (live) {
      priceMap.set(symUpper, live)
    } else if (cachedMap.has(symUpper)) {
      priceMap.set(symUpper, cachedMap.get(symUpper))
      isAnyStale = true
    } else {
      // Sin precio previo registrado
      isAnyStale = true
    }
  }

  return {
    priceMap,
    isAnyStale,
    hasFinnhubKey,
  }
}

/**
 * Carga todo el histórico de precios registrado en Dexie como un Map
 * indexado por `${symbol}_${date}` -> price (en USD).
 *
 * @param {Array<string>} [symbols=[]]
 * @returns {Promise<Map<string, number>>}
 */
export async function getPriceHistoryMap(symbols = []) {
  const map = new Map()
  try {
    if (!db.priceHistory) return map
    const records = await db.priceHistory.toArray()
    const filterUpper = symbols.map(s => s.toUpperCase())

    for (const r of records) {
      const sym = (r.symbol || '').toUpperCase()
      if (filterUpper.length === 0 || filterUpper.includes(sym)) {
        map.set(`${sym}_${r.date}`, Number(r.price) || 0)
      }
    }
  } catch (err) {
    console.warn('[pricesService] Error al leer priceHistory:', err)
  }
  return map
}


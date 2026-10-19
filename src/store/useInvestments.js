/**
 * src/store/useInvestments.js
 *
 * Store Zustand para gestión de inversiones:
 *   - Posiciones (holdings): CRUD en Dexie (db.holdings).
 *   - Precios y caché: CoinGecko (criptos) y Finnhub (acciones).
 *   - Tipo de cambio USD/MXN con fallback.
 *   - Cálculo reactivo de valor actual, ganancias y variación 24h.
 */

import { create } from 'zustand'
import { db } from '../db/database.js'
import { getAllPrices } from '../services/prices.js'
import { getUsdMxnRate } from '../services/fx.js'

const INITIAL_HOLDINGS_SEED = [
  {
    id: 'hold-btc',
    kind: 'crypto',
    symbol: 'BTC',
    name: 'Bitcoin',
    quantity: 0.05,
    avgCost: 6500000, // $65,000.00 USD en centavos
    costCurrency: 'USD',
    priceSourceId: 'coingecko',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'hold-eth',
    kind: 'crypto',
    symbol: 'ETH',
    name: 'Ethereum',
    quantity: 0.5,
    avgCost: 280000, // $2,800.00 USD en centavos
    costCurrency: 'USD',
    priceSourceId: 'coingecko',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'hold-nvda',
    kind: 'stock',
    symbol: 'NVDA',
    name: 'NVIDIA',
    quantity: 5,
    avgCost: 11500, // $115.00 USD en centavos
    costCurrency: 'USD',
    priceSourceId: 'finnhub',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'hold-amd',
    kind: 'stock',
    symbol: 'AMD',
    name: 'AMD',
    quantity: 10,
    avgCost: 14000, // $140.00 USD en centavos
    costCurrency: 'USD',
    priceSourceId: 'finnhub',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'hold-intc',
    kind: 'stock',
    symbol: 'INTC',
    name: 'Intel',
    quantity: 20,
    avgCost: 2200, // $22.00 USD en centavos
    costCurrency: 'USD',
    priceSourceId: 'finnhub',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'hold-nflx',
    kind: 'stock',
    symbol: 'NFLX',
    name: 'Netflix',
    quantity: 3,
    avgCost: 62000, // $620.00 USD en centavos
    costCurrency: 'USD',
    priceSourceId: 'finnhub',
    createdAt: new Date().toISOString(),
  },
]

export const useInvestments = create((set, get) => ({
  holdings: [],
  priceMap: new Map(),
  fxRate: 18.0,
  fxSource: 'default',
  isAnyStale: false,
  hasFinnhubKey: false,
  loading: false,
  refreshing: false,
  error: null,

  /**
   * Carga posiciones desde IndexedDB. Si la tabla está vacía,
   * inicializa con las posiciones predeterminadas del plan.
   */
  fetchHoldings: async () => {
    set({ loading: true, error: null })
    try {
      let allHoldings = await db.holdings.toArray()

      // Si está vacía, sembrar posiciones iniciales
      if (allHoldings.length === 0) {
        await db.holdings.bulkAdd(INITIAL_HOLDINGS_SEED)
        allHoldings = await db.holdings.toArray()
      }

      set({ holdings: allHoldings, loading: false })
      // Actualizar precios automáticamente al cargar
      await get().refreshPrices()
    } catch (err) {
      console.error('[useInvestments] Error al cargar holdings:', err)
      set({ error: 'No se pudieron cargar las inversiones.', loading: false })
    }
  },

  /**
   * Actualiza precios de mercado en vivo (CoinGecko y Finnhub) y tipo de cambio.
   */
  refreshPrices: async () => {
    set({ refreshing: true })
    try {
      const holdings = get().holdings
      const symbols = Array.from(new Set(holdings.map(h => h.symbol.toUpperCase())))

      // Consultar precios y tipo de cambio en paralelo
      const [pricesResult, fxResult] = await Promise.all([
        getAllPrices(symbols.length > 0 ? symbols : ['BTC', 'ETH', 'NFLX', 'INTC', 'AMD', 'NVDA']),
        getUsdMxnRate(),
      ])

      set({
        priceMap: pricesResult.priceMap,
        isAnyStale: pricesResult.isAnyStale,
        hasFinnhubKey: pricesResult.hasFinnhubKey,
        fxRate: fxResult.rate,
        fxSource: fxResult.source,
        refreshing: false,
      })
    } catch (err) {
      console.error('[useInvestments] Error al refrescar precios:', err)
      set({ refreshing: false })
    }
  },

  /**
   * Agrega una nueva posición de inversión.
   * @param {Object} holdingData
   */
  addHolding: async (holdingData) => {
    try {
      const newHolding = {
        id: crypto.randomUUID(),
        kind: holdingData.kind || 'stock',
        symbol: holdingData.symbol.toUpperCase().trim(),
        name: holdingData.name?.trim() || holdingData.symbol.toUpperCase().trim(),
        quantity: Math.max(0, Number(holdingData.quantity) || 0),
        avgCost: Math.max(0, Math.round(Number(holdingData.avgCost) || 0)),
        costCurrency: holdingData.costCurrency || 'USD',
        priceSourceId: holdingData.kind === 'crypto' ? 'coingecko' : 'finnhub',
        createdAt: new Date().toISOString(),
      }

      await db.holdings.add(newHolding)
      const updated = await db.holdings.toArray()
      set({ holdings: updated })
      await get().refreshPrices()
      return newHolding
    } catch (err) {
      console.error('[useInvestments] Error al agregar inversión:', err)
      throw err
    }
  },

  /**
   * Actualiza una posición existente.
   * @param {string} id
   * @param {Object} updates
   */
  updateHolding: async (id, updates) => {
    try {
      const sanitized = { ...updates }
      if ('quantity' in sanitized) sanitized.quantity = Math.max(0, Number(sanitized.quantity) || 0)
      if ('avgCost' in sanitized) sanitized.avgCost = Math.max(0, Math.round(Number(sanitized.avgCost) || 0))
      if ('symbol' in sanitized) sanitized.symbol = sanitized.symbol.toUpperCase().trim()

      await db.holdings.update(id, sanitized)
      const updated = await db.holdings.toArray()
      set({ holdings: updated })
      await get().refreshPrices()
    } catch (err) {
      console.error('[useInvestments] Error al actualizar inversión:', err)
      throw err
    }
  },

  /**
   * Elimina una posición por ID.
   * @param {string} id
   */
  deleteHolding: async (id) => {
    try {
      await db.holdings.delete(id)
      set(state => ({
        holdings: state.holdings.filter(h => h.id !== id),
      }))
    } catch (err) {
      console.error('[useInvestments] Error al eliminar inversión:', err)
      throw err
    }
  },
}))

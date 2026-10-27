/**
 * src/store/useInvestments.js
 *
 * Store Zustand para gestión de inversiones con soporte de LOTES y priceHistory:
 *   - Posiciones (holdings): CRUD en Dexie (db.holdings).
 *   - Lotes de compra (lots): CRUD en Dexie (db.lots) con fecha, cantidad y precio unitario.
 *   - Cálculo reactivo de costo promedio ponderado y cantidad consolidada a partir de lotes.
 *   - Precios en vivo y caché histórico: CoinGecko (criptos) y Finnhub (acciones).
 *   - Historial de precios (db.priceHistory) para gráficas de rendimiento.
 *   - Integración con useFx para tipo de cambio USD/MXN.
 */

import { create } from 'zustand'
import { db } from '../db/database.js'
import { getAllPrices, getPriceHistoryMap } from '../services/prices.js'
import { getUsdMxnRate } from '../services/fx.js'
import { useFx } from './useFx.js'
import { aggregateLots } from '../domain/investments.js'
import { todayLocalISO } from '../lib/format.js'

export const useInvestments = create((set, get) => ({
  holdings: [],
  lots: [],
  priceMap: new Map(),
  priceHistoryMap: new Map(),
  fxRate: 18.5,
  fxSource: 'default',
  isAnyStale: false,
  hasFinnhubKey: false,
  loading: false,
  refreshing: false,
  error: null,

  /**
   * Carga posiciones y lotes reales desde IndexedDB.
   * Purga automáticamente cualquier posición falsa sembrada en pruebas previas.
   */
  fetchHoldings: async () => {
    set({ loading: true, error: null })
    try {
      let allHoldings = await db.holdings.toArray()
      let allLots = db.lots ? await db.lots.toArray() : []

      // Purgar holdings falsos del seed inicial antiguo si aún existen
      const mockIds = ['hold-btc', 'hold-eth', 'hold-nvda', 'hold-amd', 'hold-intc', 'hold-nflx']
      const mockHoldings = allHoldings.filter(h => mockIds.includes(h.id))
      if (mockHoldings.length > 0) {
        for (const h of mockHoldings) {
          await db.holdings.delete(h.id)
          if (db.lots) {
            const mockLots = await db.lots.where('holdingId').equals(h.id).primaryKeys()
            await db.lots.bulkDelete(mockLots)
          }
        }
        allHoldings = await db.holdings.toArray()
        allLots = db.lots ? await db.lots.toArray() : []
      }

      // Asociar lotes a cada holding y actualizar sus promedios
      const enrichedHoldings = allHoldings.map(h => {
        const holdingLots = allLots.filter(l => l.holdingId === h.id || l.symbol === h.symbol)
        if (holdingLots.length > 0) {
          const agg = aggregateLots(holdingLots)
          return {
            ...h,
            quantity: agg.totalQuantity,
            avgCost: agg.avgCostCents,
            lots: holdingLots,
          }
        }
        return {
          ...h,
          lots: [],
        }
      })

      // Cargar mapa de histórico de precios
      const historyMap = await getPriceHistoryMap()

      set({
        holdings: enrichedHoldings,
        lots: allLots,
        priceHistoryMap: historyMap,
        loading: false,
      })

      // Actualizar precios automáticamente al cargar
      await get().refreshPrices()
    } catch (err) {
      console.error('[useInvestments] Error al cargar holdings y lotes:', err)
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
      const [pricesResult, fxResult, historyMap] = await Promise.all([
        getAllPrices(symbols.length > 0 ? symbols : ['BTC', 'ETH', 'NFLX', 'INTC', 'AMD', 'NVDA']),
        getUsdMxnRate(),
        getPriceHistoryMap(symbols),
      ])

      const liveFx = useFx.getState().getRate('USD') || fxResult.rate

      set({
        priceMap: pricesResult.priceMap,
        priceHistoryMap: historyMap,
        isAnyStale: pricesResult.isAnyStale,
        hasFinnhubKey: pricesResult.hasFinnhubKey,
        fxRate: liveFx,
        fxSource: fxResult.source,
        refreshing: false,
      })
    } catch (err) {
      console.error('[useInvestments] Error al refrescar precios:', err)
      set({ refreshing: false })
    }
  },

  /**
   * Agrega un nuevo lote de compra a una posición y recalcula su costo promedio.
   * @param {Object} lotData
   * @param {string} lotData.holdingId
   * @param {string} lotData.symbol
   * @param {number} lotData.quantity
   * @param {number} lotData.priceCents
   * @param {string} [lotData.date]
   * @param {string} [lotData.costCurrency='USD']
   */
  addLot: async (lotData) => {
    try {
      const newLot = {
        id: crypto.randomUUID(),
        holdingId: lotData.holdingId,
        symbol: lotData.symbol.toUpperCase().trim(),
        quantity: Math.max(0, Number(lotData.quantity) || 0),
        priceCents: Math.max(0, Math.round(Number(lotData.priceCents) || 0)),
        date: lotData.date || todayLocalISO(),
        costCurrency: lotData.costCurrency || 'USD',
        createdAt: new Date().toISOString(),
      }

      if (db.lots) {
        await db.lots.add(newLot)
      }

      // Recargar lotes y actualizar la posición padre
      await get().fetchHoldings()
      return newLot
    } catch (err) {
      console.error('[useInvestments] Error al agregar lote:', err)
      throw err
    }
  },

  /**
   * Elimina un lote por ID y recalcula la posición padre.
   * @param {string} lotId
   */
  deleteLot: async (lotId) => {
    try {
      if (db.lots) {
        await db.lots.delete(lotId)
      }
      await get().fetchHoldings()
    } catch (err) {
      console.error('[useInvestments] Error al eliminar lote:', err)
      throw err
    }
  },

  /**
   * Agrega una nueva posición de inversión. Si incluye lote inicial, lo registra.
   * @param {Object} holdingData
   */
  addHolding: async (holdingData) => {
    try {
      const holdingId = crypto.randomUUID()
      const newHolding = {
        id: holdingId,
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

      // Registrar el lote inicial de adquisición
      if (db.lots && newHolding.quantity > 0) {
        await db.lots.add({
          id: crypto.randomUUID(),
          holdingId,
          symbol: newHolding.symbol,
          date: holdingData.purchaseDate || todayLocalISO(),
          quantity: newHolding.quantity,
          priceCents: newHolding.avgCost,
          costCurrency: newHolding.costCurrency,
          createdAt: new Date().toISOString(),
        })
      }

      await get().fetchHoldings()
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
      await get().fetchHoldings()
    } catch (err) {
      console.error('[useInvestments] Error al actualizar inversión:', err)
      throw err
    }
  },

  /**
   * Elimina una posición por ID y todos sus lotes asociados.
   * @param {string} id
   */
  deleteHolding: async (id) => {
    try {
      const holding = get().holdings.find(h => h.id === id)
      await db.holdings.delete(id)
      if (db.lots && holding) {
        const lotsToDelete = await db.lots.where('holdingId').equals(id).toArray()
        for (const lot of lotsToDelete) {
          await db.lots.delete(lot.id)
        }
      }
      await get().fetchHoldings()
    } catch (err) {
      console.error('[useInvestments] Error al eliminar inversión:', err)
      throw err
    }
  },
}))

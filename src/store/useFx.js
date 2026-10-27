/**
 * src/store/useFx.js
 *
 * Store de Zustand para tipos de cambio (Forex).
 * Fuente única de verdad para conversiones de divisas en la aplicación.
 *
 * Características:
 *   - Mantiene en memoria las cotizaciones de USD, EUR y monedas configuradas.
 *   - Auto-actualización al montar, al cambiar visibilidad (visibilitychange) y cada 5 min mientras esté visible.
 *   - Detección de cambios de valor para disparar destello visual (hasChanged).
 *   - Soporte para refresco manual.
 */

import { create } from 'zustand'
import { getRates } from '../services/fx.js'
import { FX_REFRESH_INTERVAL_MS, FX_FLASH_DURATION_MS, DEFAULT_FALLBACK_FX_RATES } from '../lib/constants.js'
import { setRateProvider } from '../domain/currency.js'

let refreshTimer = null
let visibilityHandler = null

export const useFx = create((set, get) => ({
  rates: {
    USD: {
      rate: DEFAULT_FALLBACK_FX_RATES.USD,
      prevRate: null,
      changePct: 0,
      updatedAt: null,
      stale: true,
      source: 'default',
    },
    EUR: {
      rate: DEFAULT_FALLBACK_FX_RATES.EUR,
      prevRate: null,
      changePct: 0,
      updatedAt: null,
      stale: true,
      source: 'default',
    },
  },
  loading: false,
  error: null,
  lastUpdated: null,
  // Flags para animar destello si el valor de una divisa cambió
  hasChanged: {},

  /**
   * Obtiene la tasa de una divisa específica (ej: 'USD', 'EUR', 'MXN').
   * @param {string} currency - Código de divisa
   * @returns {number}
   */
  getRate: (currency) => {
    if (!currency || currency === 'MXN') return 1
    const data = get().rates[currency]
    return data?.rate || DEFAULT_FALLBACK_FX_RATES[currency] || 18.0
  },

  /**
   * Refresca las tasas para las divisas especificadas o por defecto ['USD', 'EUR'].
   * @param {string[]} [currencies=['USD', 'EUR']]
   */
  fetchRates: async (currencies = ['USD', 'EUR']) => {
    set({ loading: true, error: null })
    try {
      const currentRates = get().rates
      const freshRates = await getRates(currencies)

      // Detectar cambios en las tasas para activar destello visual
      const changedFlags = {}
      for (const curr of currencies) {
        const oldRate = currentRates[curr]?.rate
        const newRate = freshRates[curr]?.rate
        if (oldRate && newRate && oldRate !== newRate) {
          changedFlags[curr] = true
        }
      }

      set({
        rates: {
          ...currentRates,
          ...freshRates,
        },
        hasChanged: changedFlags,
        loading: false,
        lastUpdated: new Date().toISOString(),
      })

      // Limpiar destello visual después de la duración configurada
      if (Object.keys(changedFlags).length > 0) {
        setTimeout(() => {
          set({ hasChanged: {} })
        }, FX_FLASH_DURATION_MS)
      }
    } catch (err) {
      console.warn('[useFx] Error al refrescar tipos de cambio:', err)
      set({ loading: false, error: 'No se pudo actualizar el tipo de cambio.' })
    }
  },

  /**
   * Inicia el ciclo de auto-refresco del widget:
   *   - Consulta inmediata al abrir.
   *   - Al volver a primer plano (document.visibilityState === 'visible').
   *   - Intervalo de 5 min mientras la app esté visible (se pausa en segundo plano).
   * @param {string[]} [currencies=['USD', 'EUR']]
   * @returns {Function} cleanup para cancelar timers y listeners
   */
  startAutoRefresh: (currencies = ['USD', 'EUR']) => {
    // 1. Refresco inicial
    get().fetchRates(currencies)

    // Función auxiliar para reiniciar el temporizador si está visible
    const restartInterval = () => {
      if (refreshTimer) clearInterval(refreshTimer)
      refreshTimer = setInterval(() => {
        if (typeof document !== 'undefined' && !document.hidden) {
          get().fetchRates(currencies)
        }
      }, FX_REFRESH_INTERVAL_MS)
    }

    restartInterval()

    // 2. Manejo de cambio de visibilidad de la ventana/pestaña
    if (typeof document !== 'undefined') {
      if (visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler)
      }

      visibilityHandler = () => {
        if (!document.hidden) {
          // Volvió a primer plano: refrescar y reiniciar timer
          get().fetchRates(currencies)
          restartInterval()
        } else {
          // Pasó a segundo plano: pausar temporizador para ahorrar batería y recursos
          if (refreshTimer) {
            clearInterval(refreshTimer)
            refreshTimer = null
          }
        }
      }

      document.addEventListener('visibilitychange', visibilityHandler)
    }

    return () => {
      if (refreshTimer) clearInterval(refreshTimer)
      if (typeof document !== 'undefined' && visibilityHandler) {
        document.removeEventListener('visibilitychange', visibilityHandler)
      }
    }
  },
}))

// Registrar useFx como fuente única de verdad para conversiones en currency.js
setRateProvider((currency) => useFx.getState().getRate(currency))


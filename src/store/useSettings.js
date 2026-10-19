/**
 * src/store/useSettings.js
 *
 * Store Zustand para ajustes globales de la aplicación:
 *   - Moneda base (MXN)
 *   - Configuración de tipo de cambio (auto vs. manual y tasa de respaldo)
 *   - API Key de Finnhub (almacenada solo localmente en Dexie)
 *   - Fechas de respaldo
 */

import { create } from 'zustand'
import { db } from '../db/database.js'

export const useSettings = create((set, get) => ({
  settings: {
    id: 'global',
    baseCurrency: 'MXN',
    fxMode: 'auto',
    fxRateManual: 1800, // $18.00 MXN en centavos
    lastBackupAt: null,
    finnhubApiKey: '',
  },
  loading: false,
  error: null,

  fetchSettings: async () => {
    set({ loading: true, error: null })
    try {
      let current = await db.settings.get('global')
      if (!current) {
        current = {
          id: 'global',
          baseCurrency: 'MXN',
          fxMode: 'auto',
          fxRateManual: 1800,
          lastBackupAt: null,
          finnhubApiKey: '',
        }
        await db.settings.put(current)
      }
      set({ settings: current, loading: false })
      return current
    } catch (err) {
      console.error('[useSettings] Error al leer ajustes:', err)
      set({ error: 'No se pudieron cargar los ajustes.', loading: false })
    }
  },

  updateSettings: async (updates) => {
    try {
      const current = get().settings || { id: 'global' }
      const merged = { ...current, ...updates, id: 'global' }
      await db.settings.put(merged)
      set({ settings: merged })
      return merged
    } catch (err) {
      console.error('[useSettings] Error al actualizar ajustes:', err)
      throw err
    }
  },

  setFinnhubKey: async (apiKey) => {
    return get().updateSettings({ finnhubApiKey: (apiKey || '').trim() })
  },

  setFxSettings: async ({ fxMode, fxRateManual }) => {
    const updates = {}
    if (fxMode) updates.fxMode = fxMode
    if (fxRateManual != null) updates.fxRateManual = Math.round(Number(fxRateManual) || 0)
    return get().updateSettings(updates)
  },
}))

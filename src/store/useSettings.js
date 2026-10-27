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
import { DEFAULT_REMINDER_SETTINGS } from '../domain/reminders.js'

export const useSettings = create((set, get) => ({
  settings: {
    id: 'global',
    baseCurrency: 'MXN',
    fxMode: 'auto',
    fxRateManual: 1800, // $18.00 MXN en centavos
    fxRateManualEur: 2000, // $20.00 MXN en centavos
    primaryFxCurrency: 'USD',
    enabledFxCurrencies: ['USD', 'EUR'],
    lastBackupAt: null,
    finnhubApiKey: '',
    templateTapBehavior: 'fill', // 'fill' | 'instant'
    includeDebtsInNetWorth: false,
    showAmountsOnWidget: false,
    reminders: { ...DEFAULT_REMINDER_SETTINGS },
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
          fxRateManualEur: 2000,
          primaryFxCurrency: 'USD',
          enabledFxCurrencies: ['USD', 'EUR'],
          lastBackupAt: null,
          finnhubApiKey: '',
          templateTapBehavior: 'fill',
          includeDebtsInNetWorth: false,
          showAmountsOnWidget: false,
          reminders: { ...DEFAULT_REMINDER_SETTINGS },
        }
        await db.settings.put(current)
      } else {
        // Garantizar defaults si faltan en registros existentes
        if (!current.primaryFxCurrency) current.primaryFxCurrency = 'USD'
        if (!Array.isArray(current.enabledFxCurrencies) || current.enabledFxCurrencies.length === 0) {
          current.enabledFxCurrencies = ['USD', 'EUR']
        }
        if (!current.templateTapBehavior) current.templateTapBehavior = 'fill'
        if (typeof current.includeDebtsInNetWorth !== 'boolean') {
          current.includeDebtsInNetWorth = false
        }
        if (typeof current.showAmountsOnWidget !== 'boolean') {
          current.showAmountsOnWidget = false
        }
        if (!current.reminders) {
          current.reminders = { ...DEFAULT_REMINDER_SETTINGS }
        } else {
          current.reminders = {
            ...DEFAULT_REMINDER_SETTINGS,
            ...current.reminders,
          }
        }
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

  setFxSettings: async ({ fxMode, fxRateManual, fxRateManualEur }) => {
    const updates = {}
    if (fxMode) updates.fxMode = fxMode
    if (fxRateManual != null) updates.fxRateManual = Math.round(Number(fxRateManual) || 0)
    if (fxRateManualEur != null) updates.fxRateManualEur = Math.round(Number(fxRateManualEur) || 0)
    return get().updateSettings(updates)
  },

  setPrimaryFxCurrency: async (code) => {
    return get().updateSettings({ primaryFxCurrency: code })
  },

  setEnabledFxCurrencies: async (currencies) => {
    return get().updateSettings({ enabledFxCurrencies: currencies })
  },

  setTemplateTapBehavior: async (behavior) => {
    return get().updateSettings({ templateTapBehavior: behavior === 'instant' ? 'instant' : 'fill' })
  },

  setIncludeDebtsInNetWorth: async (enabled) => {
    return get().updateSettings({ includeDebtsInNetWorth: Boolean(enabled) })
  },

  setShowAmountsOnWidget: async (enabled) => {
    return get().updateSettings({ showAmountsOnWidget: Boolean(enabled) })
  },

  updateReminderSettings: async (reminderUpdates) => {
    const current = get().settings || { id: 'global' }
    const mergedReminders = {
      ...(current.reminders || DEFAULT_REMINDER_SETTINGS),
      ...reminderUpdates,
    }
    return get().updateSettings({ reminders: mergedReminders })
  },
}))


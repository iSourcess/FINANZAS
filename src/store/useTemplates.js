/**
 * src/store/useTemplates.js
 *
 * Store Zustand para plantillas de movimientos frecuentes con persistencia en Dexie.
 *
 * Estructura de plantilla:
 *   - id: string (UUID)
 *   - name: string (ej. "Café matutino", "Gasolina")
 *   - type: 'expense' | 'income' | 'transfer'
 *   - amountCents: number | null (centavos enteros, o null si no define monto)
 *   - currency: 'MXN' | 'USD'
 *   - categoryId: string | null
 *   - accountId: string | null
 *   - toAccountId: string | null
 *   - note: string
 *   - sortOrder: number
 *   - useCount: number
 */

import { create } from 'zustand'
import { db } from '../db/database.js'
import { reorderTemplates } from '../domain/templates.js'

export const useTemplates = create((set, get) => ({
  templates: [],
  loading: false,
  error: null,

  /**
   * Carga todas las plantillas desde IndexedDB ordenadas por sortOrder.
   */
  fetchTemplates: async () => {
    set({ loading: true, error: null })
    try {
      const items = await db.templates.toArray()
      items.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
      set({ templates: items, loading: false })
      return items
    } catch (err) {
      console.error('[useTemplates] Error al cargar plantillas:', err)
      set({ error: 'No se pudieron cargar las plantillas.', loading: false })
      return []
    }
  },

  /**
   * Agrega una nueva plantilla a IndexedDB.
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  addTemplate: async (data) => {
    set({ loading: true, error: null })
    try {
      const current = get().templates
      const maxOrder = current.reduce((max, t) => Math.max(max, t.sortOrder ?? 0), -1)

      const amountCents = data.amountCents != null && data.amountCents !== ''
        ? Math.round(Number(data.amountCents))
        : null

      const newTemplate = {
        id: crypto.randomUUID(),
        name: (data.name || '').trim() || 'Plantilla',
        type: data.type || 'expense',
        amountCents,
        currency: data.currency || 'MXN',
        categoryId: data.categoryId || null,
        accountId: data.accountId || null,
        toAccountId: data.toAccountId || null,
        note: (data.note || '').trim(),
        sortOrder: maxOrder + 1,
        useCount: 0,
        createdAt: new Date().toISOString(),
      }

      await db.templates.add(newTemplate)

      set((state) => ({
        templates: [...state.templates, newTemplate].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
        loading: false,
      }))

      return newTemplate
    } catch (err) {
      console.error('[useTemplates] Error al crear plantilla:', err)
      set({ error: 'No se pudo guardar la plantilla.', loading: false })
      throw err
    }
  },

  /**
   * Actualiza una plantilla existente.
   * @param {string} id
   * @param {Object} updates
   */
  updateTemplate: async (id, updates) => {
    set({ loading: true, error: null })
    try {
      const sanitized = { ...updates }

      if ('name' in sanitized && typeof sanitized.name === 'string') {
        sanitized.name = sanitized.name.trim()
      }
      if ('amountCents' in sanitized) {
        sanitized.amountCents = sanitized.amountCents != null && sanitized.amountCents !== ''
          ? Math.round(Number(sanitized.amountCents))
          : null
      }
      if ('note' in sanitized && typeof sanitized.note === 'string') {
        sanitized.note = sanitized.note.trim()
      }

      await db.templates.update(id, sanitized)

      set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? { ...t, ...sanitized } : t)),
        loading: false,
      }))
    } catch (err) {
      console.error('[useTemplates] Error al actualizar plantilla:', err)
      set({ error: 'No se pudo actualizar la plantilla.', loading: false })
      throw err
    }
  },

  /**
   * Elimina una plantilla por ID.
   * @param {string} id
   */
  deleteTemplate: async (id) => {
    set({ loading: true, error: null })
    try {
      await db.templates.delete(id)
      set((state) => ({
        templates: state.templates.filter((t) => t.id !== id),
        loading: false,
      }))
    } catch (err) {
      console.error('[useTemplates] Error al eliminar plantilla:', err)
      set({ error: 'No se pudo eliminar la plantilla.', loading: false })
      throw err
    }
  },

  /**
   * Incrementa el contador de uso de una plantilla (al ser tocada).
   * @param {string} id
   */
  incrementUseCount: async (id) => {
    try {
      const tpl = get().templates.find((t) => t.id === id)
      if (!tpl) return

      const newCount = (tpl.useCount || 0) + 1
      await db.templates.update(id, { useCount: newCount })

      set((state) => ({
        templates: state.templates.map((t) => (t.id === id ? { ...t, useCount: newCount } : t)),
      }))
    } catch (err) {
      console.error('[useTemplates] Error al incrementar useCount:', err)
    }
  },

  /**
   * Mueve una plantilla hacia arriba o hacia abajo en orden manual.
   * @param {string} id
   * @param {'up'|'down'} direction
   */
  moveTemplate: async (id, direction) => {
    const current = get().templates
    const reordered = reorderTemplates(current, id, direction)

    set({ templates: reordered })

    try {
      await db.transaction('rw', db.templates, async () => {
        for (const item of reordered) {
          await db.templates.update(item.id, { sortOrder: item.sortOrder })
        }
      })
    } catch (err) {
      console.error('[useTemplates] Error al guardar orden de plantillas:', err)
      // Revertir
      set({ templates: current })
    }
  },
}))

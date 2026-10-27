/**
 * src/domain/templates.js
 *
 * Lógica pura para plantillas de movimientos frecuentes.
 *
 * REGLAS ESTRICTAS:
 *   - Funciones puras: sin React, sin IndexedDB, sin efectos secundarios.
 *   - Montos en CENTAVOS ENTEROS o null si la plantilla no define monto.
 *   - Fechas en hora local (nada de toISOString()).
 */

import { todayLocalISO } from '../lib/format.js'

/**
 * Ordena las plantillas según el modo especificado.
 *
 * @param {Array<Object>} templates
 * @param {'usage'|'manual'} [mode='usage'] - 'usage' (más usadas primero) o 'manual' (por sortOrder)
 * @returns {Array<Object>} Nuevo arreglo ordenado
 */
export function sortTemplates(templates = [], mode = 'usage') {
  const cloned = [...templates]

  if (mode === 'manual') {
    return cloned.sort((a, b) => {
      const orderA = a.sortOrder ?? 9999
      const orderB = b.sortOrder ?? 9999
      if (orderA !== orderB) return orderA - orderB
      return (b.useCount || 0) - (a.useCount || 0)
    })
  }

  // Por defecto 'usage': uso descendente, luego sortOrder, luego nombre
  return cloned.sort((a, b) => {
    const usesA = a.useCount || 0
    const usesB = b.useCount || 0
    if (usesB !== usesA) return usesB - usesA

    const orderA = a.sortOrder ?? 9999
    const orderB = b.sortOrder ?? 9999
    if (orderA !== orderB) return orderA - orderB

    return (a.name || '').localeCompare(b.name || '')
  })
}

/**
 * Genera un borrador de movimiento a partir de una plantilla.
 *
 * @param {Object} template - Plantilla { id, name, type, amountCents, currency, categoryId, accountId, note }
 * @param {Object} [options]
 * @param {string} [options.todayStr] - Fecha local "YYYY-MM-DD"
 * @returns {Object} Borrador de movimiento listo para rellenar o registrar
 */
export function applyTemplate(template, { todayStr = todayLocalISO() } = {}) {
  if (!template) return null

  return {
    type: template.type || 'expense',
    amount: template.amountCents != null ? Math.round(Number(template.amountCents)) : null,
    currency: template.currency || 'MXN',
    categoryId: template.categoryId || null,
    accountId: template.accountId || null,
    toAccountId: template.toAccountId || null,
    note: template.note || '',
    date: todayStr,
  }
}

/**
 * Valida si una plantilla tiene sus referencias existentes (cuenta o categoría).
 *
 * @param {Object} template
 * @param {Object} context
 * @param {Array<Object>} [context.accounts=[]]
 * @param {Array<Object>} [context.categories=[]]
 * @returns {{
 *   isValid: boolean,
 *   missingAccount: boolean,
 *   missingCategory: boolean,
 *   warningMessage: string|null
 * }}
 */
export function validateTemplate(template, accountsOrContext = {}, maybeCategories = []) {
  if (!template) {
    return {
      isValid: false,
      missingAccount: true,
      missingCategory: true,
      warningMessage: 'Plantilla inexistente.',
    }
  }

  // Soporta tanto validateTemplate(tpl, { accounts, categories }) como validateTemplate(tpl, accounts, categories)
  const accounts = Array.isArray(accountsOrContext)
    ? accountsOrContext
    : (accountsOrContext.accounts || [])
  const categories = Array.isArray(accountsOrContext)
    ? (Array.isArray(maybeCategories) ? maybeCategories : [])
    : (accountsOrContext.categories || [])

  const accountIds = new Set(accounts.map((a) => a.id))
  const categoryIds = new Set(categories.map((c) => c.id))

  const missingAccount = Boolean(template.accountId && !accountIds.has(template.accountId))
  const missingCategory = Boolean(
    template.type !== 'transfer' &&
    template.categoryId &&
    !categoryIds.has(template.categoryId)
  )

  const isValid = !missingAccount && !missingCategory

  let warningMessage = null
  if (missingAccount && missingCategory) {
    warningMessage = 'La cuenta y la categoría asociadas ya no existen.'
  } else if (missingAccount) {
    warningMessage = 'La cuenta asociada a esta plantilla fue eliminada.'
  } else if (missingCategory) {
    warningMessage = 'La categoría asociada a esta plantilla fue eliminada.'
  }

  return {
    isValid,
    missingAccount,
    missingCategory,
    warningMessage,
  }
}

/**
 * Reordena una lista de plantillas subiendo o bajando un elemento (puro).
 *
 * @param {Array<Object>} templates
 * @param {string} templateId
 * @param {'up'|'down'} direction
 * @returns {Array<Object>} Lista con nuevos sortOrder reasignados (0..n-1)
 */
export function reorderTemplates(templates = [], templateId, direction = 'up') {
  const list = [...templates].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const index = list.findIndex((t) => t.id === templateId)

  if (index === -1) return list
  if (direction === 'up' && index === 0) return list
  if (direction === 'down' && index === list.length - 1) return list

  const targetIndex = direction === 'up' ? index - 1 : index + 1
  const [removed] = list.splice(index, 1)
  list.splice(targetIndex, 0, removed)

  return list.map((item, idx) => ({
    ...item,
    sortOrder: idx,
  }))
}

/**
 * src/domain/accountOrder.js
 *
 * Lógica pura de reordenamiento de cuentas.
 * Sin React, sin acceso a la base de datos.
 * Se prueba con Vitest en tests/accountOrder.test.js.
 */

/**
 * Mueve un elemento dentro de un array de IDs de `from` a la posición de `to`.
 * Devuelve un nuevo array sin mutar el original.
 *
 * @param {string[]} ids
 * @param {string}   activeId - ID del elemento que se mueve
 * @param {string}   overId   - ID del elemento sobre el que cae
 * @returns {string[]}
 */
function arrayMove(ids, activeId, overId) {
  const from = ids.indexOf(activeId)
  const to   = ids.indexOf(overId)
  if (from === -1 || to === -1 || from === to) return ids.slice()
  const result = ids.slice()
  result.splice(from, 1)
  result.splice(to, 0, activeId)
  return result
}

/**
 * Reordena la lista completa de cuentas según un movimiento drag-and-drop.
 *
 * Reglas:
 *  - Si `activeId` o `overId` no existen en `allAccounts`, devuelve `allAccounts` sin cambios.
 *  - Si `visibleIds` es un subconjunto (filtro activo), solo se reordenan las cuentas visibles
 *    entre las POSICIONES que ya ocupaban en `allAccounts`; las ocultas no se mueven.
 *  - El resultado siempre tiene `sortOrder` de 0 a n-1 en orden estricto.
 *
 * @param {Object[]} allAccounts  - Lista completa de cuentas (cada una con id y sortOrder).
 * @param {string}   activeId     - ID de la cuenta arrastrada.
 * @param {string}   overId       - ID de la cuenta sobre la que se soltó.
 * @param {string[]|null} [visibleIds=null] - IDs de cuentas visibles. null = sin filtro.
 * @returns {Object[]} Nueva lista completa con sortOrder reasignado 0…n-1.
 */
export function reorderAccounts(allAccounts, activeId, overId, visibleIds = null) {
  // Validación básica: si alguno de los IDs no existe, devuelve sin cambios
  const allIds = allAccounts.map(a => a.id)
  if (!allIds.includes(activeId) || !allIds.includes(overId)) {
    return allAccounts.map((a, i) => ({ ...a, sortOrder: i }))
  }

  // Sin filtro: operación directa sobre todos los IDs
  if (!visibleIds || visibleIds.length === allAccounts.length) {
    const newIds = arrayMove(allIds, activeId, overId)
    return newIds.map((id, i) => ({
      ...allAccounts.find(a => a.id === id),
      sortOrder: i,
    }))
  }

  // Con filtro: solo se mueven las visibles entre las posiciones que ocupaban
  const visibleSet = new Set(visibleIds)

  // Posiciones (índices en allAccounts) que ocupa el grupo visible
  const visiblePositions = []
  for (let i = 0; i < allAccounts.length; i++) {
    if (visibleSet.has(allAccounts[i].id)) visiblePositions.push(i)
  }

  // IDs del grupo visible en orden actual
  const currentVisibleIds = visiblePositions.map(pos => allAccounts[pos].id)

  // Si activeId u overId no están en las visibles, devuelve sin cambios
  if (!visibleSet.has(activeId) || !visibleSet.has(overId)) {
    return allAccounts.map((a, i) => ({ ...a, sortOrder: i }))
  }

  // Nuevo orden del grupo visible tras el movimiento
  const newVisibleIds = arrayMove(currentVisibleIds, activeId, overId)

  // Reconstruir allAccounts: las posiciones visibles se rellenan con el nuevo orden,
  // las ocultas permanecen en su lugar
  const result = allAccounts.map(a => ({ ...a }))
  for (let slot = 0; slot < visiblePositions.length; slot++) {
    const posInAll = visiblePositions[slot]
    const newId    = newVisibleIds[slot]
    result[posInAll] = { ...allAccounts.find(a => a.id === newId), sortOrder: posInAll }
  }

  // Reasignar sortOrder 0…n-1 según el orden resultante
  return result.map((a, i) => ({ ...a, sortOrder: i }))
}

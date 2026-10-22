/**
 * tests/accountOrder.test.js
 *
 * Pruebas de reorderAccounts (src/domain/accountOrder.js).
 *
 * Casos cubiertos:
 *  1. Mover el primero al último
 *  2. Mover el último al primero
 *  3. Mover vecinos (swap adyacente)
 *  4. Con filtro activo: solo las visibles se reordenan entre sus posiciones
 *  5. ID inexistente: devuelve la lista sin cambios de orden (solo sortOrder normalizado)
 *  6. activeId === overId: no cambia nada
 */

import { describe, it, expect } from 'vitest'
import { reorderAccounts } from '../src/domain/accountOrder.js'

// Helper para crear cuentas de prueba mínimas
function makeAccounts(items) {
  return items.map(({ id, type = 'debit', sortOrder }, i) => ({
    id,
    name: id,
    type,
    sortOrder: sortOrder ?? i,
  }))
}

const BASE = makeAccounts([
  { id: 'a', sortOrder: 0 },
  { id: 'b', sortOrder: 1 },
  { id: 'c', sortOrder: 2 },
  { id: 'd', sortOrder: 3 },
])

describe('reorderAccounts', () => {
  it('mueve el primero al último', () => {
    const result = reorderAccounts(BASE, 'a', 'd')
    const ids = result.map(r => r.id)
    expect(ids).toEqual(['b', 'c', 'd', 'a'])
    // sortOrder 0…3 estricto
    result.forEach((r, i) => expect(r.sortOrder).toBe(i))
  })

  it('mueve el último al primero', () => {
    const result = reorderAccounts(BASE, 'd', 'a')
    const ids = result.map(r => r.id)
    expect(ids).toEqual(['d', 'a', 'b', 'c'])
    result.forEach((r, i) => expect(r.sortOrder).toBe(i))
  })

  it('mueve vecinos adyacentes (b → c swap)', () => {
    const result = reorderAccounts(BASE, 'b', 'c')
    const ids = result.map(r => r.id)
    expect(ids).toEqual(['a', 'c', 'b', 'd'])
    result.forEach((r, i) => expect(r.sortOrder).toBe(i))
  })

  it('con filtro activo: solo las visibles se reordenan en sus posiciones', () => {
    // BASE: [a(0), b(1), c(2), d(3)]
    // Visibles: b y d (posiciones 1 y 3)
    // Movemos b → d: el slot 1 pasa a tener d, el slot 3 pasa a tener b
    // Ocultos a(0) y c(2) no se mueven
    const result = reorderAccounts(BASE, 'b', 'd', ['b', 'd'])
    const ids = result.map(r => r.id)
    expect(ids).toEqual(['a', 'd', 'c', 'b'])
    result.forEach((r, i) => expect(r.sortOrder).toBe(i))
  })

  it('ID inexistente: devuelve la lista con sortOrder normalizado pero sin reordenar', () => {
    const result = reorderAccounts(BASE, 'z', 'a')
    const ids = result.map(r => r.id)
    // Orden intacto
    expect(ids).toEqual(['a', 'b', 'c', 'd'])
    result.forEach((r, i) => expect(r.sortOrder).toBe(i))
  })

  it('activeId === overId: devuelve la lista sin cambios', () => {
    const result = reorderAccounts(BASE, 'b', 'b')
    const ids = result.map(r => r.id)
    expect(ids).toEqual(['a', 'b', 'c', 'd'])
    result.forEach((r, i) => expect(r.sortOrder).toBe(i))
  })
})

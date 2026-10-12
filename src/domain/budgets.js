/**
 * src/domain/budgets.js
 *
 * Lógica pura de presupuestos mensuales por categoría.
 *
 * Reglas de negocio:
 *   - Normal (<80%): Naranja acento (--orange-400).
 *   - Alerta (80% a 100%): Ámbar advertencia (#F59E0B).
 *   - Excedido (>100%): Rojo peligro (--red-400 / #EF4444).
 *   - Cada nivel incluye texto e ícono explícito (accesibilidad / no solo color).
 */

/**
 * Calcula el estado y nivel de alerta de un presupuesto individual.
 *
 * @param {number} spentCents - Monto gastado en centavos
 * @param {number} limitCents - Límite mensual en centavos
 * @returns {{
 *   spentCents: number,
 *   limitCents: number,
 *   percent: number,
 *   remainingCents: number,
 *   excessCents: number,
 *   alertLevel: 'normal'|'warning'|'danger',
 *   statusLabel: string,
 *   iconName: 'CheckCircle2'|'AlertTriangle'|'AlertOctagon'
 * }}
 */
export function calculateBudgetStatus(spentCents = 0, limitCents = 0) {
  const safeSpent = Math.max(0, Math.round(spentCents || 0))
  const safeLimit = Math.max(0, Math.round(limitCents || 0))

  const percent = safeLimit > 0 ? (safeSpent / safeLimit) * 100 : 0
  const remainingCents = Math.max(0, safeLimit - safeSpent)
  const excessCents = Math.max(0, safeSpent - safeLimit)

  let alertLevel = 'normal'
  let statusLabel = 'Dentro del presupuesto'
  let iconName = 'CheckCircle2'

  if (percent > 100) {
    alertLevel = 'danger'
    statusLabel = 'Presupuesto excedido'
    iconName = 'AlertOctagon'
  } else if (percent >= 80) {
    alertLevel = 'warning'
    statusLabel = 'Cerca del límite (80%+)'
    iconName = 'AlertTriangle'
  }

  return {
    spentCents: safeSpent,
    limitCents: safeLimit,
    percent: Number(percent.toFixed(1)),
    remainingCents,
    excessCents,
    alertLevel,
    statusLabel,
    iconName,
  }
}

/**
 * Calcula el estado de todos los presupuestos cruzando con los movimientos y categorías.
 *
 * @param {Object} params
 * @param {Array<Object>} params.budgets - Lista de presupuestos { id, categoryId, monthlyLimit }
 * @param {Array<Object>} params.movements - Movimientos del periodo
 * @param {Array<Object>} params.categories - Lista de categorías
 * @returns {{
 *   items: Array<Object>,
 *   totalSpentCents: number,
 *   totalLimitCents: number,
 *   overallPercent: number,
 *   exceededCount: number,
 *   warningCount: number
 * }}
 */
export function calculateBudgetsSummary({
  budgets = [],
  movements = [],
  categories = [],
}) {
  const categoryMap = new Map(categories.map(c => [c.id, c]))

  // Sumar gastos por categoría (solo gastos, excluye transferencias e ingresos)
  const spentByCategory = new Map()
  movements
    .filter(m => m.type === 'expense')
    .forEach(m => {
      const catId = m.categoryId
      if (catId) {
        spentByCategory.set(catId, (spentByCategory.get(catId) || 0) + (m.amount || 0))
      }
    })

  let totalSpentCents = 0
  let totalLimitCents = 0
  let exceededCount = 0
  let warningCount = 0

  const items = budgets.map(b => {
    const cat = categoryMap.get(b.categoryId)
    const spentCents = spentByCategory.get(b.categoryId) || 0
    const limitCents = b.monthlyLimit || 0

    const status = calculateBudgetStatus(spentCents, limitCents)

    totalSpentCents += spentCents
    totalLimitCents += limitCents

    if (status.alertLevel === 'danger') exceededCount++
    if (status.alertLevel === 'warning') warningCount++

    return {
      budgetId: b.id,
      categoryId: b.categoryId,
      categoryName: cat?.name || 'Categoría',
      categoryColor: cat?.color || '#FF7A1A',
      categoryIcon: cat?.icon || 'MoreHorizontal',
      ...status,
    }
  })

  // Ordenar: primero los excedidos, luego los en alerta, luego por mayor porcentaje
  items.sort((a, b) => b.percent - a.percent)

  const overallPercent = totalLimitCents > 0
    ? Number(((totalSpentCents / totalLimitCents) * 100).toFixed(1))
    : 0

  return {
    items,
    totalSpentCents,
    totalLimitCents,
    overallPercent,
    exceededCount,
    warningCount,
  }
}

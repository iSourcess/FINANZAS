/**
 * src/domain/recurring.js
 *
 * Lógica pura de gastos fijos mensuales y pagos recurrentes.
 *
 * Reglas de negocio (PLAN.md sección 5.6):
 *   - Al abrir la app se identifican los gastos fijos del mes que falten como "pendiente de pagar".
 *   - No duplicar si ya existe un movimiento generado para ese gasto fijo en el mes actual.
 *   - El usuario los confirma con un toque para registrarlos como movimiento oficial.
 */

import { toISODate } from './periods.js'

/**
 * Obtiene la lista de gastos fijos pendientes de pago para el mes actual.
 *
 * @param {Object} params
 * @param {Array<Object>} params.fixedExpenses - Lista de gastos fijos configurados
 * @param {Array<Object>} params.movements - Lista de movimientos existentes
 * @param {Date} [params.referenceDate=new Date()]
 * @returns {Array<{
 *   fixedExpense: Object,
 *   dueDate: string,
 *   isDueToday: boolean,
 *   isOverdue: boolean,
 *   daysRemaining: number
 * }>}
 */
export function getPendingRecurringExpenses({
  fixedExpenses = [],
  movements = [],
  referenceDate = new Date(),
}) {
  if (!fixedExpenses || fixedExpenses.length === 0) return []

  const refYear = referenceDate.getFullYear()
  const refMonth = referenceDate.getMonth() // 0 a 11
  const refMonthStr = String(refMonth + 1).padStart(2, '0')
  const monthPrefix = `${refYear}-${refMonthStr}`
  const todayStr = toISODate(referenceDate)

  // Conjunto de IDs de gastos fijos que ya tienen un movimiento registrado este mes
  const alreadyGeneratedFixedIds = new Set()
  movements.forEach(m => {
    if (m.fixedId && m.date && m.date.startsWith(monthPrefix)) {
      alreadyGeneratedFixedIds.add(m.fixedId)
    }
  })

  const pending = []

  // Filtrar activos que no han sido generados en el mes en curso
  const activeFixed = fixedExpenses.filter(f => f.active !== false)

  for (const item of activeFixed) {
    if (alreadyGeneratedFixedIds.has(item.id)) {
      continue // Ya fue generado en este mes, NO duplicar
    }

    // Calcular fecha de vencimiento de este mes
    const maxDays = new Date(refYear, refMonth + 1, 0).getDate()
    const targetDay = Math.min(Math.max(1, item.dayOfMonth || 1), maxDays)
    const dueDateObj = new Date(refYear, refMonth, targetDay, 12, 0, 0)
    const dueDate = toISODate(dueDateObj)

    const isDueToday = dueDate === todayStr
    const isOverdue = todayStr > dueDate

    const msPerDay = 1000 * 60 * 60 * 24
    const daysRemaining = Math.round((dueDateObj.getTime() - new Date(refYear, refMonth, referenceDate.getDate(), 12, 0, 0).getTime()) / msPerDay)

    pending.push({
      fixedExpense: item,
      dueDate,
      isDueToday,
      isOverdue,
      daysRemaining,
    })
  }

  // Ordenar por fecha de vencimiento ascendente
  pending.sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  return pending
}

/**
 * Prepara los datos de movimiento a partir de un gasto fijo confirmado.
 *
 * @param {Object} fixedExpense
 * @param {string} [dueDate]
 * @param {string} [customAccountId] - Cuenta seleccionada para el pago
 * @returns {Object} Datos del movimiento listo para agregar
 */
export function createMovementFromFixedExpense(
  fixedExpense,
  dueDate = toISODate(new Date()),
  customAccountId = null
) {
  return {
    type: 'expense',
    amount: Math.round(Number(fixedExpense.amount) || 0),
    currency: fixedExpense.currency || 'MXN',
    accountId: customAccountId || fixedExpense.accountId,
    categoryId: fixedExpense.categoryId,
    date: dueDate,
    note: fixedExpense.name || 'Gasto fijo',
    fixedId: fixedExpense.id,
  }
}

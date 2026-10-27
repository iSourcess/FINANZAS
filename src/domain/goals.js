/**
 * src/domain/goals.js
 *
 * Lógica pura de dominio para metas de ahorro (Savings Goals).
 *
 * Reglas de AGENTS.md:
 *   - Funciones puras, sin React, sin acceso a base de datos.
 *   - Montos monetarios siempre en CENTAVOS ENTEROS.
 *   - Fechas ISO "YYYY-MM-DD".
 */

/**
 * Valida los datos para crear o actualizar una meta de ahorro.
 *
 * @param {Object} goalData
 * @param {string} goalData.name
 * @param {number} goalData.targetAmount - En centavos (> 0)
 * @param {string|null} [goalData.targetDate] - Fecha objetivo ISO "YYYY-MM-DD" o null
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateGoal(goalData) {
  if (!goalData || typeof goalData !== 'object') {
    return { isValid: false, error: 'Los datos de la meta son inválidos.' }
  }

  const name = typeof goalData.name === 'string' ? goalData.name.trim() : ''
  if (!name) {
    return { isValid: false, error: 'El nombre de la meta es obligatorio.' }
  }

  const targetAmount = Number(goalData.targetAmount)
  if (!Number.isFinite(targetAmount) || Math.floor(targetAmount) <= 0) {
    return { isValid: false, error: 'El monto objetivo debe ser mayor a cero.' }
  }

  if (goalData.targetDate) {
    const dateStr = String(goalData.targetDate).trim()
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!isoDateRegex.test(dateStr)) {
      return { isValid: false, error: 'La fecha objetivo debe tener formato YYYY-MM-DD.' }
    }
    const parsed = new Date(`${dateStr}T12:00:00Z`)
    if (Number.isNaN(parsed.getTime())) {
      return { isValid: false, error: 'La fecha objetivo no es una fecha válida.' }
    }
  }

  return { isValid: true }
}

/**
 * Valida los datos de un aporte a una meta de ahorro.
 * El aporte DEBE estar vinculado a una cuenta bancaria/efectivo.
 *
 * @param {Object} contributionData
 * @param {string} contributionData.goalId
 * @param {string} contributionData.accountId - Cuenta vinculada
 * @param {number} contributionData.amount - En centavos (> 0)
 * @param {string} contributionData.date - ISO "YYYY-MM-DD"
 * @returns {{ isValid: boolean, error?: string }}
 */
export function validateContribution(contributionData) {
  if (!contributionData || typeof contributionData !== 'object') {
    return { isValid: false, error: 'Los datos del aporte son inválidos.' }
  }

  if (!contributionData.goalId || typeof contributionData.goalId !== 'string' || !contributionData.goalId.trim()) {
    return { isValid: false, error: 'El aporte debe pertenecer a una meta válida.' }
  }

  if (!contributionData.accountId || typeof contributionData.accountId !== 'string' || !contributionData.accountId.trim()) {
    return { isValid: false, error: 'El aporte debe estar vinculado a una cuenta.' }
  }

  const amount = Number(contributionData.amount)
  if (!Number.isFinite(amount) || Math.floor(amount) <= 0) {
    return { isValid: false, error: 'El monto del aporte debe ser mayor a cero.' }
  }

  const dateStr = String(contributionData.date || '').trim()
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!isoDateRegex.test(dateStr)) {
    return { isValid: false, error: 'La fecha del aporte debe tener formato YYYY-MM-DD.' }
  }

  return { isValid: true }
}

/**
 * Normaliza una fecha a timestamp UTC de medianoche para comparaciones seguras de días.
 * @param {string|Date} d
 * @returns {number}
 */
function toMidnightTimestamp(d) {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [year, month, day] = d.split('-').map(Number)
    return Date.UTC(year, month - 1, day)
  }
  const dateObj = new Date(d)
  return Date.UTC(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate())
}

/**
 * Calcula el progreso, métricas y proyecciones de una meta de ahorro individual.
 *
 * @param {Object} params
 * @param {Object} params.goal - { id, name, targetAmount, targetDate, createdAt }
 * @param {Array<Object>} [params.contributions=[]] - Lista de aportes
 * @param {Date|string} [params.referenceDate=new Date()] - Fecha actual de referencia
 * @returns {Object} Métricas calculadas en centavos enteros y porcentajes
 */
export function calculateGoalProgress({ goal, contributions = [], referenceDate = new Date() }) {
  if (!goal) {
    return {
      goalId: null,
      name: '',
      targetAmount: 0,
      savedAmount: 0,
      remainingAmount: 0,
      percent: 0,
      clampedPercent: 0,
      isCompleted: false,
      isOverdue: false,
      daysRemaining: null,
      monthsRemaining: null,
      suggestedMonthlySavings: null,
      suggestedDailySavings: null,
      contributionsCount: 0,
      contributionsByAccount: [],
    }
  }

  const targetAmount = Math.max(0, Math.round(Number(goal.targetAmount) || 0))

  // Filtrar aportes que pertenecen a esta meta
  const goalContributions = contributions.filter(c => c && c.goalId === goal.id)

  // Total ahorrado en centavos
  const savedAmount = goalContributions.reduce(
    (sum, c) => sum + Math.max(0, Math.round(Number(c.amount) || 0)),
    0
  )

  const remainingAmount = Math.max(0, targetAmount - savedAmount)
  const isCompleted = targetAmount > 0 && savedAmount >= targetAmount

  // Porcentaje exacto y clamped para barras de progreso (0% - 100%)
  const rawPercent = targetAmount > 0 ? (savedAmount / targetAmount) * 100 : 0
  const percent = Number(rawPercent.toFixed(1))
  const clampedPercent = Math.min(100, Math.max(0, percent))

  // Proyecciones de fecha si targetDate está configurada
  let daysRemaining = null
  let monthsRemaining = null
  let suggestedMonthlySavings = null
  let suggestedDailySavings = null
  let isOverdue = false

  if (goal.targetDate && /^\d{4}-\d{2}-\d{2}$/.test(goal.targetDate)) {
    const targetMs = toMidnightTimestamp(goal.targetDate)
    const refMs = toMidnightTimestamp(referenceDate)
    const msDiff = targetMs - refMs
    const oneDayMs = 1000 * 60 * 60 * 24
    daysRemaining = Math.round(msDiff / oneDayMs)

    if (daysRemaining < 0) {
      isOverdue = !isCompleted
    } else if (daysRemaining === 0) {
      // Vence hoy
      suggestedDailySavings = remainingAmount
      suggestedMonthlySavings = remainingAmount
      monthsRemaining = 0
    } else {
      // Días futuros: cálculo de ahorro sugerido
      suggestedDailySavings = Math.round(remainingAmount / daysRemaining)

      // Meses aproximados (30.4375 días promedio por mes)
      monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30.4375))
      suggestedMonthlySavings = Math.round(remainingAmount / monthsRemaining)
    }
  }

  // Agrupación de aportes por cuenta vinculada
  const accountMap = new Map()
  for (const c of goalContributions) {
    if (!c.accountId) continue
    const amt = Math.max(0, Math.round(Number(c.amount) || 0))
    const current = accountMap.get(c.accountId) || { accountId: c.accountId, totalCents: 0, count: 0 }
    current.totalCents += amt
    current.count += 1
    accountMap.set(c.accountId, current)
  }

  const contributionsByAccount = Array.from(accountMap.values())

  return {
    goalId: goal.id,
    name: goal.name || '',
    targetAmount,
    savedAmount,
    remainingAmount,
    percent,
    clampedPercent,
    isCompleted,
    isOverdue,
    targetDate: goal.targetDate || null,
    daysRemaining,
    monthsRemaining,
    suggestedMonthlySavings,
    suggestedDailySavings,
    contributionsCount: goalContributions.length,
    contributionsByAccount,
  }
}

/**
 * Calcula el resumen global de todas las metas de ahorro.
 *
 * @param {Object} params
 * @param {Array<Object>} params.goals
 * @param {Array<Object>} params.contributions
 * @param {Date|string} [params.referenceDate=new Date()]
 * @returns {Object} Resumen consolidado para el Panorama
 */
export function calculateAllGoalsSummary({ goals = [], contributions = [], referenceDate = new Date() }) {
  const items = goals.map(goal =>
    calculateGoalProgress({ goal, contributions, referenceDate })
  )

  const totalTargetCents = items.reduce((sum, item) => sum + item.targetAmount, 0)
  const totalSavedCents = items.reduce((sum, item) => sum + item.savedAmount, 0)
  const totalRemainingCents = Math.max(0, totalTargetCents - totalSavedCents)

  const overallPercent = totalTargetCents > 0
    ? Number(((totalSavedCents / totalTargetCents) * 100).toFixed(1))
    : 0

  const completedCount = items.filter(i => i.isCompleted).length
  const activeCount = items.filter(i => !i.isCompleted).length

  return {
    items,
    totalTargetCents,
    totalSavedCents,
    totalRemainingCents,
    overallPercent,
    clampedOverallPercent: Math.min(100, Math.max(0, overallPercent)),
    totalGoalsCount: items.length,
    completedCount,
    activeCount,
  }
}

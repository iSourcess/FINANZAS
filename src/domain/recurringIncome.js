/**
 * src/domain/recurringIncome.js
 *
 * Lógica pura de ingresos recurrentes (sueldo, quincena, renta cobrada, etc.).
 *
 * Reglas de negocio:
 *   - Toda lógica es pura (sin React, sin Dexie, sin efectos secundarios).
 *   - Manejo de fechas en hora local (evita desfases de toISOString/UTC).
 *   - Genera ocurrencias pendientes desde max(startDate, hace 2 meses) hasta hoy.
 *   - Clave única de ocurrencia: recurringId + dueDate con estados 'pending' | 'received' | 'skipped'.
 *   - Recorte de día automático para meses cortos (30 días), febrero (28/29) y 'último'.
 *   - Quincena: dos días (por defecto 15 y 'último').
 *   - Semanal: día de la semana (0 = domingo, 1 = lunes, ..., 6 = sábado).
 *   - startDate futura o active = false no generan pendientes.
 *   - Sugiere vincular ingresos manuales existentes con misma cuenta y monto en ±3 días.
 */

import { toISODate, fromISODate } from './periods.js'

/**
 * Obtiene el último día de un mes dado en año dado.
 * @param {number} year
 * @param {number} monthIndex - 0 a 11
 * @returns {number} 28, 29, 30 o 31
 */
export function getDaysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

/**
 * Ajusta un día de mes objetivo asegurando que no exceda los días del mes
 * y soportando 'last' / 'último'.
 * @param {number} year
 * @param {number} monthIndex - 0 a 11
 * @param {number|string} targetDay - e.g. 15, 31, 'last', 'último'
 * @returns {number}
 */
export function clipDayOfMonth(year, monthIndex, targetDay) {
  const maxDays = getDaysInMonth(year, monthIndex)
  if (targetDay === 'last' || targetDay === 'último') {
    return maxDays
  }
  const numeric = parseInt(targetDay, 10)
  if (isNaN(numeric) || numeric < 1) return 1
  return Math.min(numeric, maxDays)
}

/**
 * Calcula la fecha de hace 2 meses en hora local.
 * @param {Date} [referenceDate=new Date()]
 * @returns {string} Fecha ISO YYYY-MM-DD
 */
export function getTwoMonthsAgo(referenceDate = new Date()) {
  const refYear = referenceDate.getFullYear()
  const refMonth = referenceDate.getMonth()
  const refDay = referenceDate.getDate()

  // Mes hace 2 meses
  let targetYear = refYear
  let targetMonth = refMonth - 2
  if (targetMonth < 0) {
    targetYear -= 1
    targetMonth += 12
  }

  const maxDay = getDaysInMonth(targetYear, targetMonth)
  const clippedDay = Math.min(refDay, maxDay)
  const d = new Date(targetYear, targetMonth, clippedDay, 12, 0, 0)
  return toISODate(d)
}

/**
 * Calcula la diferencia en días entre dos fechas 'YYYY-MM-DD'.
 * @param {string} dateStrA
 * @param {string} dateStrB
 * @returns {number} Positivo si dateStrA > dateStrB, negativo si menor
 */
export function diffInDays(dateStrA, dateStrB) {
  const dateA = fromISODate(dateStrA)
  const dateB = fromISODate(dateStrB)
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.round((dateA.getTime() - dateB.getTime()) / msPerDay)
}

/**
 * Genera la lista de fechas candidatas para un ingreso recurrente dentro de un rango [windowStart, windowEnd].
 *
 * @param {Object} recurringIncome
 * @param {string} windowStart - Fecha inicial inclusiva (YYYY-MM-DD)
 * @param {string} windowEnd - Fecha final inclusiva (YYYY-MM-DD)
 * @returns {string[]} Lista de fechas ordenadas en formato 'YYYY-MM-DD'
 */
export function generateCandidateDueDates(recurringIncome, windowStart, windowEnd) {
  if (!recurringIncome.active) return []

  const startDate = recurringIncome.startDate || windowStart
  // Si la fecha de inicio es posterior a la ventana final (futura), no genera fechas
  if (startDate > windowEnd) return []

  // El rango efectivo comienza en max(startDate, windowStart)
  const effectiveStart = startDate > windowStart ? startDate : windowStart
  const startDateObj = fromISODate(effectiveStart)
  const endDateObj = fromISODate(windowEnd)

  const candidateDates = []
  const { frequency, schedule } = recurringIncome

  if (frequency === 'monthly') {
    const rawTargetDay = schedule?.dayOfMonth ?? schedule ?? 1

    let currYear = startDateObj.getFullYear()
    let currMonth = startDateObj.getMonth()
    const endYear = endDateObj.getFullYear()
    const endMonth = endDateObj.getMonth()

    while (currYear < endYear || (currYear === endYear && currMonth <= endMonth)) {
      const day = clipDayOfMonth(currYear, currMonth, rawTargetDay)
      const dateStr = toISODate(new Date(currYear, currMonth, day, 12, 0, 0))

      if (dateStr >= effectiveStart && dateStr <= windowEnd) {
        candidateDates.push(dateStr)
      }

      currMonth += 1
      if (currMonth > 11) {
        currMonth = 0
        currYear += 1
      }
    }
  } else if (frequency === 'biweekly') {
    const day1 = schedule?.day1 ?? 15
    const day2 = schedule?.day2 ?? 'last'

    let currYear = startDateObj.getFullYear()
    let currMonth = startDateObj.getMonth()
    const endYear = endDateObj.getFullYear()
    const endMonth = endDateObj.getMonth()

    while (currYear < endYear || (currYear === endYear && currMonth <= endMonth)) {
      const d1 = clipDayOfMonth(currYear, currMonth, day1)
      const d2 = clipDayOfMonth(currYear, currMonth, day2)

      const dateStr1 = toISODate(new Date(currYear, currMonth, d1, 12, 0, 0))
      const dateStr2 = toISODate(new Date(currYear, currMonth, d2, 12, 0, 0))

      const monthDates = [dateStr1, dateStr2].sort()
      for (const d of monthDates) {
        if (d >= effectiveStart && d <= windowEnd && !candidateDates.includes(d)) {
          candidateDates.push(d)
        }
      }

      currMonth += 1
      if (currMonth > 11) {
        currMonth = 0
        currYear += 1
      }
    }
  } else if (frequency === 'weekly') {
    // schedule.dayOfWeek: 0 = domingo, 1 = lunes, ..., 6 = sábado
    const targetDayOfWeek = typeof schedule?.dayOfWeek === 'number'
      ? schedule.dayOfWeek
      : (typeof schedule === 'number' ? schedule : 1) // default: lunes

    const cursor = new Date(startDateObj.getTime())
    // Avanzar cursor hasta el primer día de la semana correspondiente
    while (cursor.getDay() !== targetDayOfWeek) {
      cursor.setDate(cursor.getDate() + 1)
    }

    while (true) {
      const dateStr = toISODate(cursor)
      if (dateStr > windowEnd) break
      if (dateStr >= effectiveStart) {
        candidateDates.push(dateStr)
      }
      cursor.setDate(cursor.getDate() + 7)
    }
  }

  return candidateDates.sort()
}

/**
 * Genera nuevas ocurrencias pendientes para los ingresos recurrentes configurados.
 *
 * @param {Object} params
 * @param {Array<Object>} params.recurringIncomes - Ingresos recurrentes activos/inactivos
 * @param {Array<Object>} [params.existingOccurrences=[]] - Ocurrencias ya registradas en la base de datos
 * @param {string} [params.todayStr] - Fecha de hoy en formato 'YYYY-MM-DD' (hora local)
 * @param {Date} [params.referenceDate=new Date()]
 * @returns {Array<{
 *   recurringId: string,
 *   dueDate: string,
 *   status: 'pending'
 * }>} Nuevas ocurrencias a insertar
 */
export function generatePendingIncomeOccurrences({
  recurringIncomes = [],
  existingOccurrences = [],
  todayStr = null,
  referenceDate = new Date(),
}) {
  const today = todayStr || toISODate(referenceDate)
  const twoMonthsAgo = getTwoMonthsAgo(referenceDate)

  // Índice de ocurrencias ya existentes por [recurringId+dueDate]
  const existingSet = new Set(
    existingOccurrences.map(occ => `${occ.recurringId}::${occ.dueDate}`)
  )

  const newOccurrences = []

  for (const item of recurringIncomes) {
    if (!item.active) continue

    const windowStart = item.startDate && item.startDate > twoMonthsAgo
      ? item.startDate
      : twoMonthsAgo

    if (windowStart > today) continue // Fecha de inicio futura

    const candidateDates = generateCandidateDueDates(item, windowStart, today)

    for (const dueDate of candidateDates) {
      const key = `${item.id}::${dueDate}`
      if (!existingSet.has(key)) {
        newOccurrences.push({
          recurringId: item.id,
          dueDate,
          status: 'pending',
        })
        existingSet.add(key)
      }
    }
  }

  return newOccurrences
}

/**
 * Busca si existe un movimiento manual existente que coincida en cuenta y monto
 * en un rango de ±3 días respecto a la fecha esperada.
 *
 * @param {Object} params
 * @param {Object} params.occurrence - Ocurrencia pendiente ({ dueDate, recurringId, ... })
 * @param {Object} params.recurringIncome - Configuración del ingreso recurrente ({ accountId, amountCents, ... })
 * @param {Array<Object>} params.manualMovements - Lista de movimientos registrados
 * @param {Set<string>} [params.usedMovementIds=new Set()] - IDs de movimientos ya vinculados
 * @returns {Object|null} Movimiento sugerido para vincular o null
 */
export function findMatchingManualIncome({
  occurrence,
  recurringIncome,
  manualMovements = [],
  usedMovementIds = new Set(),
}) {
  if (!occurrence || !recurringIncome || !manualMovements.length) return null

  const targetAmount = Math.round(Number(recurringIncome.amountCents) || 0)
  const targetAccount = recurringIncome.accountId

  let bestMatch = null
  let minDiff = Infinity

  for (const mov of manualMovements) {
    // Solo ingresos manuales que no estén ya vinculados a otra ocurrencia
    if (mov.type !== 'income') continue
    if (mov.recurringIncomeId || usedMovementIds.has(mov.id)) continue
    if (mov.accountId !== targetAccount) continue

    const movAmount = Math.round(Number(mov.amount) || 0)
    if (movAmount !== targetAmount) continue

    if (!mov.date) continue
    const diff = Math.abs(diffInDays(mov.date, occurrence.dueDate))

    if (diff <= 3 && diff < minDiff) {
      minDiff = diff
      bestMatch = mov
    }
  }

  return bestMatch
}

/**
 * Prepara el payload para crear el movimiento financiero cuando el usuario hace clic en "Ya me cayó".
 *
 * @param {Object} params
 * @param {Object} params.recurringIncome
 * @param {Object} params.occurrence
 * @param {number} [params.customAmountCents] - Monto editable confirmado por el usuario
 * @param {string} [params.customDate] - Fecha seleccionada (por defecto la de la ocurrencia o hoy)
 * @param {string} [params.customAccountId] - Cuenta seleccionada
 * @returns {Object} Payload listo para useMovements.addMovement()
 */
export function createMovementFromRecurringIncome({
  recurringIncome,
  occurrence,
  customAmountCents = null,
  customDate = null,
  customAccountId = null,
}) {
  const finalAmount = customAmountCents !== null && customAmountCents !== undefined
    ? Math.round(Number(customAmountCents) || 0)
    : Math.round(Number(recurringIncome.amountCents) || 0)

  return {
    type: 'income',
    amount: finalAmount,
    currency: recurringIncome.currency || 'MXN',
    accountId: customAccountId || recurringIncome.accountId,
    categoryId: recurringIncome.categoryId,
    date: customDate || occurrence.dueDate,
    note: recurringIncome.name || 'Ingreso recurrente',
    recurringIncomeId: recurringIncome.id,
    recurringDueDate: occurrence.dueDate,
  }
}

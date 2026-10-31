/**
 * src/domain/interestAccrual.js
 *
 * Lógica pura de acreditación de rendimientos (interés compuesto diario).
 *
 * Reglas de negocio:
 *   - Solo días TERMINADOS (nunca hoy ni el futuro).
 *   - No se acredita antes de account.interestStartDate.
 *   - base = saldo al cierre del día anterior (estado antes de movimientos del día).
 *   - El interés diario se calcula con los tramos de yield.js (tasa / 365).
 *   - Se arrastra el residuo fraccionario (carryCents) para no perder fracciones.
 *   - El interés acreditado se suma al saldo base del día siguiente (compuesto).
 *   - Cajita Turbo: base alta = min(capital, 25k) + interesesAcumulados;
 *     retiro consume primero intereses y luego capital.
 *   - Cuentas sin rendimiento (BBVA, 0%) y tarjetas de crédito: no acreditan.
 *   - Idempotente: si la fecha ya existe en interestAccruals, se omite.
 */

import { calculateTierSlices, TURBO_CAP_CENTS } from './yield.js'

/**
 * Determina si una cuenta debe acreditar rendimientos.
 * @param {Object} account
 * @returns {boolean}
 */
export function isAccrualAccount(account) {
  if (!account) return false
  if (!account.interestEnabled) return false
  if (account.type === 'credit') return false
  if (!Array.isArray(account.yieldTiers) || account.yieldTiers.length === 0) return false
  return account.yieldTiers.some((t) => (t.rate || 0) > 0)
}

/**
 * Determina si una cuenta es Cajita Turbo.
 * @param {Object} account
 * @returns {boolean}
 */
export function isTurboAccount(account) {
  if (!account) return false
  return Boolean(
    account.isTurbo ||
    account.yieldCapBase === 'principal' ||
    (account.name && account.name.toLowerCase().includes('turbo'))
  )
}

/**
 * Aplica un movimiento a un estado de cuenta (saldo + capital para Turbo).
 * Para movimientos de ingresos: aumenta el saldo y el capital (Turbo).
 * Para egresos/retiros: en Turbo, consume primero intereses y luego capital.
 *
 * @param {Object} state - { balanceCents, principalCents, accumulatedInterestCents }
 * @param {Object} movement - { type, amount, deltaCents, _isSource }
 * @param {boolean} isTurbo
 * @returns {Object} Nuevo estado
 */
function applyMovementToState(state, movement, isTurbo) {
  let { balanceCents, principalCents, accumulatedInterestCents } = state
  const amt = Math.round(Math.abs(movement.amount || 0))

  if (movement.type === 'adjustment') {
    const delta = Math.round(Number(movement.deltaCents !== undefined ? movement.deltaCents : movement.amount) || 0)
    balanceCents = Math.max(0, balanceCents + delta)
    if (isTurbo) {
      if (delta > 0) {
        principalCents += delta
      } else {
        const absDelta = Math.abs(delta)
        const fromInterest = Math.min(accumulatedInterestCents, absDelta)
        accumulatedInterestCents -= fromInterest
        const fromPrincipal = absDelta - fromInterest
        principalCents = Math.max(0, principalCents - fromPrincipal)
      }
    }
    return { balanceCents, principalCents, accumulatedInterestCents }
  }

  if (movement.type === 'income') {
    balanceCents += amt
    if (isTurbo) principalCents += amt
  } else if (movement.type === 'expense') {
    balanceCents = Math.max(0, balanceCents - amt)
    if (isTurbo) {
      const fromInterest = Math.min(accumulatedInterestCents, amt)
      accumulatedInterestCents -= fromInterest
      const fromPrincipal = amt - fromInterest
      principalCents = Math.max(0, principalCents - fromPrincipal)
    }
  } else if (movement.type === 'transfer') {
    if (movement._isSource) {
      balanceCents = Math.max(0, balanceCents - amt)
      if (isTurbo) {
        const fromInterest = Math.min(accumulatedInterestCents, amt)
        accumulatedInterestCents -= fromInterest
        const fromPrincipal = amt - fromInterest
        principalCents = Math.max(0, principalCents - fromPrincipal)
      }
    } else {
      balanceCents += amt
      if (isTurbo) principalCents += amt
    }
  }

  return { balanceCents, principalCents, accumulatedInterestCents }
}

/**
 * Calcula el interés de UN día para una cuenta estándar (no Turbo).
 * Aplica tramos, arrastra residuo fraccionario (carryCents).
 *
 * @param {number} balanceCents
 * @param {Array<{upTo: number|null, rate: number}>} yieldTiers
 * @param {number} carryCents - Residuo del día anterior (fracción acumulada)
 * @returns {{ interestCents: number, newCarryCents: number, rate: number }}
 */
function calcDailyStandard(balanceCents, yieldTiers, carryCents = 0) {
  if (balanceCents <= 0 || !yieldTiers || yieldTiers.length === 0) {
    return { interestCents: 0, newCarryCents: carryCents, rate: 0 }
  }

  const slices = calculateTierSlices(balanceCents, yieldTiers)
  const rawInterest = slices.reduce((acc, s) => acc + s.dailyInterestCents, 0)

  const totalRaw = rawInterest + carryCents
  const interestCents = Math.floor(totalRaw)
  const newCarryCents = totalRaw - interestCents

  const totalBase = slices.reduce((acc, s) => acc + s.amountCents, 0)
  const rate = totalBase > 0
    ? slices.reduce((acc, s) => acc + (s.amountCents / totalBase) * s.rate, 0)
    : (yieldTiers[0]?.rate || 0)

  return { interestCents, newCarryCents, rate }
}

/**
 * Calcula el interés de UN día para la Cajita Turbo.
 * base tasa alta = min(principal, tope) + interesesAcumulados (saldo - capital)
 * excedente de capital rinde a la tasa de las otras cajitas (por defecto 7%)
 *
 * @param {number} principalCents
 * @param {number} accumulatedInterestCents
 * @param {number} [turboRate=0.13] - Tasa de la Turbo (ej: 0.13)
 * @param {number} [overflowRate=0.07] - Tasa para el capital excedente (ej: 0.07)
 * @param {number} [carryCents=0]
 * @returns {{ interestCents: number, newCarryCents: number, rate: number }}
 */
function calcDailyTurbo(
  principalCents,
  accumulatedInterestCents,
  turboRate = 0.13,
  overflowRate = 0.07,
  carryCents = 0,
) {
  const cappedPrincipal = Math.min(principalCents, TURBO_CAP_CENTS)
  const excessPrincipal = Math.max(0, principalCents - TURBO_CAP_CENTS)
  const highBase = cappedPrincipal + accumulatedInterestCents

  const highRawInterest = (highBase * turboRate) / 365
  const excessRawInterest = (excessPrincipal * overflowRate) / 365
  const rawInterest = highRawInterest + excessRawInterest

  const totalRaw = rawInterest + carryCents
  const interestCents = Math.floor(totalRaw)
  const newCarryCents = totalRaw - interestCents

  const totalBase = highBase + excessPrincipal
  const rate = totalBase > 0
    ? (highBase * turboRate + excessPrincipal * overflowRate) / totalBase
    : turboRate

  return { interestCents, newCarryCents, rate }
}

/**
 * Aplica los movimientos de un día al estado de la cuenta.
 *
 * @param {Object} state - { balanceCents, principalCents, accumulatedInterestCents }
 * @param {string} accountId
 * @param {Array<Object>} movementsForDay
 * @param {boolean} isTurbo
 * @returns {Object} Nuevo estado
 */
function applyDayMovements(state, accountId, movementsForDay, isTurbo) {
  let s = { ...state }
  for (const m of movementsForDay) {
    let tagged = { ...m }
    if (m.type === 'transfer') {
      const srcId = m.sourceAccountId ?? m.accountId
      tagged._isSource = srcId === accountId
    }
    s = applyMovementToState(s, tagged, isTurbo)
  }
  return s
}

/**
 * Acredita rendimientos para UN rango de días terminados.
 *
 * El llamador debe proporcionar el estado inicial de la cuenta al INICIO del rango
 * (es decir, el saldo al cierre del día anterior a `desde`).
 * Si no se proporciona, se usa el saldo actual de la cuenta (útil para primer acreditado).
 *
 * @param {Object} account - Cuenta con interestEnabled=true e interestStartDate
 * @param {Object} movementsByDay - { 'YYYY-MM-DD': [movement, ...] }
 * @param {string} desde - 'YYYY-MM-DD' Primer día a acreditar (inclusive)
 * @param {string} hasta - 'YYYY-MM-DD' Último día a acreditar (inclusive, debe ser < hoy)
 * @param {Set<string>} [alreadyAccruedDates] - Fechas ya acreditadas (idempotencia)
 * @param {Object} [initialState] - Estado inicial { balanceCents, principalCents, accumulatedInterestCents, carryCents }
 * @returns {Array<{accountId, date, amountCents, baseCents, rate, carryCents}>}
 */
export function accrueRange(
  account,
  movementsByDay,
  desde,
  hasta,
  alreadyAccruedDates = new Set(),
  initialState = null,
) {
  if (!isAccrualAccount(account)) return []
  if (!desde || !hasta || desde > hasta) return []

  const startDate = account.interestStartDate
  if (!startDate) return []

  const turbo = isTurboAccount(account)
  const yieldTiers = account.yieldTiers || []
  const turboRate = yieldTiers[0]?.rate || 0.13
  const overflowRate = yieldTiers[1]?.rate || 0.07

  // Estado inicial
  let state
  if (initialState) {
    state = {
      balanceCents: initialState.balanceCents ?? 0,
      principalCents: initialState.principalCents ?? 0,
      accumulatedInterestCents: initialState.accumulatedInterestCents ?? 0,
    }
  } else {
    const bal = Math.max(0, account.balance || 0)
    const accInt = turbo ? Math.max(0, account.accumulatedInterestCents || 0) : 0
    const principal = turbo
      ? Math.max(0, bal - accInt)
      : 0
    state = {
      balanceCents: bal,
      principalCents: principal,
      accumulatedInterestCents: accInt,
    }
  }

  let carryCents = initialState?.carryCents ?? 0
  const result = []

  let currentDate = desde
  while (currentDate <= hasta) {
    // Saltar días anteriores a interestStartDate
    if (currentDate < startDate) {
      const movs = movementsByDay[currentDate] || []
      state = applyDayMovements(state, account.id, movs, turbo)
      currentDate = addOneDay(currentDate)
      continue
    }

    // Idempotencia: saltar días ya acreditados
    if (alreadyAccruedDates.has(currentDate)) {
      const movs = movementsByDay[currentDate] || []
      // Aún debemos aplicar movimientos para mantener estado consistente
      // El saldo base ya tiene el interés acreditado de ese día incorporado
      state = applyDayMovements(state, account.id, movs, turbo)
      currentDate = addOneDay(currentDate)
      continue
    }

    // BASE = saldo al inicio del día (antes de movimientos)
    const baseCents = state.balanceCents

    let interestCents, newCarryCents, rate

    if (turbo) {
      ;({ interestCents, newCarryCents, rate } = calcDailyTurbo(
        state.principalCents,
        state.accumulatedInterestCents,
        turboRate,
        overflowRate,
        carryCents,
      ))
    } else {
      ;({ interestCents, newCarryCents, rate } = calcDailyStandard(
        baseCents,
        yieldTiers,
        carryCents,
      ))
    }

    carryCents = newCarryCents

    if (interestCents > 0 && baseCents > 0) {
      result.push({
        accountId: account.id,
        date: currentDate,
        amountCents: interestCents,
        baseCents,
        rate,
        carryCents: newCarryCents,
      })
    }

    // Aplicar interés al estado para el siguiente día (compuesto)
    state.balanceCents += interestCents
    if (turbo) {
      state.accumulatedInterestCents += interestCents
    }

    // Aplicar movimientos del día
    const movs = movementsByDay[currentDate] || []
    state = applyDayMovements(state, account.id, movs, turbo)

    currentDate = addOneDay(currentDate)
  }

  return result
}

/**
 * Suma un día a una fecha ISO 'YYYY-MM-DD' sin usar Date.toISOString().
 * @param {string} dateStr
 * @returns {string}
 */
export function addOneDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + 1)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * Resta un día a una fecha ISO 'YYYY-MM-DD'.
 * @param {string} dateStr
 * @returns {string}
 */
export function subtractOneDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() - 1)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

/**
 * Devuelve la fecha local de hoy en formato 'YYYY-MM-DD'.
 * @returns {string}
 */
export function todayISO() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Agrupa los intereses acreditados por mes.
 * @param {Array<Object>} accruals - Registros de interestAccruals
 * @param {string} [locale='es-MX']
 * @returns {Array<{monthKey, label, amountCents, days, entries}>}
 */
export function groupAccrualsByMonth(accruals, locale = 'es-MX') {
  if (!Array.isArray(accruals) || accruals.length === 0) return []

  const monthMap = new Map()
  for (const a of accruals) {
    const monthKey = a.date.slice(0, 7)
    if (!monthMap.has(monthKey)) {
      monthMap.set(monthKey, { monthKey, amountCents: 0, days: 0, entries: [] })
    }
    const g = monthMap.get(monthKey)
    g.amountCents += a.amountCents
    g.days += 1
    g.entries.push(a)
  }

  return Array.from(monthMap.values())
    .sort((a, b) => b.monthKey.localeCompare(a.monthKey))
    .map((g) => {
      const [y, mo] = g.monthKey.split('-').map(Number)
      const date = new Date(y, mo - 1, 1)
      const monthName = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date)
      return { ...g, label: `Rendimientos de ${monthName}` }
    })
}

/**
 * Agrupa los intereses acreditados por mes Y por cuenta.
 * Permite mostrar una línea colapsable por mes por cuenta ("Rendimientos de octubre", con monto y días).
 *
 * @param {Array<Object>} accruals - Registros de interestAccruals
 * @param {Array<Object>} [accounts=[]] - Cuentas para resolver nombre y estilo
 * @param {string} [locale='es-MX']
 * @returns {Array<{key: string, monthKey: string, accountId: string, accountName: string, account: Object|null, label: string, amountCents: number, days: number, entries: Array<Object>}>}
 */
export function groupAccrualsByMonthAndAccount(accruals, accounts = [], locale = 'es-MX') {
  if (!Array.isArray(accruals) || accruals.length === 0) return []

  const accountsMap = new Map((accounts || []).map((a) => [a.id, a]))
  const groupMap = new Map()

  for (const a of accruals) {
    const monthKey = a.date.slice(0, 7)
    const key = `${monthKey}_${a.accountId}`
    if (!groupMap.has(key)) {
      const acc = accountsMap.get(a.accountId)
      groupMap.set(key, {
        key,
        monthKey,
        accountId: a.accountId,
        accountName: acc?.name || 'Cuenta',
        account: acc || null,
        amountCents: 0,
        days: 0,
        entries: [],
      })
    }
    const g = groupMap.get(key)
    g.amountCents += a.amountCents
    g.days += 1
    g.entries.push(a)
  }

  return Array.from(groupMap.values())
    .sort((a, b) => {
      const monthCmp = b.monthKey.localeCompare(a.monthKey)
      if (monthCmp !== 0) return monthCmp
      return a.accountName.localeCompare(b.accountName)
    })
    .map((g) => {
      const [y, mo] = g.monthKey.split('-').map(Number)
      const date = new Date(y, mo - 1, 1)
      const monthName = new Intl.DateTimeFormat(locale, { month: 'long' }).format(date)
      // Ordenar entries cronológicamente
      g.entries.sort((e1, e2) => e1.date.localeCompare(e2.date))
      return {
        ...g,
        label: `Rendimientos de ${monthName}`,
      }
    })
}

/**
 * Calcula el total de intereses acreditados en un rango de fechas.
 * @param {Array<Object>} accruals
 * @param {string} [from] - 'YYYY-MM-DD'
 * @param {string} [to] - 'YYYY-MM-DD'
 * @returns {number}
 */
export function sumAccrualsInRange(accruals, from, to) {
  if (!Array.isArray(accruals)) return 0
  return accruals.reduce((acc, a) => {
    if (from && a.date < from) return acc
    if (to && a.date > to) return acc
    return acc + (a.amountCents || 0)
  }, 0)
}

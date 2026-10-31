/**
 * src/services/interestAccrual.js
 *
 * Servicio de acreditación de rendimientos diarios.
 *
 * Se ejecuta:
 *   - Al abrir la app (desde App.jsx).
 *   - Al volver al primer plano (evento visibilitychange).
 *
 * Por cada cuenta con interestEnabled:
 *   1. Determina el rango pendiente: desde el último día acreditado + 1 hasta ayer.
 *   2. Carga movimientos de la cuenta en ese rango.
 *   3. Llama a accrueRange() para calcular los intereses día por día.
 *   4. En UNA transacción de Dexie: inserta las acreditaciones y actualiza el saldo.
 *   5. Si algo falla, la transacción se revierte (nada queda a medias).
 *
 * Idempotencia: la clave compuesta [accountId+date] impide duplicados.
 * Saldos Turbo: actualiza también accumulatedInterestCents en la cuenta.
 */

import { db } from '../db/database.js'
import {
  accrueRange,
  isAccrualAccount,
  isTurboAccount,
  todayISO,
  subtractOneDay,
} from '../domain/interestAccrual.js'

/**
 * Ejecuta el acreditado de todos los días pendientes para todas las cuentas con rendimiento.
 * Retorna el total de centavos acreditados en esta ejecución.
 *
 * @returns {Promise<number>} Total de centavos acreditados
 */
export async function runInterestAccrual() {
  try {
    const accounts = await db.accounts.toArray()
    const today = todayISO()
    const yesterday = subtractOneDay(today)

    let totalAccrued = 0

    for (const account of accounts) {
      if (!isAccrualAccount(account)) continue

      try {
        const accrued = await _accrueAccount(account, today, yesterday)
        totalAccrued += accrued
      } catch (err) {
        // Fallo en una cuenta no detiene las demás
        console.error(`[interestAccrual] Error acreditando cuenta ${account.id}:`, err)
      }
    }

    return totalAccrued
  } catch (err) {
    console.error('[interestAccrual] Error al ejecutar acreditación:', err)
    return 0
  }
}

/**
 * Acredita los intereses pendientes de UNA cuenta.
 * @param {Object} account
 * @param {string} today - 'YYYY-MM-DD'
 * @param {string} yesterday - 'YYYY-MM-DD'
 * @returns {Promise<number>} Centavos acreditados
 */
async function _accrueAccount(account, today, yesterday) {
  const startDate = account.interestStartDate
  if (!startDate) return 0

  // Último día ya acreditado para esta cuenta
  const lastAccrual = await db.interestAccruals
    .where('accountId')
    .equals(account.id)
    .reverse()
    .sortBy('date')
    .then((rows) => rows[0] || null)

  // Primer día pendiente
  let desde
  if (lastAccrual) {
    desde = _addOneDay(lastAccrual.date)
  } else {
    desde = startDate
  }

  // Si no hay días pendientes, salir
  if (desde > yesterday) return 0

  const hasta = yesterday

  // Cargar movimientos del rango para esta cuenta
  const movements = await db.movements
    .where('date')
    .between(desde, hasta, true, true)
    .filter((m) =>
      m.accountId === account.id ||
      m.toAccountId === account.id ||
      m.sourceAccountId === account.id ||
      m.destinationAccountId === account.id
    )
    .toArray()

  // Agrupar por día
  const movementsByDay = {}
  for (const m of movements) {
    if (!movementsByDay[m.date]) movementsByDay[m.date] = []
    movementsByDay[m.date].push(m)
  }

  // Fechas ya acreditadas en el rango (para idempotencia extra)
  const existingAccruals = await db.interestAccruals
    .where('[accountId+date]')
    .between([account.id, desde], [account.id, hasta], true, true)
    .toArray()
  const alreadyAccruedDates = new Set(existingAccruals.map((a) => a.date))

  const isTurbo = isTurboAccount(account)

  // Reconstruir el saldo al inicio de `desde` revirtiendo movimientos desde `desde` hasta hoy
  let startingBalance = account.balance || 0
  const movementsFromDesde = await db.movements
    .where('date')
    .aboveOrEqual(desde)
    .filter((m) =>
      m.accountId === account.id ||
      m.toAccountId === account.id ||
      m.sourceAccountId === account.id ||
      m.destinationAccountId === account.id
    )
    .toArray()

  for (const m of movementsFromDesde) {
    const amt = Math.round(Math.abs(m.amount || 0))
    if (m.type === 'income') {
      startingBalance -= amt
    } else if (m.type === 'expense') {
      startingBalance += amt
    } else if (m.type === 'transfer') {
      const srcId = m.sourceAccountId ?? m.accountId
      if (srcId === account.id) {
        startingBalance += amt
      } else {
        startingBalance -= amt
      }
    } else if (m.type === 'adjustment') {
      const delta = Math.round(Number(m.deltaCents !== undefined ? m.deltaCents : m.amount) || 0)
      startingBalance -= delta
    }
  }
  startingBalance = Math.max(0, startingBalance)

  const initialAccInt = isTurbo ? Math.max(0, account.accumulatedInterestCents || 0) : 0
  const initialPrincipal = isTurbo ? Math.max(0, startingBalance - initialAccInt) : 0

  const initialState = {
    balanceCents: startingBalance,
    principalCents: initialPrincipal,
    accumulatedInterestCents: initialAccInt,
    carryCents: lastAccrual?.carryCents || 0,
  }

  // Calcular interés del rango
  const newAccruals = accrueRange(
    account,
    movementsByDay,
    desde,
    hasta,
    alreadyAccruedDates,
    initialState,
  )

  if (newAccruals.length === 0) return 0

  const totalInterestCents = newAccruals.reduce((sum, a) => sum + a.amountCents, 0)

  // Transacción atómica: insertar acreditaciones + actualizar saldo
  await db.transaction('rw', [db.interestAccruals, db.accounts], async () => {
    // Insertar las nuevas acreditaciones
    for (const a of newAccruals) {
      // Doble check de idempotencia dentro de la transacción
      const existing = await db.interestAccruals
        .where('[accountId+date]')
        .equals([a.accountId, a.date])
        .first()
      if (existing) continue

      await db.interestAccruals.add({
        id: crypto.randomUUID(),
        accountId: a.accountId,
        date: a.date,
        amountCents: a.amountCents,
        baseCents: a.baseCents,
        rate: a.rate,
        carryCents: a.carryCents,
      })
    }

    // Actualizar saldo de la cuenta
    const freshAccount = await db.accounts.get(account.id)
    if (!freshAccount) return

    const updates = {
      balance: (freshAccount.balance || 0) + totalInterestCents,
    }

    // Para Turbo, actualizar también los intereses acumulados
    if (isTurbo) {
      updates.accumulatedInterestCents =
        (freshAccount.accumulatedInterestCents || 0) + totalInterestCents
    }

    await db.accounts.update(account.id, updates)
  })

  return totalInterestCents
}

/**
 * Agrega un día a 'YYYY-MM-DD' (sin usar toISOString).
 * @param {string} dateStr
 * @returns {string}
 */
function _addOneDay(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + 1)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * Carga el total de intereses acreditados para el Panorama.
 * @param {string} [from] - 'YYYY-MM-DD' inicio del periodo
 * @param {string} [to] - 'YYYY-MM-DD' fin del periodo
 * @returns {Promise<number>} Total en centavos
 */
export async function fetchTotalAccruedInRange(from, to) {
  try {
    let query = db.interestAccruals
    if (from && to) {
      query = query.where('date').between(from, to, true, true)
    }
    const rows = await query.toArray()
    return rows.reduce((sum, r) => sum + (r.amountCents || 0), 0)
  } catch {
    return 0
  }
}

/**
 * Carga todos los intereses acreditados de una cuenta, agrupados por mes.
 * @param {string} accountId
 * @returns {Promise<Array<Object>>}
 */
export async function fetchAccrualsForAccount(accountId) {
  try {
    return await db.interestAccruals
      .where('accountId')
      .equals(accountId)
      .sortBy('date')
  } catch {
    return []
  }
}

/**
 * Carga intereses acreditados de un periodo para todas las cuentas.
 * @param {string} [from]
 * @param {string} [to]
 * @returns {Promise<Array<Object>>}
 */
export async function fetchAccrualsInRange(from, to) {
  try {
    if (!from || !to) return await db.interestAccruals.toArray()
    return await db.interestAccruals
      .where('date')
      .between(from, to, true, true)
      .toArray()
  } catch {
    return []
  }
}

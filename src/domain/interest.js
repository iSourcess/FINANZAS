/**
 * src/domain/interest.js
 *
 * Lógica pura para el cálculo y proyección de intereses generados por cuentas con rendimiento.
 *
 * Reglas de negocio:
 *   - Pasado:
 *       - Reconstruye el saldo diario de cada cuenta con rendimiento a partir del saldo actual
 *         y los movimientos posteriores: saldo(d) = saldo actual - efecto de movimientos posteriores a d.
 *       - Reutiliza movements.js (calculateBalanceChange).
 *       - Ignora días anteriores a la creación de la cuenta (account.createdAt).
 *       - Aplica las reglas de rendimiento de yield.js (tramos, Cajita Turbo con capital/intereses).
 *       - Agrupa por cubeta (buckets de buckets.js) y por cuenta (para desglose interactivo).
 *       - Es una estimación analítica; NO modifica saldos reales de la base de datos.
 *   - Futuro:
 *       - projectInterest(accounts, horizonDays, monthlyContributionCents = 0)
 *       - Capitalización diaria desde hoy.
 *       - Nu Cajita Turbo: capital topado ($25,000), intereses capitalizan rindiendo al 13%, excedente al 7%.
 *       - Cuentas por tramos (Revolut, Mercado Pago): tramos evaluados sobre el saldo creciente.
 *       - Aportación mensual: aplicada cada 30 días simulados dividida entre las cuentas de rendimiento.
 *       - Agregación por mes (horizontes 30, 90, 180, 365 días).
 */

import { format, addDays } from 'date-fns'
import { calculateBalanceChange } from './movements.js'
import { calculateAccountYield, calculateDailyInterest, calculateTurboYield, TURBO_CAP_CENTS } from './yield.js'
import { fromISODate } from './periods.js'

/**
 * Convierte un Date a string local 'YYYY-MM-DD'.
 * @param {Date} date
 * @returns {string}
 */
export function toLocalDateStr(date) {
  return format(date, 'yyyy-MM-dd')
}

/**
 * Determina si una cuenta tiene esquema de rendimiento activo.
 * @param {Object} account
 * @returns {boolean}
 */
export function isYieldAccount(account) {
  if (!account || account.hidden) return false
  if (account.isTurbo || account.yieldCapBase === 'principal') return true
  if (Array.isArray(account.yieldTiers) && account.yieldTiers.length > 0) {
    return account.yieldTiers.some((t) => (t.rate || 0) > 0)
  }
  return false
}

/**
 * Reconstruye el saldo de una cuenta al final de un día específico `d` ('YYYY-MM-DD').
 * saldo(d) = saldo actual - suma(efecto de movimientos posteriores a d)
 *
 * Si el día es anterior a la fecha de creación de la cuenta, retorna 0.
 *
 * @param {Object} account
 * @param {Array<Object>} movements - Lista de movimientos
 * @param {string} targetDate - 'YYYY-MM-DD'
 * @returns {number} Saldo en centavos enteros
 */
export function reconstructHistoricalBalance(account, movements = [], targetDate) {
  if (!account) return 0

  const creationDate = account.createdAt ? account.createdAt.slice(0, 10) : '1970-01-01'
  if (targetDate < creationDate) {
    return 0
  }

  const currentBalance = account.balance || 0

  // Movimientos estrictamente posteriores a targetDate que afectaron a esta cuenta
  let posteriorDeltas = 0
  for (let i = 0; i < movements.length; i++) {
    const m = movements[i]
    if (!m.date || m.date <= targetDate) continue

    const isSource = m.sourceAccountId ? m.sourceAccountId === account.id : (m.accountId === account.id)
    const isDest = m.destinationAccountId === account.id

    if (!isSource && !isDest && m.accountId !== account.id) continue

    const delta = calculateBalanceChange({
      accountType: account.type || 'debit',
      movementType: m.type,
      amount: m.amount,
      deltaCents: m.deltaCents,
      isSourceAccount: isSource,
    })

    posteriorDeltas += delta
  }

  const reconstructed = currentBalance - posteriorDeltas
  return Math.max(0, reconstructed)
}

/**
 * Calcula el interés diario en centavos para una cuenta con un saldo dado.
 * @param {Object} account
 * @param {number} balanceCents
 * @returns {number} Centavos (decimal)
 */
export function calculateAccountDailyInterest(account, balanceCents) {
  if (!account || balanceCents <= 0) return 0

  const isTurbo = Boolean(
    account.isTurbo ||
    (account.themeKey === 'nu' && account.yieldCapBase === 'principal') ||
    (account.yieldCapBase === 'principal' && account.yieldTiers?.[0]?.rate === 0.13)
  )

  const yieldInfo = calculateAccountYield({
    balanceCents,
    yieldTiers: account.yieldTiers || [],
    yieldCapBase: account.yieldCapBase,
    accumulatedInterestCents: account.accumulatedInterestCents || 0,
    isTurbo,
  })

  return yieldInfo.dailyCents || 0
}

/**
 * Calcula los intereses históricos y proyectados del periodo divididos por cubetas.
 *
 * @param {Object} params
 * @param {Array<Object>} params.accounts - Cuentas de la app
 * @param {Array<Object>} params.movements - Movimientos registrados
 * @param {Array<{ start: string, end: string, label: string }>} params.buckets - Cubetas generadas por getBuckets()
 * @param {Date} [params.referenceDate=new Date()] - Fecha actual de referencia
 * @returns {{
 *   bucketSeries: Array<{
 *     start: string,
 *     end: string,
 *     label: string,
 *     pastInterestCents: number,
 *     projectedInterestCents: number,
 *     totalInterestCents: number,
 *     isFuture: boolean,
 *     byAccount: Object<string, { id: string, name: string, themeKey: string, amountCents: number, pastCents: number, projectedCents: number }>
 *   }>,
 *   totalPeriodInterestCents: number,
 *   totalPastInterestCents: number,
 *   totalProjectedInterestCents: number,
 *   byAccountSummary: Array<{ id: string, name: string, themeKey: string, totalInterestCents: number, pastCents: number, projectedCents: number }>
 * }}
 */
export function calculateHistoricalInterest({
  accounts = [],
  movements = [],
  buckets = [],
  referenceDate = new Date(),
  interestAccruals = null,
}) {
  const todayStr = toLocalDateStr(referenceDate)
  const yieldAccounts = accounts.filter(isYieldAccount)

  if (yieldAccounts.length === 0 || buckets.length === 0) {
    return {
      bucketSeries: buckets.map((b) => ({
        start: b.start,
        end: b.end,
        label: b.label,
        pastInterestCents: 0,
        projectedInterestCents: 0,
        totalInterestCents: 0,
        isFuture: b.start > todayStr,
        byAccount: {},
      })),
      totalPeriodInterestCents: 0,
      totalPastInterestCents: 0,
      totalProjectedInterestCents: 0,
      byAccountSummary: [],
    }
  }

  // Mapa para consulta rápida de acreditaciones reales registradas
  const accrualsMap = interestAccruals ? new Map() : null
  if (Array.isArray(interestAccruals)) {
    for (const a of interestAccruals) {
      accrualsMap.set(`${a.accountId}_${a.date}`, a.amountCents || 0)
    }
  }

  // Precalcula movimientos filtrados (solo necesarios si no se cuenta con interestAccruals)
  const yieldAccountIds = new Set(yieldAccounts.map((a) => a.id))
  const relevantMovements = accrualsMap
    ? []
    : movements.filter(
        (m) =>
          yieldAccountIds.has(m.accountId) ||
          yieldAccountIds.has(m.sourceAccountId) ||
          yieldAccountIds.has(m.destinationAccountId)
      )

  let globalPastCents = 0
  let globalProjectedCents = 0
  const accountTotals = new Map()

  yieldAccounts.forEach((acc) => {
    accountTotals.set(acc.id, {
      id: acc.id,
      name: acc.name,
      themeKey: acc.themeKey || 'default',
      totalInterestCents: 0,
      pastCents: 0,
      projectedCents: 0,
    })
  })

  // Para la proyección en días futuros dentro del periodo, guardamos el saldo actual
  const currentBalances = new Map()
  yieldAccounts.forEach((acc) => {
    currentBalances.set(acc.id, acc.balance || 0)
  })

  const bucketSeries = buckets.map((bucket) => {
    const bucketByAccount = {}
    yieldAccounts.forEach((acc) => {
      bucketByAccount[acc.id] = {
        id: acc.id,
        name: acc.name,
        themeKey: acc.themeKey || 'default',
        amountCents: 0,
        pastCents: 0,
        projectedCents: 0,
      }
    })

    let bucketPastCents = 0
    let bucketProjectedCents = 0

    // Itera día por día dentro de la cubeta
    const bStart = fromISODate(bucket.start)
    const bEnd = fromISODate(bucket.end)
    const curDate = new Date(bStart.getFullYear(), bStart.getMonth(), bStart.getDate(), 12, 0, 0)
    const endDate = new Date(bEnd.getFullYear(), bEnd.getMonth(), bEnd.getDate(), 12, 0, 0)

    while (curDate <= endDate) {
      const dStr = toLocalDateStr(curDate)
      const isDayFuture = dStr > todayStr

      for (let i = 0; i < yieldAccounts.length; i++) {
        const acc = yieldAccounts[i]
        let dailyInt = 0

        if (isDayFuture) {
          // Día futuro dentro del periodo: proyección con saldo actual
          const bal = currentBalances.get(acc.id) || 0
          dailyInt = calculateAccountDailyInterest(acc, bal)
          bucketProjectedCents += dailyInt
          bucketByAccount[acc.id].projectedCents += dailyInt
        } else if (accrualsMap) {
          // Pasado: lee directamente las acreditaciones reales de interestAccruals (sin reconstruir saldos)
          dailyInt = accrualsMap.get(`${acc.id}_${dStr}`) || 0
          bucketPastCents += dailyInt
          bucketByAccount[acc.id].pastCents += dailyInt
        } else {
          // Pasado sin registros: reconstruir saldo histórico como fallback
          const histBalance = reconstructHistoricalBalance(acc, relevantMovements, dStr)
          dailyInt = calculateAccountDailyInterest(acc, histBalance)
          bucketPastCents += dailyInt
          bucketByAccount[acc.id].pastCents += dailyInt
        }

        bucketByAccount[acc.id].amountCents += dailyInt
      }

      curDate.setDate(curDate.getDate() + 1)
    }

    // Redondear montos de la cubeta a centavos enteros
    const roundedPast = Math.round(bucketPastCents)
    const roundedProjected = Math.round(bucketProjectedCents)
    const roundedTotal = roundedPast + roundedProjected

    globalPastCents += roundedPast
    globalProjectedCents += roundedProjected

    Object.values(bucketByAccount).forEach((accItem) => {
      accItem.pastCents = Math.round(accItem.pastCents)
      accItem.projectedCents = Math.round(accItem.projectedCents)
      accItem.amountCents = accItem.pastCents + accItem.projectedCents

      const summary = accountTotals.get(accItem.id)
      if (summary) {
        summary.pastCents += accItem.pastCents
        summary.projectedCents += accItem.projectedCents
        summary.totalInterestCents += accItem.amountCents
      }
    })

    return {
      start: bucket.start,
      end: bucket.end,
      label: bucket.label,
      pastInterestCents: roundedPast,
      projectedInterestCents: roundedProjected,
      totalInterestCents: roundedTotal,
      isFuture: bucket.start > todayStr,
      byAccount: bucketByAccount,
    }
  })

  return {
    bucketSeries,
    totalPeriodInterestCents: globalPastCents + globalProjectedCents,
    totalPastInterestCents: globalPastCents,
    totalProjectedInterestCents: globalProjectedCents,
    byAccountSummary: Array.from(accountTotals.values()),
  }
}

/**
 * Proyecta los intereses futuros con capitalización diaria desde hoy para un horizonte de días dado.
 *
 * Nu Cajita Turbo:
 *   - Capital depositado topado a $25,000 (2,500,000 centavos) rinde al 13%.
 *   - Intereses acumulados capitalizan y continúan rindiendo al 13%.
 *   - Excedente de capital rinde al 7%.
 * Cuentas por tramos (Revolut, MP):
 *   - Tramos evaluados día a día sobre el saldo creciente capitalizado.
 *
 * @param {Array<Object>} accounts - Cuentas
 * @param {number} horizonDays - Días a proyectar (30 = 1m, 90 = 3m, 180 = 6m, 365 = 12m)
 * @param {number} [monthlyContributionCents=0] - Aportación adicional recurrente cada 30 días
 * @param {Date} [referenceDate=new Date()]
 * @returns {{
 *   horizonDays: number,
 *   totalInterestCents: number,
 *   initialBalanceCents: number,
 *   finalBalanceCents: number,
 *   monthlyBuckets: Array<{
 *     monthIndex: number,
 *     label: string,
 *     interestCents: number,
 *     cumulativeInterestCents: number,
 *     endBalanceCents: number,
 *     byAccount: Object<string, number>
 *   }>,
 *   byAccount: Array<{
 *     id: string,
 *     name: string,
 *     themeKey: string,
 *     initialBalanceCents: number,
 *     finalBalanceCents: number,
 *     totalInterestCents: number
 *   }>
 * }}
 */
export function projectInterest(
  accounts = [],
  horizonDays = 30,
  monthlyContributionCents = 0,
  referenceDate = new Date()
) {
  const yieldAccounts = accounts.filter(isYieldAccount)
  const safeDays = Math.max(1, Math.round(horizonDays || 30))
  const safeContribution = Math.max(0, Math.round(monthlyContributionCents || 0))

  if (yieldAccounts.length === 0) {
    return {
      horizonDays: safeDays,
      totalInterestCents: 0,
      initialBalanceCents: 0,
      finalBalanceCents: 0,
      monthlyBuckets: [],
      byAccount: [],
    }
  }

  // Estado de simulación por cada cuenta
  const simState = yieldAccounts.map((acc) => {
    const isTurbo = Boolean(
      acc.isTurbo ||
      (acc.themeKey === 'nu' && acc.yieldCapBase === 'principal') ||
      (acc.yieldCapBase === 'principal' && acc.yieldTiers?.[0]?.rate === 0.13)
    )

    const initialBal = Math.max(0, acc.balance || 0)
    return {
      id: acc.id,
      name: acc.name,
      themeKey: acc.themeKey || 'default',
      account: acc,
      isTurbo,
      initialBalance: initialBal,
      // Para Turbo separamos capital de intereses
      principalCents: isTurbo ? initialBal : initialBal,
      accumulatedInterestCents: isTurbo ? (acc.accumulatedInterestCents || 0) : 0,
      currentBalance: initialBal,
      totalInterestEarned: 0,
    }
  })

  const initialTotalBalance = simState.reduce((acc, s) => acc + s.initialBalance, 0)

  // Dividir la aportación mensual equitativamente entre las cuentas con rendimiento
  const contributionPerAccount = simState.length > 0 ? Math.floor(safeContribution / simState.length) : 0

  const monthlyBuckets = []
  let currentMonthInterest = 0
  let currentMonthByAccount = {}
  simState.forEach((s) => {
    currentMonthByAccount[s.id] = 0
  })

  // Simulación día a día
  for (let day = 1; day <= safeDays; day++) {
    // Aportación mensual cada 30 días
    if (day > 1 && (day - 1) % 30 === 0 && safeContribution > 0) {
      simState.forEach((s) => {
        s.principalCents += contributionPerAccount
        s.currentBalance += contributionPerAccount
      })
    }

    // Rendimiento diario de cada cuenta
    simState.forEach((s) => {
      let dayInterest = 0
      if (s.isTurbo) {
        const turbo = calculateTurboYield({
          principalCents: s.principalCents,
          accumulatedInterestCents: s.accumulatedInterestCents,
          rate: s.account.yieldTiers?.[0]?.rate || 0.13,
          overflowRate: s.account.yieldTiers?.[1]?.rate || 0,
        })
        dayInterest = turbo.dailyCents
        // Los intereses capitalizan aumentando accumulatedInterestCents
        s.accumulatedInterestCents += dayInterest
        s.currentBalance += dayInterest
      } else {
        dayInterest = calculateDailyInterest(s.currentBalance, s.account.yieldTiers || [])
        s.currentBalance += dayInterest
      }

      s.totalInterestEarned += dayInterest
      currentMonthInterest += dayInterest
      currentMonthByAccount[s.id] = (currentMonthByAccount[s.id] || 0) + dayInterest
    })

    // Fin de mes (cada 30 días o al llegar al último día)
    const isMonthEnd = day % 30 === 0 || day === safeDays
    if (isMonthEnd) {
      const monthIdx = Math.ceil(day / 30)
      const currentTotalBal = simState.reduce((acc, s) => acc + s.currentBalance, 0)
      const cumulativeInterest = simState.reduce((acc, s) => acc + s.totalInterestEarned, 0)

      const roundedByAccount = {}
      Object.keys(currentMonthByAccount).forEach((k) => {
        roundedByAccount[k] = Math.round(currentMonthByAccount[k])
      })

      monthlyBuckets.push({
        monthIndex: monthIdx,
        label: `Mes ${monthIdx}`,
        interestCents: Math.round(currentMonthInterest),
        cumulativeInterestCents: Math.round(cumulativeInterest),
        endBalanceCents: Math.round(currentTotalBal),
        byAccount: roundedByAccount,
      })

      // Reiniciar acumulador del mes
      currentMonthInterest = 0
      currentMonthByAccount = {}
      simState.forEach((s) => {
        currentMonthByAccount[s.id] = 0
      })
    }
  }

  const finalTotalBalance = simState.reduce((acc, s) => acc + s.currentBalance, 0)
  const totalInterest = simState.reduce((acc, s) => acc + s.totalInterestEarned, 0)

  return {
    horizonDays: safeDays,
    totalInterestCents: Math.round(totalInterest),
    initialBalanceCents: initialTotalBalance,
    finalBalanceCents: Math.round(finalTotalBalance),
    monthlyBuckets,
    byAccount: simState.map((s) => ({
      id: s.id,
      name: s.name,
      themeKey: s.themeKey,
      initialBalanceCents: s.initialBalance,
      finalBalanceCents: Math.round(s.currentBalance),
      totalInterestCents: Math.round(s.totalInterestEarned),
    })),
  }
}

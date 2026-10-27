/**
 * src/domain/yield.js
 *
 * Lógica pura de cálculo de rendimientos por tramos y capitalización diaria.
 *
 * Reglas de negocio (PLAN.md sección 5.1):
 *   - Interés diario: suma del monto en cada tramo × tasa del tramo / 365.
 *   - Nu Cajita Turbo:
 *       Capital hasta $25,000 MXN (2,500,000 centavos) al 13% nominal.
 *       Intereses acumulados capitalizan y siguen rindiendo al 13% compuesto.
 *       Si el capital supera los $25,000, genera advertencia sugiriendo mover el excedente a otra cajita.
 *   - Revolut:
 *       15% de $0 a $25,000; 7% de $25,001 a $1,000,000; excedente a 0%.
 *   - Mercado Pago:
 *       12% hasta $25,000; 6% sobre el excedente sin límite.
 *   - BBVA débito:
 *       0% por defecto (sin rendimiento).
 *   - Cálculos provistos:
 *       - Interés diario estimado (en centavos).
 *       - Interés mensual estimado (30 días).
 *       - Interés anual estimado nominal y efectivo.
 *       - Tasa nominal ponderada y tasa efectiva anual (TEA).
 *       - Faltante para llegar al tope del tramo de tasa alta y advertencia de exceso.
 */

export const TURBO_CAP_CENTS = 2_500_000 // $25,000.00 MXN en centavos

/**
 * Calcula la tasa efectiva anual (TEA / GAT) a partir de una tasa nominal anual
 * con capitalización diaria (365 días).
 * Fórmula: (1 + r / 365)^365 - 1
 *
 * @param {number} nominalRate - Decimal (ej: 0.13 para 13%)
 * @param {number} [periods=365] - Periodos de capitalización por año
 * @returns {number} Tasa efectiva anual decimal
 */
export function calculateEffectiveRate(nominalRate, periods = 365) {
  if (!nominalRate || nominalRate <= 0) return 0
  return Math.pow(1 + nominalRate / periods, periods) - 1
}

/**
 * Calcula el desglose de capital por cada tramo de rendimiento.
 *
 * @param {number} balanceCents - Saldo total en centavos
 * @param {Array<{ upTo: number|null, rate: number }>} yieldTiers - Tramos de rendimiento
 * @returns {Array<{ tierIndex: number, amountCents: number, rate: number, dailyInterestCents: number }>}
 */
export function calculateTierSlices(balanceCents, yieldTiers = []) {
  if (!balanceCents || balanceCents <= 0 || !yieldTiers || yieldTiers.length === 0) {
    return []
  }

  const safeBalance = Math.max(0, Math.round(balanceCents))
  let remaining = safeBalance
  let prevUpTo = 0
  const slices = []

  for (let i = 0; i < yieldTiers.length; i++) {
    const tier = yieldTiers[i]
    if (remaining <= 0) break

    const tierLimit = tier.upTo ? Math.max(0, tier.upTo - prevUpTo) : Infinity
    const amountInTier = Math.min(remaining, tierLimit)
    const dailyInterestCents = (amountInTier * tier.rate) / 365

    slices.push({
      tierIndex: i,
      amountCents: amountInTier,
      rate: tier.rate,
      dailyInterestCents,
    })

    remaining -= amountInTier
    prevUpTo = tier.upTo || prevUpTo
  }

  return slices
}

/**
 * Calcula el interés diario exacto en centavos para una cuenta estándar por tramos.
 *
 * @param {number} balanceCents
 * @param {Array<{ upTo: number|null, rate: number }>} yieldTiers
 * @returns {number} Interés diario en centavos (decimal)
 */
export function calculateDailyInterest(balanceCents, yieldTiers = []) {
  const slices = calculateTierSlices(balanceCents, yieldTiers)
  return slices.reduce((acc, slice) => acc + slice.dailyInterestCents, 0)
}

/**
 * Analiza el estado del tope para el primer tramo con límite de una cuenta.
 *
 * @param {number} balanceCents
 * @param {Array<{ upTo: number|null, rate: number }>} yieldTiers
 * @param {boolean} [isTurbo=false]
 * @returns {{
 *   hasCap: boolean,
 *   capCents: number|null,
 *   remainingCents: number,
 *   isOverCap: boolean,
 *   excessCents: number,
 *   warningMessage: string|null,
 *   infoMessage: string|null
 * }}
 */
export function getCapStatus(balanceCents, yieldTiers = [], isTurbo = false) {
  const safeBalance = Math.max(0, Math.round(balanceCents || 0))

  // Si es cajita turbo, el tope es fijo de $25,000
  const capCents = isTurbo ? TURBO_CAP_CENTS : (yieldTiers[0]?.upTo || null)

  if (!capCents) {
    return {
      hasCap: false,
      capCents: null,
      remainingCents: 0,
      isOverCap: false,
      excessCents: 0,
      warningMessage: null,
      infoMessage: null,
    }
  }

  const isOverCap = safeBalance > capCents
  const excessCents = isOverCap ? safeBalance - capCents : 0
  const remainingCents = !isOverCap ? capCents - safeBalance : 0

  let warningMessage = null
  let infoMessage = null

  if (isOverCap) {
    warningMessage = isTurbo
      ? `Superaste el tope de depósito de $25,000 en Cajita Turbo. El capital excedente no rinde aquí (0%). Muévelo a tu Cajita Ahorro (7%).`
      : `Has superado el tope del primer tramo de tasa alta. El excedente aplica al tramo siguiente.`
  } else if (remainingCents > 0) {
    infoMessage = `Te faltan para llegar al tope de tasa alta.`
  } else {
    infoMessage = `Has alcanzado el tope máximo de tasa alta.`
  }

  return {
    hasCap: true,
    capCents,
    remainingCents,
    isOverCap,
    excessCents,
    warningMessage,
    infoMessage,
  }
}

/**
 * Cálculo específico para Nu Cajita Turbo:
 * El capital depositado hasta $25,000 rinde al 13%, y los intereses acumulados
 * capitalizan a diario y continúan rindiendo al 13%.
 * El excedente de capital depositado sobre $25,000 NO rinde en la Turbo (0%),
 * debe transferirse a Cajita Ahorro (7%).
 *
 * @param {Object} params
 * @param {number} params.principalCents - Capital depositado en centavos
 * @param {number} [params.accumulatedInterestCents=0] - Intereses históricos generados
 * @param {number} [params.rate=0.13] - Tasa nominal de la cajita turbo
 * @param {number} [params.overflowRate=0] - Tasa para el excedente en la Turbo (0% por defecto)
 * @returns {Object}
 */
export function calculateTurboYield({
  principalCents = 0,
  accumulatedInterestCents = 0,
  rate = 0.13,
  overflowRate = 0,
}) {
  const safePrincipal = Math.max(0, Math.round(principalCents))
  const safeAccumulated = Math.max(0, Math.round(accumulatedInterestCents))

  const cappedPrincipal = Math.min(safePrincipal, TURBO_CAP_CENTS)
  const excessPrincipal = Math.max(0, safePrincipal - TURBO_CAP_CENTS)

  // Base con tasa alta (capital topado + intereses capitalizados al 13%)
  const highYieldBase = cappedPrincipal + safeAccumulated
  const highYieldDaily = (highYieldBase * rate) / 365

  // Interés diario del excedente en la Turbo (0%)
  const excessDaily = (excessPrincipal * overflowRate) / 365

  const totalDailyCents = highYieldDaily + excessDaily
  const effectiveRate = calculateEffectiveRate(rate)

  const capStatus = getCapStatus(safePrincipal, [{ upTo: TURBO_CAP_CENTS, rate }], true)

  return {
    isTurbo: true,
    principalCents: safePrincipal,
    accumulatedInterestCents: safeAccumulated,
    highYieldBaseCents: highYieldBase,
    excessPrincipalCents: excessPrincipal,
    dailyCents: totalDailyCents,
    monthlyCents: totalDailyCents * 30,
    annualNominalCents: totalDailyCents * 365,
    annualEffectiveCents: highYieldBase * effectiveRate + excessPrincipal * calculateEffectiveRate(overflowRate),
    nominalRate: rate,
    effectiveRate,
    capStatus,
  }
}

/**
 * Función maestra para calcular todas las estimaciones de rendimiento de una cuenta.
 *
 * @param {Object} params
 * @param {number} params.balanceCents - Saldo actual
 * @param {Array<{ upTo: number|null, rate: number }>} params.yieldTiers - Tramos de rendimiento
 * @param {string|null} [params.yieldCapBase] - 'principal' | 'balance'
 * @param {number} [params.accumulatedInterestCents=0] - Interés acumulado
 * @param {boolean} [params.isTurbo=false] - Si es Cajita Turbo
 * @returns {Object} Resumen completo de rendimientos
 */
export function calculateAccountYield({
  balanceCents = 0,
  yieldTiers = [],
  yieldCapBase = null,
  accumulatedInterestCents = 0,
  isTurbo = false,
}) {
  const safeBalance = Math.max(0, Math.round(balanceCents || 0))

  // Si es Turbo explícitamente o tiene base 'principal' con tope de $25k al 13%
  if (isTurbo || (yieldCapBase === 'principal' && yieldTiers?.[0]?.rate === 0.13)) {
    let principalCents = safeBalance
    let accInterestCents = Math.max(0, Math.round(accumulatedInterestCents || 0))

    if (accInterestCents > 0) {
      principalCents = Math.max(0, safeBalance - accInterestCents)
    } else if (safeBalance > TURBO_CAP_CENTS) {
      // En Nu el límite para depositar es $25,000; todo saldo adicional por encima
      // corresponde a intereses acumulados que siguen rindiendo al 13% (interés compuesto).
      principalCents = TURBO_CAP_CENTS
      accInterestCents = safeBalance - TURBO_CAP_CENTS
    }

    return calculateTurboYield({
      principalCents,
      accumulatedInterestCents: accInterestCents,
      rate: yieldTiers?.[0]?.rate || 0.13,
      overflowRate: yieldTiers?.[1]?.rate || 0,
    })
  }

  // Cuenta estándar por tramos (Revolut, Mercado Pago, etc.)
  if (!yieldTiers || yieldTiers.length === 0) {
    return {
      dailyCents: 0,
      monthlyCents: 0,
      annualNominalCents: 0,
      annualEffectiveCents: 0,
      weightedNominalRate: 0,
      weightedEffectiveRate: 0,
      capStatus: { hasCap: false },
      slices: [],
    }
  }

  const slices = calculateTierSlices(safeBalance, yieldTiers)
  const dailyCents = slices.reduce((acc, s) => acc + s.dailyInterestCents, 0)
  const annualNominalCents = dailyCents * 365
  const monthlyCents = dailyCents * 30 // Proyección a 30 días

  // Tasa nominal ponderada
  const weightedNominalRate = safeBalance > 0
    ? slices.reduce((acc, s) => acc + (s.amountCents / safeBalance) * s.rate, 0)
    : (yieldTiers[0]?.rate || 0)

  // Tasa efectiva ponderada
  const weightedEffectiveRate = safeBalance > 0
    ? slices.reduce((acc, s) => acc + (s.amountCents / safeBalance) * calculateEffectiveRate(s.rate), 0)
    : calculateEffectiveRate(weightedNominalRate)

  const annualEffectiveCents = safeBalance * weightedEffectiveRate
  const capStatus = getCapStatus(safeBalance, yieldTiers, false)

  return {
    isTurbo: false,
    balanceCents: safeBalance,
    dailyCents,
    monthlyCents,
    annualNominalCents,
    annualEffectiveCents,
    weightedNominalRate,
    weightedEffectiveRate,
    capStatus,
    slices,
  }
}

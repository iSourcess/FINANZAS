/**
 * src/domain/reconcile.js
 *
 * Lógica pura para el ajuste y cuadre de saldo de cuentas con el banco.
 *
 * REGLAS ESTRICTAS:
 *   - Funciones puras: sin React, sin IndexedDB, sin efectos secundarios.
 *   - Montos siempre en CENTAVOS ENTEROS.
 *   - El movimiento de tipo 'adjustment' es neutro: modifica el saldo de la cuenta,
 *     pero está excluido de ingresos, gastos, presupuestos, dona y comparativas.
 *   - En cuentas de crédito: el balance es DEUDA (positivo = debes). Si la deuda real
 *     es mayor, deltaCents > 0 (sube la deuda); si la deuda real es menor, deltaCents < 0.
 *   - En Nu Cajita Turbo: el ajuste no altera el capital depositado ($25,000);
 *     los intereses acumulados salen de saldo - capital. Si saldo < capital,
 *     se avisa que revise el capital configurado en vez de mostrar negativos.
 */

export const RECONCILE_REASONS = [
  { id: 'reconcile', label: 'Cuadre / Conciliación', description: 'Ajuste para igualar saldo bancario' },
  { id: 'interest', label: 'Intereses', description: 'Intereses ganados o cobrados' },
  { id: 'fee', label: 'Comisión bancaria', description: 'Comisiones o cargos por servicio' },
  { id: 'loan_given', label: 'Préstamo otorgado', description: 'Dinero prestado a un tercero' },
  { id: 'loan_received', label: 'Préstamo recibido', description: 'Préstamo recibido de un tercero' },
  { id: 'repayment_received', label: 'Cobro de deuda', description: 'Devolución de dinero que prestaste' },
  { id: 'repayment_made', label: 'Pago de deuda', description: 'Pago de dinero que te prestaron' },
  { id: 'other', label: 'Otro motivo', description: 'Ajuste no clasificado' },
]

/**
 * Obtiene la etiqueta amigable de un motivo de conciliación.
 * @param {string} reasonId
 * @returns {string}
 */
export function getReconcileReasonLabel(reasonId) {
  const found = RECONCILE_REASONS.find((r) => r.id === reasonId)
  return found ? found.label : 'Ajuste de saldo'
}

/**
 * Calcula la diferencia (deltaCents) entre el saldo/deuda real y el actual de la app.
 *
 * @param {Object} params
 * @param {number} params.currentBalanceCents - Saldo actual en app (en centavos)
 * @param {number} params.realBalanceCents - Saldo real en banco (en centavos)
 * @param {boolean} [params.isCredit=false] - Si la cuenta es de crédito
 * @returns {{
 *   deltaCents: number,
 *   isZero: boolean,
 *   sign: '+'|'-'|'',
 *   absDeltaCents: number
 * }}
 */
export function calculateReconcileDelta({
  currentBalanceCents = 0,
  realBalanceCents = 0,
  isCredit = false,
}) {
  const safeCurrent = Math.round(Number(currentBalanceCents) || 0)
  const safeReal = Math.round(Number(realBalanceCents) || 0)

  // En débito/ahorro: delta = real - actual (positivo = entró dinero, negativo = faltó dinero)
  // En crédito: delta = deudaReal - deudaActual (positivo = debes más, negativo = debes menos)
  const deltaCents = safeReal - safeCurrent
  const isZero = deltaCents === 0

  let sign = ''
  if (deltaCents > 0) sign = '+'
  else if (deltaCents < 0) sign = '-'

  return {
    deltaCents,
    isZero,
    sign,
    absDeltaCents: Math.abs(deltaCents),
  }
}

/**
 * Valida y calcula el impacto de cuadrar saldo en Nu Cajita Turbo.
 *
 * Reglas:
 *   - El ajuste NO cambia el capital depositado ($25,000 o el configurado).
 *   - Los intereses acumulados salen de saldo - capital.
 *   - Si saldo < capital, avisa que revise el capital en vez de mostrar negativos.
 *
 * @param {Object} params
 * @param {number} params.realBalanceCents - Saldo real tras el ajuste (en centavos)
 * @param {number} [params.capitalCents=2_500_000] - Capital depositado configurado
 * @returns {{
 *   effectiveCapitalCents: number,
 *   accumulatedInterestCents: number,
 *   isBelowCapital: boolean,
 *   warningMessage: string|null
 * }}
 */
export function validateReconcileTurbo({
  realBalanceCents = 0,
  capitalCents = 2_500_000,
}) {
  const safeReal = Math.max(0, Math.round(Number(realBalanceCents) || 0))
  const safeCapital = Math.max(0, Math.round(Number(capitalCents) || 2_500_000))

  const isBelowCapital = safeReal < safeCapital

  if (isBelowCapital) {
    return {
      effectiveCapitalCents: safeReal,
      accumulatedInterestCents: 0,
      isBelowCapital: true,
      warningMessage: 'El saldo es menor al capital configurado ($25,000.00). Te sugerimos revisar el capital depositado en la edición de la cuenta.',
    }
  }

  return {
    effectiveCapitalCents: safeCapital,
    accumulatedInterestCents: safeReal - safeCapital,
    isBelowCapital: false,
    warningMessage: null,
  }
}

/**
 * Calcula los días transcurridos desde el último cuadre y formatea el aviso.
 *
 * @param {string|null} lastReconciledDateStr - 'YYYY-MM-DD' o ISO
 * @param {Date|string} [referenceDate=new Date()]
 * @returns {{
 *   text: string,
 *   days: number|null,
 *   isWarning: boolean,
 *   hasReconciled: boolean
 * }}
 */
export function formatDaysSinceReconcile(lastReconciledDateStr, referenceDate = new Date()) {
  if (!lastReconciledDateStr) {
    return {
      text: 'Sin cuadrar aún',
      days: null,
      isWarning: false,
      hasReconciled: false,
    }
  }

  const dateOnly = lastReconciledDateStr.slice(0, 10)
  const [ry, rm, rd] = dateOnly.split('-').map(Number)
  const recDate = new Date(ry, rm - 1, rd, 12, 0, 0)

  let ref = referenceDate
  if (typeof referenceDate === 'string') {
    const [fy, fm, fd] = referenceDate.slice(0, 10).split('-').map(Number)
    ref = new Date(fy, fm - 1, fd, 12, 0, 0)
  } else {
    ref = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 12, 0, 0)
  }

  const diffMs = ref.getTime() - recDate.getTime()
  const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)))

  let text = ''
  if (days === 0) {
    text = 'Cuadrado hoy'
  } else if (days === 1) {
    text = 'Cuadrado ayer'
  } else {
    text = `Cuadrado hace ${days} días`
  }

  return {
    text,
    days,
    isWarning: days > 30,
    hasReconciled: true,
  }
}

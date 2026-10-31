/**
 * src/domain/detections.js
 *
 * Lógica pura para la pantalla "Por confirmar":
 *   - applyDetection: genera el borrador de movimiento a partir de una detección.
 *   - detectDuplicatesAgainstMovements: alerta si ya existe un movimiento idéntico (misma cuenta, monto y ±1 día).
 *   - matchFixedExpense: empareja con un gasto fijo pendiente (mismo monto ±1% y ±3 días).
 *   - matchRecurringIncome: empareja con un ingreso recurrente pendiente (mismo monto ±1% y ±3 días).
 *   - detectTransferPairs: detecta transferencias propias (misma cantidad, cuentas distintas, ventana 10 min).
 *   - isDetectionOlderThanDays / countDetectionsOlderThanDays: identificador de avisos rezagados (>2 días).
 *
 * REGLAS ESTRICTAS:
 *   - Funciones puras sin React, sin Dexie, sin efectos secundarios.
 *   - Montos en CENTAVOS ENTEROS.
 *   - Fechas en formato local YYYY-MM-DD.
 */

import { toISODate } from './periods.js'

/**
 * Palabras clave comunes para sugerir categorías a partir del comercio o nota.
 */
const CATEGORY_KEYWORDS = {
  comida: ['restaurante', 'starbucks', 'mcdonalds', 'uber eats', 'rappi', 'didi food', 'oxxo', 'seven', '7-eleven', 'walmart', 'soriana', 'chedraui', 'costco', 'super', 'taquer', 'cafe', 'cafeteria', 'pizza', 'burger'],
  transporte: ['uber', 'didi', 'cabify', 'gasolinera', 'pemex', 'shell', 'bp', 'mobil', 'estacionamiento', 'peaje', 'tag', 'metro', 'autobus', 'vuelo', 'aeromexico', 'volaris', 'vivaaerobus'],
  ocio: ['netflix', 'spotify', 'cinepolis', 'cinemex', 'hbo', 'disney', 'prime video', 'youtube', 'apple music', 'steam', 'playstation', 'nintendo', 'xbox', 'concierto', 'teatro'],
  casa: ['cfe', 'luz', 'agua', 'renta', 'muebles', 'ikea', 'home depot', 'sodimac', 'liverpool', 'palacio de hierro', 'amazon'],
  servicios: ['telmex', 'totalplay', 'izzy', 'at&t', 'telcel', 'movistar', 'internet', 'gas'],
  salud: ['farmacia', 'san pablo', 'benavides', 'del ahorro', 'guadalajara', 'hospital', 'medico', 'laboratorio', 'chopo', 'dentista', 'optica'],
  educacion: ['colegio', 'universidad', 'escuela', 'udemy', 'coursera', 'platzi', 'libro', 'libreria', 'gandhi'],
}

/**
 * Extrae la fecha ISO local (YYYY-MM-DD) desde un timestamp o fecha ISO.
 * @param {number|string|Date} dateVal
 * @returns {string}
 */
export function extractIsoDate(dateVal) {
  if (!dateVal) return toISODate(new Date())
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
    return dateVal
  }
  const dateObj = typeof dateVal === 'number'
    ? new Date(dateVal)
    : new Date(dateVal)

  if (isNaN(dateObj.getTime())) {
    return toISODate(new Date())
  }
  return toISODate(dateObj)
}

/**
 * Sugiere una categoría apropiada evaluando el texto del comercio o nota.
 * @param {string} text
 * @param {Array<Object>} categories
 * @param {'expense'|'income'|'transfer'} [kind='expense']
 * @returns {Object|null} Categoría sugerida o null
 */
export function suggestCategoryForDetection(text = '', categories = [], kind = 'expense') {
  if (!Array.isArray(categories) || categories.length === 0) return null
  const clean = (text || '').toLowerCase().trim()

  if (kind === 'income') {
    const incomeCat = categories.find(c =>
      c.type === 'income' &&
      /(sueldo|n[oó]mina|ingreso|honorarios|dep[oó]sito|transferencia)/i.test(c.name)
    )
    if (incomeCat) return incomeCat
    return categories.find(c => c.type === 'income') || null
  }

  const expenseCategories = categories.filter(c => c.type === 'expense' || !c.type)
  if (!clean) return expenseCategories[0] || null

  // 1. Coincidencia directa con nombre de categoría
  const directMatch = expenseCategories.find(c =>
    clean.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(clean)
  )
  if (directMatch) return directMatch

  // 2. Coincidencia por palabras clave
  for (const [keyCategory, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => clean.includes(kw))) {
      const match = expenseCategories.find(c => c.name.toLowerCase().includes(keyCategory))
      if (match) return match
    }
  }

  return expenseCategories[0] || null
}

/**
 * Convierte una detección en un borrador de movimiento listo para registrar.
 *
 * @param {Object} detection - Objeto de tabla pendingDetections
 * @param {Array<Object>} [accounts=[]]
 * @param {Array<Object>} [categories=[]]
 * @returns {Object} Borrador de movimiento
 */
export function applyDetection(detection, accounts = [], categories = []) {
  if (!detection) return null

  const kind = detection.kind === 'income' ? 'income' : detection.kind === 'transfer' ? 'transfer' : 'expense'
  const suggestedCategory = kind === 'transfer' ? null : suggestCategoryForDetection(detection.merchant, categories, kind)

  const date = extractIsoDate(detection.postedAt || detection.detectedAt)

  // Determinar cuenta por defecto si no viene fijada en la detección
  let accountId = detection.accountId || null
  if (!accountId && accounts.length > 0) {
    if (detection.last4) {
      const byLast4 = accounts.find(a => String(a.last4 || '').slice(-4) === String(detection.last4).slice(-4))
      if (byLast4) accountId = byLast4.id
    }
    if (!accountId) {
      accountId = accounts[0].id
    }
  }

  return {
    type: kind,
    amount: detection.amountCents ?? 0,
    currency: detection.currency || 'MXN',
    accountId,
    toAccountId: kind === 'transfer' ? (detection.toAccountId || null) : null,
    categoryId: suggestedCategory ? suggestedCategory.id : null,
    date,
    note: (detection.merchant || '').trim(),
    fixedId: detection.matchedFixedId || null,
    detectionId: detection.id || null,
  }
}

/**
 * Calcula la diferencia en días entre dos fechas 'YYYY-MM-DD'.
 * @param {string} dateStr1
 * @param {string} dateStr2
 * @returns {number}
 */
export function diffDays(dateStr1, dateStr2) {
  const [y1, m1, d1] = dateStr1.split('-').map(Number)
  const [y2, m2, d2] = dateStr2.split('-').map(Number)
  const dt1 = Date.UTC(y1, m1 - 1, d1)
  const dt2 = Date.UTC(y2, m2 - 1, d2)
  return Math.round(Math.abs(dt1 - dt2) / (1000 * 60 * 60 * 24))
}

/**
 * Detecta duplicados contra movimientos existentes (misma cuenta, monto y ±1 día).
 *
 * @param {Object} detection - Detección pendiente
 * @param {Array<Object>} [movements=[]] - Movimientos registrados en la app
 * @returns {{ isDuplicate: boolean, duplicateMovement: Object|null, reason: string|null }}
 */
export function detectDuplicatesAgainstMovements(detection, movements = []) {
  if (!detection || !detection.amountCents || !Array.isArray(movements)) {
    return { isDuplicate: false, duplicateMovement: null, reason: null }
  }

  const detectionDate = extractIsoDate(detection.postedAt || detection.detectedAt)
  const detectionAmount = Math.abs(detection.amountCents)
  const targetAccountId = detection.accountId

  for (const mov of movements) {
    // Si la detección tiene cuenta definida, debe coincidir origen o destino
    if (targetAccountId && mov.accountId !== targetAccountId && mov.toAccountId !== targetAccountId) {
      continue
    }

    const movAmount = Math.abs(mov.amount)
    if (movAmount !== detectionAmount) {
      continue
    }

    // Verificar ventana de ±1 día
    const movDate = mov.date || extractIsoDate(mov.createdAt)
    if (movDate && diffDays(movDate, detectionDate) <= 1) {
      return {
        isDuplicate: true,
        duplicateMovement: mov,
        reason: `Ya existe un movimiento de $${(movAmount / 100).toFixed(2)} registrado el ${movDate}`,
      }
    }
  }

  return { isDuplicate: false, duplicateMovement: null, reason: null }
}

/**
 * Empareja una detección de gasto con un gasto fijo pendiente (mismo monto ±1% y ±3 días).
 *
 * @param {Object} detection
 * @param {Array<Object>} [fixedExpenses=[]]
 * @param {Array<string>} [paidFixedExpenseIds=[]]
 * @param {string|Date} [refDate=null]
 * @returns {{ isMatch: boolean, fixedExpense: Object|null, diffPercent: number|null }}
 */
export function matchFixedExpense(detection, fixedExpenses = [], paidFixedExpenseIds = [], refDate = null) {
  if (!detection || detection.kind === 'income' || !detection.amountCents) {
    return { isMatch: false, fixedExpense: null, diffPercent: null }
  }

  const paidSet = new Set(paidFixedExpenseIds || [])
  const detectionDate = extractIsoDate(detection.postedAt || detection.detectedAt || refDate)
  const [detYear, detMonth] = detectionDate.split('-').map(Number)
  const detAmount = Math.abs(detection.amountCents)

  let bestMatch = null
  let minAmountDiff = Infinity

  for (const fe of fixedExpenses) {
    if (paidSet.has(fe.id)) continue

    const feAmount = Math.abs(fe.amount || 0)
    if (feAmount <= 0) continue

    // Tolerancia de monto: ±1%
    const maxDelta = Math.max(1, Math.round(feAmount * 0.01))
    const amountDiff = Math.abs(feAmount - detAmount)
    if (amountDiff > maxDelta) continue

    // Tolerancia de fecha: ±3 días respecto al dueDay del mes
    const dueDay = fe.dueDay || 1
    // Construir la fecha teórica del gasto fijo para el mes de la detección
    const daysInMonth = new Date(detYear, detMonth, 0).getDate()
    const targetDay = Math.min(dueDay, daysInMonth)
    const feTargetDate = `${detYear}-${String(detMonth).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`

    const daysApart = diffDays(feTargetDate, detectionDate)
    if (daysApart <= 3) {
      if (amountDiff < minAmountDiff) {
        minAmountDiff = amountDiff
        bestMatch = fe
      }
    }
  }

  if (bestMatch) {
    const diffPercent = Math.round((Math.abs(bestMatch.amount - detAmount) / bestMatch.amount) * 10000) / 100
    return { isMatch: true, fixedExpense: bestMatch, diffPercent }
  }

  return { isMatch: false, fixedExpense: null, diffPercent: null }
}

/**
 * Empareja una detección de ingreso con un ingreso recurrente pendiente (mismo monto ±1% y ±3 días).
 *
 * @param {Object} detection
 * @param {Array<Object>} [recurringIncomes=[]]
 * @param {Array<Object>} [occurrences=[]]
 * @param {string|Date} [refDate=null]
 * @returns {{ isMatch: boolean, recurringIncome: Object|null, candidateDate: string|null }}
 */
export function matchRecurringIncome(detection, recurringIncomes = [], occurrences = [], refDate = null) {
  if (!detection || detection.kind === 'expense' || !detection.amountCents) {
    return { isMatch: false, recurringIncome: null, candidateDate: null }
  }

  const detectionDate = extractIsoDate(detection.postedAt || detection.detectedAt || refDate)
  const detAmount = Math.abs(detection.amountCents)

  for (const ri of recurringIncomes) {
    if (ri.active === false) continue

    const riAmount = Math.abs(ri.amountCents || 0)
    if (riAmount > 0) {
      const maxDelta = Math.max(1, Math.round(riAmount * 0.01))
      if (Math.abs(riAmount - detAmount) > maxDelta) continue
    }

    // Si tiene ocurrencias registradas, buscar una pendiente en ventana ±3 días
    const pendingOccs = (occurrences || []).filter(o => o.recurringId === ri.id && o.status !== 'confirmed')
    for (const occ of pendingOccs) {
      if (occ.dueDate && diffDays(occ.dueDate, detectionDate) <= 3) {
        return { isMatch: true, recurringIncome: ri, candidateDate: occ.dueDate }
      }
    }

    // Si no hay ocurrencias explícitas pero coincide con su día estimado
    const dayOfMonth = ri.dayOfMonth || 1
    const [y, m] = detectionDate.split('-').map(Number)
    const targetDate = `${y}-${String(m).padStart(2, '0')}-${String(Math.min(dayOfMonth, 28)).padStart(2, '0')}`
    if (diffDays(targetDate, detectionDate) <= 3) {
      return { isMatch: true, recurringIncome: ri, candidateDate: targetDate }
    }
  }

  return { isMatch: false, recurringIncome: null, candidateDate: null }
}

/**
 * Detecta pares de transferencias propias entre cuentas en una ventana de 10 minutos.
 * Caso típico: aviso de débito/retiro de Banco A y aviso de depósito en Banco B por la misma cifra.
 *
 * @param {Array<Object>} detections - Lista de detecciones pendientes
 * @returns {Array<Object>} Lista de pares de transferencia propuestos
 */
export function detectTransferPairs(detections = []) {
  if (!Array.isArray(detections) || detections.length < 2) return []

  const pending = detections.filter(d => (d.status === 'pending' || !d.status) && d.amountCents > 0)
  const pairs = []
  const pairedIds = new Set()

  const TEN_MINUTES_MS = 10 * 60 * 1000

  for (let i = 0; i < pending.length; i++) {
    const d1 = pending[i]
    if (pairedIds.has(d1.id)) continue

    const time1 = typeof d1.postedAt === 'number'
      ? d1.postedAt
      : new Date(d1.detectedAt || d1.postedAt || 0).getTime()

    for (let j = i + 1; j < pending.length; j++) {
      const d2 = pending[j]
      if (pairedIds.has(d2.id)) continue

      // Mismo monto exacto
      if (d1.amountCents !== d2.amountCents) continue

      // Cuentas o apps distintas
      const sameAccount = d1.accountId && d2.accountId && d1.accountId === d2.accountId
      const samePkg = d1.packageName && d2.packageName && d1.packageName === d2.packageName
      if (sameAccount && samePkg) continue

      // Ventana de tiempo <= 10 minutos
      const time2 = typeof d2.postedAt === 'number'
        ? d2.postedAt
        : new Date(d2.detectedAt || d2.postedAt || 0).getTime()

      if (Math.abs(time1 - time2) <= TEN_MINUTES_MS) {
        // Identificar origen (gasto/salida) y destino (ingreso/entrada)
        let fromDetection = d1
        let toDetection = d2

        if (d1.kind === 'income' || d2.kind === 'expense') {
          fromDetection = d2
          toDetection = d1
        }

        pairedIds.add(d1.id)
        pairedIds.add(d2.id)

        pairs.push({
          fromDetection,
          toDetection,
          amountCents: d1.amountCents,
          fromAccountId: fromDetection.accountId,
          toAccountId: toDetection.accountId,
          timeDiffMs: Math.abs(time1 - time2),
          date: extractIsoDate(fromDetection.postedAt || fromDetection.detectedAt),
        })
        break
      }
    }
  }

  return pairs
}

/**
 * Determina si una detección tiene más de N días sin confirmar.
 * @param {Object} detection
 * @param {number} [days=2]
 * @param {Date|number|string} [refDate=new Date()]
 * @returns {boolean}
 */
export function isDetectionOlderThanDays(detection, days = 2, refDate = new Date()) {
  if (!detection) return false
  const nowMs = typeof refDate === 'number' ? refDate : new Date(refDate).getTime()
  const detMs = typeof detection.postedAt === 'number'
    ? detection.postedAt
    : new Date(detection.detectedAt || detection.postedAt || 0).getTime()

  if (isNaN(detMs) || detMs === 0) return false
  const msThreshold = days * 24 * 60 * 60 * 1000
  return (nowMs - detMs) > msThreshold
}

/**
 * Cuenta cuántas detecciones pendientes tienen más de N días.
 * @param {Array<Object>} detections
 * @param {number} [days=2]
 * @param {Date|number|string} [refDate=new Date()]
 * @returns {number}
 */
export function countDetectionsOlderThanDays(detections = [], days = 2, refDate = new Date()) {
  if (!Array.isArray(detections)) return 0
  return detections.filter(d => (d.status === 'pending' || !d.status) && isDetectionOlderThanDays(d, days, refDate)).length
}

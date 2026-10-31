/**
 * src/domain/detectionParser.js
 *
 * Motor de parseo e interpretación de notificaciones bancarias:
 *   1. Reglas como DATOS (tabla detectionRules y JSON): regex comunes a JS y java.util.regex.
 *   2. Modo genérico de extracción para apps permitidas sin regla específica.
 *   3. Resolución de cuenta (1º últimos 4 dígitos, 2º cuenta por defecto, 3º null si ambigüedad).
 *   4. Deduplicación inteligente por cuenta/last4 + monto en ventana de tiempo (5 min).
 *   5. Formateo exacto del texto para la notificación nativa propia.
 *
 * REGLAS DE AGENTS.md:
 *   - Lógica pura sin React ni base de datos.
 *   - Montos en centavos enteros.
 *   - Totalmente testeado en tests/detectionParser.test.js.
 */

export const DEFAULT_IGNORE_PATTERNS = [
  'promoci[oó]n',
  'descuento',
  'oferta',
  'cr[eé]dito preaprobado',
  'pr[eé]stamo disponible',
  'invita a tus amigos',
  'invitaci[oó]n',
  'gana dinero',
  'cashback especial',
  'actualiza tus datos',
  'nueva funci[oó]n',
  'seguridad',
  'c[oó]digo de seguridad',
  'token',
  'nip',
]

export const DEFAULT_EXPENSE_PATTERN =
  'compra|cargo|pago|pagaste|retiro|enviaste|salida|disposici[oó]n|spent|payment'
export const DEFAULT_INCOME_PATTERN =
  'dep[oó]sito|abono|recibiste|n[oó]mina|sueldo|reembolso|devoluci[oó]n|received'

/**
 * Convierte un texto con monto (ej: "$1,250.50", "45.00") en centavos enteros (125050).
 *
 * @param {string} rawAmount
 * @returns {number|null} Monto en centavos enteros o null si es inválido.
 */
export function parseAmountToCents(rawAmount) {
  if (!rawAmount || typeof rawAmount !== 'string') return null

  // Limpiar caracteres de moneda y espacios
  let cleaned = rawAmount.replace(/[^0-9.,]/g, '').trim()
  if (!cleaned) return null

  // Normalizar separador de miles y decimales
  // Si contiene coma y punto (ej. 1,250.50), eliminar la coma
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/,/g, '')
  } else if (cleaned.includes(',')) {
    // Si contiene solo coma y tiene 2 dígitos al final (ej. 125,50), es decimal europeo
    if (/,\d{2}$/.test(cleaned)) {
      cleaned = cleaned.replace(',', '.')
    } else {
      // De lo contrario es separador de miles (ej. 1,000)
      cleaned = cleaned.replace(/,/g, '')
    }
  }

  const num = parseFloat(cleaned)
  if (isNaN(num)) return null

  return Math.round(num * 100)
}

/**
 * Comprueba si un texto coincide con cualquiera de los patrones regex dados.
 *
 * @param {string} text
 * @param {string[]} patterns
 * @returns {boolean}
 */
export function matchesAnyPattern(text, patterns = []) {
  if (!text || !Array.isArray(patterns)) return false
  for (const pat of patterns) {
    if (!pat) continue
    try {
      const reg = new RegExp(pat, 'i')
      if (reg.test(text)) return true
    } catch {
      // Ignorar regex inválidas
    }
  }
  return false
}

/**
 * Extrae el valor de un grupo usando una expresión regular compatible con JS y Java.
 *
 * @param {string} text
 * @param {string} regexStr
 * @param {number} [groupIndex=1]
 * @returns {string|null}
 */
export function extractRegexGroup(text, regexStr, groupIndex = 1) {
  if (!text || !regexStr) return null
  try {
    const reg = new RegExp(regexStr, 'i')
    const match = reg.exec(text)
    if (match && match[groupIndex] !== undefined) {
      return match[groupIndex].trim()
    }
  } catch {
    // Regex no válida
  }
  return null
}

/**
 * Parsea una notificación usando las reglas definidas o el modo genérico.
 *
 * @param {Object} notif
 * @param {string} notif.packageName
 * @param {string} [notif.title]
 * @param {string} [notif.text]
 * @param {string} [notif.bigText]
 * @param {number|string} [notif.postTime]
 * @param {Array<Object>} [rules=[]] - Reglas por app registradas en detectionRules
 * @param {Object} [genericOptions={}] - Opciones de modo genérico
 * @returns {{
 *   ignored: boolean,
 *   amountCents: number|null,
 *   currency: string,
 *   kind: 'expense'|'income'|null,
 *   merchant: string|null,
 *   last4: string|null,
 *   parseConfidence: 'high'|'medium'|'low',
 *   matchedRuleId: string|null,
 *   hasAmount: boolean
 * }}
 */
export function parseNotification(notif, rules = [], genericOptions = {}) {
  if (!notif) {
    return {
      ignored: true,
      amountCents: null,
      currency: 'MXN',
      kind: null,
      merchant: null,
      last4: null,
      parseConfidence: 'low',
      matchedRuleId: null,
      hasAmount: false,
    }
  }

  const title = (notif.title || '').trim()
  const bodyText = (notif.text || '').trim()
  const bigText = (notif.bigText || '').trim()
  const fullText = `${title} ${bodyText} ${bigText}`.trim()

  // 1. Verificar patrones ignorados (promociones, publicidad, créditos preaprobados)
  const customIgnore = Array.isArray(genericOptions.ignorePatterns)
    ? genericOptions.ignorePatterns
    : []
  const allIgnorePatterns = [...DEFAULT_IGNORE_PATTERNS, ...customIgnore]

  if (matchesAnyPattern(fullText, allIgnorePatterns)) {
    return {
      ignored: true,
      amountCents: null,
      currency: 'MXN',
      kind: null,
      merchant: null,
      last4: null,
      parseConfidence: 'low',
      matchedRuleId: null,
      hasAmount: false,
    }
  }

  // 2. Buscar regla específica para el paquete
  const pkg = (notif.packageName || '').toLowerCase()
  const matchingRules = (rules || [])
    .filter((r) => r.enabled !== false && (r.packageName || '').toLowerCase() === pkg)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0))

  for (const rule of matchingRules) {
    // Si la regla tiene patrón de coincidencia general
    if (rule.matchPattern) {
      try {
        const reg = new RegExp(rule.matchPattern, 'i')
        if (!reg.test(fullText)) continue
      } catch {
        continue
      }
    }

    // Ignorar si coincide con los ignorePatterns específicos de la regla
    if (Array.isArray(rule.ignorePatterns) && matchesAnyPattern(fullText, rule.ignorePatterns)) {
      return {
        ignored: true,
        amountCents: null,
        currency: 'MXN',
        kind: null,
        merchant: null,
        last4: null,
        parseConfidence: 'low',
        matchedRuleId: rule.id || null,
        hasAmount: false,
      }
    }

    // Extraer monto
    let amountCents = null
    if (rule.amountRegex) {
      const raw = extractRegexGroup(fullText, rule.amountRegex, rule.amountGroup || 1)
      if (raw) amountCents = parseAmountToCents(raw)
    }

    // Extraer moneda
    let currency = rule.defaultCurrency || 'MXN'
    if (rule.currencyRegex) {
      const c = extractRegexGroup(fullText, rule.currencyRegex, rule.currencyGroup || 1)
      if (c) currency = c.toUpperCase()
    }

    // Extraer tipo (gasto o ingreso)
    let kind = null
    if (Array.isArray(rule.kindRules)) {
      for (const kr of rule.kindRules) {
        if (kr.pattern && new RegExp(kr.pattern, 'i').test(fullText)) {
          kind = kr.kind === 'income' ? 'income' : 'expense'
          break
        }
      }
    }

    // Extraer comercio
    let merchant = null
    if (rule.merchantRegex) {
      merchant = extractRegexGroup(fullText, rule.merchantRegex, rule.merchantGroup || 1)
    }

    // Extraer últimos 4 dígitos
    let last4 = null
    if (rule.last4Regex) {
      last4 = extractRegexGroup(fullText, rule.last4Regex, rule.last4Group || 1)
    }

    return {
      ignored: false,
      amountCents,
      currency,
      kind: kind || (amountCents !== null ? 'expense' : null),
      merchant,
      last4,
      parseConfidence: amountCents !== null && kind ? 'high' : 'medium',
      matchedRuleId: rule.id || null,
      hasAmount: amountCents !== null,
    }
  }

  // 3. MODO GENÉRICO (apps permitidas sin regla específica)
  return parseGenericNotification(fullText, genericOptions)
}

/**
 * Modo genérico para interpretar cualquier app bancaria sin regla previa.
 *
 * @param {string} fullText
 * @param {Object} [options={}]
 * @returns {Object}
 */
export function parseGenericNotification(fullText, options = {}) {
  // 3.1 Extraer monto por patrones de moneda comunes
  const amountPatterns = [
    // Símbolo de divisa antes: $125.50, USD 45.00, MXN 500
    /(?:[-+]?\s*(?:\$|USD|MXN|EUR|€)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?))/i,
    // Símbolo de divisa después: 1,250.00 MXN, 500 pesos
    /([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(?:MXN|USD|EUR|pesos)\b/i,
    // Monto decimal estándar con comas de miles: 1,250.00
    /\b([0-9]{1,3}(?:,[0-9]{3})+\.[0-9]{2})\b/,
  ]

  let amountCents = null
  for (const pat of amountPatterns) {
    const match = pat.exec(fullText)
    if (match && match[1]) {
      amountCents = parseAmountToCents(match[1])
      if (amountCents !== null) break
    }
  }

  // 3.2 Extraer divisa
  let currency = 'MXN'
  if (/\b(USD|d[oó]lar(?:es)?)\b/i.test(fullText)) {
    currency = 'USD'
  } else if (/\b(EUR|euro(?:s)?)\b/i.test(fullText)) {
    currency = 'EUR'
  }

  // 3.3 Deducir tipo (gasto o ingreso) por palabras clave en español
  const expenseWords = options.expensePattern || DEFAULT_EXPENSE_PATTERN
  const incomeWords = options.incomePattern || DEFAULT_INCOME_PATTERN

  let kind = null
  if (new RegExp(incomeWords, 'i').test(fullText)) {
    kind = 'income'
  } else if (new RegExp(expenseWords, 'i').test(fullText)) {
    kind = 'expense'
  } else if (amountCents !== null) {
    // Si hay un monto detectado pero no palabras explícitas, asumir gasto
    kind = 'expense'
  }

  // 3.4 Extraer comercio / destinatario / remitente (solo si hay monto detectado)
  let merchant = null
  if (amountCents !== null) {
    const merchantMatch = /(?:\ben\b|\bpara\b|\ba favor de\b|\bat\b|\bde\b|\bdesde\b|\ba\b)\s+([A-Za-z0-9áéíóúÁÉÍÓÚñÑ\s.*-]{2,30}?)(?:\s+v[ií]a|\s+a\s+tu|\s+con|\s+por|\s+el|\.|\$|$)/i.exec(
      fullText
    )
    if (merchantMatch && merchantMatch[1]) {
      const cleanMerchant = merchantMatch[1].trim()
      // Evitar capturar palabras como "tu tarjeta", "depósito", etc.
      if (
        !/^(tu|su|un|una|la|el)\s+(tarjeta|cuenta)$/i.test(cleanMerchant) &&
        !/^(dep[oó]sito|transferencia|pago|compra|spei)$/i.test(cleanMerchant)
      ) {
        merchant = cleanMerchant
      }
    }
  }

  // 3.5 Extraer últimos 4 dígitos
  let last4 = null
  const last4Match = /(?:tarjeta|cuenta|terminaci[oó]n|terminada en|termina en|\*{1,8})\s*([0-9]{4})\b/i.exec(
    fullText
  )
  if (last4Match && last4Match[1]) {
    last4 = last4Match[1]
  }

  const hasAmount = amountCents !== null
  const parseConfidence = hasAmount && kind ? 'medium' : 'low'

  return {
    ignored: false,
    amountCents,
    currency,
    kind,
    merchant,
    last4,
    parseConfidence,
    matchedRuleId: null,
    hasAmount,
  }
}

/**
 * Resuelve la cuenta a asociar a una detección:
 *   1. Primero por los últimos 4 dígitos coincidentes.
 *   2. Si no, por la cuenta por defecto de la app.
 *   3. Si hay ambigüedad (ej. varias cuentas de la app sin coincidencia last4), queda null.
 *
 * @param {Object} detection - Objeto con { packageName, last4 }
 * @param {Array<Object>} accounts - Cuentas disponibles
 * @param {Object} bankAccountMappings - Mapeo { [packageName]: string[] }
 * @returns {string|null} ID de la cuenta resuelta o null
 */
export function resolveAccountForDetection(detection, accounts = [], bankAccountMappings = {}) {
  if (!detection) return null

  const { packageName, last4 } = detection

  // 1. Buscar coincidencia por últimos 4 dígitos
  if (last4) {
    const matchingAccounts = accounts.filter((acc) => {
      // Coincidencia con nombre (ej. "Nu *1234")
      if (acc.name && acc.name.includes(last4)) return true
      // Coincidencia con credit.last4
      if (acc.credit && String(acc.credit.last4) === String(last4)) return true
      // Coincidencia directa con last4
      if (acc.last4 && String(acc.last4) === String(last4)) return true
      return false
    })

    if (matchingAccounts.length === 1) {
      return matchingAccounts[0].id
    }
  }

  // 2. Si no hay coincidencia por dígitos, revisar cuentas asignadas al paquete
  if (packageName && bankAccountMappings[packageName]) {
    const mappedIds = Array.isArray(bankAccountMappings[packageName])
      ? bankAccountMappings[packageName]
      : [bankAccountMappings[packageName]]

    // Si tiene exactamente una cuenta asignada, usarla por defecto
    if (mappedIds.length === 1) {
      return mappedIds[0]
    }

    // Si tiene más de una cuenta asignada (ej. Débito y Crédito Nu), es ambiguo -> null
    if (mappedIds.length > 1) {
      return null
    }
  }

  return null
}

/**
 * Deduplica detecciones pendientes: misma cuenta o mismos últimos 4 dígitos, mismo monto
 * y ventana de 5 minutos = una sola detección fusionando las fuentes.
 *
 * @param {Array<Object>} existingDetections
 * @param {Object} incomingDetection
 * @param {number} [windowMs=300000] - 5 minutos
 * @returns {{ isDuplicate: boolean, mergedDetection: Object|null }}
 */
export function deduplicatePendingDetection(
  existingDetections = [],
  incomingDetection,
  windowMs = 300000
) {
  if (!incomingDetection || incomingDetection.amountCents == null) {
    return { isDuplicate: false, mergedDetection: null }
  }

  const incomingTime = incomingDetection.postedAt
    ? new Date(incomingDetection.postedAt).getTime()
    : Date.now()

  for (const existing of existingDetections) {
    if (!existing || existing.status === 'dismissed' || existing.amountCents == null) {
      continue
    }

    // Verificar mismo monto y moneda
    if (
      existing.amountCents === incomingDetection.amountCents &&
      existing.currency === incomingDetection.currency
    ) {
      const existingTime = existing.postedAt
        ? new Date(existing.postedAt).getTime()
        : new Date(existing.detectedAt).getTime()
      const diffMs = Math.abs(incomingTime - existingTime)

      if (diffMs <= windowMs) {
        // Misma cuenta o mismos últimos 4 dígitos
        const sameAccount =
          incomingDetection.accountId &&
          existing.accountId &&
          incomingDetection.accountId === existing.accountId
        const sameLast4 =
          incomingDetection.last4 &&
          existing.last4 &&
          incomingDetection.last4 === existing.last4

        if (sameAccount || sameLast4) {
          // Fusionar fuentes
          const newSources = [...(existing.sources || [])]
          if (Array.isArray(incomingDetection.sources)) {
            newSources.push(...incomingDetection.sources)
          } else {
            newSources.push({
              packageName: incomingDetection.packageName,
              postedAt: incomingDetection.postedAt,
            })
          }

          const merged = {
            ...existing,
            merchant: existing.merchant || incomingDetection.merchant,
            accountId: existing.accountId || incomingDetection.accountId,
            sources: newSources,
          }

          return { isDuplicate: true, mergedDetection: merged }
        }
      }
    }
  }

  return { isDuplicate: false, mergedDetection: null }
}

/**
 * Formatea el texto EXACTO para la notificación nativa propia.
 *
 * Variantes:
 *   - Con monto y cuenta: "MOVIMIENTO DETECTADO POR $250.00 DE LA CUENTA NU"
 *   - Sin monto:          "MOVIMIENTO DETECTADO EN LA CUENTA NU"
 *   - Sin cuenta:         "MOVIMIENTO DETECTADO POR $250.00"
 *   - Sin monto ni cuenta: "MOVIMIENTO DETECTADO"
 *
 * @param {Object} params
 * @param {number|null} params.amountCents
 * @param {string} [params.currency='MXN']
 * @param {string|null} params.bankName
 * @param {boolean} [params.showAmount=true]
 * @returns {string} Texto en mayúsculas exactas requeridas
 */
export function formatNotificationDisplayText({
  amountCents,
  currency = 'MXN',
  bankName = null,
  showAmount = true,
}) {
  const normBank = bankName ? bankName.trim().toUpperCase() : null
  const hasAmount = amountCents != null && showAmount !== false

  let formattedAmount = null
  if (hasAmount) {
    const pesos = (amountCents / 100).toFixed(2)
    formattedAmount = currency === 'USD' ? `USD $${pesos}` : `$${pesos}`
  }

  if (formattedAmount && normBank) {
    return `MOVIMIENTO DETECTADO POR ${formattedAmount} DE LA CUENTA ${normBank}`
  }

  if (normBank && !formattedAmount) {
    return `MOVIMIENTO DETECTADO EN LA CUENTA ${normBank}`
  }

  if (formattedAmount && !normBank) {
    return `MOVIMIENTO DETECTADO POR ${formattedAmount}`
  }

  return 'MOVIMIENTO DETECTADO'
}

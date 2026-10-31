/**
 * src/domain/notificationDetection.js
 *
 * Lógica pura de detección de notificaciones bancarias:
 *   1. Deduplicación por identificador estable y ventana de tiempo.
 *   2. Filtrado por lista de aplicaciones permitidas (allowlist).
 *   3. Enmascaramiento de datos personales y sensibles (tarjetas, folios, referencias, CLABEs),
 *      preservando intactos los montos de dinero.
 *   4. Expiración y purga de muestras de más de 7 días.
 *   5. Mapeo de apps bancarias a cuentas del usuario.
 *
 * REGLAS DE AGENTS.md:
 *   - Lógica pura sin React ni acceso a base de datos.
 *   - Probada con vitest en tests/.
 */

/**
 * Genera un identificador determinista y estable para una notificación.
 *
 * @param {Object} notif
 * @param {string} notif.packageName
 * @param {string} [notif.title]
 * @param {string} [notif.text]
 * @param {string} [notif.bigText]
 * @param {string|number} [notif.id]
 * @returns {string}
 */
export function generateStableNotificationId({ packageName, title = '', text = '', bigText = '', id = '' }) {
  const normPkg = (packageName || '').trim().toLowerCase()
  const normTitle = (title || '').trim()
  const normText = (text || '').trim()
  const normBig = (bigText || '').trim()

  const contentSignature = `${normTitle}|${normText}|${normBig}`
  let hash = 0
  for (let i = 0; i < contentSignature.length; i++) {
    hash = ((hash << 5) - hash + contentSignature.charCodeAt(i)) | 0
  }

  const baseId = id ? `${id}#` : ''
  return `${normPkg}#${baseId}${Math.abs(hash)}`
}

/**
 * Comprueba si una notificación es un duplicado de otra previamente procesada.
 *
 * Una notificación se considera duplicada si:
 *   1. Tiene el mismo identificador exacto.
 *   2. O tiene el mismo paquete y el mismo contenido (título + texto) dentro de una
 *      ventana de tiempo configurable (por defecto 5 minutos).
 *
 * @param {Array<Object>} existingList - Lista de notificaciones recientes.
 * @param {Object} incoming - Notificación entrante.
 * @param {number} [windowMs=300000] - Ventana de duplicación en milisegundos (5 min).
 * @returns {boolean}
 */
export function isDuplicateNotification(existingList = [], incoming, windowMs = 300000) {
  if (!incoming || !Array.isArray(existingList)) return false

  const incomingId = incoming.id || generateStableNotificationId(incoming)
  const incomingTime = Number(incoming.postTime) || Date.now()
  const incomingTitle = (incoming.title || '').trim()
  const incomingText = (incoming.text || '').trim()
  const incomingPkg = (incoming.packageName || '').trim().toLowerCase()

  for (const existing of existingList) {
    if (!existing) continue

    // Mismo ID directo
    if (existing.id && existing.id === incomingId) {
      return true
    }

    // Mismo contenido en ventana de tiempo
    const existingPkg = (existing.packageName || '').trim().toLowerCase()
    if (existingPkg === incomingPkg) {
      const existingTime = Number(existing.postTime) || (existing.createdAt ? new Date(existing.createdAt).getTime() : 0)
      const diffMs = Math.abs(incomingTime - existingTime)

      if (diffMs <= windowMs) {
        const existingTitle = (existing.title || '').trim()
        const existingText = (existing.text || '').trim()
        if (existingTitle === incomingTitle && existingText === incomingText && (incomingTitle || incomingText)) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Filtra una lista de notificaciones para incluir únicamente las de paquetes permitidos.
 *
 * @param {Array<Object>} notifications
 * @param {Array<string>|Set<string>} allowlist
 * @returns {Array<Object>}
 */
export function filterAllowedNotifications(notifications = [], allowlist = []) {
  if (!Array.isArray(notifications)) return []
  const allowSet = allowlist instanceof Set ? allowlist : new Set((allowlist || []).map(p => (p || '').trim().toLowerCase()))

  return notifications.filter(n => {
    if (!n || !n.packageName) return false
    return allowSet.has(n.packageName.trim().toLowerCase())
  })
}

/**
 * Enmascara números sensibles de 4 o más dígitos (números de tarjeta, cuentas, folios,
 * códigos de autorización, referencias o teléfonos), preservando íntegros los montos
 * de dinero ($1,234.50, $4500, 1500.00 MXN, etc.).
 *
 * @param {string} text
 * @returns {string} Texto con números sensibles enmascarados como "••••".
 */
export function maskSensitiveData(text) {
  if (!text || typeof text !== 'string') return ''

  // 1. Detectar y proteger montos monetarios conocidos:
  // Patrones:
  // - Símbolo de moneda seguido de número: $1,250.00, $15000, USD 400.00, MXN 500
  // - Número con decimales seguido de moneda o palabra: 1,250.50 MXN, 5000 pesos, 350.00 MXN
  // - Frases de monto: "por $1,200", "monto de $500", "retiro por 4,500.00"
  const amountPlaceholders = []
  let placeholderIndex = 0

  // Regex para capturar montos con símbolo de moneda o código de divisa
  // Ejemplos: $1,234.56, $ 500, +$1,200.00, -$450, MXN 1,500.00, $12000
  const currencyPrefixRegex = /(?:[+-]?\s*(?:\$|USD|MXN|EUR|€)\s*[+-]?\s*\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\b(?:\$|USD|MXN|EUR|€)\s*\d+(?:\.\d{1,2})?)/gi

  // Regex para montos seguidos de divisa o palabra "pesos"
  // Ejemplos: 1,500.00 MXN, 2500.50 pesos, 10,000.00 USD
  const currencySuffixRegex = /\b\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?\s*(?:MXN|USD|EUR|pesos|pesos mexicanos)\b/gi

  // Regex para montos decimales obvios (formato con comas y 2 decimales): 1,234.50
  const standardDecimalMoneyRegex = /\b\d{1,3}(?:,\d{3})+\.\d{2}\b/g

  // Proteger matches
  let masked = text
    .replace(currencyPrefixRegex, (match) => {
      const token = `___AMOUNT_TOKEN_${placeholderIndex++}___`
      amountPlaceholders.push({ token, value: match })
      return token
    })
    .replace(currencySuffixRegex, (match) => {
      const token = `___AMOUNT_TOKEN_${placeholderIndex++}___`
      amountPlaceholders.push({ token, value: match })
      return token
    })
    .replace(standardDecimalMoneyRegex, (match) => {
      const token = `___AMOUNT_TOKEN_${placeholderIndex++}___`
      amountPlaceholders.push({ token, value: match })
      return token
    })

  // 2. Enmascarar números de tarjetas con asteriscos previos o formato agrupado:
  // Ejemplos: *1234, ****1234, terminada en 1234, 4152 3134 1234 5678
  masked = masked.replace(/(?:\*{1,8}|terminada en\s+|terminación\s+|cuenta\s+|tarjeta\s+)(\d{4})\b/gi, (match, digits) => {
    return match.replace(digits, '••••')
  })

  // Tarjetas o cuentas agrupadas por espacios o guiones: 1234 5678 9012 3456
  masked = masked.replace(/\b\d{4}[-\s]\d{4}[-\s]\d{4}(?:[-\s]\d{4})?\b/g, '•••• •••• •••• ••••')

  // 3. Enmascarar cualquier secuencia continua de 4 o más dígitos que no sea un monto protegido
  // (números de cuenta, teléfonos, CLABEs, códigos de autorización, folios, fechas largas)
  masked = masked.replace(/\b\d{4,}\b/g, '••••')

  // 4. Restaurar los montos monetarios protegidos
  for (const { token, value } of amountPlaceholders) {
    masked = masked.replace(token, value)
  }

  return masked
}

/**
 * Determina si una muestra es más antigua que el número de días especificado (por defecto 7).
 *
 * @param {Object|string|number} sampleOrDate
 * @param {number} [maxDays=7]
 * @param {number} [nowTime=Date.now()]
 * @returns {boolean}
 */
export function isSampleExpired(sampleOrDate, maxDays = 7, nowTime = Date.now()) {
  if (!sampleOrDate) return true

  let itemTime = 0
  if (typeof sampleOrDate === 'number') {
    itemTime = sampleOrDate
  } else if (typeof sampleOrDate === 'string') {
    itemTime = new Date(sampleOrDate).getTime()
  } else if (typeof sampleOrDate === 'object') {
    if (sampleOrDate.postTime) {
      itemTime = Number(sampleOrDate.postTime)
    } else if (sampleOrDate.createdAt) {
      itemTime = new Date(sampleOrDate.createdAt).getTime()
    }
  }

  if (isNaN(itemTime) || itemTime <= 0) return true

  const maxAgeMs = maxDays * 24 * 60 * 60 * 1000
  return nowTime - itemTime > maxAgeMs
}

/**
 * Filtra las muestras eliminando aquellas que tengan más de 7 días de antigüedad.
 *
 * @param {Array<Object>} samples
 * @param {number} [maxDays=7]
 * @param {number} [nowTime=Date.now()]
 * @returns {Array<Object>}
 */
export function filterExpiredSamples(samples = [], maxDays = 7, nowTime = Date.now()) {
  if (!Array.isArray(samples)) return []
  return samples.filter(s => !isSampleExpired(s, maxDays, nowTime))
}

/**
 * Devuelve las cuentas asignadas a un paquete bancario según la configuración del usuario.
 *
 * @param {string} packageName
 * @param {Object} bankAccountMappings - Objeto con forma { [packageName]: string[] | string }
 * @param {Array<Object>} availableAccounts - Lista completa de cuentas
 * @returns {Array<Object>} Cuentas vinculadas
 */
export function resolveMappedAccounts(packageName, bankAccountMappings = {}, availableAccounts = []) {
  if (!packageName || !bankAccountMappings) return []

  const normPkg = packageName.trim().toLowerCase()
  // Buscar coincidencia exacta o insensitiva
  let matchedIds = bankAccountMappings[packageName]
  if (!matchedIds) {
    for (const [key, ids] of Object.entries(bankAccountMappings)) {
      if (key.trim().toLowerCase() === normPkg) {
        matchedIds = ids
        break
      }
    }
  }

  if (!matchedIds) return []

  const idList = Array.isArray(matchedIds) ? matchedIds : [matchedIds]
  const idSet = new Set(idList)

  return availableAccounts.filter(acc => idSet.has(acc.id))
}

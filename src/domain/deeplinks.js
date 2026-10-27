/**
 * src/domain/deeplinks.js
 *
 * Lógica pura para el procesamiento y traducción de deep links del esquema finanzas://
 * No tiene dependencias de React, DOM ni APIs de Capacitor.
 */

/**
 * Mapeo de rutas o alias hacia las rutas internas de la aplicación.
 */
const ROUTE_ALIASES = {
  registrar: '/registrar',
  register: '/registrar',
  registro: '/registrar',
  gasto: '/registrar',
  ingreso: '/registrar',
  panorama: '/panorama',
  overview: '/panorama',
  dashboard: '/panorama',
  cuentas: '/cuentas',
  accounts: '/cuentas',
  wallet: '/cuentas',
  ajustes: '/ajustes',
  settings: '/ajustes',
}

/**
 * Parsea un enlace profundo con esquema finanzas:// y lo traduce a una ruta
 * y parámetros compatibles con HashRouter (/path?query).
 *
 * Soporta formatos:
 * - finanzas://registrar?type=expense
 * - finanzas://register?type=income
 * - finanzas://panorama
 * - finanzas://cuentas
 * - finanzas:///registrar?type=expense (con triple barra)
 * - /registrar?type=expense (ruta relativa directa)
 *
 * @param {string} url - Cadena de URL o deep link a procesar
 * @returns {{
 *   isValid: boolean,
 *   route: string,
 *   fullPath: string,
 *   searchParams: Record<string, string>,
 *   movementType: 'expense' | 'income' | 'transfer' | null
 * }}
 */
export function parseDeepLink(url) {
  const fallback = {
    isValid: false,
    route: '/registrar',
    fullPath: '/registrar',
    searchParams: {},
    movementType: null,
  }

  if (typeof url !== 'string' || !url.trim()) {
    return fallback
  }

  const cleanUrl = url.trim()

  // Si no empieza con el esquema esperado ni con '/', descartar o verificar
  let pathWithQuery = ''

  if (cleanUrl.startsWith('finanzas://')) {
    // Quitar esquema: finanzas://register?type=expense -> register?type=expense
    pathWithQuery = cleanUrl.replace(/^finanzas:\/{2,3}/, '')
  } else if (cleanUrl.startsWith('finanzas:')) {
    pathWithQuery = cleanUrl.replace(/^finanzas:/, '')
  } else if (cleanUrl.startsWith('#/')) {
    pathWithQuery = cleanUrl.replace(/^#\//, '')
  } else if (cleanUrl.startsWith('/')) {
    pathWithQuery = cleanUrl.replace(/^\//, '')
  } else {
    // Si no es un formato reconocido
    return fallback
  }

  // Separar ruta de los parámetros query (?foo=bar)
  const questionIdx = pathWithQuery.indexOf('?')
  let rawHostOrPath = ''
  let queryString = ''

  if (questionIdx !== -1) {
    rawHostOrPath = pathWithQuery.slice(0, questionIdx)
    queryString = pathWithQuery.slice(questionIdx + 1)
  } else {
    rawHostOrPath = pathWithQuery
  }

  // Limpiar barras finales o iniciales
  const normalizedPathKey = rawHostOrPath.replace(/^\/+|\/+$/g, '').toLowerCase()

  // Resolver ruta interna
  const targetRoute = ROUTE_ALIASES[normalizedPathKey] || '/registrar'

  // Procesar search params
  const params = {}
  if (queryString) {
    const pairs = queryString.split('&')
    for (const pair of pairs) {
      if (!pair) continue
      const [key, value] = pair.split('=')
      if (key) {
        params[decodeURIComponent(key.trim())] = value ? decodeURIComponent(value.trim()) : ''
      }
    }
  }

  // Identificar tipo de movimiento si aplica
  let movementType = null
  const rawType = (params.type || '').toLowerCase()

  if (rawType === 'expense' || rawType === 'gasto') {
    movementType = 'expense'
  } else if (rawType === 'income' || rawType === 'ingreso') {
    movementType = 'income'
  } else if (rawType === 'transfer' || rawType === 'transferencia') {
    movementType = 'transfer'
  } else if (normalizedPathKey === 'gasto') {
    movementType = 'expense'
    params.type = 'expense'
  } else if (normalizedPathKey === 'ingreso') {
    movementType = 'income'
    params.type = 'income'
  }

  // Reconstruir query string canónica
  const queryParts = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
  const search = queryParts.length > 0 ? `?${queryParts.join('&')}` : ''
  const fullPath = `${targetRoute}${search}`

  return {
    isValid: true,
    route: targetRoute,
    fullPath,
    searchParams: params,
    movementType,
  }
}

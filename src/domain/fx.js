/**
 * src/domain/fx.js
 *
 * Lógica pura de cálculo y formateo de tipos de cambio (Forex).
 *
 * Funciones puras:
 *   - calculateFxChange: calcula variación absoluta y porcentual frente al día anterior.
 *   - formatFxRate: formatea el tipo de cambio con 2 o 4 decimales según precisión.
 *   - formatRelativeTime: formatea timestamps a texto relativo ("hace X min", "hace X h").
 *
 * Sin dependencias de React ni de base de datos.
 */

/**
 * Calcula la variación absoluta y porcentual entre el tipo de cambio actual y el anterior.
 *
 * @param {number|null|undefined} currentRate
 * @param {number|null|undefined} prevRate
 * @returns {{
 *   change: number,
 *   changePct: number,
 *   direction: 'up' | 'down' | 'neutral',
 *   hasPrev: boolean
 * }}
 */
export function calculateFxChange(currentRate, prevRate) {
  const current = Number(currentRate) || 0
  const prev = Number(prevRate) || 0

  if (!prev || prev <= 0 || !current || current <= 0) {
    return {
      change: 0,
      changePct: 0,
      direction: 'neutral',
      hasPrev: false,
    }
  }

  const change = current - prev
  const changePct = Number(((change / prev) * 100).toFixed(2))

  let direction = 'neutral'
  if (changePct > 0) direction = 'up'
  else if (changePct < 0) direction = 'down'

  return {
    change: Number(change.toFixed(4)),
    changePct,
    direction,
    hasPrev: true,
  }
}

/**
 * Formatea una tasa de cambio a cadena legible con 2 o 4 decimales.
 * Si los decimales después del 2do dígito son significativos, muestra hasta 4.
 *
 * @param {number|null|undefined} rate
 * @returns {string} Ej: "18.61" o "18.6155"
 */
export function formatFxRate(rate) {
  const num = Number(rate)
  if (isNaN(num) || num <= 0) return '0.00'

  // Si tiene decimales significativos más allá de 2, mostrar 4
  const fixed4 = num.toFixed(4)
  if (fixed4.endsWith('00')) {
    return num.toFixed(2)
  }
  return fixed4
}

/**
 * Formatea una fecha o ISO timestamp a texto relativo en español ("hace X min", "hace X h", "recién").
 *
 * @param {Date|string|number|null|undefined} dateOrIso
 * @param {Date} [now=new Date()]
 * @returns {string}
 */
export function formatRelativeTime(dateOrIso, now = new Date()) {
  if (!dateOrIso) return 'Sin fecha'

  const targetDate = typeof dateOrIso === 'string' || typeof dateOrIso === 'number'
    ? new Date(dateOrIso)
    : dateOrIso

  if (isNaN(targetDate.getTime())) return 'Fecha inválida'

  const diffMs = Math.max(0, now.getTime() - targetDate.getTime())
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSec < 45) {
    return 'hace un momento'
  }
  if (diffMin < 60) {
    return `hace ${diffMin} min`
  }
  if (diffHours < 24) {
    return diffHours === 1 ? 'hace 1 hora' : `hace ${diffHours} h`
  }
  if (diffDays === 1) {
    return 'hace 1 día'
  }
  return `hace ${diffDays} días`
}

/**
 * src/components/notifications/PendingDetectionsCard.jsx
 *
 * Tarjeta superior "Por confirmar (N)" para Registrar y Panorama.
 *
 * REGLAS:
 *   - Si no hay detecciones pendientes (vacío), NO se muestra (retorna null).
 *   - Modo privado: montos ocultos con máscara ('••••') hasta tocar para revelar.
 *   - Al tocar la tarjeta o el botón de acción, abre la hoja de revisión.
 *   - Formato relativo "hace X min".
 *   - Estilo acorde al Design System: negro y acento naranja, sin colores sueltos.
 */

import { useState } from 'react'
import { Sparkles, ChevronRight, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import { useNotificationDetection } from '../../store/useNotificationDetection.js'
import { useSettings } from '../../store/useSettings.js'
import { formatMoney, formatRelativeTime } from '../../lib/format.js'

export default function PendingDetectionsCard({ onOpenReview }) {
  const { pendingDetections, loading } = useNotificationDetection()
  const { settings } = useSettings()

  // Control local para revelar montos si el modo privado está activo
  const [unmasked, setUnmasked] = useState(false)
  const isPrivate = Boolean(settings?.privacyMode) && !unmasked

  if (loading && (!pendingDetections || pendingDetections.length === 0)) {
    return null
  }

  const count = pendingDetections?.length || 0
  if (count === 0) {
    return null
  }

  const latest = pendingDetections[0]
  const timeAgo = formatRelativeTime(latest?.postedAt || latest?.detectedAt)

  const toggleMask = (e) => {
    e.stopPropagation()
    setUnmasked((prev) => !prev)
  }

  return (
    <div
      onClick={onOpenReview}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpenReview?.()
        }
      }}
      className="w-full rounded-2xl p-3.5 mb-4 transition-all duration-200 cursor-pointer text-left select-none outline-none focus-visible:ring-2 focus-visible:ring-[var(--orange-400)] active:scale-[0.99]"
      style={{
        background: 'linear-gradient(135deg, rgba(255, 122, 26, 0.14) 0%, rgba(20, 20, 20, 0.95) 100%)',
        border: '1px solid rgba(255, 122, 26, 0.35)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 16px rgba(255, 122, 26, 0.12)',
      }}
      aria-label={`Por confirmar: ${count} movimientos detectados`}
    >
      <div className="flex items-center justify-between gap-3">
        {/* Cabecera y contador */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{
              background: 'var(--orange-400)',
              color: 'var(--text-inverse)',
            }}
          >
            <Sparkles size={16} strokeWidth={2.4} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-xs text-white truncate">
                Por confirmar ({count})
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-wider"
                style={{
                  background: 'rgba(255, 122, 26, 0.2)',
                  color: 'var(--orange-300)',
                  border: '1px solid rgba(255, 122, 26, 0.4)',
                }}
              >
                Nuevo
              </span>
            </div>

            <p className="text-[11px] text-[var(--text-secondary)] truncate mt-0.5">
              {latest.merchant
                ? `${latest.merchant} · ${timeAgo}`
                : `Movimiento bancario detectado · ${timeAgo}`}
            </p>
          </div>
        </div>

        {/* Monto y acción */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {latest.amountCents !== null && latest.amountCents !== undefined && (
            <div
              onClick={toggleMask}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--orange-400)] transition-colors"
              title={isPrivate ? 'Toca para mostrar monto' : 'Monto detectado'}
            >
              <span className="font-bold text-xs text-white tabular-nums">
                {isPrivate ? '••••' : formatMoney(latest.amountCents, latest.currency || 'MXN')}
              </span>
              {Boolean(settings?.privacyMode) && (
                <span className="text-[var(--text-muted)]">
                  {isPrivate ? <Eye size={12} /> : <EyeOff size={12} />}
                </span>
              )}
            </div>
          )}

          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--orange-400)] bg-[rgba(255,122,26,0.1)] border border-[rgba(255,122,26,0.2)]"
            aria-hidden="true"
          >
            <ChevronRight size={16} />
          </div>
        </div>
      </div>

      {/* Muestra rápida si hay múltiples detecciones */}
      {count > 1 && (
        <div className="mt-2.5 pt-2 border-t border-[rgba(255,122,26,0.15)] flex items-center justify-between text-[10px] text-[var(--text-muted)]">
          <span>Toca para revisar y confirmar los {count} movimientos</span>
          <span className="text-[var(--orange-400)] font-medium">Revisar lista</span>
        </div>
      )}
    </div>
  )
}


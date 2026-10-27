/**
 * src/components/fx/FxWidget.jsx
 *
 * Widget compacto de Tipo de Cambio para la parte superior de Panorama (~72-88 px).
 *
 * Características:
 *   - Carrusel horizontal con scroll-snap (USD/MXN, EUR/MXN).
 *   - Muestra precio con 2-4 decimales, variación con ▲/▼ + porcentaje (no solo color) y "hace X min".
 *   - Puntos de paginación sincronizados.
 *   - Moneda principal: botón de estrella (o pulsación larga) la fija como principal y se guarda en useSettings.
 *   - Destello breve cuando la cotización cambia (respeta prefers-reduced-motion).
 *   - Soporte para navegación con teclado (flechas) y áreas táctiles de mínimo 44 px.
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  RefreshCw,
  Clock,
  WifiOff,
} from 'lucide-react'
import { useFx } from '../../store/useFx.js'
import { useSettings } from '../../store/useSettings.js'
import { formatFxRate, formatRelativeTime } from '../../domain/fx.js'
import { AVAILABLE_FX_PAIRS } from '../../lib/constants.js'

export default function FxWidget() {
  const { rates, loading, hasChanged, startAutoRefresh, fetchRates } = useFx()
  const { settings, setPrimaryFxCurrency, fetchSettings } = useSettings()

  const scrollRef = useRef(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const longPressTimer = useRef(null)

  const primaryCurrency = settings?.primaryFxCurrency || 'USD'
  const enabledCurrencies = settings?.enabledFxCurrencies || ['USD', 'EUR']

  // Filtrar pares activos y ordenar colocando la moneda principal en primer lugar
  const activePairs = useMemo(() => {
    const list = AVAILABLE_FX_PAIRS.filter(p => enabledCurrencies.includes(p.code))
    // Ordenar para que la moneda principal aparezca primero al abrir
    return list.sort((a, b) => {
      if (a.code === primaryCurrency) return -1
      if (b.code === primaryCurrency) return 1
      return 0
    })
  }, [enabledCurrencies, primaryCurrency])

  // Iniciar auto-refresco (al montar, visibilitychange, y cada 5 min)
  useEffect(() => {
    fetchSettings()
    const codes = activePairs.map(p => p.code)
    const cleanup = startAutoRefresh(codes.length > 0 ? codes : ['USD', 'EUR'])
    return cleanup
  }, [startAutoRefresh, fetchSettings, activePairs])

  // Sincronizar indicador de paginación con el scroll horizontal
  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollLeft, clientWidth } = scrollRef.current
    if (clientWidth > 0) {
      const idx = Math.round(scrollLeft / clientWidth)
      setActiveIndex(Math.min(idx, activePairs.length - 1))
    }
  }

  // Navegar con los puntos de paginación o flechas
  const scrollToIndex = (index) => {
    if (!scrollRef.current) return
    const width = scrollRef.current.clientWidth
    scrollRef.current.scrollTo({
      left: index * width,
      behavior: 'smooth',
    })
    setActiveIndex(index)
  }

  // Soporte para teclado (flecha izquierda / derecha)
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowRight' && activeIndex < activePairs.length - 1) {
      e.preventDefault()
      scrollToIndex(activeIndex + 1)
    } else if (e.key === 'ArrowLeft' && activeIndex > 0) {
      e.preventDefault()
      scrollToIndex(activeIndex - 1)
    }
  }

  // Soporte para pulsación larga para fijar moneda principal
  const handleTouchStart = (currencyCode) => {
    longPressTimer.current = setTimeout(() => {
      setPrimaryFxCurrency(currencyCode)
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(15)
        }
      } catch { /* no-op */ }
    }, 500)
  }

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  if (activePairs.length === 0) return null

  return (
    <section
      aria-label="Widget de tipos de cambio de divisas"
      className="relative w-full rounded-2xl flex flex-col justify-between"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        minHeight: '80px',
        boxShadow: '0 4px 14px -2px rgba(0, 0, 0, 0.35)',
      }}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* ── Carrusel con Scroll-Snap ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none items-stretch w-full"
        style={{ scrollSnapType: 'x mandatory' }}
      >
        {activePairs.map((pairItem) => {
          const rateData = rates[pairItem.code]
          const isPrimary = pairItem.code === primaryCurrency
          const changed = Boolean(hasChanged[pairItem.code])

          const rate = rateData?.rate || 0
          const changePct = rateData?.changePct || 0
          const direction = changePct > 0 ? 'up' : changePct < 0 ? 'down' : 'neutral'
          const isStale = Boolean(rateData?.stale)
          const relativeTime = rateData?.updatedAt ? formatRelativeTime(rateData.updatedAt) : 'reciente'

          return (
            <div
              key={pairItem.code}
              className="w-full flex-shrink-0 snap-center p-3.5 flex items-center justify-between gap-3 transition-all duration-300"
              style={{
                // Destello suave si el valor acaba de cambiar, respetando reduced-motion en CSS
                background: changed ? 'var(--orange-900)' : 'transparent',
              }}
              onTouchStart={() => handleTouchStart(pairItem.code)}
              onTouchEnd={handleTouchEnd}
              onMouseDown={() => handleTouchStart(pairItem.code)}
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
            >
              {/* Lado izquierdo: Par, bandera y botón estrella principal */}
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setPrimaryFxCurrency(pairItem.code)}
                  title={isPrimary ? 'Moneda principal fijada' : `Fijar ${pairItem.code} como principal`}
                  aria-label={`Fijar ${pairItem.code} como principal`}
                  className="min-w-[44px] min-h-[44px] -ml-2 -my-2 flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-[var(--orange-400)] transition-colors"
                >
                  <Star
                    size={16}
                    className={isPrimary ? 'text-[var(--orange-400)] fill-[var(--orange-400)]' : 'text-[var(--text-muted)] opacity-60'}
                  />
                </button>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 700,
                        fontSize: '14px',
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {pairItem.pair}
                    </span>
                    {isPrimary && (
                      <span
                        className="px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase tracking-wider"
                        style={{
                          background: 'var(--orange-900)',
                          color: 'var(--orange-400)',
                          border: '1px solid var(--orange-700)',
                        }}
                      >
                        Principal
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-secondary)] mt-0.5">
                    <span className="flex items-center gap-1">
                      <Clock size={10} className="opacity-70" />
                      {relativeTime}
                    </span>
                    {isStale && (
                      <span className="flex items-center gap-0.5 text-[var(--orange-400)]" title="Sin conexión: cotización en caché">
                        <WifiOff size={10} />
                        Caché
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Lado derecho: Cotización, variación con icono + texto, y botón manual refresh */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <span
                    className="block font-bold text-base sm:text-lg"
                    style={{
                      fontFamily: "'Space Grotesk', sans-serif",
                      color: 'var(--text-primary)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    ${formatFxRate(rate)}
                  </span>

                  {/* Variación porcentual: ícono + texto (nunca solo color) */}
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    {direction === 'up' && (
                      <span className="flex items-center gap-0.5 text-[11px] font-semibold text-emerald-400" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <TrendingUp size={12} aria-hidden="true" />
                        <span>▲ +{Math.abs(changePct).toFixed(2)}%</span>
                      </span>
                    )}
                    {direction === 'down' && (
                      <span className="flex items-center gap-0.5 text-[11px] font-semibold text-[var(--red-400)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <TrendingDown size={12} aria-hidden="true" />
                        <span>▼ -{Math.abs(changePct).toFixed(2)}%</span>
                      </span>
                    )}
                    {direction === 'neutral' && (
                      <span className="flex items-center gap-0.5 text-[11px] font-medium text-[var(--text-muted)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        <Minus size={12} aria-hidden="true" />
                        <span>0.00%</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Botón táctil de refresco manual */}
                <button
                  type="button"
                  onClick={() => fetchRates(activePairs.map(p => p.code))}
                  disabled={loading}
                  aria-label="Actualizar tipo de cambio"
                  title="Refrescar cotización ahora"
                  className="min-w-[44px] min-h-[44px] -mr-2 -my-2 flex items-center justify-center rounded-xl text-[var(--text-muted)] hover:text-white transition-colors"
                >
                  <RefreshCw
                    size={14}
                    className={loading ? 'animate-spin text-[var(--orange-400)]' : 'opacity-70 hover:opacity-100'}
                  />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Puntos de Paginación del Carrusel (si hay más de 1 divisa activa) ── */}
      {activePairs.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pb-1.5 -mt-1" aria-hidden="true">
          {activePairs.map((pairItem, idx) => (
            <button
              key={pairItem.code}
              type="button"
              onClick={() => scrollToIndex(idx)}
              aria-label={`Ir a ${pairItem.pair}`}
              className="w-1.5 h-1.5 rounded-full transition-all duration-200"
              style={{
                background: idx === activeIndex ? 'var(--orange-400)' : 'var(--border-default)',
                width: idx === activeIndex ? '16px' : '6px',
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}

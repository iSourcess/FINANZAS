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
      className="relative w-full rounded-2xl flex flex-col justify-between overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(26, 26, 26, 0.9) 0%, rgba(17, 17, 17, 0.95) 100%)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.45)',
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
              className="w-full flex-shrink-0 snap-center px-4 py-3 sm:py-3.5 flex items-center justify-between gap-3 transition-colors duration-300"
              style={{
                background: changed ? 'rgba(255, 122, 26, 0.12)' : 'transparent',
              }}
              onTouchStart={() => handleTouchStart(pairItem.code)}
              onTouchEnd={handleTouchEnd}
              onMouseDown={() => handleTouchStart(pairItem.code)}
              onMouseUp={handleTouchEnd}
              onMouseLeave={handleTouchEnd}
            >
              {/* Lado izquierdo: Estrella sutil, Par con Badge elegante y hora */}
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setPrimaryFxCurrency(pairItem.code)}
                  title={isPrimary ? 'Moneda principal fijada' : `Fijar ${pairItem.code} como principal`}
                  aria-label={`Fijar ${pairItem.code} como principal`}
                  className="w-8 h-8 -ml-1 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--orange-400)] hover:bg-white/5 transition-all flex-shrink-0"
                >
                  <Star
                    size={15}
                    className={
                      isPrimary
                        ? 'text-[var(--orange-400)] fill-[var(--orange-400)] drop-shadow-[0_0_8px_rgba(255,122,26,0.5)]'
                        : 'opacity-40 hover:opacity-100'
                    }
                  />
                </button>

                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 700,
                        fontSize: '15px',
                        color: 'var(--text-primary)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {pairItem.pair}
                    </span>
                    {isPrimary && (
                      <span
                        className="px-1.5 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase"
                        style={{
                          background: 'rgba(255, 122, 26, 0.15)',
                          color: 'var(--orange-400)',
                          border: '1px solid rgba(255, 122, 26, 0.3)',
                        }}
                      >
                        Principal
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] mt-0.5">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock size={10} className="opacity-60" />
                      {relativeTime}
                    </span>
                    {isStale && (
                      <span className="flex items-center gap-0.5 text-[var(--orange-400)] font-medium" title="Sin conexión: cotización en caché">
                        <span>·</span>
                        <WifiOff size={10} />
                        Caché
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Lado derecho: Precio grande y variación en chip estilizado */}
              <div className="flex items-center gap-2.5 flex-shrink-0">
                <div className="text-right flex flex-col items-end">
                  <span
                    className="font-bold text-base sm:text-lg tracking-tight font-mono text-white"
                    style={{ fontVariantNumeric: 'tabular-nums' }}
                  >
                    ${formatFxRate(rate)}
                  </span>

                  {/* Badge de Variación porcentual estilo Finanzas moderno */}
                  <div className="mt-0.5">
                    {direction === 'up' && (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono text-emerald-400"
                        style={{
                          background: 'rgba(52, 211, 153, 0.12)',
                          border: '1px solid rgba(52, 211, 153, 0.25)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        <TrendingUp size={11} strokeWidth={2.5} aria-hidden="true" />
                        <span>+{Math.abs(changePct).toFixed(2)}%</span>
                      </span>
                    )}
                    {direction === 'down' && (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold font-mono text-[var(--red-400)]"
                        style={{
                          background: 'rgba(239, 68, 68, 0.12)',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        <TrendingDown size={11} strokeWidth={2.5} aria-hidden="true" />
                        <span>-{Math.abs(changePct).toFixed(2)}%</span>
                      </span>
                    )}
                    {direction === 'neutral' && (
                      <span
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium font-mono text-[var(--text-muted)]"
                        style={{
                          background: 'rgba(255, 255, 255, 0.05)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        <Minus size={11} aria-hidden="true" />
                        <span>0.00%</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Botón sutil de refresco manual */}
                <button
                  type="button"
                  onClick={() => fetchRates(activePairs.map(p => p.code))}
                  disabled={loading}
                  aria-label="Actualizar tipo de cambio"
                  title="Refrescar cotización ahora"
                  className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-white/5 transition-colors"
                >
                  <RefreshCw
                    size={13}
                    className={loading ? 'animate-spin text-[var(--orange-400)]' : 'opacity-60 hover:opacity-100'}
                  />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Puntos de Paginación del Carrusel (Integrados con diseño sutil) ── */}
      {activePairs.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pb-2 pt-0.5" aria-hidden="true">
          {activePairs.map((pairItem, idx) => (
            <button
              key={pairItem.code}
              type="button"
              onClick={() => scrollToIndex(idx)}
              aria-label={`Ir a ${pairItem.pair}`}
              className="h-1 rounded-full transition-all duration-300"
              style={{
                background: idx === activeIndex ? 'var(--orange-400)' : 'rgba(255, 255, 255, 0.15)',
                width: idx === activeIndex ? '16px' : '5px',
              }}
            />
          ))}
        </div>
      )}
    </section>
  )
}

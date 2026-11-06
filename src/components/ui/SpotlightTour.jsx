/**
 * src/components/ui/SpotlightTour.jsx
 *
 * Componente de Tour Guiado Interactivo (Spotlight / Coachmarks).
 * Oscurece la pantalla, enfoca el elemento objetivo con un halo naranja brillante
 * y muestra una tarjeta explicativa flotante con navegación paso a paso.
 */

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, ChevronRight, ChevronLeft, X, Check } from 'lucide-react'
import { useTour, TOUR_STEPS } from '../../store/useTour.js'

export default function SpotlightTour() {
  const navigate = useNavigate()
  const { isOpen, currentStepIndex, nextStep, prevStep, endTour } = useTour()
  const [targetRect, setTargetRect] = useState(null)

  const step = TOUR_STEPS[currentStepIndex] || null
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1

  // Medir posición del elemento objetivo
  const updateRect = useCallback(() => {
    if (!step) return

    let el = document.querySelector(step.targetSelector)
    if (!el && step.fallbackSelector) {
      el = document.querySelector(step.fallbackSelector)
    }

    if (el) {
      const rect = el.getBoundingClientRect()
      // Si el elemento mide 0 (invisible), no actualizar
      if (rect.width > 0 && rect.height > 0) {
        setTargetRect({
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        })
      }
    } else {
      setTargetRect(null)
    }
  }, [step])

  // Ajustar cuando cambia de paso o se redimensiona
  useEffect(() => {
    if (!isOpen || !step) return

    // Intentar de inmediato y luego tras un breve retardo para permitir renders de ruta
    updateRect()
    const t1 = setTimeout(updateRect, 100)
    const t2 = setTimeout(updateRect, 300)
    const t3 = setTimeout(updateRect, 600)

    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [isOpen, step, updateRect])

  // Desplazar el elemento a la vista si está fuera de pantalla
  useEffect(() => {
    if (!isOpen || !step) return
    const el = document.querySelector(step.targetSelector) || document.querySelector(step.fallbackSelector)
    if (el) {
      const rect = el.getBoundingClientRect()
      const isOffScreen = rect.top < 60 || rect.bottom > window.innerHeight - 80
      if (isOffScreen) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [isOpen, step])

  // Teclado (Escape para cerrar, flechas para navegar)
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        endTour()
      } else if (e.key === 'ArrowRight') {
        nextStep(navigate)
      } else if (e.key === 'ArrowLeft' && currentStepIndex > 0) {
        prevStep(navigate)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, currentStepIndex, nextStep, prevStep, endTour, navigate])

  if (!isOpen || !step) return null

  const pad = 6
  const spotlightTop = targetRect ? Math.max(0, targetRect.top - pad) : 0
  const spotlightLeft = targetRect ? Math.max(0, targetRect.left - pad) : 0
  const spotlightWidth = targetRect ? targetRect.width + pad * 2 : 0
  const spotlightHeight = targetRect ? targetRect.height + pad * 2 : 0

  // Cálculo de posición de la tarjeta flotante
  // Si el elemento está en la mitad inferior de la pantalla, mostrar la tarjeta arriba
  // Si está en la mitad superior, mostrarla abajo
  const cardAbove = targetRect ? targetRect.top > window.innerHeight * 0.5 : true

  return (
    <div
      className="fixed inset-0 z-[9999] overflow-hidden select-none"
      style={{ touchAction: 'none' }}
    >
      {/* ── Spotlight Box con recorte oscuro exterior ── */}
      {targetRect ? (
        <div
          className="fixed transition-all duration-300 ease-out"
          style={{
            top: spotlightTop,
            left: spotlightLeft,
            width: spotlightWidth,
            height: spotlightHeight,
            borderRadius: '22px',
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.82)',
            border: '2px solid var(--orange-400)',
            pointerEvents: 'none',
          }}
        >
          {/* Anillo de pulso resplandeciente */}
          <div
            className="absolute -inset-1 rounded-[24px] pointer-events-none opacity-40 animate-pulse"
            style={{
              border: '2px solid var(--orange-400)',
              filter: 'blur(2px)',
            }}
          />
        </div>
      ) : (
        /* Fondo oscuro completo de respaldo si no hay selector disponible */
        <div
          className="fixed inset-0 bg-black/80 transition-opacity duration-300"
          onClick={endTour}
        />
      )}

      {/* ── Tarjeta de Contenido Flotante ── */}
      <div
        className="fixed left-4 right-4 max-w-sm mx-auto z-10 transition-all duration-300 ease-out"
        style={{
          [cardAbove ? 'bottom' : 'top']: targetRect
            ? cardAbove
              ? `calc(${window.innerHeight - spotlightTop}px + 16px)`
              : `calc(${spotlightTop + spotlightHeight}px + 16px)`
            : '50%',
          transform: !targetRect ? 'translateY(-50%)' : 'none',
        }}
      >
        <div
          className="rounded-3xl p-5 shadow-2xl flex flex-col gap-3.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
          style={{
            background: 'rgba(24, 24, 27, 0.96)',
            border: '1px solid rgba(255, 122, 26, 0.3)',
            boxShadow: '0 20px 48px -8px rgba(0, 0, 0, 0.8), 0 0 24px rgba(255, 122, 26, 0.15)',
          }}
        >
          {/* Encabezado: Badge de paso y Botón Cerrar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center text-[var(--orange-400)]"
                style={{
                  background: 'var(--orange-900)',
                  border: '1px solid var(--orange-700)',
                }}
              >
                <Sparkles size={13} />
              </div>
              <span
                className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                style={{
                  background: 'var(--orange-900)',
                  color: 'var(--orange-400)',
                  border: '1px solid var(--orange-700)',
                }}
              >
                {step.badge}
              </span>
            </div>

            <button
              type="button"
              onClick={endTour}
              className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition-colors"
              title="Cerrar tour"
            >
              <X size={16} />
            </button>
          </div>

          {/* Título y Descripción */}
          <div className="flex flex-col gap-1.5">
            <h3
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '17px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                letterSpacing: '-0.01em',
              }}
            >
              {step.title}
            </h3>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
              {step.description}
            </p>
          </div>

          {/* Stepper Dots (Indicadores de progreso) */}
          <div className="flex items-center justify-center gap-1.5 py-1">
            {TOUR_STEPS.map((s, idx) => (
              <span
                key={s.id}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{
                  width: idx === currentStepIndex ? '20px' : '6px',
                  background:
                    idx === currentStepIndex
                      ? 'var(--orange-400)'
                      : 'rgba(255, 255, 255, 0.2)',
                }}
              />
            ))}
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={endTour}
              className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] py-1.5 px-2 transition-colors"
            >
              Saltar tour
            </button>

            <div className="flex items-center gap-2">
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  onClick={() => prevStep(navigate)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-white bg-[var(--bg-elevated)] hover:bg-[var(--border-default)] transition-colors active:scale-95"
                >
                  <ChevronLeft size={14} />
                  <span>Atrás</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => nextStep(navigate)}
                className="flex items-center gap-1 px-4 py-1.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95 shadow-md hover:brightness-110"
                style={{
                  background: 'var(--orange-500)',
                  border: '1px solid var(--orange-400)',
                }}
              >
                <span>{isLastStep ? '¡Entendido!' : 'Siguiente'}</span>
                {isLastStep ? <Check size={14} /> : <ChevronRight size={14} />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

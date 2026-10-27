/**
 * src/components/goals/GoalProgressBar.jsx
 *
 * Barra de progreso para una meta de ahorro.
 *
 * Muestra:
 *   - Monto ahorrado vs. Monto objetivo (en pesos con formatMoney).
 *   - Porcentaje completado (0 - 100%).
 *   - Badge de estado (Completada, En progreso, Vencida, o Días restantes).
 *   - Barra con transición fluida y colores acordes al tema (naranja acento o verde para meta cumplida).
 */

import { CheckCircle2, Clock, AlertTriangle } from 'lucide-react'
import { formatMoney } from '../../lib/format.js'

export default function GoalProgressBar({
  name,
  targetAmount = 0,
  savedAmount = 0,
  percent = 0,
  clampedPercent = 0,
  isCompleted = false,
  isOverdue = false,
  daysRemaining = null,
  showName = true,
}) {
  const barColor = isCompleted
    ? 'var(--emerald-500, #10B981)'
    : isOverdue
    ? 'var(--red-400)'
    : 'var(--orange-400)'

  return (
    <div className="flex flex-col gap-2">
      {/* ── Encabezado de la barra ── */}
      <div className="flex items-center justify-between text-xs gap-2">
        {showName && (
          <span className="font-bold text-white truncate max-w-[200px]" title={name}>
            {name}
          </span>
        )}

        {/* Badge de estado con ícono y texto explícito */}
        <div className="flex items-center gap-1.5 ml-auto">
          {isCompleted ? (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1"
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10B981',
                border: '1px solid rgba(16, 185, 129, 0.3)',
              }}
            >
              <CheckCircle2 size={11} strokeWidth={2.5} />
              <span>¡Completada!</span>
            </span>
          ) : isOverdue ? (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1"
              style={{
                background: 'var(--red-900)',
                color: 'var(--red-400)',
                border: '1px solid var(--red-700)',
              }}
            >
              <AlertTriangle size={11} strokeWidth={2.5} />
              <span>Vencida</span>
            </span>
          ) : daysRemaining !== null ? (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1"
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Clock size={10} />
              <span>{daysRemaining === 0 ? 'Vence hoy' : `${daysRemaining} días`}</span>
            </span>
          ) : null}

          <span className="font-mono font-bold text-xs text-white tabular-nums">
            {percent}%
          </span>
        </div>
      </div>

      {/* ── Barra física de progreso ── */}
      <div
        className="w-full h-2.5 rounded-full overflow-hidden"
        style={{ background: 'var(--bg-surface)' }}
        role="progressbar"
        aria-valuenow={clampedPercent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Progreso de ${name}`}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${clampedPercent}%`,
            background: isCompleted
              ? 'linear-gradient(90deg, #059669 0%, #10B981 100%)'
              : 'linear-gradient(90deg, var(--orange-500) 0%, var(--orange-400) 100%)',
            boxShadow: isCompleted
              ? '0 0 10px rgba(16, 185, 129, 0.4)'
              : '0 0 10px rgba(255, 122, 26, 0.35)',
          }}
        />
      </div>

      {/* ── Montos: Ahorrado / Objetivo ── */}
      <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
        <span>
          Ahorrado:{' '}
          <strong className="text-white font-mono tabular-nums">
            {formatMoney(savedAmount)}
          </strong>
        </span>
        <span>
          Objetivo:{' '}
          <span className="font-mono tabular-nums">
            {formatMoney(targetAmount)}
          </span>
        </span>
      </div>
    </div>
  )
}

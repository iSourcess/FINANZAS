/**
 * src/components/charts/BudgetBar.jsx
 *
 * Barra de progreso de presupuesto mensual por categoría.
 *
 * Reglas de diseño (design-system/MASTER.md y AGENTS.md):
 *   - Normal (<80%): Naranja acento (--orange-400) + CheckCircle2
 *   - Alerta (80% - 100%): Ámbar advertencia (#F59E0B) + AlertTriangle
 *   - Excedido (>100%): Rojo peligro (--red-400 / #EF4444) + AlertOctagon
 *   - Siempre incluye texto e ícono además del color (accesibilidad WCAG).
 */

import { CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react'
import { formatMoney } from '../../lib/format.js'
import { calculateBudgetStatus } from '../../domain/budgets.js'

export default function BudgetBar({
  categoryName = 'Categoría',
  spentCents = 0,
  limitCents = 0,
}) {
  const status = calculateBudgetStatus(spentCents, limitCents)
  const { percent, alertLevel, statusLabel, remainingCents, excessCents } = status

  const isDanger = alertLevel === 'danger'
  const isWarning = alertLevel === 'warning'

  const barColor = isDanger
    ? 'var(--red-400)'
    : isWarning
    ? 'var(--color-warning)'
    : 'var(--orange-400)'

  const IconComp = isDanger
    ? AlertOctagon
    : isWarning
    ? AlertTriangle
    : CheckCircle2

  return (
    <div
      className="p-3.5 rounded-xl flex flex-col gap-2 transition-all"
      style={{
        background: 'var(--bg-elevated)',
        border: isDanger ? '1px solid var(--red-600)' : '1px solid var(--border-subtle)',
      }}
    >
      {/* ── Fila Superior: Nombre de Categoría y Estado ── */}
      <div className="flex items-center justify-between text-xs gap-2">
        <span className="font-bold text-white truncate">{categoryName}</span>

        {/* Badge con ícono y texto explícito */}
        <span
          className="px-2 py-0.5 rounded-full text-[10px] font-semibold flex items-center gap-1 flex-shrink-0"
          style={{
            background: isDanger
              ? 'var(--red-900)'
              : isWarning
              ? 'rgba(245, 158, 11, 0.15)'
              : 'var(--orange-900)',
            color: barColor,
            border: `1px solid ${barColor}`,
          }}
        >
          <IconComp size={11} strokeWidth={2.5} />
          <span>{statusLabel}</span>
        </span>
      </div>

      {/* ── Barra de Progreso ── */}
      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{ background: 'var(--bg-surface)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${Math.min(100, Math.max(0, percent))}%`,
            background: barColor,
          }}
        />
      </div>

      {/* ── Fila Inferior: Gastado vs Límite y Restante/Exceso ── */}
      <div className="flex items-center justify-between text-[11px] font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
        <span className="text-[var(--text-secondary)]">
          Gastado: <strong className="text-white">{formatMoney(spentCents)}</strong> de {formatMoney(limitCents)}
        </span>

        <span style={{ color: barColor }} className="font-bold">
          {isDanger
            ? `+${formatMoney(excessCents)} de más`
            : `${formatMoney(remainingCents)} disponible`} ({percent.toFixed(0)}%)
        </span>
      </div>
    </div>
  )
}

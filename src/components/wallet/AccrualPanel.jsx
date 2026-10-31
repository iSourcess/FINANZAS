/**
 * src/components/wallet/AccrualPanel.jsx
 *
 * Panel de acreditación de rendimientos en el detalle de cuenta.
 *
 * Muestra:
 *   - Interruptor "Acreditar rendimientos" (interestEnabled)
 *   - Fecha "Desde" (interestStartDate)
 *   - Último día acreditado
 *   - Aviso estimado
 *   - Para Cajita Turbo: capital depositado e intereses acumulados por separado
 */

import { useState } from 'react'
import { Zap, Calendar, Info, TrendingUp, ToggleLeft, ToggleRight } from 'lucide-react'
import { formatMoney, formatDate } from '../../lib/format.js'
import { TURBO_CAP_CENTS } from '../../domain/yield.js'

export default function AccrualPanel({
  account,
  lastAccrualDate,
  onToggleEnabled,
  onChangeStartDate,
}) {
  const isTurbo = Boolean(
    account.isTurbo ||
    (account.yieldCapBase === 'principal' && account.yieldTiers?.[0]?.rate === 0.13)
  )

  const interestEnabled = Boolean(account.interestEnabled)
  const interestStartDate = account.interestStartDate || ''
  const accumulatedInterestCents = account.accumulatedInterestCents || 0

  // Para Turbo: capital = saldo - intereses acumulados
  const principalCents = isTurbo
    ? Math.max(0, (account.balance || 0) - accumulatedInterestCents)
    : 0

  const [localStartDate, setLocalStartDate] = useState(interestStartDate)

  const handleToggle = () => {
    onToggleEnabled?.(!interestEnabled)
  }

  const handleDateChange = (e) => {
    const val = e.target.value
    setLocalStartDate(val)
    onChangeStartDate?.(val)
  }

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* ── Encabezado ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={16} className="text-[var(--orange-400)]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white">
            Acreditación de rendimientos
          </span>
        </div>
      </div>

      {/* ── Interruptor ── */}
      <div
        className="flex items-center justify-between gap-3 p-3 rounded-lg"
        style={{ background: 'var(--bg-surface)' }}
      >
        <div className="flex flex-col">
          <span className="text-xs font-semibold text-white">Acreditar rendimientos</span>
          <span className="text-[11px] text-[var(--text-secondary)]">
            {interestEnabled
              ? 'El interés se suma al saldo diariamente'
              : 'Desactivado — solo estimaciones'}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={interestEnabled}
          onClick={handleToggle}
          aria-label="Activar o desactivar acreditación de rendimientos"
          className="flex-shrink-0 flex items-center justify-center p-2 text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
          style={{ minWidth: '44px', minHeight: '44px' }}
        >
          {interestEnabled ? (
            <ToggleRight size={28} className="text-[var(--orange-400)]" />
          ) : (
            <ToggleLeft size={28} className="text-[var(--text-muted)]" />
          )}
        </button>
      </div>

      {/* ── Fecha de inicio ── */}
      {interestEnabled && (
        <div
          className="flex items-center gap-3 p-3 rounded-lg"
          style={{ background: 'var(--bg-surface)' }}
        >
          <Calendar size={15} className="text-[var(--orange-400)] flex-shrink-0" />
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-[11px] text-[var(--text-secondary)]">Acreditar desde</span>
            <input
              type="date"
              value={localStartDate}
              onChange={handleDateChange}
              aria-label="Fecha de inicio de acreditación"
              className="bg-transparent text-xs font-semibold text-white border-none outline-none"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                colorScheme: 'dark',
                minHeight: '28px',
              }}
            />
          </div>
        </div>
      )}

      {/* ── Último día acreditado ── */}
      {interestEnabled && (
        <div
          className="flex items-center justify-between gap-2 p-3 rounded-lg text-xs"
          style={{ background: 'var(--bg-surface)' }}
        >
          <div className="flex items-center gap-2">
            <TrendingUp size={14} className="text-[var(--orange-400)]" />
            <span className="text-[11px] text-[var(--text-secondary)]">Último día acreditado</span>
          </div>
          <span className="font-mono font-semibold text-white text-[11px]">
            {lastAccrualDate ? formatDate(lastAccrualDate) : 'Ninguno aún'}
          </span>
        </div>
      )}

      {/* ── Cajita Turbo: capital e intereses por separado ── */}
      {isTurbo && (
        <div className="flex flex-col gap-2">
          <span className="text-[10px] text-[var(--text-muted)] uppercase font-semibold">
            Desglose Cajita Turbo
          </span>
          <div
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px]"
            style={{ background: 'var(--bg-surface)' }}
          >
            <span className="text-[var(--text-secondary)]">
              Capital depositado (tope {formatMoney(TURBO_CAP_CENTS)})
            </span>
            <span className="font-bold text-[var(--orange-400)] font-mono">
              {formatMoney(principalCents)}
            </span>
          </div>
          <div
            className="flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px]"
            style={{ background: 'var(--bg-surface)' }}
          >
            <span className="text-[var(--text-secondary)]">Intereses acumulados</span>
            <span className="font-bold text-[var(--orange-400)] font-mono">
              {formatMoney(accumulatedInterestCents)}
            </span>
          </div>
        </div>
      )}

      {/* ── Aviso estimado ── */}
      {interestEnabled && (
        <div
          className="flex items-start gap-2 p-2.5 rounded-lg text-[11px] leading-relaxed"
          style={{
            background: 'rgba(255, 122, 26, 0.06)',
            border: '1px solid rgba(255, 122, 26, 0.2)',
            color: 'var(--text-secondary)',
          }}
        >
          <Info size={13} className="text-[var(--orange-400)] flex-shrink-0 mt-0.5" />
          <span>
            Estimado; cuadra con tu saldo del banco de vez en cuando.
          </span>
        </div>
      )}
    </div>
  )
}

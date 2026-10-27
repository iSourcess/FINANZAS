/**
 * src/components/wallet/YieldPanel.jsx
 *
 * Panel de rendimiento estimado para cuentas de débito y ahorro.
 *
 * Muestra:
 *   - Proyecciones estimadas: diario, mensual (30d), anual nominal y anual efectivo (compuesto).
 *   - Aviso de tope y barra de progreso hacia el tope de tasa alta.
 *   - Desglose por tramo de capital con advertencia visible si se sobrepasa el límite.
 */

import { Sparkles, AlertTriangle, Info, TrendingUp } from 'lucide-react'
import { calculateAccountYield } from '../../domain/yield.js'
import { formatMoney, formatPercent } from '../../lib/format.js'

export default function YieldPanel({
  account,
}) {
  if (!account || !account.yieldTiers || account.yieldTiers.length === 0) {
    return null
  }

  const isTurbo = account.themeKey === 'nu' && account.yieldCapBase === 'principal'

  const yieldInfo = calculateAccountYield({
    balanceCents: account.balance || 0,
    yieldTiers: account.yieldTiers,
    yieldCapBase: account.yieldCapBase,
    accumulatedInterestCents: account.accumulatedInterestCents || 0,
    isTurbo,
  })

  const { capStatus } = yieldInfo
  const balance = account.balance || 0
  const nominalRate = yieldInfo.weightedNominalRate ?? yieldInfo.nominalRate ?? 0
  const effectiveRate = yieldInfo.weightedEffectiveRate ?? yieldInfo.effectiveRate ?? 0

  // Porcentaje del tope alcanzado (sobre el capital depositado)
  const capPercent = capStatus.hasCap && capStatus.capCents
    ? Math.min(100, (yieldInfo.principalCents / capStatus.capCents) * 100)
    : 0

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3.5 transition-all"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* ── Encabezado ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-[var(--orange-400)]" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white">
            Rendimiento Estimado
          </span>
        </div>
        <span className="text-[10px] text-[var(--text-muted)] italic font-mono">
          Estimado (no oficial)
        </span>
      </div>

      {/* ── Métricas de Rendimiento en 4 Cuadrantes ── */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Diario */}
        <div className="p-2.5 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
          <span className="block text-[10px] text-[var(--text-secondary)] uppercase font-medium">
            Diario estimado
          </span>
          <span
            className="block text-sm font-bold text-[var(--orange-400)] font-mono"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatMoney(yieldInfo.dailyCents)}
            <span className="text-[10px] text-[var(--text-muted)] font-sans font-normal ml-1">/ día</span>
          </span>
        </div>

        {/* Mensual (30 días) */}
        <div className="p-2.5 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
          <span className="block text-[10px] text-[var(--text-secondary)] uppercase font-medium">
            Mensual estimado (30d)
          </span>
          <span
            className="block text-sm font-bold text-white font-mono"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatMoney(yieldInfo.monthlyCents)}
            <span className="text-[10px] text-[var(--text-muted)] font-sans font-normal ml-1">/ mes</span>
          </span>
        </div>

        {/* Anual Nominal */}
        <div className="p-2.5 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)] uppercase font-medium">
              Anual nominal
            </span>
            <span className="text-[10px] font-bold text-[var(--text-muted)] font-mono">
              {formatPercent(nominalRate)}
            </span>
          </div>
          <span
            className="block text-sm font-bold text-white font-mono mt-0.5"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatMoney(yieldInfo.annualNominalCents)}
          </span>
        </div>

        {/* Anual Efectivo (compuesto con capitalización diaria) */}
        <div className="p-2.5 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[var(--text-secondary)] uppercase font-medium">
              Efectivo anual (TEA)
            </span>
            <span className="text-[10px] font-bold text-[var(--orange-400)] font-mono">
              {formatPercent(effectiveRate)}
            </span>
          </div>
          <span
            className="block text-sm font-bold text-[var(--orange-400)] font-mono mt-0.5"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatMoney(yieldInfo.annualEffectiveCents)}
          </span>
        </div>
      </div>

      {/* ── Aviso y Barra de Tope de Tasa Alta ── */}
      {capStatus.hasCap && capStatus.capCents && (
        <div className="flex flex-col gap-2 pt-1">
          {/* Advertencia si superó el tope */}
          {capStatus.isOverCap ? (
            <div
              className="p-3 rounded-xl flex items-start gap-2.5 text-xs animate-in fade-in duration-200"
              style={{
                background: 'var(--orange-900)',
                border: '1px solid var(--orange-700)',
                color: 'var(--orange-200)',
              }}
            >
              <AlertTriangle size={16} className="text-[var(--orange-400)] flex-shrink-0 mt-0.5" />
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-white">Tope de tasa alta superado</span>
                <span className="text-[11px] leading-relaxed">
                  {capStatus.warningMessage}
                </span>
                <span className="font-mono font-bold text-[var(--orange-400)] text-[11px] mt-0.5">
                  Excedente: {formatMoney(capStatus.excessCents)}
                </span>
              </div>
            </div>
          ) : capStatus.remainingCents > 0 ? (
            <div
              className="p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-[var(--orange-400)]" />
                <span className="text-[11px] text-[var(--text-secondary)]">
                  Te faltan para el tope de {formatMoney(capStatus.capCents)}:
                </span>
              </div>
              <span className="font-bold text-white font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {formatMoney(capStatus.remainingCents)}
              </span>
            </div>
          ) : (
            <div
              className="p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-2">
                <TrendingUp size={14} className="text-[var(--orange-400)]" />
                <span className="text-[11px] text-[var(--text-secondary)]">
                  Tope de depósito de {formatMoney(capStatus.capCents, account.currency)} alcanzado:
                </span>
              </div>
              <span className="font-bold text-[var(--orange-400)] font-mono text-[11px]">
                Intereses capitalizan al 13%
              </span>
            </div>
          )}

          {/* Barra de Progreso hacia el Tope */}
          <div className="flex flex-col gap-1 mt-0.5">
            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
              <span>Capital: {formatMoney(yieldInfo.principalCents, account.currency)}</span>
              <span>Tope: {formatMoney(capStatus.capCents, account.currency)}</span>
            </div>
            <div
              className="w-full h-1.5 rounded-full overflow-hidden"
              style={{ background: 'var(--bg-surface)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${capPercent}%`,
                  background: capStatus.isOverCap ? 'var(--orange-600)' : 'var(--orange-400)',
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Desglose: Turbo (3 renglones) vs. otras cuentas (lista de tramos) ── */}
      <div className="pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        {isTurbo ? (
          // La Cajita Turbo muestra capital e intereses por separado
          <>
            <span className="block text-[10px] text-[var(--text-muted)] uppercase font-semibold mb-2">
              Desglose Cajita Turbo
            </span>
            <div className="flex flex-col gap-1.5">
              {/* Capital hasta el tope */}
              <div
                className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg"
                style={{ background: 'var(--bg-surface)' }}
              >
                <span className="text-[var(--text-secondary)] text-[11px]">
                  Capital depositado (tope {formatMoney(capStatus.capCents, account.currency)})
                </span>
                <span className="font-bold text-[var(--orange-400)] font-mono text-[11px]">
                  {formatMoney(yieldInfo.principalCents, account.currency)}
                  <span className="text-[var(--text-muted)] font-normal ml-1">@ 13%</span>
                </span>
              </div>

              {/* Intereses acumulados (siempre al 13%, compuesto) */}
              <div
                className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg"
                style={{ background: 'var(--bg-surface)' }}
              >
                <span className="text-[var(--text-secondary)] text-[11px]">
                  Intereses acumulados (compuesto)
                </span>
                <span className="font-bold text-[var(--orange-400)] font-mono text-[11px]">
                  {formatMoney(yieldInfo.accumulatedInterestCents || 0, account.currency)}
                  <span className="text-[var(--text-muted)] font-normal ml-1">@ 13%</span>
                </span>
              </div>

              {/* Capital excedente (si supera el tope de depósito) */}
              {capStatus.isOverCap && (
                <div
                  className="flex flex-col gap-1 text-xs py-1.5 px-2.5 rounded-lg"
                  style={{ background: 'var(--orange-900)', border: '1px solid var(--orange-700)' }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--orange-200)] text-[11px] font-semibold">
                      Capital excedente (sobre el tope)
                    </span>
                    <span className="font-bold text-[var(--orange-400)] font-mono text-[11px] tabular-nums">
                      {formatMoney(capStatus.excessCents, account.currency)}
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--orange-300)] opacity-90">
                    Sin rendimiento en Turbo (0%) • Muévelo a Cajita Ahorro (7%)
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          // Cuentas normales: lista de tramos configurados
          <>
            <span className="block text-[10px] text-[var(--text-muted)] uppercase font-semibold mb-2">
              Tramos y Tasas Configuradas
            </span>
            <div className="flex flex-col gap-1.5">
              {account.yieldTiers.map((tier, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg"
                  style={{ background: 'var(--bg-surface)' }}
                >
                  <span className="text-[var(--text-secondary)] text-[11px]">
                    {tier.upTo
                      ? `Hasta ${formatMoney(tier.upTo, account.currency)}`
                      : 'Excedente / Sin límite'}
                  </span>
                  <span className="font-bold text-[var(--orange-400)] font-mono text-[11px]">
                    {formatPercent(tier.rate)} anual
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/**
 * src/components/charts/InterestChart.jsx
 *
 * Gráfica lineal de Intereses ganados en el periodo seleccionado.
 *
 * Características:
 *   - Pasado: lee interestAccruals (acreditaciones reales al saldo) por cubeta.
 *   - Futuro: usa proyección con saldo actual (calculateHistoricalInterest).
 *   - Total acumulado en pesos del periodo.
 *   - Tooltip interactivo con desglose por cuenta.
 */

import { useState, useMemo, useEffect } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Sparkles, Info, X } from 'lucide-react'
import { getBuckets } from '../../domain/buckets.js'
import {
  calculateHistoricalInterest,
  isYieldAccount,
} from '../../domain/interest.js'
import { formatMoney } from '../../lib/format.js'
import { getCardTheme } from '../../lib/constants.js'
import { db } from '../../db/database.js'

export default function InterestChart({
  accounts = [],
  movements = [],
  period = { type: 'month' },
  referenceDate = new Date(),
}) {
  const [selectedPoint, setSelectedPoint] = useState(null)

  // Filtrar cuentas con rendimiento
  const yieldAccounts = useMemo(() => {
    return accounts.filter(isYieldAccount)
  }, [accounts])

  const todayStr = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

  // Cubetas según el periodo seleccionado
  const buckets = useMemo(() => {
    return getBuckets(period, referenceDate)
  }, [period, referenceDate])

  // Accruals reales de la DB (para cubetas pasadas)
  const [realAccruals, setRealAccruals] = useState([])
  useEffect(() => {
    if (buckets.length === 0) return
    const from = buckets[0].start
    const to = buckets[buckets.length - 1].end
    db.interestAccruals
      .where('date')
      .between(from, to, true, true)
      .toArray()
      .then(setRealAccruals)
      .catch(() => setRealAccruals([]))
  }, [buckets])

  // Cálculo: lee interestAccruals para el pasado (sin reconstruir saldos) y usa proyección para el futuro
  const historicalData = useMemo(() => {
    return calculateHistoricalInterest({
      accounts: yieldAccounts,
      movements,
      buckets,
      referenceDate,
      interestAccruals: realAccruals,
    })
  }, [yieldAccounts, movements, buckets, referenceDate, realAccruals])

  // Datos para la gráfica: real para pasado, proyección para futuro
  const chartData = useMemo(() => {
    return historicalData.bucketSeries.map((b, idx) => {
      const isPast = b.end < todayStr
      const totalCents = b.totalInterestCents

      return {
        key: `bucket-${idx}`,
        label: b.label,
        total: totalCents / 100,
        totalCents,
        isFuture: !isPast,
        byAccount: b.byAccount,
      }
    })
  }, [historicalData, todayStr])

  const totalCents = useMemo(
    () => chartData.reduce((sum, d) => sum + d.totalCents, 0),
    [chartData]
  )
  const hasAnyInterest = chartData.some((d) => d.totalCents > 0)

  // Estado vacío si no hay cuentas de rendimiento
  if (yieldAccounts.length === 0) {
    return (
      <div
        className="rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3 min-h-[260px]"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{
            background: 'var(--orange-900)',
            color: 'var(--orange-400)',
            border: '1px solid var(--orange-700)',
          }}
        >
          <Sparkles size={24} />
        </div>
        <div className="flex flex-col gap-1 max-w-xs">
          <h4 className="font-semibold text-sm text-[var(--text-primary)]">
            Sin cuentas con rendimiento
          </h4>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Configura una cuenta con tasa anual (como Nu Cajita Turbo, Revolut o Mercado Pago) para ver la gráfica de tus intereses ganados.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4 transition-all"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* ── Encabezado ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className="p-2 rounded-xl flex items-center justify-center"
            style={{
              background: 'var(--orange-900)',
              color: 'var(--orange-400)',
              border: '1px solid var(--orange-700)',
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Intereses ganados
              </h3>
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono text-[var(--text-secondary)] bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                estimado
              </span>
            </div>
            <span className="text-xs text-[var(--text-muted)]">
              Capitalización diaria en el periodo seleccionado
            </span>
          </div>
        </div>

        {/* Total acumulado en el periodo */}
        <div className="text-right">
          <span className="text-[10px] text-[var(--text-muted)] block">
            Total del periodo
          </span>
          <span
            className="text-xl font-bold font-mono tracking-tight text-[var(--orange-400)] tabular-nums"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatMoney(totalCents)}
          </span>
        </div>
      </div>

      {/* ── Gráfica Lineal Recharts ── */}
      <div className="w-full h-56 relative">
        {!hasAnyInterest && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center text-xs text-[var(--text-muted)] gap-1">
            <Info size={16} />
            <span>Sin intereses generados en este rango</span>
          </div>
        )}

        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 12, right: 12, left: -20, bottom: 0 }}
            onClick={(state) => {
              if (state && state.activePayload && state.activePayload.length > 0) {
                setSelectedPoint(state.activePayload[0].payload)
              }
            }}
          >
            <XAxis
              dataKey="label"
              stroke="var(--text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-subtle)' }}
            />
            <YAxis
              stroke="var(--text-muted)"
              fontSize={10}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-subtle)' }}
              tickFormatter={(v) => `$${Math.round(v)}`}
            />
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload
                  return (
                    <div
                      className="rounded-xl p-2.5 shadow-xl text-xs font-mono"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <div className="text-[11px] font-sans font-semibold text-[var(--text-secondary)] mb-1">
                        {data.label}
                      </div>
                      <div className="text-[var(--orange-400)] font-bold text-sm">
                        {formatMoney(data.totalCents)}
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] font-sans mt-1">
                        Toca el punto para desglose por cuenta
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="var(--orange-400)"
              strokeWidth={2.5}
              dot={{
                r: 3.5,
                fill: 'var(--orange-400)',
                stroke: 'var(--bg-surface)',
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
                fill: 'var(--orange-400)',
                stroke: 'var(--bg-base)',
                strokeWidth: 2.5,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Desglose al Tocar un Punto ── */}
      {selectedPoint && (
        <div
          className="rounded-xl p-3.5 flex flex-col gap-2.5 animate-in fade-in duration-150"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-default)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[var(--text-primary)]">
                Desglose: {selectedPoint.label}
              </span>
              <span className="text-xs font-mono font-bold text-[var(--orange-400)]">
                {formatMoney(selectedPoint.totalCents)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSelectedPoint(null)}
              className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
              title="Cerrar desglose"
            >
              <X size={15} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {yieldAccounts.map((acc) => {
              const byAccData = selectedPoint.byAccount?.[acc.id]
              const amountCents =
                typeof byAccData === 'number'
                  ? byAccData
                  : byAccData?.amountCents || 0

              const theme = getCardTheme(acc.themeKey)

              return (
                <div
                  key={acc.id}
                  className="p-2.5 rounded-lg flex items-center justify-between text-xs"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ background: theme.colorHex || 'var(--orange-400)' }}
                    />
                    <span className="font-medium text-[var(--text-primary)] truncate max-w-[140px]">
                      {acc.name}
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-[var(--text-secondary)]">
                    {formatMoney(amountCents)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Resumen de Accesibilidad Textual ── */}
      <div className="pt-2 border-t border-[var(--border-subtle)] flex items-start gap-2 text-xs text-[var(--text-secondary)]">
        <Info size={14} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
        <p className="leading-relaxed">
          Rendimiento estimado del periodo: un total de <strong>{formatMoney(totalCents)}</strong> generado en {yieldAccounts.length} cuenta(s) con tasa activa.
        </p>
      </div>
    </div>
  )
}

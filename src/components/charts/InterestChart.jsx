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
  calculateAccountDailyInterest,
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

  // Interés diario esperado base de todas las cuentas activas
  const dailyExpectedCents = useMemo(() => {
    return yieldAccounts.reduce((sum, acc) => {
      const bal = acc.balance || 0
      if (bal <= 0) return sum
      return sum + calculateAccountDailyInterest(acc, bal)
    }, 0)
  }, [yieldAccounts])

  // Datos acumulados para la gráfica:
  // Como solicitó el usuario: día 1 = $18, día 2 = $36, día 10 = $180 (acumulación incremental)
  // - earned: intereses acumulados ganados hasta hoy (línea naranja creciente)
  // - projected: intereses acumulados esperados a lo largo del periodo (línea gris creciente)
  const chartData = useMemo(() => {
    let runningEarnedCents = 0
    let runningExpectedCents = 0

    // Acumulador por cuenta para el desglose
    const runningByAccountCents = {}
    yieldAccounts.forEach((acc) => {
      runningByAccountCents[acc.id] = 0
    })

    return historicalData.bucketSeries.map((b, idx) => {
      const isPastOrToday = b.start <= todayStr
      const pastCents = b.pastInterestCents ?? 0
      const projectedCents = b.projectedInterestCents ?? 0

      // Esperado para este bucket diario
      const bucketExpectedCents = b.totalInterestCents > 0
        ? b.totalInterestCents
        : (projectedCents > 0 ? projectedCents : (dailyExpectedCents || 0))

      runningExpectedCents += bucketExpectedCents

      if (isPastOrToday) {
        // En días transcurridos se acumula lo acreditado o estimado
        const bucketEarned = pastCents > 0 ? pastCents : bucketExpectedCents
        runningEarnedCents += bucketEarned
      }

      // Actualizar acumulado por cuenta
      const breakdown = {}
      yieldAccounts.forEach((acc) => {
        const byAccData = b.byAccount?.[acc.id]
        const dailyForAcc = typeof byAccData === 'number'
          ? byAccData
          : (byAccData?.amountCents || calculateAccountDailyInterest(acc, acc.balance || 0))
        runningByAccountCents[acc.id] = (runningByAccountCents[acc.id] || 0) + dailyForAcc
        breakdown[acc.id] = {
          id: acc.id,
          name: acc.name,
          themeKey: acc.themeKey || 'default',
          amountCents: runningByAccountCents[acc.id],
        }
      })

      return {
        key: `bucket-${idx}`,
        label: b.label,
        // earned: acumulado ganado a la fecha (naranja). Solo hasta hoy. Futuro = null
        earned: isPastOrToday ? (runningEarnedCents / 100) : null,
        earnedCents: runningEarnedCents,
        // projected: acumulado esperado del mes (gris). Crece día a día hasta el total del periodo
        projected: runningExpectedCents / 100,
        projectedCents: runningExpectedCents,
        totalCents: runningExpectedCents,
        isFuture: !isPastOrToday,
        byAccount: breakdown,
      }
    })
  }, [historicalData, todayStr, dailyExpectedCents, yieldAccounts])

  // Total acumulado ganado a la fecha
  const totalEarnedCents = useMemo(() => {
    const pastItems = chartData.filter((d) => !d.isFuture)
    if (pastItems.length === 0) return 0
    return pastItems[pastItems.length - 1].earnedCents || 0
  }, [chartData])

  // Total acumulado esperado al final del periodo
  const totalExpectedCents = useMemo(() => {
    if (chartData.length === 0) return 0
    return chartData[chartData.length - 1].projectedCents || 0
  }, [chartData])

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
      id="tour-interest-chart"
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
              Acumulado progresivo en el periodo seleccionado
            </span>
          </div>
        </div>

        {/* Total acumulado y esperado en el periodo */}
        <div className="text-right">
          <span className="text-[10px] text-[var(--text-muted)] block">
            Ganado a hoy / Total mes
          </span>
          <div className="flex items-baseline justify-end gap-1 font-mono">
            <span
              className="text-lg sm:text-xl font-bold tracking-tight text-[var(--orange-400)] tabular-nums"
              style={{ fontVariantNumeric: 'tabular-nums' }}
              title="Intereses ganados acumulados a la fecha"
            >
              {formatMoney(totalEarnedCents)}
            </span>
            <span className="text-xs text-[var(--text-muted)]">/</span>
            <span
              className="text-xs sm:text-sm font-semibold text-[var(--text-secondary)] tabular-nums"
              style={{ fontVariantNumeric: 'tabular-nums' }}
              title="Intereses esperados acumulados al final del periodo"
            >
              {formatMoney(totalExpectedCents)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Leyenda de la gráfica ── */}
      <div className="flex items-center gap-4 text-[11px] font-medium -mt-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--orange-400)]" />
          <span className="text-white">Ganado acumulado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--border-default)]" />
          <span className="text-[var(--text-muted)]">Esperado acumulado</span>
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
                      {data.earned !== null && (
                        <div className="text-[var(--orange-400)] font-bold text-xs flex items-center justify-between gap-3">
                          <span>Ganado acumulado:</span>
                          <span>{formatMoney(data.earnedCents)}</span>
                        </div>
                      )}
                      <div className="text-[var(--text-secondary)] font-semibold text-xs flex items-center justify-between gap-3 mt-0.5">
                        <span>Esperado acumulado:</span>
                        <span>{formatMoney(data.projectedCents)}</span>
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] font-sans mt-1.5 border-t border-[var(--border-subtle)] pt-1">
                        Toca el punto para desglose por cuenta
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            {/* Línea Gris: Intereses Esperados / Proyectados del mes */}
            <Line
              type="monotone"
              dataKey="projected"
              stroke="#6B7280"
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{
                r: 3,
                fill: '#6B7280',
                stroke: 'var(--bg-surface)',
                strokeWidth: 1.5,
              }}
              activeDot={{
                r: 5,
                fill: '#9CA3AF',
                stroke: 'var(--bg-base)',
                strokeWidth: 2,
              }}
            />
            {/* Línea Naranja: Intereses Ganados a la fecha */}
            <Line
              type="monotone"
              dataKey="earned"
              stroke="var(--orange-400)"
              strokeWidth={2.5}
              connectNulls={false}
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
                Desglose acumulado: {selectedPoint.label}
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
          Rendimiento acumulado: <strong>{formatMoney(totalEarnedCents)}</strong> ganados a la fecha de un estimado total de <strong>{formatMoney(totalExpectedCents)}</strong> en {yieldAccounts.length} cuenta(s) con tasa activa.
        </p>
      </div>
    </div>
  )
}

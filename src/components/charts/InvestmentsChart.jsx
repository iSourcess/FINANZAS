/**
 * src/components/charts/InvestmentsChart.jsx
 *
 * Gráfica lineal del rendimiento consolidado de TODAS las inversiones.
 *
 * Características:
 *   - Gráfica lineal (LineChart) con todas las inversiones combinadas en el periodo seleccionado.
 *   - Ganancia o pérdida total del portafolio en MXN y USD con porcentaje explícito.
 *   - Color naranja (--orange-400) para rendimiento positivo, rojo (--red-400) para negativo.
 *   - Tooltip detallado con valor del portafolio y ganancia neta.
 *   - Obedece al PeriodFilter (Semana, Mes, Año, Todo, Rango).
 *   - Accesibilidad con resumen textual inferior.
 */

import { useState, useEffect, useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp,
  TrendingDown,
  Layers,
  AlertCircle,
  Info,
} from 'lucide-react'
import { useInvestments } from '../../store/useInvestments.js'
import { useFx } from '../../store/useFx.js'
import { getFxHistoryMap } from '../../services/fx.js'
import { getBuckets } from '../../domain/buckets.js'
import { calculatePortfolioGainSeries } from '../../domain/investments.js'
import { formatMoney } from '../../lib/format.js'

export default function InvestmentsChart({
  period = { type: 'month' },
  referenceDate = new Date(),
}) {
  const {
    holdings,
    lots,
    priceMap,
    priceHistoryMap,
    loading,
    error,
    fetchHoldings,
  } = useInvestments()

  const { getRate } = useFx()
  const currentFxRate = getRate('USD') || 18.5
  const [fxHistoryMap, setFxHistoryMap] = useState(new Map())

  useEffect(() => {
    if (holdings.length === 0 && !loading) {
      fetchHoldings()
    }
  }, [holdings.length, loading, fetchHoldings])

  useEffect(() => {
    let mounted = true
    getFxHistoryMap('USD/MXN').then((map) => {
      if (mounted) {
        setFxHistoryMap(map)
      }
    })
    return () => {
      mounted = false
    }
  }, [])

  // Cubetas según el PeriodFilter
  const buckets = useMemo(() => {
    return getBuckets(period, referenceDate)
  }, [period, referenceDate])

  // Mapa de precios actuales para fallback
  const currentPriceSimpleMap = useMemo(() => {
    const map = {}
    if (priceMap && priceMap.forEach) {
      priceMap.forEach((val, key) => {
        map[key] = val?.price ? Number(val.price) : 0
      })
    }
    return map
  }, [priceMap])

  // Cálculo de la serie temporal consolidando TODAS las inversiones
  const gainSeries = useMemo(() => {
    if (holdings.length === 0) return []

    return calculatePortfolioGainSeries({
      holdings, // Todas las inversiones
      lots,
      buckets,
      priceHistoryMap,
      currentPriceMap: currentPriceSimpleMap,
      fxHistoryMap,
      currentFxRate,
    })
  }, [holdings, lots, buckets, priceHistoryMap, currentPriceSimpleMap, fxHistoryMap, currentFxRate])

  // Formato para Recharts LineChart
  const chartData = useMemo(() => {
    return gainSeries.map((item) => ({
      key: item.date,
      label: item.label,
      date: item.date,
      gainMXN: item.gainLossCentsMXN / 100, // en pesos para el eje Y
      gainCentsMXN: item.gainLossCentsMXN,
      gainCentsUSD: item.gainLossCentsUSD,
      valueCentsMXN: item.totalValueCentsMXN,
      valueCentsUSD: item.totalValueCentsUSD,
      costCentsMXN: item.totalCostCentsMXN,
      gainPct: item.gainLossPercent,
    }))
  }, [gainSeries])

  const latestGain = useMemo(() => {
    if (chartData.length === 0) return null
    const last = chartData[chartData.length - 1]
    return {
      gainMXN: last.gainCentsMXN,
      gainUSD: last.gainCentsUSD,
      gainPct: last.gainPct,
      totalValueMXN: last.valueCentsMXN,
      totalValueUSD: last.valueCentsUSD,
    }
  }, [chartData])

  if (loading && holdings.length === 0) {
    return (
      <div
        className="rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-2 min-h-[260px] animate-pulse"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <span className="text-xs text-[var(--text-muted)] font-mono">
          Cargando inversiones...
        </span>
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-2 min-h-[260px]"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <AlertCircle size={24} className="text-[var(--red-400)]" />
        <span className="text-xs text-[var(--red-400)] font-medium">{error}</span>
      </div>
    )
  }

  if (holdings.length === 0) {
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
            background: 'var(--bg-elevated)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-default)',
          }}
        >
          <Layers size={24} />
        </div>
        <div className="flex flex-col gap-1 max-w-xs">
          <h4 className="font-semibold text-sm text-[var(--text-primary)]">
            Sin inversiones registradas
          </h4>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Agrega tus activos (acciones o criptos) en la sección de inversiones para monitorear el rendimiento en tiempo real.
          </p>
        </div>
      </div>
    )
  }

  const isPositive = (latestGain?.gainMXN || 0) >= 0
  const gainColor = isPositive ? 'var(--orange-400)' : 'var(--red-400)'
  const gainBg = isPositive ? 'var(--orange-900)' : 'var(--red-900)'
  const gainBorder = isPositive ? 'var(--orange-700)' : 'var(--red-600)'

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
              background: gainBg,
              color: gainColor,
              border: `1px solid ${gainBorder}`,
            }}
          >
            {isPositive ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
          </div>
          <div>
            <h3
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 'var(--font-size-base)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Inversiones
            </h3>
            <span className="text-xs text-[var(--text-muted)]">
              Rendimiento total ({holdings.length} {holdings.length === 1 ? 'activo' : 'activos'})
            </span>
          </div>
        </div>

        {/* Badge de Ganancia / Pérdida Global */}
        <div className="text-right">
          <div className="flex items-baseline justify-end gap-1.5">
            <span
              className="text-xl font-bold font-mono tracking-tight tabular-nums"
              style={{ color: gainColor, fontVariantNumeric: 'tabular-nums' }}
            >
              {isPositive ? '+' : ''}
              {formatMoney(latestGain?.gainMXN || 0)}
            </span>
            <span
              className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-full"
              style={{
                background: gainBg,
                color: gainColor,
                border: `1px solid ${gainBorder}`,
              }}
            >
              {isPositive ? '▲' : '▼'} {Math.abs(latestGain?.gainPct || 0)}%
            </span>
          </div>
          <span className="text-[10px] text-[var(--text-muted)] font-mono block">
            Valor: {formatMoney(latestGain?.totalValueMXN || 0)} ≈ {formatMoney(latestGain?.totalValueUSD || 0, 'USD')}
          </span>
        </div>
      </div>

      {/* ── Gráfica Lineal Recharts (Todas las inversiones) ── */}
      <div className="w-full h-56 relative">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            margin={{ top: 12, right: 12, left: -16, bottom: 0 }}
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
                  const isPtPositive = data.gainCentsMXN >= 0
                  return (
                    <div
                      className="rounded-xl p-3 shadow-xl text-xs font-mono"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <div className="text-[11px] font-sans font-semibold text-[var(--text-secondary)] mb-1">
                        {data.label}
                      </div>
                      <div
                        className="font-bold text-sm"
                        style={{ color: isPtPositive ? 'var(--orange-400)' : 'var(--red-400)' }}
                      >
                        {isPtPositive ? '+' : ''}{formatMoney(data.gainCentsMXN)} ({isPtPositive ? '+' : ''}{data.gainPct}%)
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] mt-1">
                        Valor portafolio: {formatMoney(data.valueCentsMXN)}
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Line
              type="monotone"
              dataKey="gainMXN"
              stroke={gainColor}
              strokeWidth={2.5}
              dot={{
                r: 3.5,
                fill: gainColor,
                stroke: 'var(--bg-surface)',
                strokeWidth: 2,
              }}
              activeDot={{
                r: 6,
                fill: gainColor,
                stroke: 'var(--bg-base)',
                strokeWidth: 2.5,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* ── Resumen de Accesibilidad Textual ── */}
      <div className="pt-2 border-t border-[var(--border-subtle)] flex items-start gap-2 text-xs text-[var(--text-secondary)]">
        <Info size={14} className="mt-0.5 shrink-0 text-[var(--text-muted)]" />
        <p className="leading-relaxed">
          Rendimiento consolidado del portafolio en el periodo: {isPositive ? 'ganancia' : 'pérdida'} de{' '}
          <strong style={{ color: gainColor }}>{formatMoney(latestGain?.gainMXN || 0)}</strong> ({latestGain?.gainPct || 0}%), sobre un valor total de {formatMoney(latestGain?.totalValueMXN || 0)}.
        </p>
      </div>
    </div>
  )
}

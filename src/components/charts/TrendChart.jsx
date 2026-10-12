/**
 * src/components/charts/TrendChart.jsx
 *
 * Gráfica de tendencia temporal de ingresos vs. gastos.
 *
 * Incluye:
 *   - Recharts BarChart interactivo.
 *   - Barras de Ingresos (Naranja acento) y Gastos (Gris elevado / neutro).
 *   - Tooltip oscuro formateado en MXN.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatMoney } from '../../lib/format.js'

export default function TrendChart({ trendData = [] }) {
  if (!trendData || trendData.length === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center text-xs text-[var(--text-muted)] flex flex-col items-center justify-center gap-1.5 min-h-[220px]"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="w-12 h-12 rounded-full border-2 border-dashed border-[var(--border-default)] mb-2" />
        <span>Sin datos de tendencia en este periodo</span>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between">
        <h3
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'var(--font-size-base)',
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        >
          Tendencia de flujo
        </h3>
        <span className="text-xs text-[var(--text-muted)]">
          Ingresos vs. Gastos
        </span>
      </div>

      <div className="w-full h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
              tickFormatter={(val) => `$${val}`}
            />
            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const inc = payload.find(p => p.dataKey === 'income')?.value || 0
                  const exp = payload.find(p => p.dataKey === 'expense')?.value || 0

                  return (
                    <div
                      className="rounded-xl p-2.5 shadow-xl text-xs font-mono"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        color: 'white',
                      }}
                    >
                      <div className="text-[11px] font-sans font-semibold text-[var(--text-secondary)] mb-1">
                        {label}
                      </div>
                      <div className="text-[var(--orange-400)] font-bold">
                        Ingresos: {formatMoney(inc * 100)}
                      </div>
                      <div className="text-[var(--text-primary)] font-bold">
                        Gastos: {formatMoney(exp * 100)}
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
              formatter={(value) => (value === 'income' ? 'Ingresos' : 'Gastos')}
            />
            <Bar
              dataKey="income"
              name="income"
              fill="var(--orange-400)"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
            <Bar
              dataKey="expense"
              name="expense"
              fill="#6B6B6B"
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

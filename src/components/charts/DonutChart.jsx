/**
 * src/components/charts/DonutChart.jsx
 *
 * Gráfica de dona de gastos por categoría en la escala de tonos naranja.
 *
 * Incluye:
 *   - Recharts Pie/Donut con radio interno y externo.
 *   - Tooltip oscuro formateado con montos en pesos.
 *   - Leyenda detallada con porcentaje y monto por categoría.
 */

import { useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { formatMoney } from '../../lib/format.js'

// Escala de naranjas del sistema de diseño para donut slots
const ORANGE_DONUT_PALETTE = [
  '#FF7A1A', // --donut-1
  '#FF9A45', // --donut-2
  '#FFBA80', // --donut-3
  '#FFE0C0', // --donut-4
  '#C45200', // --donut-5
  '#8A3A00', // --donut-6
  '#F59E0B', // --donut-7
  '#6B6B6B', // --donut-8
]

export default function DonutChart({
  categoryBreakdown = [],
  totalExpense = 0,
}) {
  const [activeIndex, setActiveIndex] = useState(null)

  if (!categoryBreakdown || categoryBreakdown.length === 0 || totalExpense === 0) {
    return (
      <div
        className="rounded-2xl p-8 text-center text-xs text-[var(--text-muted)] flex flex-col items-center justify-center gap-1.5 min-h-[220px]"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="w-12 h-12 rounded-full border-2 border-dashed border-[var(--border-default)] mb-2" />
        <span>Sin gastos registrados en este periodo</span>
      </div>
    )
  }

  // Mapear datos para Recharts (montos en pesos para la gráfica)
  const chartData = categoryBreakdown.map((item, idx) => ({
    name: item.name,
    value: item.amount / 100, // pesos
    cents: item.amount,
    percentage: item.percentage,
    color: item.color || ORANGE_DONUT_PALETTE[idx % ORANGE_DONUT_PALETTE.length],
  }))

  const activeItem = activeIndex !== null ? chartData[activeIndex] : null

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
          Gastos por categoría
        </h3>
        <span
          className="text-xs font-mono font-semibold text-[var(--text-secondary)]"
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          Total: {formatMoney(totalExpense)}
        </span>
      </div>

      {/* ── Contenedor del Donut y Centro Hero ── */}
      <div className="relative w-full h-56 flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
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
                        color: 'white',
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1 font-sans font-semibold">
                        <span
                          className="w-2.5 h-2.5 rounded-full inline-block"
                          style={{ background: data.color }}
                        />
                        <span>{data.name}</span>
                      </div>
                      <div className="text-[var(--orange-400)] font-bold">
                        {formatMoney(data.cents)} ({data.percentage}%)
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={85}
              paddingAngle={3}
              stroke="var(--bg-surface)"
              strokeWidth={2}
              onMouseEnter={(_, index) => setActiveIndex(index)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  style={{
                    outline: 'none',
                    filter: activeIndex === index ? 'brightness(1.15)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 150ms ease-out',
                  }}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Texto al centro del Donut */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
          <span className="text-[10px] uppercase font-semibold text-[var(--text-muted)] tracking-wider">
            {activeItem ? activeItem.name : 'Gasto'}
          </span>
          <span
            className="text-base font-bold text-white font-mono"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {activeItem ? formatMoney(activeItem.cents) : formatMoney(totalExpense)}
          </span>
          {activeItem && (
            <span className="text-[10px] text-[var(--orange-400)] font-semibold font-mono">
              {activeItem.percentage}%
            </span>
          )}
        </div>
      </div>

      {/* ── Leyenda Detallada ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        {chartData.map((item, idx) => (
          <div
            key={idx}
            className="flex items-center justify-between p-1.5 rounded-lg text-xs hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
            onMouseEnter={() => setActiveIndex(idx)}
            onMouseLeave={() => setActiveIndex(null)}
          >
            <div className="flex items-center gap-2 truncate">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ background: item.color }}
              />
              <span className="text-white truncate">{item.name}</span>
            </div>

            <div className="flex items-center gap-2 font-mono flex-shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>
              <span className="text-[var(--text-secondary)] font-semibold">{formatMoney(item.cents)}</span>
              <span className="text-[var(--text-muted)] text-[11px] w-10 text-right">{item.percentage}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

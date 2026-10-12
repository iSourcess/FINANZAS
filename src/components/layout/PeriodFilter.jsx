/**
 * src/components/layout/PeriodFilter.jsx
 *
 * Selector de periodo temporal para la pantalla Panorama.
 * Opciones: Semana · Mes · Año · Todo · Rango
 */

import { useState } from 'react'
import { Calendar } from 'lucide-react'

export default function PeriodFilter({
  selectedPeriod = 'month',
  onSelectPeriod,
  customRange = { startDate: '', endDate: '' },
  onChangeCustomRange,
}) {
  const [showCustomPicker, setShowCustomPicker] = useState(false)

  const TABS = [
    { id: 'week', label: 'Semana' },
    { id: 'month', label: 'Mes' },
    { id: 'year', label: 'Año' },
    { id: 'all', label: 'Todo' },
    { id: 'custom', label: 'Rango' },
  ]

  const handleTabClick = (id) => {
    onSelectPeriod(id)
    if (id === 'custom') {
      setShowCustomPicker(true)
    } else {
      setShowCustomPicker(false)
    }
  }

  return (
    <div className="w-full flex flex-col gap-2.5">
      {/* ── Tabs de Navegación ── */}
      <div
        className="w-full flex items-center p-1 rounded-xl overflow-x-auto scrollbar-none"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        {TABS.map((tab) => {
          const isActive = selectedPeriod === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabClick(tab.id)}
              className={`flex-1 min-w-[64px] py-1.5 px-3 rounded-lg text-xs font-semibold text-center transition-all ${
                isActive
                  ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ── Selector de Fechas para Rango Personalizado ── */}
      {(selectedPeriod === 'custom' || showCustomPicker) && (
        <div
          className="flex items-center gap-2 p-3 rounded-xl animate-in fade-in duration-200"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Calendar size={16} className="text-[var(--orange-400)] flex-shrink-0" />
          <div className="flex-1 flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Desde</label>
              <input
                type="date"
                value={customRange.startDate || ''}
                onChange={(e) =>
                  onChangeCustomRange?.({ ...customRange, startDate: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded-lg text-xs text-white outline-none"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                }}
              />
            </div>
            <div className="flex-1 min-w-[120px]">
              <label className="block text-[10px] text-[var(--text-muted)] mb-0.5">Hasta</label>
              <input
                type="date"
                value={customRange.endDate || ''}
                onChange={(e) =>
                  onChangeCustomRange?.({ ...customRange, endDate: e.target.value })
                }
                className="w-full px-2.5 py-1.5 rounded-lg text-xs text-white outline-none"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

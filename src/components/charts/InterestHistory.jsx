/**
 * src/components/charts/InterestHistory.jsx
 *
 * Historial de rendimientos acreditados agrupados por mes.
 *
 * - Para el pasado: lee interestAccruals (acreditaciones reales al saldo).
 * - Muestra una línea colapsable por mes: "Rendimientos de octubre 2026".
 * - Al expandir, muestra el detalle de días acreditados y monto.
 * - No aparecen como movimientos individuales en el historial.
 */

import { useState, useEffect, useMemo } from 'react'
import { Sparkles, ChevronDown, ChevronRight } from 'lucide-react'
import { groupAccrualsByMonthAndAccount } from '../../domain/interestAccrual.js'
import { formatMoney, formatDate } from '../../lib/format.js'
import { getCardTheme } from '../../lib/constants.js'
import { db } from '../../db/database.js'

export default function InterestHistory({
  startDate,
  endDate,
  accounts = [],
  typeFilter = 'all',
  searchTerm = '',
}) {
  const [accruals, setAccruals] = useState([])
  const [expandedKey, setExpandedKey] = useState(null)

  // Cargar acreditaciones del periodo
  useEffect(() => {
    let isMounted = true
    async function load() {
      try {
        let rows
        if (startDate && endDate) {
          rows = await db.interestAccruals
            .where('date')
            .between(startDate, endDate, true, true)
            .toArray()
        } else {
          rows = await db.interestAccruals.toArray()
        }
        if (isMounted) setAccruals(rows || [])
      } catch {
        if (isMounted) setAccruals([])
      }
    }
    load()
    return () => {
      isMounted = false
    }
  }, [startDate, endDate])

  // Agrupar por mes Y por cuenta
  const groups = useMemo(() => {
    const list = groupAccrualsByMonthAndAccount(accruals, accounts)
    if (!searchTerm.trim()) return list
    const q = searchTerm.toLowerCase()
    return list.filter(
      (g) =>
        g.label.toLowerCase().includes(q) ||
        (g.accountName || '').toLowerCase().includes(q)
    )
  }, [accruals, accounts, searchTerm])

  // Si el usuario filtra por gastos, los rendimientos no deben verse
  if (typeFilter === 'expense') return null

  if (groups.length === 0) return null

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => {
        const isExpanded = expandedKey === group.key
        const theme = group.account ? getCardTheme(group.account.themeKey) : null

        return (
          <div
            key={group.key}
            className="rounded-xl overflow-hidden transition-all"
            style={{
              background: 'var(--bg-surface)',
              border: isExpanded ? '1px solid var(--orange-500)' : '1px solid var(--border-subtle)',
            }}
          >
            {/* Fila de mes por cuenta (colapsable) */}
            <button
              type="button"
              onClick={() => setExpandedKey(isExpanded ? null : group.key)}
              aria-expanded={isExpanded}
              aria-label={`${group.label}, ${group.accountName}, ${group.days} días, ${formatMoney(group.amountCents)}`}
              className="w-full flex items-center justify-between p-3 text-left transition-colors cursor-pointer"
              style={{
                background: isExpanded ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                minHeight: '44px',
              }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'var(--orange-950)',
                    color: 'var(--orange-400)',
                    border: '1px solid var(--orange-900)',
                  }}
                >
                  <Sparkles size={16} />
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-white truncate">
                      {group.label}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium"
                      style={{
                        background: 'var(--bg-overlay)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {group.days} {group.days === 1 ? 'día' : 'días'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)] mt-0.5">
                    {theme && (
                      <span
                        className="w-1.5 h-1.5 rounded-full inline-block flex-shrink-0"
                        style={{ background: theme.base }}
                      />
                    )}
                    <span className="truncate">{group.accountName}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <span
                  className="font-bold text-sm font-mono"
                  style={{ color: 'var(--orange-400)', fontVariantNumeric: 'tabular-nums' }}
                >
                  +{formatMoney(group.amountCents)}
                </span>
                <span className="text-[var(--text-muted)] p-1">
                  {isExpanded ? (
                    <ChevronDown size={16} className="text-[var(--orange-400)]" />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </span>
              </div>
            </button>

            {/* Detalle diario expandido */}
            {isExpanded && (
              <div
                className="flex flex-col divide-y border-t"
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                <div
                  className="px-4 py-2 text-[10px] uppercase tracking-wider font-semibold flex items-center justify-between"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <span>Fecha y saldo base</span>
                  <span>Tasa · Rendimiento</span>
                </div>

                {group.entries.map((entry) => (
                  <div
                    key={entry.id || entry.date}
                    className="flex items-center justify-between px-4 py-2.5 text-xs transition-colors hover:bg-[var(--bg-overlay)]"
                  >
                    <div className="flex flex-col">
                      <span className="font-mono text-white font-medium">
                        {formatDate(entry.date)}
                      </span>
                      {entry.baseCents > 0 && (
                        <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                          Base: {formatMoney(entry.baseCents)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-mono"
                        style={{
                          background: 'var(--bg-overlay)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {(entry.rate * 100).toFixed(1)}%
                      </span>
                      <span
                        className="font-bold text-[var(--orange-400)] font-mono"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        +{formatMoney(entry.amountCents)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * src/pages/Overview/OverviewPage.jsx
 *
 * Pantalla Panorama financiero.
 *
 * Incluye:
 *   - PeriodFilter (Semana · Mes · Año · Todo · Rango)
 *   - Tarjetas resumen (Ingresos, Gastos, Balance con ícono y texto explícito de Superávit/Déficit)
 *   - DonutChart de gastos por categoría en escala de naranjas
 *   - TrendChart de ingresos vs. gastos en el tiempo
 *   - Bloques vacíos para Presupuestos y Gastos Fijos
 *   - Historial de movimientos del periodo con búsqueda y filtros
 */

import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  Scale,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  ArrowRightLeft,
  UtensilsCrossed,
  Car,
  Home,
  Zap,
  HeartPulse,
  Gamepad2,
  ShoppingBag,
  GraduationCap,
  MoreHorizontal,
  Banknote,
  PiggyBank,
  CalendarDays,
  Settings,
  Check,
} from 'lucide-react'
import { useMovements } from '../../store/useMovements.js'
import { useAccounts } from '../../store/useAccounts.js'
import { useBudgets } from '../../store/useBudgets.js'
import PeriodFilter from '../../components/layout/PeriodFilter.jsx'
import DonutChart from '../../components/charts/DonutChart.jsx'
import TrendChart from '../../components/charts/TrendChart.jsx'
import BudgetBar from '../../components/charts/BudgetBar.jsx'
import Button from '../../components/ui/Button.jsx'
import { getPeriodRange, getPreviousPeriodRange, isDateInRange } from '../../domain/periods.js'
import { calculatePeriodSummaries } from '../../domain/summaries.js'
import { calculateBudgetsSummary } from '../../domain/budgets.js'
import { formatMoney, formatDate } from '../../lib/format.js'
import { getCardTheme } from '../../lib/constants.js'

const ICON_MAP = {
  UtensilsCrossed,
  Car,
  Home,
  Zap,
  HeartPulse,
  Gamepad2,
  ShoppingBag,
  GraduationCap,
  MoreHorizontal,
  Banknote,
  TrendingUp,
}

export default function OverviewPage() {
  const navigate = useNavigate()
  const { movements, categories, fetchMovements } = useMovements()
  const { accounts, fetchAccounts } = useAccounts()
  const { budgets, fixedExpenses, pendingRecurring, fetchBudgets, confirmRecurringExpense } = useBudgets()

  // Estado del filtro de periodo
  const [periodType, setPeriodType] = useState('month')
  const [customRange, setCustomRange] = useState({
    startDate: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
  })

  // Filtros del historial
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'expense' | 'income'
  const [categoryFilter, setCategoryFilter] = useState('all')

  useEffect(() => {
    fetchMovements()
    fetchAccounts()
    fetchBudgets()
  }, [fetchMovements, fetchAccounts, fetchBudgets])

  // Calcular fechas del periodo actual y anterior
  const { currentRange, prevRange } = useMemo(() => {
    const curr = getPeriodRange(periodType, new Date(), customRange)
    const prev = getPreviousPeriodRange(periodType, new Date(), customRange)
    return { currentRange: curr, prevRange: prev }
  }, [periodType, customRange])

  // Calcular resúmenes del periodo
  const summary = useMemo(() => {
    return calculatePeriodSummaries({
      movements,
      categories,
      startDate: currentRange.startDate,
      endDate: currentRange.endDate,
      prevStartDate: prevRange?.startDate,
      prevEndDate: prevRange?.endDate,
    })
  }, [movements, categories, currentRange, prevRange])

  // Resumen de presupuestos de este mes
  const budgetsSummary = useMemo(() => {
    return calculateBudgetsSummary({
      budgets,
      movements,
      categories,
    })
  }, [budgets, movements, categories])

  // Mapas para categorías y cuentas
  const categoriesMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const accountsMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])

  // Filtrar movimientos del historial
  const filteredHistory = useMemo(() => {
    return movements.filter(m => {
      // 1. Debe estar en el periodo
      if (!isDateInRange(m.date, currentRange.startDate, currentRange.endDate)) return false

      // 2. Filtro por tipo
      if (typeFilter !== 'all' && m.type !== typeFilter) return false

      // 3. Filtro por categoría
      if (categoryFilter !== 'all' && m.categoryId !== categoryFilter) return false

      // 4. Búsqueda por texto (nota o categoría)
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase()
        const noteMatch = (m.note || '').toLowerCase().includes(query)
        const catName = categoriesMap.get(m.categoryId)?.name?.toLowerCase() || ''
        const catMatch = catName.includes(query)
        if (!noteMatch && !catMatch) return false
      }

      return true
    })
  }, [movements, currentRange, typeFilter, categoryFilter, searchTerm, categoriesMap])

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto flex flex-col gap-6">
      {/* ── Encabezado y Filtro de Periodo ── */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <h1
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              Panorama
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {currentRange.label}
              {currentRange.startDate && currentRange.endDate && (
                <span className="ml-1 text-[var(--text-muted)] font-mono">
                  ({currentRange.startDate} al {currentRange.endDate})
                </span>
              )}
            </p>
          </div>
        </div>

        <PeriodFilter
          selectedPeriod={periodType}
          onSelectPeriod={setPeriodType}
          customRange={customRange}
          onChangeCustomRange={setCustomRange}
        />
      </div>

      {/* ── Tarjetas Resumen (Hero Cards) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Ingresos */}
        <div
          className="rounded-2xl p-4 flex flex-col justify-between"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-2">
            <span className="font-semibold uppercase tracking-wider">Ingresos</span>
            <span className="p-1.5 rounded-lg bg-[var(--orange-900)] text-[var(--orange-400)]">
              <TrendingUp size={16} />
            </span>
          </div>

          <div>
            <span
              className="block text-2xl font-bold font-mono text-white tracking-tight"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatMoney(summary.totalIncome)}
            </span>

            {summary.comparison.income && (
              <span className="text-[11px] text-[var(--text-secondary)] mt-1 block">
                {summary.comparison.income.percent >= 0 ? '+' : ''}
                {summary.comparison.income.percent}% vs. periodo ant.
              </span>
            )}
          </div>
        </div>

        {/* Gastos */}
        <div
          className="rounded-2xl p-4 flex flex-col justify-between"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-2">
            <span className="font-semibold uppercase tracking-wider">Gastos</span>
            <span className="p-1.5 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
              <TrendingDown size={16} />
            </span>
          </div>

          <div>
            <span
              className="block text-2xl font-bold font-mono text-white tracking-tight"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatMoney(summary.totalExpense)}
            </span>

            {summary.comparison.expense && (
              <span className="text-[11px] text-[var(--text-secondary)] mt-1 block">
                {summary.comparison.expense.percent >= 0 ? '+' : ''}
                {summary.comparison.expense.percent}% vs. periodo ant.
              </span>
            )}
          </div>
        </div>

        {/* Balance Neto (Superávit / Déficit con ícono y texto explícito) */}
        <div
          className="rounded-2xl p-4 flex flex-col justify-between"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-2">
            <span className="font-semibold uppercase tracking-wider">Balance Neto</span>
            <div className="flex items-center gap-1">
              {summary.balance >= 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--orange-900)] text-[var(--orange-400)] border border-[var(--orange-700)] flex items-center gap-1">
                  <CheckCircle2 size={12} /> Superávit
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--red-900)] text-[var(--red-400)] border border-[var(--red-600)] flex items-center gap-1">
                  <AlertCircle size={12} /> Déficit
                </span>
              )}
            </div>
          </div>

          <div>
            <span
              className="block text-2xl font-bold font-mono tracking-tight"
              style={{
                color: summary.balance >= 0 ? 'var(--orange-400)' : 'var(--red-400)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {summary.balance >= 0 ? '+' : ''}{formatMoney(summary.balance)}
            </span>

            <span className="text-[11px] text-[var(--text-muted)] mt-1 block">
              {summary.balance >= 0 ? 'Flujo neto positivo' : 'Gastos superan ingresos'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Gráficas: Donut y Trend ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <DonutChart
          categoryBreakdown={summary.categoryBreakdown}
          totalExpense={summary.totalExpense}
        />
        <TrendChart trendData={summary.trendData} />
      </div>

      {/* ── Presupuestos y Gastos Fijos ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Presupuestos por Categoría */}
        <div
          className="rounded-2xl p-5 flex flex-col gap-3"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PiggyBank size={18} className="text-[var(--orange-400)]" />
              <h3
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Presupuestos
              </h3>
            </div>
            <button
              onClick={() => navigate('/ajustes')}
              className="text-xs text-[var(--orange-400)] hover:text-[var(--orange-300)] flex items-center gap-1 font-medium transition-colors"
              title="Administrar presupuestos en Ajustes"
            >
              <Settings size={13} />
              Configurar
            </button>
          </div>

          {budgetsSummary.items.length === 0 ? (
            <div className="py-6 flex flex-col items-center justify-center text-center gap-2">
              <PiggyBank size={28} className="text-[var(--text-muted)] opacity-50" />
              <p className="text-xs text-[var(--text-muted)] max-w-xs">
                No tienes límites configurados. Define presupuestos mensuales por categoría para monitorear alertas de gasto.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/ajustes')}
                className="mt-1 text-xs"
              >
                Definir presupuestos
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Resumen global */}
              <div
                className="p-3 rounded-xl flex items-center justify-between text-xs"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex flex-col">
                  <span className="text-[11px] text-[var(--text-muted)]">Gasto total vs. límite</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {formatMoney(budgetsSummary.totalSpent)} / {formatMoney(budgetsSummary.totalLimit)}
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                    style={{
                      background:
                        budgetsSummary.overallPercent > 100
                          ? 'var(--red-900)'
                          : budgetsSummary.overallPercent >= 80
                          ? 'rgba(245, 158, 11, 0.15)'
                          : 'var(--orange-900)',
                      color:
                        budgetsSummary.overallPercent > 100
                          ? 'var(--red-400)'
                          : budgetsSummary.overallPercent >= 80
                          ? '#F59E0B'
                          : 'var(--orange-400)',
                    }}
                  >
                    {Math.round(budgetsSummary.overallPercent)}% del total
                  </span>
                </div>
              </div>

              {/* Lista de barras de presupuesto */}
              <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
                {budgetsSummary.items.map(item => (
                  <BudgetBar
                    key={item.categoryId}
                    categoryName={item.categoryName}
                    spentCents={item.spentCents}
                    limitCents={item.limitCents}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Gastos Fijos Mensuales */}
        <div
          className="rounded-2xl p-5 flex flex-col gap-3"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays size={18} className="text-[var(--orange-400)]" />
              <h3
                style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 'var(--font-size-base)',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                Gastos fijos del mes
              </h3>
            </div>
            <button
              onClick={() => navigate('/ajustes')}
              className="text-xs text-[var(--orange-400)] hover:text-[var(--orange-300)] flex items-center gap-1 font-medium transition-colors"
              title="Administrar gastos fijos en Ajustes"
            >
              <Settings size={13} />
              Configurar
            </button>
          </div>

          {fixedExpenses.length === 0 ? (
            <div className="py-6 flex flex-col items-center justify-center text-center gap-2">
              <CalendarDays size={28} className="text-[var(--text-muted)] opacity-50" />
              <p className="text-xs text-[var(--text-muted)] max-w-xs">
                No tienes gastos fijos registrados. Agrega suscripciones, renta o servicios para confirmarlos cada mes.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/ajustes')}
                className="mt-1 text-xs"
              >
                Agregar gasto fijo
              </Button>
            </div>
          ) : pendingRecurring.length === 0 ? (
            <div className="py-8 flex flex-col items-center justify-center text-center gap-2">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(34, 197, 94, 0.1)' }}
              >
                <CheckCircle2 size={22} className="text-emerald-400" />
              </div>
              <p className="text-xs font-semibold text-emerald-400">
                ¡Al día con tus gastos fijos!
              </p>
              <p className="text-[11px] text-[var(--text-muted)] max-w-xs">
                Todos los pagos recurrentes de este mes ya han sido confirmados y registrados.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-72 overflow-y-auto pr-1">
              <p className="text-[11px] text-[var(--text-muted)]">
                {pendingRecurring.length} {pendingRecurring.length === 1 ? 'pago pendiente' : 'pagos pendientes'} este mes:
              </p>
              {pendingRecurring.map(item => {
                const isOverdue = item.isOverdue
                const isDueToday = item.isDueToday
                const cat = categoriesMap.get(item.fixedExpense.categoryId)
                const acc = accountsMap.get(item.fixedExpense.accountId)

                return (
                  <div
                    key={item.fixedExpense.id}
                    className="p-3 rounded-xl flex items-center justify-between gap-2 transition-colors"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: isOverdue ? '1px solid var(--red-700)' : '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-white truncate">
                          {item.fixedExpense.name}
                        </span>
                        {isOverdue && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[var(--red-900)] text-[var(--red-400)]">
                            Vencido
                          </span>
                        )}
                        {isDueToday && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[var(--orange-900)] text-[var(--orange-400)]">
                            Vence hoy
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-muted)] mt-0.5">
                        <span>Vence {item.dueDate.slice(8, 10)} de este mes</span>
                        {cat && <span>• {cat.name}</span>}
                        {acc && <span>• {acc.name}</span>}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-mono text-xs font-bold text-white tabular-nums">
                        {formatMoney(item.fixedExpense.amount)}
                      </span>
                      <button
                        onClick={async () => {
                          try {
                            await confirmRecurringExpense(item)
                            await fetchMovements()
                          } catch (err) {
                            console.error('Error al confirmar gasto fijo:', err)
                          }
                        }}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[var(--orange-500)] hover:bg-[var(--orange-400)] text-black transition-colors"
                        title="Confirmar y registrar movimiento"
                      >
                        <Check size={13} />
                        <span>Pagar</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Historial de Movimientos con Búsqueda y Filtros ── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'var(--font-size-lg)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Historial del periodo
          </h2>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            {filteredHistory.length} movimientos
          </span>
        </div>

        {/* Barra de Filtros y Búsqueda */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          {/* Búsqueda */}
          <div
            className="flex-1 w-full flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
            }}
          >
            <Search size={15} className="text-[var(--text-muted)]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nota o categoría..."
              className="w-full bg-transparent border-none outline-none text-xs text-white"
            />
          </div>

          {/* Filtro por Tipo */}
          <div className="flex items-center gap-1 p-1 rounded-xl w-full sm:w-auto" style={{ background: 'var(--bg-surface)' }}>
            {[
              { id: 'all', label: 'Todos' },
              { id: 'expense', label: 'Gastos' },
              { id: 'income', label: 'Ingresos' },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTypeFilter(t.id)}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  typeFilter === t.id
                    ? 'bg-[var(--bg-elevated)] text-[var(--orange-400)] font-bold'
                    : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Filtro por Categoría */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 rounded-xl text-xs text-white outline-none"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
            }}
          >
            <option value="all">Todas las categorías</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Lista de Movimientos */}
        {filteredHistory.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center text-xs text-[var(--text-muted)]"
            style={{
              background: 'var(--bg-surface)',
              border: '1px dashed var(--border-default)',
            }}
          >
            No se encontraron movimientos que coincidan con los filtros.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredHistory.map((movement) => {
              const category = categoriesMap.get(movement.categoryId)
              const account = accountsMap.get(movement.accountId)
              const destAccount = movement.toAccountId ? accountsMap.get(movement.toAccountId) : null

              const IconComp = movement.type === 'transfer'
                ? ArrowRightLeft
                : (category?.icon && ICON_MAP[category.icon] ? ICON_MAP[category.icon] : MoreHorizontal)

              const theme = account ? getCardTheme(account.themeKey) : null
              const isIncome = movement.type === 'income'
              const isTransfer = movement.type === 'transfer'

              return (
                <div
                  key={movement.id}
                  className="rounded-xl p-3 flex items-center justify-between gap-3"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
                      style={{
                        background: isTransfer
                          ? 'var(--bg-overlay)'
                          : (category?.color || 'var(--orange-400)'),
                      }}
                    >
                      <IconComp size={16} />
                    </span>

                    <div className="min-w-0">
                      <span className="block text-xs font-semibold text-white truncate">
                        {movement.note || (isTransfer ? 'Transferencia' : category?.name || 'Movimiento')}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] mt-0.5">
                        <span className="font-mono">{movement.date}</span>
                        {theme && (
                          <span
                            className="w-1.5 h-1.5 rounded-full inline-block"
                            style={{ background: theme.base }}
                          />
                        )}
                        <span className="truncate">
                          {isTransfer
                            ? `${account?.name} → ${destAccount?.name}`
                            : account?.name}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span
                      className="block font-bold text-sm font-mono"
                      style={{
                        color: isIncome
                          ? 'var(--orange-400)'
                          : isTransfer
                          ? 'var(--text-secondary)'
                          : 'var(--text-primary)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {isIncome ? '+' : isTransfer ? '' : '-'}{formatMoney(movement.amount, movement.currency)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}

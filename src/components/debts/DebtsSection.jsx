/**
 * src/components/debts/DebtsSection.jsx
 *
 * Pestaña "Deudas" para la pantalla de Cuentas.
 *
 * Muestra:
 *   1. Resumen superior: "Me deben $X · Debo $Y · Balance neto $Z" (convertido a MXN).
 *   2. Filtros: Todas / Me deben / Debo, y Abiertas / Saldadas.
 *   3. Vista agrupada por persona o listado individual.
 *   4. Barra de progreso por deuda con saldo restante y principal.
 *   5. Vencidas marcadas con ícono AlertTriangle y texto explícito "Vencida".
 *   6. Acciones: Registrar abono, Marcar como saldada, Editar y Eliminar.
 */

import { useState, useMemo } from 'react'
import {
  HandCoins,
  ArrowDownLeft,
  ArrowUpRight,
  Plus,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Trash2,
  Edit2,
  Check,
  ChevronDown,
  ChevronRight,
  Users,
  List,
} from 'lucide-react'
import Button from '../ui/Button.jsx'
import { formatMoney, formatDate } from '../../lib/format.js'
import { toISODate } from '../../domain/periods.js'
import {
  calculateDebtRemainingCents,
  calculateDebtProgressPercent,
  calculateDebtStatus,
  calculateDebtsSummary,
  isDebtOverdue,
  isDebtUpcoming,
} from '../../domain/debts.js'

export default function DebtsSection({
  debts = [],
  payments = [],
  debtPayments = [],
  summary = null,
  fxRate = 1800,
  loading = false,
  onOpenCreate,
  onNewDebt,
  onOpenEdit,
  onEditDebt,
  onOpenPayment,
  onRecordPayment,
  onSettleDebt,
  onReopenDebt,
  onDeleteDebt,
  onDeletePayment,
}) {
  const [directionFilter, setDirectionFilter] = useState('all') // 'all' | 'owed_to_me' | 'i_owe'
  const [statusFilter, setStatusFilter] = useState('open') // 'open' | 'settled' | 'all'
  const [viewMode, setViewMode] = useState('list') // 'list' | 'by_person'
  const [expandedDebtIds, setExpandedDebtIds] = useState(new Set())

  const todayStr = toISODate(new Date())

  const actualPayments = (payments && payments.length > 0) ? payments : (debtPayments || [])
  const actualSummary = useMemo(() => {
    return summary || calculateDebtsSummary({ debts, payments: actualPayments, fxRate })
  }, [summary, debts, actualPayments, fxRate])

  const handleOpenCreate = onOpenCreate || onNewDebt
  const handleOpenEdit = onOpenEdit || onEditDebt
  const handleOpenPayment = onOpenPayment || onRecordPayment

  const toggleExpand = (id) => {
    setExpandedDebtIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Filtrar deudas
  const filteredDebts = useMemo(() => {
    return debts.filter(d => {
      const status = calculateDebtStatus(d, actualPayments)
      if (statusFilter === 'open' && status !== 'open') return false
      if (statusFilter === 'settled' && status !== 'settled') return false
      if (directionFilter !== 'all' && d.direction !== directionFilter) return false
      return true
    })
  }, [debts, actualPayments, directionFilter, statusFilter])

  // Agrupar por persona si viewMode === 'by_person'
  const groupedByPerson = useMemo(() => {
    const map = new Map()
    for (const d of filteredDebts) {
      const key = d.person.toLowerCase()
      if (!map.has(key)) {
        map.set(key, {
          person: d.person,
          debts: [],
          totalOwedToMe: 0,
          totalIOwe: 0,
        })
      }
      const group = map.get(key)
      group.debts.push(d)
      const remaining = calculateDebtRemainingCents(d, actualPayments)
      if (d.direction === 'owed_to_me') {
        group.totalOwedToMe += remaining
      } else {
        group.totalIOwe += remaining
      }
    }
    return Array.from(map.values())
  }, [filteredDebts, actualPayments])

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-200">
      {/* ── Resumen Superior (Hero Card) ── */}
      {actualSummary && (
        <div
          className="rounded-2xl p-4 sm:p-5 flex flex-col gap-3"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HandCoins size={18} className="text-[var(--orange-400)]" />
              <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                Resumen de Préstamos y Deudas
              </span>
            </div>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              Consolidado en MXN
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Me deben */}
            <div
              className="p-3 rounded-xl flex flex-col justify-between"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
                <span>Me deben</span>
                <ArrowDownLeft size={14} className="text-[var(--orange-400)]" />
              </div>
              <span className="text-xl font-bold font-mono text-[var(--orange-400)] tabular-nums">
                {formatMoney(actualSummary.totalOwedToMeMXN)}
              </span>
              {actualSummary.owedToMeUSDCents > 0 && (
                <span className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  Incluye {formatMoney(actualSummary.owedToMeUSDCents, 'USD')}
                </span>
              )}
            </div>

            {/* Debo */}
            <div
              className="p-3 rounded-xl flex flex-col justify-between"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
                <span>Yo debo</span>
                <ArrowUpRight size={14} className="text-[var(--red-400)]" />
              </div>
              <span className="text-xl font-bold font-mono text-[var(--red-400)] tabular-nums">
                {formatMoney(actualSummary.totalIOweMXN)}
              </span>
              {actualSummary.iOweUSDCents > 0 && (
                <span className="text-[10px] text-[var(--text-muted)] mt-0.5">
                  Incluye {formatMoney(actualSummary.iOweUSDCents, 'USD')}
                </span>
              )}
            </div>

            {/* Saldo Neto */}
            <div
              className="p-3 rounded-xl flex flex-col justify-between"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] mb-1">
                <span>Balance neto</span>
                <span className="text-[10px] text-[var(--text-muted)]">
                  {actualSummary.netBalanceMXN >= 0 ? 'A favor' : 'En contra'}
                </span>
              </div>
              <span
                className="text-xl font-bold font-mono tabular-nums"
                style={{
                  color: actualSummary.netBalanceMXN >= 0 ? 'var(--orange-400)' : 'var(--red-400)',
                }}
              >
                {actualSummary.netBalanceMXN >= 0 ? '+' : ''}{formatMoney(actualSummary.netBalanceMXN)}
              </span>
              <span className="text-[10px] text-[var(--text-muted)] mt-0.5">
                {actualSummary.openCount} {actualSummary.openCount === 1 ? 'deuda activa' : 'deudas activas'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── Barra de Filtros y Controles ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Filtro Dirección */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'owed_to_me', label: 'Me deben' },
              { id: 'i_owe', label: 'Debo' },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setDirectionFilter(f.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  directionFilter === f.id
                    ? 'bg-[var(--orange-500)] text-black font-bold'
                    : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Filtro Estado */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs">
            {[
              { id: 'open', label: 'Abiertas' },
              { id: 'settled', label: 'Saldadas' },
              { id: 'all', label: 'Historial' },
            ].map(s => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStatusFilter(s.id)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  statusFilter === s.id
                    ? 'bg-[var(--bg-elevated)] text-[var(--orange-400)] font-bold'
                    : 'text-[var(--text-secondary)] hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Selector de Vista: Lista vs Por Persona */}
          <div className="flex items-center p-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              title="Vista en lista"
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'list'
                  ? 'bg-[var(--bg-elevated)] text-[var(--orange-400)]'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              <List size={15} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('by_person')}
              title="Agrupar por persona"
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'by_person'
                  ? 'bg-[var(--bg-elevated)] text-[var(--orange-400)]'
                  : 'text-[var(--text-muted)] hover:text-white'
              }`}
            >
              <Users size={15} />
            </button>
          </div>
        </div>

        {/* Botón Nueva Deuda */}
        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={handleOpenCreate}
          className="min-h-[44px]"
        >
          Nueva deuda
        </Button>
      </div>

      {/* ── Contenido de Deudas ── */}
      {filteredDebts.length === 0 ? (
        <div
          className="py-12 px-4 rounded-2xl flex flex-col items-center justify-center text-center gap-3"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)' }}
          >
            <HandCoins size={24} className="text-[var(--orange-400)]" />
          </div>
          <div className="flex flex-col gap-1 max-w-sm">
            <h3 className="text-sm font-semibold text-white">No hay deudas en esta sección</h3>
            <p className="text-xs text-[var(--text-muted)]">
              {statusFilter === 'settled'
                ? 'Aún no tienes deudas saldadas en el historial.'
                : 'Registra préstamos que hayas hecho a amigos o deudas que tengas pendientes.'}
            </p>
          </div>
          {statusFilter !== 'settled' && (
            <Button
              variant="primary"
              size="sm"
              icon={Plus}
              onClick={handleOpenCreate}
              className="min-h-[44px] mt-1"
            >
              Registrar deuda
            </Button>
          )}
        </div>
      ) : viewMode === 'by_person' ? (
        /* ── Vista Agrupada por Persona ── */
        <div className="flex flex-col gap-3">
          {groupedByPerson.map(group => (
            <div
              key={group.person}
              className="p-4 rounded-xl flex flex-col gap-3"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs"
                    style={{ background: 'var(--orange-900)', color: 'var(--orange-400)' }}
                  >
                    {group.person.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{group.person}</h3>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {group.debts.length} {group.debts.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right">
                  {group.totalOwedToMe > 0 && (
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] block">Te debe</span>
                      <span className="font-mono text-xs font-bold text-[var(--orange-400)]">
                        {formatMoney(group.totalOwedToMe)}
                      </span>
                    </div>
                  )}
                  {group.totalIOwe > 0 && (
                    <div>
                      <span className="text-[10px] text-[var(--text-muted)] block">Le debes</span>
                      <span className="font-mono text-xs font-bold text-[var(--red-400)]">
                        {formatMoney(group.totalIOwe)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Lista interna de deudas de esta persona */}
              <div className="flex flex-col gap-2">
                {group.debts.map(debt => (
                  <DebtCard
                    key={debt.id}
                    debt={debt}
                    payments={actualPayments}
                    todayStr={todayStr}
                    isExpanded={expandedDebtIds.has(debt.id)}
                    onToggleExpand={() => toggleExpand(debt.id)}
                    onOpenPayment={handleOpenPayment}
                    onSettleDebt={onSettleDebt}
                    onReopenDebt={onReopenDebt}
                    onOpenEdit={handleOpenEdit}
                    onDeleteDebt={onDeleteDebt}
                    onDeletePayment={onDeletePayment}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Vista en Lista Individual ── */
        <div className="flex flex-col gap-3">
          {filteredDebts.map(debt => (
            <DebtCard
              key={debt.id}
              debt={debt}
              payments={actualPayments}
              todayStr={todayStr}
              isExpanded={expandedDebtIds.has(debt.id)}
              onToggleExpand={() => toggleExpand(debt.id)}
              onOpenPayment={handleOpenPayment}
              onSettleDebt={onSettleDebt}
              onReopenDebt={onReopenDebt}
              onOpenEdit={handleOpenEdit}
              onDeleteDebt={onDeleteDebt}
              onDeletePayment={onDeletePayment}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Componente individual de tarjeta de deuda con barra de progreso y abonos desplegables.
 */
function DebtCard({
  debt,
  payments,
  todayStr,
  isExpanded,
  onToggleExpand,
  onOpenPayment,
  onSettleDebt,
  onReopenDebt,
  onOpenEdit,
  onDeleteDebt,
  onDeletePayment,
}) {
  const isOwedToMe = debt.direction === 'owed_to_me'
  const remaining = calculateDebtRemainingCents(debt, payments)
  const percent = calculateDebtProgressPercent(debt, payments)
  const status = calculateDebtStatus(debt, payments)
  const isOverdue = isDebtOverdue(debt, todayStr, payments)
  const isUpcoming = isDebtUpcoming(debt, todayStr, 7, payments)

  const debtPayments = payments.filter(p => p.debtId === debt.id)

  return (
    <div
      className="p-4 rounded-xl flex flex-col gap-3 transition-colors"
      style={{
        background: 'var(--bg-surface)',
        border: isOverdue ? '1px solid var(--red-600)' : '1px solid var(--border-subtle)',
        opacity: status === 'settled' ? 0.75 : 1,
      }}
    >
      {/* Encabezado: Dirección, persona, badges, montos */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm text-white truncate">
              {debt.person}
            </span>

            {/* Badge Dirección */}
            <span
              className="px-2 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1"
              style={{
                background: isOwedToMe ? 'var(--orange-900)' : 'var(--red-900)',
                color: isOwedToMe ? 'var(--orange-400)' : 'var(--red-400)',
              }}
            >
              {isOwedToMe ? <ArrowDownLeft size={12} /> : <ArrowUpRight size={12} />}
              <span>{isOwedToMe ? 'Me debe' : 'Le debo'}</span>
            </span>

            {/* Badge Vencida (ÍCONO + TEXTO OBLIGATORIO) */}
            {isOverdue && status === 'open' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--red-900)] text-[var(--red-400)] flex items-center gap-1">
                <AlertTriangle size={12} />
                <span>Vencida ({debt.dueDate})</span>
              </span>
            )}

            {/* Badge Próxima a vencer */}
            {isUpcoming && status === 'open' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--orange-900)] text-[var(--orange-400)] flex items-center gap-1">
                <Clock size={12} />
                <span>Vence {debt.dueDate}</span>
              </span>
            )}

            {/* Badge Saldada */}
            {status === 'settled' && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--bg-elevated)] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 size={12} />
                <span>Saldada</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-1 flex-wrap">
            <span>Inicio: {formatDate(debt.openedAt)}</span>
            {debt.dueDate && !isOverdue && !isUpcoming && (
              <span>• Límite: {formatDate(debt.dueDate)}</span>
            )}
            {debt.note && <span>• {debt.note}</span>}
          </div>
        </div>

        {/* Montos: Saldo restante y Principal */}
        <div className="text-right flex-shrink-0">
          <span
            className="block text-base font-bold font-mono tabular-nums"
            style={{
              color: status === 'settled'
                ? 'var(--text-muted)'
                : isOwedToMe
                ? 'var(--orange-400)'
                : 'var(--red-400)',
            }}
          >
            {formatMoney(remaining, debt.currency)}
          </span>
          <span className="text-[11px] text-[var(--text-muted)] font-mono block">
            de {formatMoney(debt.principalCents, debt.currency)}
          </span>
        </div>
      </div>

      {/* Barra de progreso */}
      <div className="flex flex-col gap-1">
        <div className="w-full h-2 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${percent}%`,
              background: status === 'settled' ? 'var(--text-muted)' : 'var(--orange-500)',
            }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)]">
          <span>{percent}% abonado</span>
          {debtPayments.length > 0 && (
            <button
              type="button"
              onClick={onToggleExpand}
              className="text-[var(--text-secondary)] hover:text-white flex items-center gap-1 font-semibold"
            >
              <span>{debtPayments.length} {debtPayments.length === 1 ? 'abono' : 'abonos'}</span>
              {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </button>
          )}
        </div>
      </div>

      {/* Lista desplegable de abonos registrados */}
      {isExpanded && debtPayments.length > 0 && (
        <div
          className="p-2.5 rounded-lg flex flex-col gap-1.5 text-xs"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
        >
          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
            Historial de abonos:
          </span>
          {debtPayments.map(p => (
            <div
              key={p.id}
              className="flex items-center justify-between py-1 border-b border-[var(--border-subtle)] last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-[var(--text-muted)]">{p.date}</span>
                {p.adjustmentId && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-[var(--bg-surface)] text-[var(--text-secondary)]">
                    Cuenta bancaria afectada
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-white">
                  +{formatMoney(p.amountCents, debt.currency)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('¿Eliminar este abono y revertir el saldo de la cuenta si aplica?')) {
                      onDeletePayment(p.id)
                    }
                  }}
                  className="p-1 text-[var(--text-muted)] hover:text-[var(--red-400)] transition-colors"
                  title="Eliminar abono"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)] flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {status === 'open' ? (
            <>
              <button
                type="button"
                onClick={() => onOpenPayment(debt)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--orange-500)] text-black hover:bg-[var(--orange-400)] transition-colors"
                style={{ minHeight: '44px' }}
              >
                <Plus size={14} />
                <span>Registrar abono</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`¿Marcar como saldada la deuda con ${debt.person}?`)) {
                    onSettleDebt(debt.id)
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-white transition-colors"
                style={{ minHeight: '44px' }}
                title="Marcar como saldada sin registrar más abonos"
              >
                <Check size={14} />
                <span>Saldar</span>
              </button>
            </>
          ) : (
            onReopenDebt && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`¿Reabrir la deuda con ${debt.person}?`)) {
                    onReopenDebt(debt.id)
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-default)] text-[var(--text-secondary)] hover:text-white transition-colors"
                style={{ minHeight: '44px' }}
                title="Reabrir deuda"
              >
                <Clock size={14} />
                <span>Reabrir</span>
              </button>
            )
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpenEdit(debt)}
            aria-label={`Editar deuda de ${debt.person}`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-white transition-colors"
          >
            <Edit2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`¿Eliminar la deuda con "${debt.person}" y todos sus abonos?`)) {
                onDeleteDebt(debt.id)
              }
            }}
            aria-label={`Eliminar deuda de ${debt.person}`}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--red-400)] transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * src/components/goals/SavingsGoalsSection.jsx
 *
 * Sección de Metas de Ahorro para la pantalla Panorama (Overview).
 *
 * Características:
 *   - Barra de progreso interactiva con porcentaje y montos en pesos.
 *   - Proyección de ahorro sugerido (mensual/diario) si hay fecha objetivo.
 *   - Aportes vinculados a cuentas bancarias/efectivo con badges por cuenta.
 *   - Botón directo "+ Aportar" para registrar fondos sin salir del Panorama.
 *   - Historial desplegable de aportes con opción de eliminar aportes individuales.
 *   - Modales accesibles para crear/editar metas y registrar aportes.
 */

import { useState, useMemo } from 'react'
import {
  Target,
  Plus,
  Coins,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Calendar,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { useGoals } from '../../store/useGoals.js'
import { useAccounts } from '../../store/useAccounts.js'
import { calculateGoalProgress, calculateAllGoalsSummary } from '../../domain/goals.js'
import { formatMoney, formatDate, accountLabel } from '../../lib/format.js'
import GoalProgressBar from './GoalProgressBar.jsx'
import GoalFormModal from './GoalFormModal.jsx'
import GoalContributionModal from './GoalContributionModal.jsx'
import Button from '../ui/Button.jsx'

export default function SavingsGoalsSection() {
  const { goals, contributions, deleteGoal, deleteContribution } = useGoals()
  const { accounts } = useAccounts()

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState(null)
  const [contributeGoal, setContributeGoal] = useState(null)
  const [expandedGoalId, setExpandedGoalId] = useState(null)

  const accountsMap = useMemo(() => new Map(accounts.map(a => [a.id, a])), [accounts])

  const summary = useMemo(() => {
    return calculateAllGoalsSummary({
      goals,
      contributions,
      referenceDate: new Date(),
    })
  }, [goals, contributions])

  const handleOpenCreate = () => {
    setEditingGoal(null)
    setIsGoalModalOpen(true)
  }

  const handleOpenEdit = (goal) => {
    setEditingGoal(goal)
    setIsGoalModalOpen(true)
  }

  const handleDeleteGoal = async (goal) => {
    if (window.confirm(`¿Seguro que deseas eliminar la meta "${goal.name}" y todos sus aportes registrados?`)) {
      try {
        await deleteGoal(goal.id)
      } catch (err) {
        console.error('Error al eliminar meta:', err)
      }
    }
  }

  const handleDeleteContribution = async (contribId) => {
    if (window.confirm('¿Deseas revertir o eliminar este aporte?')) {
      try {
        await deleteContribution(contribId)
      } catch (err) {
        console.error('Error al eliminar aporte:', err)
      }
    }
  }

  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* ── Encabezado de la Sección ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="p-1.5 rounded-lg bg-[var(--orange-900)] text-[var(--orange-400)]">
            <Target size={18} />
          </span>
          <h3
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'var(--font-size-base)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Metas de ahorro
          </h3>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleOpenCreate}
          className="text-xs flex items-center gap-1.5"
        >
          <Plus size={14} />
          <span>Nueva meta</span>
        </Button>
      </div>

      {/* ── Estado Vacío ── */}
      {goals.length === 0 ? (
        <div className="py-8 flex flex-col items-center justify-center text-center gap-2.5">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
          >
            <Coins size={24} className="text-[var(--orange-400)] opacity-70" />
          </div>
          <p className="text-xs text-[var(--text-muted)] max-w-xs">
            No tienes metas de ahorro activas. Define objetivos como fondo para emergencias o viajes y registra aportes desde tus cuentas.
          </p>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenCreate}
            className="mt-1 text-xs"
          >
            Crear primera meta
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Banner de progreso consolidado (si hay más de 1 meta) */}
          {goals.length > 1 && (
            <div
              className="p-3.5 rounded-xl flex items-center justify-between text-xs"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex flex-col">
                <span className="text-[11px] text-[var(--text-muted)]">
                  Total acumulado ({summary.completedCount} de {summary.totalGoalsCount} cumplidas)
                </span>
                <span className="font-mono font-bold text-white tabular-nums">
                  {formatMoney(summary.totalSavedCents)} / {formatMoney(summary.totalTargetCents)}
                </span>
              </div>
              <div className="text-right">
                <span
                  className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                  style={{
                    background: summary.overallPercent >= 100 ? 'rgba(16, 185, 129, 0.15)' : 'var(--orange-900)',
                    color: summary.overallPercent >= 100 ? '#10B981' : 'var(--orange-400)',
                    border: `1px solid ${summary.overallPercent >= 100 ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-subtle)'}`,
                  }}
                >
                  {summary.overallPercent}% global
                </span>
              </div>
            </div>
          )}

          {/* Lista de Metas */}
          <div className="flex flex-col gap-3">
            {summary.items.map((item) => {
              const rawGoal = goals.find(g => g.id === item.goalId)
              const isExpanded = expandedGoalId === item.goalId
              const goalContribs = contributions.filter(c => c.goalId === item.goalId)

              return (
                <div
                  key={item.goalId}
                  className="p-4 rounded-xl flex flex-col gap-3 transition-colors"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: item.isCompleted
                      ? '1px solid rgba(16, 185, 129, 0.3)'
                      : '1px solid var(--border-subtle)',
                  }}
                >
                  {/* Barra de progreso de la meta */}
                  <GoalProgressBar
                    name={item.name}
                    targetAmount={item.targetAmount}
                    savedAmount={item.savedAmount}
                    percent={item.percent}
                    clampedPercent={item.clampedPercent}
                    isCompleted={item.isCompleted}
                    isOverdue={item.isOverdue}
                    daysRemaining={item.daysRemaining}
                  />

                  {/* Fila informativa: Cuentas vinculadas & Sugerencia de ahorro */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-[var(--border-subtle)] text-[11px]">
                    {/* Cuentas vinculadas que aportaron */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[var(--text-muted)] flex items-center gap-1">
                        <Wallet size={12} />
                        Aportado desde:
                      </span>
                      {item.contributionsByAccount.length === 0 ? (
                        <span className="text-[var(--text-muted)] italic">Sin aportes aún</span>
                      ) : (
                        item.contributionsByAccount.map(accData => {
                          const acc = accountsMap.get(accData.accountId)
                          return (
                            <span
                              key={accData.accountId}
                              className="px-2 py-0.5 rounded-md font-mono text-[10px] font-medium"
                              style={{
                                background: 'var(--bg-surface)',
                                border: '1px solid var(--border-subtle)',
                                color: 'var(--text-primary)',
                              }}
                              title={`Total aportado: ${formatMoney(accData.totalCents)} en ${accData.count} aporte(s)`}
                            >
                              {acc ? accountLabel(acc) : 'Cuenta'}: {formatMoney(accData.totalCents)}
                            </span>
                          )
                        })
                      )}
                    </div>

                    {/* Proyección de ahorro sugerido */}
                    {item.suggestedMonthlySavings !== null && !item.isCompleted && (
                      <div className="flex items-center gap-1 text-[var(--orange-400)] font-medium">
                        <Sparkles size={12} />
                        <span>Ahorro sugerido: <strong>{formatMoney(item.suggestedMonthlySavings)}/mes</strong></span>
                      </div>
                    )}
                  </div>

                  {/* Fila de Acciones: Aportar, Historial, Editar, Eliminar */}
                  <div className="flex items-center justify-between pt-1 gap-2">
                    <button
                      onClick={() => setExpandedGoalId(isExpanded ? null : item.goalId)}
                      className="text-[11px] text-[var(--text-secondary)] hover:text-white flex items-center gap-1 transition-colors"
                      title="Ver desglose de aportes"
                    >
                      {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                      <span>{goalContribs.length} {goalContribs.length === 1 ? 'aporte' : 'aportes'}</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleOpenEdit(rawGoal)}
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-surface)] transition-colors"
                        title="Editar meta"
                      >
                        <Edit2 size={13} />
                      </button>

                      <button
                        onClick={() => handleDeleteGoal(rawGoal)}
                        className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--red-400)] hover:bg-[var(--bg-surface)] transition-colors"
                        title="Eliminar meta"
                      >
                        <Trash2 size={13} />
                      </button>

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setContributeGoal(rawGoal)}
                        className="text-xs py-1 px-2.5 h-auto flex items-center gap-1"
                      >
                        <Plus size={13} />
                        <span>Aportar</span>
                      </Button>
                    </div>
                  </div>

                  {/* ── Desglose de aportes vinculados desplegable ── */}
                  {isExpanded && (
                    <div
                      className="mt-2 pt-3 border-t border-[var(--border-subtle)] flex flex-col gap-2 animate-in fade-in duration-150"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                        Historial de aportes
                      </span>

                      {goalContribs.length === 0 ? (
                        <p className="text-xs text-[var(--text-muted)] italic py-2">
                          No has registrado aportes para esta meta todavía.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
                          {goalContribs.map(contrib => {
                            const acc = accountsMap.get(contrib.accountId)
                            return (
                              <div
                                key={contrib.id}
                                className="p-2 rounded-lg flex items-center justify-between text-xs"
                                style={{
                                  background: 'var(--bg-surface)',
                                  border: '1px solid var(--border-subtle)',
                                }}
                              >
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-white">
                                      {acc ? accountLabel(acc) : 'Cuenta vinculada'}
                                    </span>
                                    {contrib.note && (
                                      <span className="text-[10px] text-[var(--text-muted)]">
                                        • {contrib.note}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10px] text-[var(--text-secondary)] font-mono">
                                    {formatDate(contrib.date)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-white tabular-nums">
                                    +{formatMoney(contrib.amount)}
                                  </span>
                                  <button
                                    onClick={() => handleDeleteContribution(contrib.id)}
                                    className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--red-400)] transition-colors"
                                    title="Eliminar este aporte"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Modales ── */}
      <GoalFormModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        initialGoal={editingGoal}
      />

      <GoalContributionModal
        isOpen={Boolean(contributeGoal)}
        onClose={() => setContributeGoal(null)}
        goal={contributeGoal}
      />
    </div>
  )
}

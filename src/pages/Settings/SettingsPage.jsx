/**
 * src/pages/Settings/SettingsPage.jsx
 *
 * Pantalla de Ajustes para administrar:
 *   1. Presupuestos mensuales por categoría.
 *   2. Gastos fijos recurrentes (suscripciones, servicios, renta).
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  PiggyBank,
  CalendarDays,
  Plus,
  Trash2,
  Edit2,
  Check,
  Calendar,
  CreditCard,
  X,
} from 'lucide-react'
import { useBudgets } from '../../store/useBudgets.js'
import { useMovements } from '../../store/useMovements.js'
import { useAccounts } from '../../store/useAccounts.js'
import Button from '../../components/ui/Button.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { formatMoney, centsToInput, inputToCents } from '../../lib/format.js'

export default function SettingsPage() {
  const navigate = useNavigate()
  const {
    budgets,
    fixedExpenses,
    fetchBudgets,
    setBudget,
    deleteBudget,
    addFixedExpense,
    updateFixedExpense,
    deleteFixedExpense,
    toggleFixedExpense,
  } = useBudgets()

  const { categories, fetchMovements } = useMovements()
  const { accounts, fetchAccounts } = useAccounts()

  const [activeTab, setActiveTab] = useState('budgets') // 'budgets' | 'fixed'

  // Modal para editar presupuesto
  const [editingBudgetCat, setEditingBudgetCat] = useState(null)
  const [budgetLimitInput, setBudgetLimitInput] = useState('')

  // Modal para crear/editar gasto fijo
  const [isFixedModalOpen, setIsFixedModalOpen] = useState(false)
  const [editingFixed, setEditingFixed] = useState(null)
  const [fixedName, setFixedName] = useState('')
  const [fixedAmountInput, setFixedAmountInput] = useState('')
  const [fixedDay, setFixedDay] = useState(1)
  const [fixedCatId, setFixedCatId] = useState('')
  const [fixedAccId, setFixedAccId] = useState('')

  useEffect(() => {
    fetchBudgets()
    fetchMovements()
    fetchAccounts()
  }, [fetchBudgets, fetchMovements, fetchAccounts])

  const expenseCategories = categories.filter(c => c.type === 'expense' && !c.hidden)
  const budgetsMap = new Map(budgets.map(b => [b.categoryId, b]))
  const accountsMap = new Map(accounts.map(a => [a.id, a]))
  const categoriesMap = new Map(categories.map(c => [c.id, c]))

  // ── Guardar Presupuesto ──
  const handleSaveBudget = async () => {
    if (!editingBudgetCat) return
    const limitCents = inputToCents(budgetLimitInput)
    await setBudget(editingBudgetCat.id, limitCents)
    setEditingBudgetCat(null)
  }

  // ── Abrir modal de gasto fijo ──
  const handleOpenFixedModal = (fixed = null) => {
    if (fixed) {
      setEditingFixed(fixed)
      setFixedName(fixed.name)
      setFixedAmountInput(centsToInput(fixed.amount))
      setFixedDay(fixed.dayOfMonth || 1)
      setFixedCatId(fixed.categoryId || expenseCategories[0]?.id || '')
      setFixedAccId(fixed.accountId || accounts[0]?.id || '')
    } else {
      setEditingFixed(null)
      setFixedName('')
      setFixedAmountInput('')
      setFixedDay(1)
      setFixedCatId(expenseCategories[0]?.id || '')
      setFixedAccId(accounts[0]?.id || '')
    }
    setIsFixedModalOpen(true)
  }

  // ── Guardar Gasto Fijo ──
  const handleSaveFixed = async (e) => {
    e.preventDefault()
    if (!fixedName.trim()) return

    const payload = {
      name: fixedName.trim(),
      amount: inputToCents(fixedAmountInput),
      dayOfMonth: parseInt(fixedDay, 10) || 1,
      categoryId: fixedCatId,
      accountId: fixedAccId,
      currency: 'MXN',
      active: true,
    }

    if (editingFixed) {
      await updateFixedExpense(editingFixed.id, payload)
    } else {
      await addFixedExpense(payload)
    }

    setIsFixedModalOpen(false)
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'var(--bg-base)',
        color: 'var(--text-primary)',
      }}
    >
      {/* ── Header ── */}
      <header
        className="flex items-center gap-3 px-4 py-3 sticky top-0 z-40"
        style={{
          borderBottom: '1px solid var(--border-subtle)',
          background: 'var(--bg-surface)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          aria-label="Volver"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: '8px',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '44px',
            minWidth: '44px',
          }}
        >
          <ArrowLeft size={20} />
        </button>
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'var(--font-size-xl)',
            fontWeight: 700,
          }}
        >
          Ajustes
        </h1>
      </header>

      {/* ── Contenido Principal ── */}
      <main className="p-4 sm:p-6 max-w-2xl mx-auto w-full flex flex-col gap-5 flex-1">
        {/* Selector de Sección */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('budgets')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'budgets'
                ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <PiggyBank size={16} />
            <span>Presupuestos</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fixed')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'fixed'
                ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <CalendarDays size={16} />
            <span>Gastos Fijos</span>
          </button>
        </div>

        {/* ── SECCIÓN 1: PRESUPUESTOS ── */}
        {activeTab === 'budgets' && (
          <div className="flex flex-col gap-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Presupuestos por Categoría</h2>
                <p className="text-xs text-[var(--text-secondary)]">Define el límite mensual que deseas destinar</p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              {expenseCategories.map((cat) => {
                const budget = budgetsMap.get(cat.id)
                const limit = budget?.monthlyLimit || 0

                return (
                  <div
                    key={cat.id}
                    className="p-3 rounded-xl flex items-center justify-between gap-3"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ background: cat.color || 'var(--orange-400)' }}
                      />
                      <span className="text-xs font-semibold text-white">{cat.name}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs font-bold" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {limit > 0 ? formatMoney(limit) : <span className="text-[var(--text-muted)] font-sans font-normal italic">Sin límite</span>}
                      </span>

                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditingBudgetCat(cat)
                          setBudgetLimitInput(limit > 0 ? centsToInput(limit) : '')
                        }}
                      >
                        {limit > 0 ? 'Editar' : 'Fijar'}
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── SECCIÓN 2: GASTOS FIJOS ── */}
        {activeTab === 'fixed' && (
          <div className="flex flex-col gap-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Gastos Fijos Mensuales</h2>
                <p className="text-xs text-[var(--text-secondary)]">Pagos recurrentes que se recuerdan cada mes</p>
              </div>

              <Button
                size="sm"
                variant="primary"
                icon={Plus}
                onClick={() => handleOpenFixedModal(null)}
              >
                Nuevo
              </Button>
            </div>

            {fixedExpenses.length === 0 ? (
              <div
                className="p-8 rounded-2xl text-center text-xs text-[var(--text-muted)] flex flex-col items-center justify-center gap-2"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px dashed var(--border-default)',
                }}
              >
                <span>No tienes gastos fijos registrados aún.</span>
                <Button size="sm" variant="secondary" icon={Plus} onClick={() => handleOpenFixedModal(null)}>
                  Agregar Netflix, Renta o Internet
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {fixedExpenses.map((fixed) => {
                  const cat = categoriesMap.get(fixed.categoryId)
                  const acc = accountsMap.get(fixed.accountId)

                  return (
                    <div
                      key={fixed.id}
                      className="p-3.5 rounded-xl flex items-center justify-between gap-3"
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        opacity: fixed.active !== false ? 1 : 0.5,
                      }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-white truncate">{fixed.name}</span>
                          <span className="text-[10px] text-[var(--text-muted)] font-mono">Día {fixed.dayOfMonth}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-[var(--text-secondary)] mt-0.5">
                          <span>{cat?.name || 'Gasto'}</span>
                          <span>•</span>
                          <span>{acc?.name || 'Cuenta'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatMoney(fixed.amount, fixed.currency)}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenFixedModal(fixed)}
                            aria-label="Editar gasto fijo"
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white transition-colors"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteFixedExpense(fixed.id)}
                            aria-label="Eliminar gasto fijo"
                            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--red-400)] transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── Modal para Editar Presupuesto ── */}
      {editingBudgetCat && (
        <Modal
          isOpen={Boolean(editingBudgetCat)}
          onClose={() => setEditingBudgetCat(null)}
          title={`Presupuesto: ${editingBudgetCat.name}`}
        >
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Límite mensual ($ MXN)
              </label>
              <input
                type="number"
                step="0.01"
                autoFocus
                value={budgetLimitInput}
                onChange={(e) => setBudgetLimitInput(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg text-sm text-white font-mono outline-none"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                }}
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  const b = budgetsMap.get(editingBudgetCat.id)
                  if (b) await deleteBudget(b.id)
                  setEditingBudgetCat(null)
                }}
              >
                Eliminar límite
              </Button>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditingBudgetCat(null)}>
                  Cancelar
                </Button>
                <Button variant="primary" size="sm" onClick={handleSaveBudget}>
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Modal para Crear/Editar Gasto Fijo ── */}
      {isFixedModalOpen && (
        <Modal
          isOpen={isFixedModalOpen}
          onClose={() => setIsFixedModalOpen(false)}
          title={editingFixed ? `Editar: ${editingFixed.name}` : 'Nuevo Gasto Fijo'}
        >
          <form onSubmit={handleSaveFixed} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                Nombre del gasto fijo *
              </label>
              <input
                type="text"
                required
                value={fixedName}
                onChange={(e) => setFixedName(e.target.value)}
                placeholder="Ej: Netflix, Totalplay, Renta, Gimnasio"
                className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Monto ($ MXN) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={fixedAmountInput}
                  onChange={(e) => setFixedAmountInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 rounded-lg text-xs text-white font-mono outline-none"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Día de cobro (1-31) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={fixedDay}
                  onChange={(e) => setFixedDay(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Categoría
                </label>
                <select
                  value={fixedCatId}
                  onChange={(e) => setFixedCatId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  {expenseCategories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                  Cuenta para pagar
                </label>
                <select
                  value={fixedAccId}
                  onChange={(e) => setFixedAccId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                  }}
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <Button variant="ghost" size="sm" onClick={() => setIsFixedModalOpen(false)}>
                Cancelar
              </Button>
              <Button variant="primary" size="sm" type="submit">
                {editingFixed ? 'Guardar cambios' : 'Crear gasto fijo'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

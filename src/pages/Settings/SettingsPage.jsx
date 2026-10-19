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
  KeyRound,
  Eye,
  EyeOff,
  Coins,
  CheckCircle2,
  Download,
  Upload,
  FileSpreadsheet,
  FileJson,
  Bell,
  Archive,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { useBudgets } from '../../store/useBudgets.js'
import { useMovements } from '../../store/useMovements.js'
import { useAccounts } from '../../store/useAccounts.js'
import { useSettings } from '../../store/useSettings.js'
import { useInvestments } from '../../store/useInvestments.js'
import {
  exportDatabaseToJSON,
  exportMovementsToCSV,
  validateBackupJSON,
  restoreDatabase,
} from '../../services/backup.js'
import { scheduleFinancialReminders } from '../../services/notifications.js'
import Button from '../../components/ui/Button.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { formatMoney, centsToInput, inputToCents, formatDate } from '../../lib/format.js'

export default function SettingsPage() {
  const navigate = useNavigate()
  const {
    budgets,
    fixedExpenses,
    pendingRecurring,
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
  const { settings, fetchSettings, setFinnhubKey, setFxSettings } = useSettings()
  const { refreshPrices } = useInvestments()

  const [activeTab, setActiveTab] = useState('budgets') // 'budgets' | 'fixed' | 'fx' | 'backup'

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

  // Configuración de Finnhub y FX
  const [finnhubInput, setFinnhubInput] = useState('')
  const [showFinnhubKey, setShowFinnhubKey] = useState(false)
  const [fxModeInput, setFxModeInput] = useState('auto')
  const [fxRateInput, setFxRateInput] = useState('18.00')
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('')

  // Respaldo y Notificaciones
  const [importSummaryModal, setImportSummaryModal] = useState(null)
  const [importError, setImportError] = useState('')
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [reminderMsg, setReminderMsg] = useState('')

  useEffect(() => {
    fetchBudgets()
    fetchMovements()
    fetchAccounts()
    fetchSettings().then((s) => {
      if (s) {
        setFinnhubInput(s.finnhubApiKey || '')
        setFxModeInput(s.fxMode || 'auto')
        const rate = Number(s.fxRateManual) || 1800
        setFxRateInput(rate > 100 ? (rate / 100).toFixed(2) : rate.toFixed(2))
      }
    })
  }, [fetchBudgets, fetchMovements, fetchAccounts, fetchSettings])

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

  // ── Guardar Finnhub API Key ──
  const handleSaveFinnhub = async () => {
    await setFinnhubKey(finnhubInput)
    await refreshPrices()
    setSaveSuccessMsg('API Key de Finnhub guardada correctamente.')
    setTimeout(() => setSaveSuccessMsg(''), 3000)
  }

  // ── Guardar Configuración de FX ──
  const handleSaveFx = async () => {
    const rateCents = Math.round((parseFloat(fxRateInput) || 18) * 100)
    await setFxSettings({ fxMode: fxModeInput, fxRateManual: rateCents })
    await refreshPrices()
    setSaveSuccessMsg('Ajustes de tipo de cambio guardados.')
    setTimeout(() => setSaveSuccessMsg(''), 3000)
  }

  // ── Exportar Respaldo JSON ──
  const handleExportJSON = async () => {
    setIsExporting(true)
    setImportError('')
    try {
      const res = await exportDatabaseToJSON()
      await fetchSettings()
      setSaveSuccessMsg(`Respaldo generado con éxito: ${res.filename}`)
      setTimeout(() => setSaveSuccessMsg(''), 4000)
    } catch (err) {
      setImportError(err.message || 'Error al exportar JSON')
    } finally {
      setIsExporting(false)
    }
  }

  // ── Exportar Movimientos a CSV ──
  const handleExportCSV = async () => {
    setIsExporting(true)
    setImportError('')
    try {
      const res = await exportMovementsToCSV()
      setSaveSuccessMsg(`Historial exportado (${res.count} movimientos) a CSV`)
      setTimeout(() => setSaveSuccessMsg(''), 4000)
    } catch (err) {
      setImportError(err.message || 'Error al exportar CSV')
    } finally {
      setIsExporting(false)
    }
  }

  // ── Selección de Archivo para Importar ──
  const handleFileSelected = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportError('')
    const reader = new FileReader()
    reader.onload = (event) => {
      const content = event.target?.result
      if (typeof content === 'string') {
        const validation = validateBackupJSON(content)
        if (!validation.valid) {
          setImportError(validation.error || 'Archivo de respaldo inválido.')
        } else {
          setImportSummaryModal(validation)
        }
      }
    }
    reader.onerror = () => {
      setImportError('No se pudo leer el archivo seleccionado.')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ── Confirmar y Restaurar Base de Datos ──
  const handleConfirmRestore = async () => {
    if (!importSummaryModal?.parsedData) return
    setIsImporting(true)
    setImportError('')
    try {
      await restoreDatabase(importSummaryModal.parsedData)
      await Promise.all([
        fetchAccounts(),
        fetchMovements(),
        fetchBudgets(),
        fetchSettings(),
      ])
      setImportSummaryModal(null)
      setSaveSuccessMsg('¡Base de datos restaurada correctamente!')
      setTimeout(() => setSaveSuccessMsg(''), 4000)
    } catch (err) {
      setImportError(err.message || 'Error al restaurar la base de datos.')
    } finally {
      setIsImporting(false)
    }
  }

  // ── Programar Recordatorios Locales ──
  const handleScheduleReminders = async () => {
    try {
      const res = await scheduleFinancialReminders({
        accounts,
        pendingRecurring,
      })
      if (res.error) {
        setReminderMsg(`Aviso: ${res.error}`)
      } else {
        setReminderMsg(`¡Listo! Se programaron ${res.scheduledCount} recordatorios automáticos (cortes, pagos y fijos).`)
      }
      setTimeout(() => setReminderMsg(''), 5000)
    } catch (err) {
      setReminderMsg(`Error: ${err.message}`)
      setTimeout(() => setReminderMsg(''), 5000)
    }
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
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('budgets')}
            className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'budgets'
                ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <PiggyBank size={15} />
            <span>Presupuestos</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fixed')}
            className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'fixed'
                ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <CalendarDays size={15} />
            <span>Gastos fijos</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fx')}
            className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'fx'
                ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <Coins size={15} />
            <span>Inversiones y FX</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`py-2 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'backup'
                ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <Archive size={15} />
            <span>Respaldo</span>
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

        {/* ── SECCIÓN 3: INVERSIONES Y TIPO DE CAMBIO ── */}
        {activeTab === 'fx' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            {saveSuccessMsg && (
              <div
                className="p-3 rounded-xl flex items-center gap-2 text-xs"
                style={{
                  background: 'var(--orange-900)',
                  color: 'var(--orange-400)',
                  border: '1px solid var(--orange-400)',
                }}
              >
                <CheckCircle2 size={15} />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {/* Finnhub API Key */}
            <div
              className="p-4 rounded-xl flex flex-col gap-3"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-2">
                <KeyRound size={18} className="text-[var(--orange-400)]" />
                <div>
                  <h3 className="text-sm font-bold text-white">API Key de Finnhub (Acciones)</h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Necesaria para cotizaciones en tiempo real de NFLX, INTC, AMD y NVDA.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs text-[var(--text-muted)]">
                  Tu API Key gratuita (finnhub.io):
                </label>
                <div className="relative">
                  <input
                    type={showFinnhubKey ? 'text' : 'password'}
                    placeholder="Pega tu API key de Finnhub..."
                    value={finnhubInput}
                    onChange={(e) => setFinnhubInput(e.target.value)}
                    className="w-full pl-3 pr-10 py-2.5 rounded-lg text-xs text-white font-mono outline-none"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowFinnhubKey(!showFinnhubKey)}
                    className="absolute right-3 top-2.5 text-[var(--text-muted)] hover:text-white transition-colors"
                  >
                    {showFinnhubKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">
                  Se guarda solo en este dispositivo y nunca en el código ni en el repositorio.
                </span>
              </div>

              <div className="flex justify-end pt-1">
                <Button variant="primary" size="sm" onClick={handleSaveFinnhub}>
                  Guardar API Key
                </Button>
              </div>
            </div>

            {/* Tipo de Cambio USD / MXN */}
            <div
              className="p-4 rounded-xl flex flex-col gap-3"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-2">
                <Coins size={18} className="text-[var(--orange-400)]" />
                <div>
                  <h3 className="text-sm font-bold text-white">Tipo de Cambio USD / MXN</h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Define la conversión de activos y movimientos en dólares a pesos.
                  </p>
                </div>
              </div>

              {/* Selector de Modo */}
              <div className="flex rounded-lg p-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setFxModeInput('auto')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    fxModeInput === 'auto'
                      ? 'bg-[var(--orange-500)] text-black'
                      : 'text-[var(--text-secondary)] hover:text-white'
                  }`}
                >
                  Automático (Internet)
                </button>
                <button
                  type="button"
                  onClick={() => setFxModeInput('manual')}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    fxModeInput === 'manual'
                      ? 'bg-[var(--orange-500)] text-black'
                      : 'text-[var(--text-secondary)] hover:text-white'
                  }`}
                >
                  Manual Fijo
                </button>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-[var(--text-muted)]">
                  {fxModeInput === 'auto'
                    ? 'Tasa de respaldo offline ($ MXN por 1 USD):'
                    : 'Tasa fija manual ($ MXN por 1 USD):'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-[var(--text-muted)] font-mono">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    value={fxRateInput}
                    onChange={(e) => setFxRateInput(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 rounded-lg text-xs text-white font-mono outline-none"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                    }}
                  />
                </div>
                <span className="text-[11px] text-[var(--text-muted)]">
                  {fxModeInput === 'auto'
                    ? 'Se utiliza cuando la app no tiene internet o los servidores de divisas fallan.'
                    : 'Todas las conversiones de USD a MXN usarán siempre este valor.'}
                </span>
              </div>

              <div className="flex justify-end pt-1">
                <Button variant="primary" size="sm" onClick={handleSaveFx}>
                  Guardar tipo de cambio
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── SECCIÓN 4: RESPALDO Y RECORDATORIOS ── */}
        {activeTab === 'backup' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            {saveSuccessMsg && (
              <div
                className="p-3 rounded-xl flex items-center gap-2 text-xs"
                style={{
                  background: 'var(--orange-900)',
                  color: 'var(--orange-400)',
                  border: '1px solid var(--orange-400)',
                }}
              >
                <CheckCircle2 size={15} />
                <span>{saveSuccessMsg}</span>
              </div>
            )}

            {importError && (
              <div
                className="p-3 rounded-xl flex items-center gap-2 text-xs"
                style={{
                  background: 'var(--red-900)',
                  color: 'var(--red-400)',
                  border: '1px solid var(--red-600)',
                }}
              >
                <AlertTriangle size={15} />
                <span>{importError}</span>
              </div>
            )}

            {reminderMsg && (
              <div
                className="p-3 rounded-xl flex items-center gap-2 text-xs"
                style={{
                  background: 'var(--bg-elevated)',
                  color: 'white',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <Bell size={15} className="text-[var(--orange-400)]" />
                <span>{reminderMsg}</span>
              </div>
            )}

            {/* Estado del Último Respaldo */}
            <div
              className="p-4 rounded-xl flex items-center justify-between gap-3"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <Clock size={18} className="text-[var(--orange-400)]" />
                </div>
                <div>
                  <span className="text-xs text-[var(--text-muted)] block">Último respaldo realizado</span>
                  <span className="text-sm font-bold text-white font-mono">
                    {settings?.lastBackupAt
                      ? `${formatDate(settings.lastBackupAt.slice(0, 10))} a las ${settings.lastBackupAt.slice(11, 16)}`
                      : 'Ninguno registrado aún'}
                  </span>
                </div>
              </div>

              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{
                  background: settings?.lastBackupAt ? 'var(--orange-900)' : 'var(--bg-elevated)',
                  color: settings?.lastBackupAt ? 'var(--orange-400)' : 'var(--text-muted)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {settings?.lastBackupAt ? 'Al día' : 'Pendiente'}
              </span>
            </div>

            {/* Exportar e Importar Datos */}
            <div
              className="p-4 rounded-xl flex flex-col gap-4"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <h3 className="text-sm font-bold text-white">Copias de Seguridad</h3>
                <p className="text-xs text-[var(--text-secondary)]">
                  Exporta tus datos para guardarlos de forma segura o transferirlos a otro dispositivo.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Exportar JSON */}
                <div
                  className="p-3.5 rounded-xl flex flex-col justify-between gap-3"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <FileJson size={20} className="text-[var(--orange-400)] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-xs text-white block">Respaldo Completo (JSON)</span>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Guarda toda tu base de datos (cuentas, movimientos, presupuestos, gastos e inversiones).
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Download}
                    onClick={handleExportJSON}
                    disabled={isExporting}
                  >
                    {isExporting ? 'Generando...' : 'Exportar JSON'}
                  </Button>
                </div>

                {/* Exportar CSV */}
                <div
                  className="p-3.5 rounded-xl flex flex-col justify-between gap-3"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="flex items-start gap-2.5">
                    <FileSpreadsheet size={20} className="text-[var(--orange-400)] flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold text-xs text-white block">Historial en Excel (CSV)</span>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Exporta tus movimientos en formato de tabla para abrirlos en Excel o Google Sheets.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={Download}
                    onClick={handleExportCSV}
                    disabled={isExporting}
                  >
                    {isExporting ? 'Exportando...' : 'Exportar CSV'}
                  </Button>
                </div>
              </div>

              {/* Importar JSON */}
              <div
                className="p-3.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t"
                style={{ borderColor: 'var(--border-subtle)' }}
              >
                <div>
                  <span className="font-semibold text-xs text-white block">Restaurar desde archivo</span>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    Reemplaza tus datos actuales con una copia de seguridad JSON previa.
                  </p>
                </div>

                <div>
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".json"
                      onChange={handleFileSelected}
                      className="hidden"
                    />
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-elevated)] hover:bg-[var(--bg-overlay)] border border-[var(--border-default)] text-white transition-colors">
                      <Upload size={14} />
                      <span>Seleccionar JSON</span>
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Recordatorios y Notificaciones */}
            <div
              className="p-4 rounded-xl flex flex-col gap-3"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-2">
                <Bell size={18} className="text-[var(--orange-400)]" />
                <div>
                  <h3 className="text-sm font-bold text-white">Recordatorios Locales</h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Avisos en tu dispositivo para fecha de corte y pago de tarjetas, y gastos fijos pendientes.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[var(--text-muted)] max-w-sm">
                  Programa notificaciones para no olvidar tus fechas límite de pago y cortes bancarios.
                </span>

                <Button
                  variant="secondary"
                  size="sm"
                  icon={Bell}
                  onClick={handleScheduleReminders}
                >
                  Sincronizar avisos
                </Button>
              </div>
            </div>
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

      {/* ── Modal de Confirmación de Restauración ── */}
      {importSummaryModal && (
        <Modal
          isOpen={Boolean(importSummaryModal)}
          onClose={() => setImportSummaryModal(null)}
          title="Confirmar restauración de respaldo"
        >
          <div className="flex flex-col gap-4">
            <div
              className="p-3.5 rounded-xl flex items-start gap-2.5 text-xs"
              style={{
                background: 'var(--red-900)',
                color: 'var(--red-400)',
                border: '1px solid var(--red-600)',
              }}
            >
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <strong className="block text-white mb-0.5">¡Advertencia de reemplazo!</strong>
                <span>
                  Esta acción eliminará todos los datos actuales de la aplicación y los reemplazará
                  por completo con la información de este respaldo.
                </span>
              </div>
            </div>

            {/* Resumen de elementos a restaurar */}
            <div
              className="p-3.5 rounded-xl flex flex-col gap-2 text-xs font-mono"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              <span className="text-[var(--text-muted)] font-sans font-semibold">
                Contenido del archivo a restaurar:
              </span>
              <div className="grid grid-cols-2 gap-2 text-white">
                <div>Cuentas: <strong>{importSummaryModal.summary?.accountsCount || 0}</strong></div>
                <div>Movimientos: <strong>{importSummaryModal.summary?.movementsCount || 0}</strong></div>
                <div>Categorías: <strong>{importSummaryModal.summary?.categoriesCount || 0}</strong></div>
                <div>Presupuestos: <strong>{importSummaryModal.summary?.budgetsCount || 0}</strong></div>
                <div>Gastos fijos: <strong>{importSummaryModal.summary?.fixedExpensesCount || 0}</strong></div>
                <div>Inversiones: <strong>{importSummaryModal.summary?.holdingsCount || 0}</strong></div>
              </div>
              {importSummaryModal.summary?.exportedAt && (
                <span className="text-[10px] text-[var(--text-muted)] mt-1 font-sans">
                  Exportado originalmente: {formatDate(importSummaryModal.summary.exportedAt.slice(0, 10))}
                </span>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setImportSummaryModal(null)}
                disabled={isImporting}
              >
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmRestore}
                disabled={isImporting}
              >
                {isImporting ? 'Restaurando...' : 'Reemplazar y restaurar'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

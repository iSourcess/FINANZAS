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
  Star,
  ArrowUp,
  ArrowDown,
  Bookmark,
  CalendarClock,
  ToggleLeft,
  ToggleRight,
  HandCoins,
  TrendingUp,
} from 'lucide-react'
import { AVAILABLE_FX_PAIRS } from '../../lib/constants.js'
import { useFx } from '../../store/useFx.js'
import { useBudgets } from '../../store/useBudgets.js'
import { useMovements } from '../../store/useMovements.js'
import { useAccounts } from '../../store/useAccounts.js'
import { useSettings } from '../../store/useSettings.js'
import { useTemplates } from '../../store/useTemplates.js'
import { useInvestments } from '../../store/useInvestments.js'
import { useRecurringIncomes } from '../../store/useRecurringIncomes.js'
import { validateTemplate } from '../../domain/templates.js'
import { DEFAULT_REMINDER_SETTINGS } from '../../domain/reminders.js'
import TemplateFormModal from '../../components/forms/TemplateFormModal.jsx'
import RecurringIncomeModal from '../../components/forms/RecurringIncomeModal.jsx'
import NotificationPermissionModal from '../../components/notifications/NotificationPermissionModal.jsx'
import { toISODate } from '../../domain/periods.js'
import {
  exportDatabaseToJSON,
  exportMovementsToCSV,
  validateBackupJSON,
  restoreDatabase,
} from '../../services/backup.js'
import {
  rescheduleAll,
  sendTestNotification,
  checkNotificationPermissions,
  scheduleFinancialReminders,
} from '../../services/notifications.js'
import Button from '../../components/ui/Button.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { formatMoney, centsToInput, inputToCents, formatDate, accountLabel } from '../../lib/format.js'

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
  const {
    settings,
    fetchSettings,
    setFinnhubKey,
    setFxSettings,
    setTemplateTapBehavior,
    setIncludeDebtsInNetWorth,
    updateReminderSettings,
  } = useSettings()
  const {
    templates,
    fetchTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    moveTemplate,
  } = useTemplates()
  const { refreshPrices } = useInvestments()
  const {
    recurringIncomes,
    occurrences,
    loading: recurringLoading,
    error: recurringError,
    fetchRecurringIncomes,
    addRecurringIncome,
    updateRecurringIncome,
    deleteRecurringIncome,
    toggleRecurringIncome,
  } = useRecurringIncomes()

  const [activeTab, setActiveTab] = useState('budgets') // 'budgets' | 'fixed' | 'incomes' | 'templates' | 'reminders' | 'fx' | 'backup'

  // Estados de recordatorios y permisos
  const [isPermissionModalOpen, setIsPermissionModalOpen] = useState(false)
  const [permissionStatus, setPermissionStatus] = useState('prompt')
  const [isSendingTestNotif, setIsSendingTestNotif] = useState(false)

  useEffect(() => {
    checkNotificationPermissions().then(setPermissionStatus)
  }, [])

  // Modal para crear/editar ingreso recurrente
  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false)
  const [editingIncome, setEditingIncome] = useState(null)
  const todayStr = toISODate(new Date())

  // Modal para crear/editar plantilla
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState(null)

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
  const [fxRateEurInput, setFxRateEurInput] = useState('20.00')
  const [primaryFxInput, setPrimaryFxInput] = useState('USD')
  const [enabledFxList, setEnabledFxList] = useState(['USD', 'EUR'])
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
    fetchTemplates()
    fetchRecurringIncomes()
    fetchSettings().then((s) => {
      if (s) {
        setFinnhubInput(s.finnhubApiKey || '')
        setFxModeInput(s.fxMode || 'auto')
        const rate = Number(s.fxRateManual) || 1800
        setFxRateInput(rate > 100 ? (rate / 100).toFixed(2) : rate.toFixed(2))
        const rateEur = Number(s.fxRateManualEur) || 2000
        setFxRateEurInput(rateEur > 100 ? (rateEur / 100).toFixed(2) : rateEur.toFixed(2))
        setPrimaryFxInput(s.primaryFxCurrency || 'USD')
        if (Array.isArray(s.enabledFxCurrencies) && s.enabledFxCurrencies.length > 0) {
          setEnabledFxList(s.enabledFxCurrencies)
        }
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

  // ── Handlers de monedas del Widget FX ──
  const handleMoveCurrency = (index, direction) => {
    const newList = [...enabledFxList]
    const targetIdx = index + direction
    if (targetIdx < 0 || targetIdx >= newList.length) return
    const [moved] = newList.splice(index, 1)
    newList.splice(targetIdx, 0, moved)
    setEnabledFxList(newList)
  }

  const handleToggleCurrency = (code) => {
    if (enabledFxList.includes(code)) {
      if (enabledFxList.length === 1) return // Mantener al menos una divisa
      const filtered = enabledFxList.filter(c => c !== code)
      setEnabledFxList(filtered)
      if (primaryFxInput === code && filtered.length > 0) {
        setPrimaryFxInput(filtered[0])
      }
    } else {
      setEnabledFxList([...enabledFxList, code])
    }
  }

  // ── Guardar Configuración de FX ──
  const handleSaveFx = async () => {
    const rateUsdCents = Math.round((parseFloat(fxRateInput) || 18) * 100)
    const rateEurCents = Math.round((parseFloat(fxRateEurInput) || 20) * 100)
    await setFxSettings({
      fxMode: fxModeInput,
      fxRateManual: rateUsdCents,
      fxRateManualEur: rateEurCents,
    })
    await setPrimaryFxCurrency(primaryFxInput)
    await setEnabledFxCurrencies(enabledFxList)
    await useFx.getState().fetchRates(enabledFxList)
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
      const res = await rescheduleAll()
      if (res.error) {
        setReminderMsg(`Aviso: ${res.error}`)
      } else {
        setReminderMsg(`¡Listo! Se sincronizaron ${res.scheduledCount} recordatorios en tu calendario.`)
      }
      setTimeout(() => setReminderMsg(''), 5000)
    } catch (err) {
      setReminderMsg(`Error: ${err.message}`)
      setTimeout(() => setReminderMsg(''), 5000)
    }
  }

  // ── Handlers de configuración de recordatorios ──
  const handleToggleReminder = async (key) => {
    try {
      const currentReminders = settings?.reminders || DEFAULT_REMINDER_SETTINGS
      const currentItem = currentReminders[key] || {}
      const nextVal = !currentItem.enabled
      const updated = {
        ...currentReminders,
        [key]: { ...currentItem, enabled: nextVal },
      }
      await updateReminderSettings(updated)
      await rescheduleAll()
      setSaveSuccessMsg('Ajuste de recordatorio guardado.')
      setTimeout(() => setSaveSuccessMsg(''), 3000)
    } catch (err) {
      console.error('Error al actualizar recordatorio:', err)
    }
  }

  const handleChangeReminderTime = async (key, newTime) => {
    try {
      const currentReminders = settings?.reminders || DEFAULT_REMINDER_SETTINGS
      const currentItem = currentReminders[key] || {}
      const updated = {
        ...currentReminders,
        [key]: { ...currentItem, time: newTime },
      }
      await updateReminderSettings(updated)
      await rescheduleAll()
      setSaveSuccessMsg('Hora de recordatorio actualizada.')
      setTimeout(() => setSaveSuccessMsg(''), 3000)
    } catch (err) {
      console.error('Error al actualizar hora de recordatorio:', err)
    }
  }

  const handleSendTestNotification = async (channelId) => {
    try {
      setIsSendingTestNotif(true)
      const res = await sendTestNotification(channelId)
      if (res.success) {
        setSaveSuccessMsg('Notificación de prueba enviada (aparecerá en un instante).')
        setTimeout(() => setSaveSuccessMsg(''), 4000)
      } else {
        setIsPermissionModalOpen(true)
      }
    } catch {
      setIsPermissionModalOpen(true)
    } finally {
      setIsSendingTestNotif(false)
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
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-1.5 p-1 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('budgets')}
            className={`py-2 px-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'budgets'
                ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <PiggyBank size={14} />
            <span>Presupuestos</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fixed')}
            className={`py-2 px-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'fixed'
                ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <CalendarDays size={14} />
            <span>Gastos fijos</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('incomes')}
            className={`py-2 px-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'incomes'
                ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <CalendarClock size={14} />
            <span>Ingresos</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`py-2 px-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'templates'
                ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <Bookmark size={14} />
            <span>Plantillas</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reminders')}
            className={`py-2 px-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'reminders'
                ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <Bell size={14} />
            <span>Recordatorios</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fx')}
            className={`py-2 px-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'fx'
                ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <Coins size={14} />
            <span>Inversiones/FX</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('backup')}
            className={`py-2 px-1.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-all ${
              activeTab === 'backup'
                ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            <Archive size={14} />
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
                          <span>{acc ? accountLabel(acc) : 'Cuenta'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-white mr-1" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {formatMoney(fixed.amount, fixed.currency)}
                        </span>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenFixedModal(fixed)}
                            aria-label={`Editar gasto fijo ${fixed.name}`}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-white transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`¿Eliminar el gasto fijo "${fixed.name}"?`)) {
                                deleteFixedExpense(fixed.id)
                              }
                            }}
                            aria-label={`Eliminar gasto fijo ${fixed.name}`}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--red-400)] transition-colors"
                          >
                            <Trash2 size={16} />
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

        {/* ── SECCIÓN: INGRESOS RECURRENTES ── */}
        {activeTab === 'incomes' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            {recurringError && (
              <div
                className="p-3 rounded-xl flex items-center gap-2 text-xs"
                style={{
                  background: 'var(--red-900)',
                  color: 'var(--red-400)',
                  border: '1px solid var(--red-700)',
                }}
              >
                <AlertCircle size={15} />
                <span>{recurringError}</span>
              </div>
            )}

            {/* Cabecera con botón de crear */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Ingresos Recurrentes</h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Sueldo, quincenas, rentas cobradas y cobros periódicos
                </p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setEditingIncome(null)
                  setIsIncomeModalOpen(true)
                }}
                className="min-h-[44px]"
              >
                Nuevo ingreso
              </Button>
            </div>

            {recurringLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3">
                <div className="w-6 h-6 border-2 border-[var(--orange-400)] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs text-[var(--text-muted)]">Cargando ingresos recurrentes...</span>
              </div>
            ) : recurringIncomes.length === 0 ? (
              <div
                className="py-10 px-4 rounded-2xl flex flex-col items-center justify-center text-center gap-3"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ background: 'var(--bg-elevated)' }}
                >
                  <CalendarClock size={24} className="text-[var(--orange-400)]" />
                </div>
                <div className="flex flex-col gap-1 max-w-sm">
                  <h3 className="text-sm font-semibold text-white">No tienes ingresos recurrentes</h3>
                  <p className="text-xs text-[var(--text-muted)]">
                    Agrega tus fuentes fijas de dinero para generar recordatorios y registrarlos en tu saldo con un toque.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  icon={Plus}
                  onClick={() => {
                    setEditingIncome(null)
                    setIsIncomeModalOpen(true)
                  }}
                  className="min-h-[44px] mt-1"
                >
                  Agregar ingreso recurrente
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {recurringIncomes.map((item) => {
                  const acc = accountsMap.get(item.accountId)
                  const cat = categoriesMap.get(item.categoryId)
                  const itemOccurrences = occurrences
                    .filter((o) => o.recurringId === item.id)
                    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
                    .slice(0, 4)

                  let frequencyLabel = 'Mensual'
                  if (item.frequency === 'biweekly') {
                    const d1 = item.schedule?.day1 ?? 15
                    const d2 = item.schedule?.day2 === 'last' ? 'último' : item.schedule?.day2 ?? 30
                    frequencyLabel = `Quincenal (días ${d1} y ${d2})`
                  } else if (item.frequency === 'weekly') {
                    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
                    frequencyLabel = `Semanal (${dayNames[item.schedule?.dayOfWeek ?? 1] || 'Lun'})`
                  } else {
                    const d = item.schedule?.dayOfMonth === 'last' ? 'último día' : `día ${item.schedule?.dayOfMonth ?? 1}`
                    frequencyLabel = `Mensual (${d})`
                  }

                  return (
                    <div
                      key={item.id}
                      className="p-4 rounded-xl flex flex-col gap-3 transition-colors"
                      style={{
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        opacity: item.active ? 1 : 0.65,
                      }}
                    >
                      {/* Cabecera del ingreso */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-white truncate">
                              {item.name}
                            </span>
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-semibold"
                              style={{
                                background: item.active ? 'var(--orange-900)' : 'var(--bg-elevated)',
                                color: item.active ? 'var(--orange-400)' : 'var(--text-muted)',
                              }}
                            >
                              {item.active ? 'Activo' : 'Pausado'}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mt-1 flex-wrap">
                            <span>{frequencyLabel}</span>
                            {cat && <span>• {cat.name}</span>}
                            {acc && <span>• {accountLabel(acc)}</span>}
                          </div>
                        </div>

                        <span className="font-mono text-sm font-bold text-emerald-400 tabular-nums flex-shrink-0">
                          +{formatMoney(item.amountCents, item.currency)}
                        </span>
                      </div>

                      {/* Lista de ocurrencias recientes */}
                      {itemOccurrences.length > 0 && (
                        <div
                          className="p-2.5 rounded-lg flex flex-col gap-1.5"
                          style={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                            Ocurrencias recientes:
                          </span>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                            {itemOccurrences.map((occ) => {
                              const isOverdue = occ.dueDate < todayStr && occ.status === 'pending'
                              const isDueToday = occ.dueDate === todayStr && occ.status === 'pending'

                              return (
                                <div
                                  key={occ.id || `${occ.recurringId}-${occ.dueDate}`}
                                  className="p-1.5 rounded flex flex-col gap-0.5 text-[11px]"
                                  style={{
                                    background: 'var(--bg-surface)',
                                    border: isOverdue ? '1px solid var(--red-700)' : '1px solid var(--border-subtle)',
                                  }}
                                >
                                  <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                                    {occ.dueDate}
                                  </span>

                                  {occ.status === 'pending' && isOverdue && (
                                    <span className="flex items-center gap-1 font-bold text-[var(--red-400)] text-[10px]">
                                      <AlertTriangle size={11} className="flex-shrink-0" />
                                      <span>Atrasado</span>
                                    </span>
                                  )}

                                  {occ.status === 'pending' && isDueToday && (
                                    <span className="flex items-center gap-1 font-bold text-[var(--orange-400)] text-[10px]">
                                      <Clock size={11} className="flex-shrink-0" />
                                      <span>Hoy</span>
                                    </span>
                                  )}

                                  {occ.status === 'pending' && !isOverdue && !isDueToday && (
                                    <span className="flex items-center gap-1 text-[var(--text-muted)] text-[10px]">
                                      <Clock size={11} className="flex-shrink-0" />
                                      <span>Pendiente</span>
                                    </span>
                                  )}

                                  {occ.status === 'received' && (
                                    <span className="flex items-center gap-1 font-semibold text-emerald-400 text-[10px]">
                                      <CheckCircle2 size={11} className="flex-shrink-0" />
                                      <span>Recibido</span>
                                    </span>
                                  )}

                                  {occ.status === 'skipped' && (
                                    <span className="flex items-center gap-1 text-[var(--text-muted)] text-[10px]">
                                      <X size={11} className="flex-shrink-0" />
                                      <span>Omitido</span>
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Botones de acción */}
                      <div className="flex items-center justify-between pt-1 border-t border-[var(--border-subtle)]">
                        <button
                          type="button"
                          onClick={() => toggleRecurringIncome(item.id, !item.active)}
                          className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] hover:text-white transition-colors"
                          style={{ minHeight: '44px' }}
                        >
                          {item.active ? (
                            <>
                              <ToggleRight size={20} className="text-[var(--orange-400)]" />
                              <span>Pausar</span>
                            </>
                          ) : (
                            <>
                              <ToggleLeft size={20} className="text-[var(--text-muted)]" />
                              <span>Reactivar</span>
                            </>
                          )}
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingIncome(item)
                              setIsIncomeModalOpen(true)
                            }}
                            aria-label={`Editar ingreso ${item.name}`}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-white transition-colors"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`¿Eliminar el ingreso recurrente "${item.name}" y su historial de ocurrencias?`)) {
                                await deleteRecurringIncome(item.id)
                              }
                            }}
                            aria-label={`Eliminar ingreso ${item.name}`}
                            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--red-400)] transition-colors"
                          >
                            <Trash2 size={16} />
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

        {/* ── SECCIÓN 3: PLANTILLAS FRECUENTES ── */}
        {activeTab === 'templates' && (
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

            {/* Cabecera con botón de crear */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Plantillas de Movimientos</h2>
                <p className="text-xs text-[var(--text-secondary)]">Accesos rápidos para registrar tus movimientos habituales</p>
              </div>
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => {
                  setEditingTemplate(null)
                  setIsTemplateModalOpen(true)
                }}
              >
                Nueva plantilla
              </Button>
            </div>

            {/* Ajuste de comportamiento de toque */}
            <div
              className="p-3.5 rounded-xl flex flex-col gap-2.5"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span className="text-xs font-semibold text-white">Al tocar una plantilla en Registrar:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTemplateTapBehavior('fill')}
                  className={`p-2.5 rounded-lg text-left text-xs border transition-all flex items-start gap-2.5 ${
                    (settings?.templateTapBehavior || 'fill') === 'fill'
                      ? 'border-[var(--orange-400)] bg-[var(--orange-950)] text-white'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full border mt-0.5 flex items-center justify-center flex-shrink-0 ${
                    (settings?.templateTapBehavior || 'fill') === 'fill'
                      ? 'border-[var(--orange-400)] bg-[var(--orange-400)]'
                      : 'border-[var(--text-muted)]'
                  }`}>
                    {(settings?.templateTapBehavior || 'fill') === 'fill' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-black" />
                    )}
                  </div>
                  <div>
                    <span className="font-semibold block text-white">Rellenar formulario (por defecto)</span>
                    <span className="text-[11px] text-[var(--text-secondary)] block mt-0.5">
                      Carga los datos en el formulario y te permite revisar o ingresar el monto antes de guardar.
                    </span>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setTemplateTapBehavior('instant')}
                  className={`p-2.5 rounded-lg text-left text-xs border transition-all flex items-start gap-2.5 ${
                    settings?.templateTapBehavior === 'instant'
                      ? 'border-[var(--orange-400)] bg-[var(--orange-950)] text-white'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white'
                  }`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full border mt-0.5 flex items-center justify-center flex-shrink-0 ${
                    settings?.templateTapBehavior === 'instant'
                      ? 'border-[var(--orange-400)] bg-[var(--orange-400)]'
                      : 'border-[var(--text-muted)]'
                  }`}>
                    {settings?.templateTapBehavior === 'instant' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-black" />
                    )}
                  </div>
                  <div>
                    <span className="font-semibold block text-white">Registrar al instante</span>
                    <span className="text-[11px] text-[var(--text-secondary)] block mt-0.5">
                      Guarda el movimiento inmediatamente con 1 toque (si tiene monto definido) y muestra botón Deshacer.
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* Lista de plantillas */}
            {templates.length === 0 ? (
              <div
                className="rounded-2xl p-8 text-center text-xs text-[var(--text-muted)] flex flex-col items-center justify-center gap-2"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px dashed var(--border-default)',
                }}
              >
                <Bookmark size={24} className="text-[var(--text-muted)] opacity-60 mb-1" />
                <span className="font-semibold text-white">No tienes plantillas creadas todavía</span>
                <span>Crea tu primera plantilla o activa "Guardar también como plantilla" al registrar cualquier movimiento.</span>
                <Button
                  variant="outline"
                  size="sm"
                  icon={Plus}
                  className="mt-2"
                  onClick={() => {
                    setEditingTemplate(null)
                    setIsTemplateModalOpen(true)
                  }}
                >
                  Crear plantilla
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {templates.map((tpl, index) => {
                  const validation = validateTemplate(tpl, accounts, categories)
                  const account = accountsMap.get(tpl.accountId)
                  const category = categoriesMap.get(tpl.categoryId)
                  const isFirst = index === 0
                  const isLast = index === templates.length - 1

                  return (
                    <div
                      key={tpl.id}
                      className="rounded-xl p-3 flex flex-col gap-2 transition-all"
                      style={{
                        background: 'var(--bg-surface)',
                        border: validation.isValid ? '1px solid var(--border-subtle)' : '1px solid var(--red-500)',
                      }}
                    >
                      {/* Advertencia si es inválida */}
                      {!validation.isValid && (
                        <div
                          className="px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-2"
                          style={{
                            background: 'var(--red-900)',
                            color: 'var(--red-400)',
                          }}
                        >
                          <AlertTriangle size={14} className="flex-shrink-0" />
                          <span>{validation.reason || 'Plantilla incompleta. Edítala para corregir la cuenta o categoría.'}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {/* Botones para subir/bajar orden */}
                          <div className="flex flex-col gap-0.5">
                            <button
                              type="button"
                              disabled={isFirst}
                              onClick={() => moveTemplate(tpl.id, 'up')}
                              aria-label="Subir orden"
                              className="w-6 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-white disabled:opacity-20 disabled:hover:text-[var(--text-muted)] transition-colors"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={isLast}
                              onClick={() => moveTemplate(tpl.id, 'down')}
                              aria-label="Bajar orden"
                              className="w-6 h-5 rounded flex items-center justify-center text-[var(--text-muted)] hover:text-white disabled:opacity-20 disabled:hover:text-[var(--text-muted)] transition-colors"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>

                          {/* Info de la plantilla */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-white truncate">{tpl.name}</span>
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                style={{
                                  background: tpl.type === 'expense' ? 'var(--red-900)' : tpl.type === 'income' ? 'var(--green-900)' : 'var(--blue-900)',
                                  color: tpl.type === 'expense' ? 'var(--red-400)' : tpl.type === 'income' ? 'var(--green-400)' : 'var(--blue-400)',
                                }}
                              >
                                {tpl.type === 'expense' ? 'Gasto' : tpl.type === 'income' ? 'Ingreso' : 'Transf.'}
                              </span>
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-2 mt-0.5 truncate">
                              <span>
                                {tpl.amountCents !== null ? formatMoney(tpl.amountCents, tpl.currency || 'MXN') : 'Monto variable'}
                              </span>
                              <span>•</span>
                              <span>{account?.name || (tpl.accountId ? 'Cuenta eliminada' : 'Sin cuenta')}</span>
                              {tpl.type !== 'transfer' && (
                                <>
                                  <span>•</span>
                                  <span>{category?.name || (tpl.categoryId ? 'Categoría eliminada' : 'Sin categoría')}</span>
                                </>
                              )}
                              <span>•</span>
                              <span>{tpl.useCount || 0} usos</span>
                            </div>
                          </div>
                        </div>

                        {/* Acciones Editar y Eliminar */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTemplate(tpl)
                              setIsTemplateModalOpen(true)
                            }}
                            aria-label={`Editar ${tpl.name}`}
                            className="flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-white transition-colors"
                            style={{ minWidth: '44px', minHeight: '44px' }}
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`¿Eliminar la plantilla "${tpl.name}"?`)) {
                                await deleteTemplate(tpl.id)
                                setSaveSuccessMsg('Plantilla eliminada.')
                                setTimeout(() => setSaveSuccessMsg(''), 3000)
                              }
                            }}
                            aria-label={`Eliminar ${tpl.name}`}
                            className="flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--red-400)] transition-colors"
                            style={{ minWidth: '44px', minHeight: '44px' }}
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

        {/* ── SECCIÓN 4: INVERSIONES Y TIPO DE CAMBIO ── */}
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

            {/* Configuración de Patrimonio y Deudas */}
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
                  <HandCoins size={18} className="text-[var(--orange-400)]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Incluir deudas y préstamos en el patrimonio</h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Suma lo que te deben y resta lo que debes en el cálculo del patrimonio neto de Cuentas.
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={Boolean(settings?.includeDebtsInNetWorth)}
                onClick={async () => {
                  const nextVal = !settings?.includeDebtsInNetWorth
                  await setIncludeDebtsInNetWorth(nextVal)
                  setSaveSuccessMsg(nextVal ? 'Deudas incluidas en el patrimonio.' : 'Deudas excluidas del patrimonio.')
                  setTimeout(() => setSaveSuccessMsg(''), 3000)
                }}
                className="flex items-center justify-center p-2 text-[var(--text-muted)] hover:text-white transition-colors"
                style={{ minWidth: '44px', minHeight: '44px' }}
                aria-label="Alternar inclusión de deudas en el patrimonio"
              >
                {settings?.includeDebtsInNetWorth ? (
                  <ToggleRight size={28} className="text-[var(--orange-400)]" />
                ) : (
                  <ToggleLeft size={28} className="text-[var(--text-muted)]" />
                )}
              </button>
            </div>

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

            {/* Configuración del Widget de Tipo de Cambio (Monedas visibles, orden y principal) */}
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
                  <h3 className="text-sm font-bold text-white">Monedas en el Widget de Tipo de Cambio</h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Elige qué monedas ver en el carrusel superior del Panorama, su orden y cuál es la principal.
                  </p>
                </div>
              </div>

              {/* Lista ordenada de monedas del widget */}
              <div className="flex flex-col gap-2 mt-1">
                {AVAILABLE_FX_PAIRS.map((pairItem) => {
                  const isEnabled = enabledFxList.includes(pairItem.code)
                  const isPrimary = primaryFxInput === pairItem.code
                  const orderIndex = enabledFxList.indexOf(pairItem.code)

                  return (
                    <div
                      key={pairItem.code}
                      className="p-2.5 rounded-xl flex items-center justify-between gap-2 transition-all"
                      style={{
                        background: isEnabled ? 'var(--bg-elevated)' : 'transparent',
                        border: isEnabled ? '1px solid var(--border-default)' : '1px dashed var(--border-subtle)',
                        opacity: isEnabled ? 1 : 0.6,
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Checkbox para activar/desactivar */}
                        <button
                          type="button"
                          onClick={() => handleToggleCurrency(pairItem.code)}
                          aria-label={isEnabled ? `Ocultar ${pairItem.pair}` : `Mostrar ${pairItem.pair}`}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-white"
                        >
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={() => handleToggleCurrency(pairItem.code)}
                            className="w-4 h-4 accent-[var(--orange-400)] cursor-pointer pointer-events-none"
                          />
                        </button>

                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-xs text-white">
                              {pairItem.pair}
                            </span>
                            {isPrimary && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase"
                                style={{
                                  background: 'var(--orange-900)',
                                  color: 'var(--orange-400)',
                                }}
                              >
                                Principal
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[var(--text-secondary)] truncate">
                            {pairItem.name}
                          </span>
                        </div>
                      </div>

                      {/* Controles: Fijar principal (estrella) y reordenar (subir/bajar) */}
                      <div className="flex items-center gap-1">
                        {isEnabled && (
                          <>
                            <button
                              type="button"
                              onClick={() => setPrimaryFxInput(pairItem.code)}
                              title={isPrimary ? 'Es la moneda principal' : 'Fijar como moneda principal'}
                              aria-label={`Fijar ${pairItem.code} como principal`}
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--orange-400)] transition-colors"
                            >
                              <Star
                                size={16}
                                className={isPrimary ? 'text-[var(--orange-400)] fill-[var(--orange-400)]' : 'opacity-60'}
                              />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMoveCurrency(orderIndex, -1)}
                              disabled={orderIndex <= 0}
                              title="Mover arriba"
                              aria-label={`Mover ${pairItem.code} arriba`}
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            >
                              <ArrowUp size={16} />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleMoveCurrency(orderIndex, 1)}
                              disabled={orderIndex >= enabledFxList.length - 1}
                              title="Mover abajo"
                              aria-label={`Mover ${pairItem.code} abajo`}
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors"
                            >
                              <ArrowDown size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Selector de Modo */}
              <div className="pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <label className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider block mb-2">
                  Modo de Cotización
                </label>
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
              </div>

              {/* Inputs para tasas manuales/fallback */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[var(--text-muted)]">
                    {fxModeInput === 'auto' ? 'Respaldo USD ($ MXN por 1 USD):' : 'Tasa fija USD ($ MXN por 1 USD):'}
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
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-[var(--text-muted)]">
                    {fxModeInput === 'auto' ? 'Respaldo EUR ($ MXN por 1 EUR):' : 'Tasa fija EUR ($ MXN por 1 EUR):'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-[var(--text-muted)] font-mono">€</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      value={fxRateEurInput}
                      onChange={(e) => setFxRateEurInput(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 rounded-lg text-xs text-white font-mono outline-none"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                      }}
                    />
                  </div>
                </div>
              </div>

              <span className="text-[11px] text-[var(--text-muted)]">
                {fxModeInput === 'auto'
                  ? 'Las tasas de respaldo se utilizan cuando la app está sin conexión a internet o los servidores de cotizaciones fallan.'
                  : 'Todas las conversiones usarán siempre estas tasas fijas.'}
              </span>

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
          </div>
        )}

        {/* ── SECCIÓN 5: RECORDATORIOS UNIFICADOS ── */}
        {activeTab === 'reminders' && (
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

            {/* Banner de Estado de Permisos de Notificación */}
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
                    background: permissionStatus === 'granted' ? 'var(--orange-900)' : 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: permissionStatus === 'granted' ? 'var(--orange-400)' : 'var(--text-muted)',
                  }}
                >
                  <Bell size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white">Permisos de Notificación</span>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                      style={{
                        background: permissionStatus === 'granted' ? 'var(--orange-900)' : 'var(--red-900)',
                        color: permissionStatus === 'granted' ? 'var(--orange-400)' : 'var(--red-400)',
                      }}
                    >
                      {permissionStatus === 'granted' ? 'Activos' : permissionStatus === 'denied' ? 'Bloqueados' : 'Sin activar'}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    {permissionStatus === 'granted'
                      ? 'Las notificaciones locales están autorizadas en este dispositivo.'
                      : 'Activa los permisos para recibir tus avisos de cortes y vencimientos.'}
                  </p>
                </div>
              </div>

              {permissionStatus !== 'granted' && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => setIsPermissionModalOpen(true)}
                >
                  Configurar
                </Button>
              )}
            </div>

            {/* Nota de Programación No Exacta y Privacidad */}
            <div
              className="p-3.5 rounded-xl flex items-start gap-2.5 text-xs"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <Clock size={16} className="text-[var(--orange-400)] flex-shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1 leading-relaxed">
                <span className="font-semibold text-white">Programación de bajo consumo</span>
                <p className="text-[11px]">
                  Los recordatorios se programan en tu dispositivo sin consumo excesivo de batería (sin alarmas exactas). Debido a la optimización de Android (modo Doze), los avisos pueden llegar con unos minutos de diferencia respecto a la hora configurada.
                </p>
              </div>
            </div>

            {/* Botón Enviar Notificación de Prueba */}
            <div
              className="p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div>
                <span className="font-bold text-sm text-white block">Notificación de Prueba</span>
                <span className="text-xs text-[var(--text-secondary)] block mt-0.5">
                  Verifica que tu celular muestre y haga sonar las alertas de Finanzas.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                icon={Bell}
                disabled={isSendingTestNotif}
                onClick={() => handleSendTestNotification()}
              >
                {isSendingTestNotif ? 'Enviando...' : 'Enviar prueba'}
              </Button>
            </div>

            {/* Lista de Canales y Tipos de Recordatorios */}
            <div className="flex flex-col gap-3">
              <h3 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Configuración por Tipo de Recordatorio
              </h3>

              {/* 1. Registro Diario */}
              <ReminderRow
                title="Registro diario de movimientos"
                description="Te recuerda cada noche registrar tus gastos para mantener el control. Si ya registraste hoy, se cancela automáticamente."
                icon={CalendarClock}
                enabled={Boolean((settings?.reminders || DEFAULT_REMINDER_SETTINGS).dailyLog?.enabled)}
                time={(settings?.reminders || DEFAULT_REMINDER_SETTINGS).dailyLog?.time || '21:00'}
                onToggle={() => handleToggleReminder('dailyLog')}
                onChangeTime={(t) => handleChangeReminderTime('dailyLog', t)}
              />

              {/* 2. Tarjetas de Crédito */}
              <ReminderRow
                title="Cortes y fechas límite de pago"
                description="Avisos el día de corte de tus tarjetas y en la fecha límite de pago para evitar intereses."
                icon={CreditCard}
                enabled={Boolean((settings?.reminders || DEFAULT_REMINDER_SETTINGS).creditCards?.enabled)}
                time={(settings?.reminders || DEFAULT_REMINDER_SETTINGS).creditCards?.time || '09:00'}
                onToggle={() => handleToggleReminder('creditCards')}
                onChangeTime={(t) => handleChangeReminderTime('creditCards', t)}
              />

              {/* 3. Gastos Fijos */}
              <ReminderRow
                title="Gastos fijos y suscripciones"
                description="Avisos el día que vencen tus servicios, rentas o suscripciones pendientes del mes."
                icon={CalendarDays}
                enabled={Boolean((settings?.reminders || DEFAULT_REMINDER_SETTINGS).fixedExpenses?.enabled)}
                time={(settings?.reminders || DEFAULT_REMINDER_SETTINGS).fixedExpenses?.time || '10:00'}
                onToggle={() => handleToggleReminder('fixedExpenses')}
                onChangeTime={(t) => handleChangeReminderTime('fixedExpenses', t)}
              />

              {/* 4. Ingresos Esperados */}
              <ReminderRow
                title="Ingresos recurrentes previstos"
                description="Avisos el día programado de tu sueldo, quincena o cobro de rentas."
                icon={TrendingUp}
                enabled={Boolean((settings?.reminders || DEFAULT_REMINDER_SETTINGS).expectedIncomes?.enabled)}
                time={(settings?.reminders || DEFAULT_REMINDER_SETTINGS).expectedIncomes?.time || '09:00'}
                onToggle={() => handleToggleReminder('expectedIncomes')}
                onChangeTime={(t) => handleChangeReminderTime('expectedIncomes', t)}
              />

              {/* 5. Deudas y Préstamos */}
              <ReminderRow
                title="Deudas y préstamos por vencer"
                description="Avisos cuando vence un préstamo que otorgaste o un dinero que debes devolver."
                icon={HandCoins}
                enabled={Boolean((settings?.reminders || DEFAULT_REMINDER_SETTINGS).debts?.enabled)}
                time={(settings?.reminders || DEFAULT_REMINDER_SETTINGS).debts?.time || '09:00'}
                onToggle={() => handleToggleReminder('debts')}
                onChangeTime={(t) => handleChangeReminderTime('debts', t)}
              />

              {/* 6. Respaldo Semanal */}
              <ReminderRow
                title="Respaldo semanal"
                description="Recordatorio dominical para exportar una copia de seguridad si no has respaldado recientemente."
                icon={Archive}
                enabled={Boolean((settings?.reminders || DEFAULT_REMINDER_SETTINGS).weeklyBackup?.enabled)}
                time={(settings?.reminders || DEFAULT_REMINDER_SETTINGS).weeklyBackup?.time || '12:00'}
                onToggle={() => handleToggleReminder('weeklyBackup')}
                onChangeTime={(t) => handleChangeReminderTime('weeklyBackup', t)}
              />
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
                    <option key={a.id} value={a.id}>{accountLabel(a)}</option>
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

      {/* ── Modal de Crear / Editar Plantilla ── */}
      <TemplateFormModal
        isOpen={isTemplateModalOpen}
        onClose={() => {
          setIsTemplateModalOpen(false)
          setEditingTemplate(null)
        }}
        onSave={async (data) => {
          if (editingTemplate?.id) {
            await updateTemplate(editingTemplate.id, data)
            setSaveSuccessMsg('Plantilla actualizada.')
          } else {
            await addTemplate(data)
            setSaveSuccessMsg('Plantilla creada correctamente.')
          }
          setIsTemplateModalOpen(false)
          setEditingTemplate(null)
          setTimeout(() => setSaveSuccessMsg(''), 3000)
        }}
        template={editingTemplate}
        accounts={accounts}
        categories={categories}
      />

      {/* ── Modal de Crear / Editar Ingreso Recurrente ── */}
      <RecurringIncomeModal
        isOpen={isIncomeModalOpen}
        onClose={() => {
          setIsIncomeModalOpen(false)
          setEditingIncome(null)
        }}
        income={editingIncome}
        accounts={accounts}
        categories={categories}
        onSave={async (payload) => {
          if (editingIncome?.id) {
            await updateRecurringIncome(editingIncome.id, payload)
            setSaveSuccessMsg('Ingreso recurrente actualizado.')
          } else {
            await addRecurringIncome(payload)
            setSaveSuccessMsg('Ingreso recurrente guardado correctamente.')
          }
          setIsIncomeModalOpen(false)
          setEditingIncome(null)
          setTimeout(() => setSaveSuccessMsg(''), 3000)
        }}
      />

      {/* ── Modal de Permisos de Notificación ── */}
      <NotificationPermissionModal
        isOpen={isPermissionModalOpen}
        onClose={() => setIsPermissionModalOpen(false)}
        onPermissionGranted={() => {
          setPermissionStatus('granted')
          rescheduleAll().catch(() => {})
          setSaveSuccessMsg('Permisos otorgados y recordatorios sincronizados.')
          setTimeout(() => setSaveSuccessMsg(''), 4000)
        }}
      />
    </div>
  )
}

/**
 * Fila de configuración de un recordatorio con toggle y time picker.
 */
function ReminderRow({ title, description, icon: Icon, enabled, time, onToggle, onChangeTime }) {
  return (
    <div
      className="p-3.5 sm:p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{
            background: enabled ? 'var(--orange-900)' : 'var(--bg-elevated)',
            color: enabled ? 'var(--orange-400)' : 'var(--text-muted)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <Icon size={18} />
        </div>
        <div>
          <span className="font-bold text-xs text-white block">{title}</span>
          <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">{description}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 self-end sm:self-center flex-shrink-0">
        {enabled && (
          <div className="flex items-center gap-1.5 bg-[var(--bg-elevated)] px-2.5 py-1 rounded-lg border border-[var(--border-subtle)]">
            <Clock size={12} className="text-[var(--text-muted)]" />
            <input
              type="time"
              value={time}
              onChange={(e) => onChangeTime(e.target.value)}
              className="bg-transparent text-white font-mono text-xs outline-none cursor-pointer"
              style={{ minHeight: '36px' }}
              title="Hora del recordatorio"
            />
          </div>
        )}

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={onToggle}
          className="flex items-center justify-center p-2 text-[var(--text-muted)] hover:text-white transition-colors"
          style={{ minWidth: '44px', minHeight: '44px' }}
          aria-label={`Alternar ${title}`}
        >
          {enabled ? (
            <ToggleRight size={28} className="text-[var(--orange-400)]" />
          ) : (
            <ToggleLeft size={28} className="text-[var(--text-muted)]" />
          )}
        </button>
      </div>
    </div>
  )
}


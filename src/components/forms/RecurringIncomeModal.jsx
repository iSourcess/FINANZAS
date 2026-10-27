/**
 * src/components/forms/RecurringIncomeModal.jsx
 *
 * Modal para crear o editar un ingreso recurrente (sueldo, quincena, renta, etc.).
 *
 * Campos:
 *   - Nombre del ingreso (ej. "Nómina quincenal", "Renta depto")
 *   - Monto en pesos (se guarda en centavos enteros)
 *   - Moneda: MXN / USD
 *   - Cuenta destino: selector de cuentas
 *   - Categoría de ingreso: selector con íconos
 *   - Frecuencia: Mensual / Quincenal / Semanal
 *   - Regla de calendario (schedule):
 *       * Mensual: día del mes (1..31) o último día del mes
 *       * Quincenal: dos días del mes (por defecto 15 y último día)
 *       * Semanal: día de la semana (Lunes a Domingo)
 *   - Fecha de inicio (startDate, en hora local)
 */

import { useState, useEffect } from 'react'
import {
  CalendarClock,
  AlertCircle,
  Calendar,
  CreditCard,
  Tag,
  Check,
} from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { centsToInput, inputToCents, accountLabel } from '../../lib/format.js'
import { toISODate } from '../../domain/periods.js'

const DAYS_OF_WEEK = [
  { value: 1, label: 'Lunes' },
  { value: 2, label: 'Martes' },
  { value: 3, label: 'Miércoles' },
  { value: 4, label: 'Jueves' },
  { value: 5, label: 'Viernes' },
  { value: 6, label: 'Sábado' },
  { value: 0, label: 'Domingo' },
]

export default function RecurringIncomeModal({
  isOpen,
  onClose,
  income = null,
  accounts = [],
  categories = [],
  onSave,
}) {
  const isEditing = Boolean(income && income.id)

  const [name, setName] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [currency, setCurrency] = useState('MXN')
  const [accountId, setAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [frequency, setFrequency] = useState('monthly')
  const [startDate, setStartDate] = useState(toISODate(new Date()))

  // Schedule fields
  const [monthlyDay, setMonthlyDay] = useState('15')
  const [monthlyIsLastDay, setMonthlyIsLastDay] = useState(false)

  const [biweeklyDay1, setBiweeklyDay1] = useState('15')
  const [biweeklyDay2, setBiweeklyDay2] = useState('last')

  const [weeklyDayOfWeek, setWeeklyDayOfWeek] = useState(1) // Lunes

  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Categorías de ingreso disponibles
  const incomeCategories = categories.filter(c => c.type === 'income')
  const usableCategories = incomeCategories.length > 0 ? incomeCategories : categories

  // Cuentas disponibles
  const usableAccounts = accounts.filter(a => a.type !== 'credit')

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('')
      setIsSubmitting(false)

      if (income) {
        setName(income.name || '')
        setAmountInput(income.amountCents ? centsToInput(income.amountCents) : '')
        setCurrency(income.currency || 'MXN')
        setAccountId(income.accountId || (usableAccounts[0]?.id || ''))
        setCategoryId(income.categoryId || (usableCategories[0]?.id || ''))
        setFrequency(income.frequency || 'monthly')
        setStartDate(income.startDate || toISODate(new Date()))

        const sched = income.schedule || {}
        if (income.frequency === 'monthly') {
          const day = sched.dayOfMonth ?? 15
          if (day === 'last' || day === 'último') {
            setMonthlyIsLastDay(true)
            setMonthlyDay('31')
          } else {
            setMonthlyIsLastDay(false)
            setMonthlyDay(String(day))
          }
        } else if (income.frequency === 'biweekly') {
          setBiweeklyDay1(String(sched.day1 ?? 15))
          setBiweeklyDay2(String(sched.day2 ?? 'last'))
        } else if (income.frequency === 'weekly') {
          setWeeklyDayOfWeek(typeof sched.dayOfWeek === 'number' ? sched.dayOfWeek : 1)
        }
      } else {
        setName('')
        setAmountInput('')
        setCurrency('MXN')
        setAccountId(usableAccounts[0]?.id || '')
        setCategoryId(usableCategories[0]?.id || '')
        setFrequency('biweekly') // Quincena común por defecto
        setStartDate(toISODate(new Date()))
        setMonthlyDay('15')
        setMonthlyIsLastDay(false)
        setBiweeklyDay1('15')
        setBiweeklyDay2('last')
        setWeeklyDayOfWeek(5) // Viernes
      }
    }
  }, [isOpen, income])

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setErrorMsg('')

    if (!name.trim()) {
      setErrorMsg('Ingresa un nombre para identificar este ingreso.')
      return
    }

    const cents = inputToCents(amountInput)
    if (!cents || cents <= 0) {
      setErrorMsg('Ingresa un monto válido mayor a 0.')
      return
    }

    if (!accountId) {
      setErrorMsg('Selecciona la cuenta donde se depositará el ingreso.')
      return
    }

    // Construir schedule según frecuencia
    let schedule = {}
    if (frequency === 'monthly') {
      schedule = {
        dayOfMonth: monthlyIsLastDay ? 'last' : Math.min(31, Math.max(1, parseInt(monthlyDay, 10) || 1)),
      }
    } else if (frequency === 'biweekly') {
      const d1 = Math.min(31, Math.max(1, parseInt(biweeklyDay1, 10) || 15))
      const d2 = biweeklyDay2 === 'last' ? 'last' : Math.min(31, Math.max(1, parseInt(biweeklyDay2, 10) || 30))
      schedule = { day1: d1, day2: d2 }
    } else if (frequency === 'weekly') {
      schedule = { dayOfWeek: Number(weeklyDayOfWeek) }
    }

    const payload = {
      name: name.trim(),
      amountCents: cents,
      currency,
      accountId,
      categoryId: categoryId || null,
      frequency,
      schedule,
      startDate: startDate || toISODate(new Date()),
      active: income?.active !== false,
    }

    try {
      setIsSubmitting(true)
      await onSave(payload)
      onClose()
    } catch (err) {
      console.error('Error al guardar ingreso recurrente:', err)
      setErrorMsg('Ocurrió un error al guardar. Intenta de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar ingreso recurrente' : 'Nuevo ingreso recurrente'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
        {errorMsg && (
          <div
            className="p-3 rounded-xl flex items-center gap-2"
            style={{
              background: 'var(--red-900)',
              border: '1px solid var(--red-700)',
              color: 'var(--red-400)',
            }}
          >
            <AlertCircle size={15} className="flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Nombre */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
            Nombre del ingreso *
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ej. Sueldo de empresa, Quincena, Renta cobrada"
            className="w-full px-3 py-2.5 rounded-xl text-white outline-none transition-colors"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              minHeight: '44px',
            }}
            maxLength={60}
          />
        </div>

        {/* Monto y Moneda */}
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2 flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
              Monto esperado *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono">
                $
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0.00"
                className="w-full pl-7 pr-3 py-2.5 rounded-xl text-white font-mono outline-none"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  minHeight: '44px',
                }}
              />
            </div>
          </div>

          <div className="col-span-1 flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
              Moneda
            </label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-white outline-none cursor-pointer"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                minHeight: '44px',
              }}
            >
              <option value="MXN">MXN ($)</option>
              <option value="USD">USD ($)</option>
            </select>
          </div>
        </div>

        {/* Cuenta destino */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
            <CreditCard size={13} className="text-[var(--orange-400)]" />
            <span>Cuenta donde cae el dinero *</span>
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-white outline-none cursor-pointer"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              minHeight: '44px',
            }}
          >
            {usableAccounts.map(acc => (
              <option key={acc.id} value={acc.id}>
                {accountLabel(acc)} ({acc.currency})
              </option>
            ))}
          </select>
        </div>

        {/* Categoría */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
            <Tag size={13} className="text-[var(--orange-400)]" />
            <span>Categoría</span>
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-white outline-none cursor-pointer"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              minHeight: '44px',
            }}
          >
            <option value="">Sin categoría asignada</option>
            {usableCategories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Frecuencia Selector (Pills) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
            <CalendarClock size={13} className="text-[var(--orange-400)]" />
            <span>Frecuencia de pago</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'biweekly', label: 'Quincenal' },
              { id: 'monthly', label: 'Mensual' },
              { id: 'weekly', label: 'Semanal' },
            ].map(f => {
              const active = frequency === f.id
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFrequency(f.id)}
                  className="py-2.5 px-2 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                  style={{
                    background: active ? 'var(--orange-500)' : 'var(--bg-elevated)',
                    color: active ? '#000' : 'var(--text-secondary)',
                    border: active ? '1px solid var(--orange-500)' : '1px solid var(--border-default)',
                    minHeight: '44px',
                  }}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Configuración según frecuencia (schedule) */}
        <div
          className="p-3 rounded-xl flex flex-col gap-2.5"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {frequency === 'monthly' && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-white">Día de cobro mensual</span>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={monthlyIsLastDay}
                    onChange={(e) => setMonthlyIsLastDay(e.target.checked)}
                    className="w-4 h-4 rounded text-[var(--orange-500)] focus:ring-0"
                  />
                  <span className="text-xs text-[var(--text-secondary)]">Último día de cada mes</span>
                </label>
              </div>

              {!monthlyIsLastDay && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[var(--text-secondary)]">Día:</span>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={monthlyDay}
                    onChange={(e) => setMonthlyDay(e.target.value)}
                    className="w-20 px-3 py-1.5 rounded-lg text-white font-mono text-center outline-none"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      minHeight: '44px',
                    }}
                  />
                  <span className="text-[11px] text-[var(--text-muted)]">
                    (Se recorta si el mes tiene menos días)
                  </span>
                </div>
              )}
            </div>
          )}

          {frequency === 'biweekly' && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-white">Días de quincena</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-[var(--text-muted)]">Primer pago</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[var(--text-secondary)]">Día</span>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={biweeklyDay1}
                      onChange={(e) => setBiweeklyDay1(e.target.value)}
                      className="w-16 px-2.5 py-1.5 rounded-lg text-white font-mono text-center outline-none"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-default)',
                        minHeight: '44px',
                      }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] text-[var(--text-muted)]">Segundo pago</span>
                  <select
                    value={biweeklyDay2}
                    onChange={(e) => setBiweeklyDay2(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg text-white outline-none cursor-pointer text-xs"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-default)',
                      minHeight: '44px',
                    }}
                  >
                    <option value="last">Último día del mes</option>
                    <option value="30">Día 30</option>
                    <option value="28">Día 28</option>
                    <option value="1">Día 1 del siguiente mes</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {frequency === 'weekly' && (
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-white">Día de pago cada semana</span>
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
                {DAYS_OF_WEEK.map(d => {
                  const isSel = weeklyDayOfWeek === d.value
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => setWeeklyDayOfWeek(d.value)}
                      className="py-2 px-1 rounded-lg text-xs font-semibold transition-colors"
                      style={{
                        background: isSel ? 'var(--orange-500)' : 'var(--bg-elevated)',
                        color: isSel ? '#000' : 'var(--text-secondary)',
                        border: isSel ? '1px solid var(--orange-500)' : '1px solid var(--border-default)',
                        minHeight: '44px',
                      }}
                    >
                      {d.label.slice(0, 3)}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Fecha de inicio */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
            <Calendar size={13} className="text-[var(--orange-400)]" />
            <span>Fecha de inicio de este ingreso</span>
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-white font-mono outline-none cursor-pointer"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              minHeight: '44px',
            }}
          />
          <span className="text-[10px] text-[var(--text-muted)]">
            Solo se generarán ocurrencias a partir de esta fecha (hasta un máximo de 2 meses atrás).
          </span>
        </div>

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            className="min-h-[44px]"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            className="min-h-[44px] flex items-center gap-1.5"
          >
            <Check size={15} />
            <span>{isEditing ? 'Guardar cambios' : 'Crear ingreso recurrente'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  )
}

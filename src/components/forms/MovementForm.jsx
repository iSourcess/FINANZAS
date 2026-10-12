/**
 * src/components/forms/MovementForm.jsx
 *
 * Formulario para registrar y editar movimientos financieros.
 *
 * Campos:
 *   - Selector: Ingreso / Gasto / Transferencia
 *   - Monto: AmountInput en centavos enteros con selector MXN/USD
 *   - Cuenta: CardPicker con sugerencia preseleccionada
 *   - En transferencias: selector de cuenta origen y cuenta destino
 *   - En tarjetas de crédito: opción 'A Meses Sin Intereses' (3, 6, 9, 12, 18, 24)
 *   - Categoría: selector con íconos de lucide-react y color de donut
 *   - Fecha: selector de fecha (hoy por defecto) con accesos rápidos
 *   - Nota: campo de texto libre opcional
 */

import { useState, useEffect } from 'react'
import {
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
  ArrowRightLeft,
  Calendar,
  Check,
  CreditCard,
} from 'lucide-react'
import AmountInput from './AmountInput.jsx'
import CardPicker from '../wallet/CardPicker.jsx'
import Button from '../ui/Button.jsx'
import { ALLOWED_MSI_MONTHS } from '../../domain/msi.js'
import { formatMoney } from '../../lib/format.js'

// Mapa de íconos por nombre en lucide-react
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

export default function MovementForm({
  accounts = [],
  categories = [],
  initialMovement = null,
  onSave,
  onCancel,
}) {
  const isEditing = Boolean(initialMovement?.id)

  const [type, setType] = useState(initialMovement?.type || 'expense')
  const [amountCents, setAmountCents] = useState(initialMovement?.amount || 0)
  const [currency, setCurrency] = useState(initialMovement?.currency || 'MXN')
  const [accountId, setAccountId] = useState(initialMovement?.accountId || '')
  const [toAccountId, setToAccountId] = useState(initialMovement?.toAccountId || '')
  const [categoryId, setCategoryId] = useState(initialMovement?.categoryId || '')
  const [date, setDate] = useState(
    initialMovement?.date || new Date().toISOString().slice(0, 10)
  )
  const [note, setNote] = useState(initialMovement?.note || '')
  const [errorMsg, setErrorMsg] = useState('')

  // Estado para Meses Sin Intereses (MSI)
  const [isMsi, setIsMsi] = useState(Boolean(initialMovement?.msi))
  const [msiMonths, setMsiMonths] = useState(initialMovement?.msi?.months || 3)

  // Preseleccionar cuenta sugerida si no hay una seleccionada
  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      const suggested = accounts.find(a => !a.hidden) || accounts[0]
      setAccountId(suggested.id)
    }
  }, [accounts, accountId])

  // Preseleccionar cuenta destino para transferencias si está vacía o coincide con origen
  useEffect(() => {
    if (type === 'transfer' && accounts.length > 1) {
      if (!toAccountId || toAccountId === accountId) {
        const other = accounts.find(a => a.id !== accountId && !a.hidden) || accounts[1]
        if (other) setToAccountId(other.id)
      }
    }
  }, [type, accountId, toAccountId, accounts])

  // Identificar si la cuenta seleccionada es tarjeta de crédito
  const selectedAccount = accounts.find(a => a.id === accountId)
  const isCreditAccount = selectedAccount?.type === 'credit'

  // Filtrar categorías según el tipo seleccionado
  const filteredCategories = categories.filter(c => c.type === type && !c.hidden)

  // Preseleccionar primera categoría del tipo si no hay
  useEffect(() => {
    if (type !== 'transfer' && (!categoryId || !filteredCategories.some(c => c.id === categoryId))) {
      if (filteredCategories.length > 0) {
        setCategoryId(filteredCategories[0].id)
      }
    }
  }, [type, categoryId, filteredCategories])

  const todayStr = new Date().toISOString().slice(0, 10)
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  // Monto mensual estimado para MSI
  const monthlyMsiCents = isMsi && amountCents > 0
    ? Math.floor(amountCents / msiMonths)
    : 0

  const handleSubmit = (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!amountCents || amountCents <= 0) {
      setErrorMsg('Ingresa un monto mayor a $0.00.')
      return
    }

    if (!accountId) {
      setErrorMsg('Selecciona una cuenta.')
      return
    }

    if (type === 'transfer') {
      if (!toAccountId) {
        setErrorMsg('Selecciona la cuenta de destino para la transferencia.')
        return
      }
      if (accountId === toAccountId) {
        setErrorMsg('La cuenta origen y destino deben ser distintas.')
        return
      }
    } else {
      if (!categoryId) {
        setErrorMsg('Selecciona una categoría.')
        return
      }
    }

    // Configuración de MSI si aplica
    const msiData = isCreditAccount && type === 'expense' && isMsi ? {
      months: msiMonths,
      startDate: date,
      monthlyAmount: Math.floor(amountCents / msiMonths),
    } : null

    try {
      onSave({
        type,
        amount: amountCents,
        currency,
        accountId,
        toAccountId: type === 'transfer' ? toAccountId : null,
        categoryId: type === 'transfer' ? null : categoryId,
        date,
        note: note.trim(),
        msi: msiData,
      })

      if (!isEditing) {
        setAmountCents(0)
        setNote('')
        setIsMsi(false)
      }
    } catch (err) {
      setErrorMsg(err.message || 'Error al guardar el movimiento.')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl p-4 sm:p-5 flex flex-col gap-5 transition-all"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.4)',
      }}
    >
      {errorMsg && (
        <div
          className="p-3 rounded-xl text-xs"
          style={{
            background: 'var(--red-900)',
            color: 'var(--red-400)',
            border: '1px solid var(--red-600)',
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* ── Selector de Tipo: Gasto / Ingreso / Transferencia ── */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
        {[
          { id: 'expense', label: 'Gasto' },
          { id: 'income', label: 'Ingreso' },
          { id: 'transfer', label: 'Transferencia' },
        ].map((t) => {
          const isSelected = type === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setType(t.id)
                if (t.id !== 'expense') setIsMsi(false)
              }}
              className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                isSelected
                  ? 'bg-[var(--orange-400)] text-[var(--text-inverse)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* ── Input de Monto Hero ── */}
      <AmountInput
        cents={amountCents}
        onChangeCents={setAmountCents}
        currency={currency}
        onChangeCurrency={setCurrency}
      />

      {/* ── Selector de Cuenta(s) ── */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
          {type === 'transfer' ? 'Cuenta de Origen' : 'Cuenta / Tarjeta'}
        </label>
        <CardPicker
          accounts={accounts}
          selectedAccountId={accountId}
          onSelect={setAccountId}
        />
      </div>

      {/* Si es Transferencia: Selector de Cuenta Destino */}
      {type === 'transfer' && (
        <div className="pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowRightLeft size={14} className="text-[var(--orange-400)]" />
            <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
              Cuenta de Destino
            </label>
          </div>
          <CardPicker
            accounts={accounts.filter(a => a.id !== accountId)}
            selectedAccountId={toAccountId}
            onSelect={setToAccountId}
          />
        </div>
      )}

      {/* ── Opción de Meses Sin Intereses (MSI) para Tarjetas de Crédito ── */}
      {isCreditAccount && type === 'expense' && (
        <div
          className="p-3.5 rounded-xl flex flex-col gap-2.5 transition-all"
          style={{
            background: 'var(--bg-elevated)',
            border: isMsi ? '1px solid var(--orange-400)' : '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard size={16} className="text-[var(--orange-400)]" />
              <span className="text-xs font-semibold text-white">
                A Meses Sin Intereses (MSI)
              </span>
            </div>

            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isMsi}
                onChange={(e) => setIsMsi(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-[var(--bg-surface)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--orange-400)]" />
            </label>
          </div>

          {/* Opciones de plazo si MSI está activo */}
          {isMsi && (
            <div className="flex flex-col gap-2 pt-1 animate-in fade-in duration-200">
              <div className="grid grid-cols-6 gap-1.5">
                {ALLOWED_MSI_MONTHS.map((m) => {
                  const isSelected = msiMonths === m
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMsiMonths(m)}
                      className={`py-1.5 rounded-lg text-xs font-bold text-center border transition-all ${
                        isSelected
                          ? 'bg-[var(--orange-400)] text-[var(--text-inverse)] border-[var(--orange-400)]'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border-subtle)] hover:text-white'
                      }`}
                    >
                      {m} m
                    </button>
                  )
                })}
              </div>

              {amountCents > 0 && (
                <div className="text-[11px] text-[var(--text-secondary)] font-mono flex items-center justify-between pt-1">
                  <span>Mensualidad estimada:</span>
                  <span className="font-bold text-[var(--orange-400)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {msiMonths} pagos de ~{formatMoney(monthlyMsiCents, currency)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Selector de Categorías (solo para Ingreso o Gasto) ── */}
      {type !== 'transfer' && (
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-2">
            Categoría
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 max-h-48 overflow-y-auto p-1 scrollbar-none">
            {filteredCategories.map((cat) => {
              const isSelected = categoryId === cat.id
              const IconComp = ICON_MAP[cat.icon] || MoreHorizontal

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryId(cat.id)}
                  className="flex flex-col items-center justify-center gap-1.5 p-2.5 rounded-xl border text-center transition-all outline-none"
                  style={{
                    background: isSelected ? 'var(--orange-900)' : 'var(--bg-elevated)',
                    borderColor: isSelected ? 'var(--orange-400)' : 'var(--border-subtle)',
                    color: isSelected ? 'var(--orange-300)' : 'var(--text-secondary)',
                  }}
                >
                  <span
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                    style={{ background: cat.color || 'var(--orange-400)' }}
                  >
                    <IconComp size={16} />
                  </span>
                  <span className="text-xs font-medium truncate w-full">
                    {cat.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Fecha y Nota ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Fecha */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Fecha
          </label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg text-xs text-white outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
              }}
            />
            <button
              type="button"
              onClick={() => setDate(todayStr)}
              className={`px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                date === todayStr
                  ? 'border-[var(--orange-400)] text-[var(--orange-400)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-white'
              }`}
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={() => setDate(yesterdayStr)}
              className={`px-2.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
                date === yesterdayStr
                  ? 'border-[var(--orange-400)] text-[var(--orange-400)]'
                  : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-white'
              }`}
            >
              Ayer
            </button>
          </div>
        </div>

        {/* Nota */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Nota (opcional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: Tacos, Gasolina, Super..."
            className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
            }}
          />
        </div>
      </div>

      {/* ── Botón Guardar ── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {isEditing && (
          <Button variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button
          variant="primary"
          type="submit"
          className="w-full sm:w-auto"
          icon={Check}
        >
          {isEditing ? 'Guardar cambios' : 'Registrar movimiento'}
        </Button>
      </div>
    </form>
  )
}

/**
 * src/components/forms/ConfirmIncomeOccurrenceModal.jsx
 *
 * Diálogo modal para la acción "Ya me cayó".
 * Permite confirmar o ajustar el monto recibido, la fecha (fecha esperada o fecha de hoy)
 * y la cuenta donde cayó el dinero antes de crear el movimiento y marcar la ocurrencia como recibida.
 */

import { useState, useEffect } from 'react'
import { Check, AlertCircle, CreditCard, Calendar, DollarSign } from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { centsToInput, inputToCents, accountLabel } from '../../lib/format.js'
import { toISODate } from '../../domain/periods.js'

export default function ConfirmIncomeOccurrenceModal({
  isOpen,
  onClose,
  occurrence = null,
  recurringIncome = null,
  accounts = [],
  onConfirm,
}) {
  const [amountInput, setAmountInput] = useState('')
  const [date, setDate] = useState('')
  const [accountId, setAccountId] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const todayStr = toISODate(new Date())

  const usableAccounts = accounts.filter(a => a.type !== 'credit')

  useEffect(() => {
    if (isOpen && occurrence && recurringIncome) {
      setErrorMsg('')
      setIsSubmitting(false)
      setAmountInput(recurringIncome.amountCents ? centsToInput(recurringIncome.amountCents) : '')
      setDate(occurrence.dueDate || todayStr)
      setAccountId(recurringIncome.accountId || usableAccounts[0]?.id || '')
    }
  }, [isOpen, occurrence, recurringIncome])

  const handleConfirm = async (e) => {
    e?.preventDefault()
    setErrorMsg('')

    const cents = inputToCents(amountInput)
    if (!cents || cents <= 0) {
      setErrorMsg('Ingresa un monto válido mayor a 0.')
      return
    }

    if (!accountId) {
      setErrorMsg('Selecciona la cuenta de destino.')
      return
    }

    if (!date) {
      setErrorMsg('Selecciona la fecha del ingreso.')
      return
    }

    try {
      setIsSubmitting(true)
      await onConfirm({
        customAmountCents: cents,
        customDate: date,
        customAccountId: accountId,
      })
      onClose()
    } catch (err) {
      console.error('Error al registrar ingreso:', err)
      setErrorMsg('Error al registrar el movimiento. Intenta de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!occurrence || !recurringIncome) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirmar ingreso recibido"
    >
      <form onSubmit={handleConfirm} className="flex flex-col gap-4 text-xs">
        <div
          className="p-3 rounded-xl flex items-center justify-between"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <span className="text-[11px] text-[var(--text-muted)] block">Ingreso esperado</span>
            <span className="font-semibold text-sm text-white">{recurringIncome.name}</span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded font-mono font-bold bg-[var(--orange-900)] text-[var(--orange-400)]">
            Vence {occurrence.dueDate}
          </span>
        </div>

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

        {/* Monto editable */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
            <DollarSign size={13} className="text-[var(--orange-400)]" />
            <span>Monto recibido ({recurringIncome.currency}) *</span>
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
              className="w-full pl-7 pr-3 py-2.5 rounded-xl text-white font-mono text-sm font-bold outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                minHeight: '44px',
              }}
            />
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">
            Puedes ajustar el monto si recibiste bono, retención o ajuste en tu pago.
          </span>
        </div>

        {/* Fecha con botones rápidos */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
            <Calendar size={13} className="text-[var(--orange-400)]" />
            <span>Fecha del ingreso *</span>
          </label>
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => setDate(occurrence.dueDate)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: date === occurrence.dueDate ? 'var(--orange-900)' : 'var(--bg-elevated)',
                color: date === occurrence.dueDate ? 'var(--orange-400)' : 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
                minHeight: '36px',
              }}
            >
              Fecha esperada ({occurrence.dueDate.slice(5)})
            </button>
            <button
              type="button"
              onClick={() => setDate(todayStr)}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={{
                background: date === todayStr ? 'var(--orange-900)' : 'var(--bg-elevated)',
                color: date === todayStr ? 'var(--orange-400)' : 'var(--text-secondary)',
                border: '1px solid var(--border-default)',
                minHeight: '36px',
              }}
            >
              Hoy ({todayStr.slice(5)})
            </button>
          </div>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl text-white font-mono outline-none cursor-pointer"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              minHeight: '44px',
            }}
          />
        </div>

        {/* Cuenta destino */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
            <CreditCard size={13} className="text-[var(--orange-400)]" />
            <span>Cuenta donde se deposita *</span>
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

        {/* Acciones */}
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
            <span>Confirmar ingreso</span>
          </Button>
        </div>
      </form>
    </Modal>
  )
}

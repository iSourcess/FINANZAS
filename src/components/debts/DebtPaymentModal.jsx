/**
 * src/components/debts/DebtPaymentModal.jsx
 *
 * Modal para registrar un abono a una deuda.
 *
 * Reglas:
 *   - Valida el monto respecto al saldo restante.
 *   - Si el abono excede el saldo restante, exige confirmación explícita (checkbox o alerta).
 *   - Interruptor opcional: "Afectar el saldo de una cuenta".
 */

import { useState, useEffect } from 'react'
import {
  DollarSign,
  AlertCircle,
  Calendar,
  CreditCard,
  Check,
  AlertTriangle,
} from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { centsToInput, inputToCents, formatMoney, accountLabel } from '../../lib/format.js'
import { toISODate } from '../../domain/periods.js'
import {
  calculateDebtRemainingCents,
  validateDebtPayment,
} from '../../domain/debts.js'

export default function DebtPaymentModal({
  isOpen,
  onClose,
  debt = null,
  payments = [],
  accounts = [],
  onSavePayment,
  onSave,
}) {
  const handleSave = onSave || onSavePayment
  const [amountInput, setAmountInput] = useState('')
  const [date, setDate] = useState(toISODate(new Date()))
  const [affectAccount, setAffectAccount] = useState(false)
  const [accountId, setAccountId] = useState('')
  const [allowOverpayment, setAllowOverpayment] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const usableAccounts = accounts.filter(a => a.type !== 'credit')
  const remainingCents = debt ? calculateDebtRemainingCents(debt, payments) : 0

  useEffect(() => {
    if (isOpen && debt) {
      setErrorMsg('')
      setIsSubmitting(false)
      setAmountInput(remainingCents > 0 ? centsToInput(remainingCents) : '')
      setDate(toISODate(new Date()))
      setAffectAccount(false)
      setAccountId(usableAccounts[0]?.id || '')
      setAllowOverpayment(false)
    }
  }, [isOpen, debt])

  if (!debt) return null

  const isOwedToMe = debt.direction === 'owed_to_me'

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setErrorMsg('')

    const cents = inputToCents(amountInput)
    const validation = validateDebtPayment({
      remainingCents,
      paymentAmountCents: cents,
      allowOverpayment,
    })

    if (!validation.valid) {
      setErrorMsg(validation.error || 'Monto de abono inválido.')
      return
    }

    if (affectAccount && !accountId) {
      setErrorMsg('Selecciona la cuenta que deseas afectar.')
      return
    }

    try {
      setIsSubmitting(true)
      if (handleSave) {
        await handleSave(
          {
            amountCents: cents,
            date: date || toISODate(new Date()),
          },
          {
            affectAccount,
            accountId: affectAccount ? accountId : null,
          }
        )
      }
      onClose()
    } catch (err) {
      console.error('Error al registrar abono:', err)
      setErrorMsg('Ocurrió un error al registrar el abono.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isOwedToMe ? 'Registrar abono recibido' : 'Registrar pago de deuda'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
        {/* Info resumen de la deuda */}
        <div
          className="p-3 rounded-xl flex items-center justify-between"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div>
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block">
              {isOwedToMe ? 'Te debe' : 'Le debes a'}
            </span>
            <span className="font-bold text-sm text-white">{debt.person}</span>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block">
              Saldo restante
            </span>
            <span className="font-mono font-bold text-sm text-white">
              {formatMoney(remainingCents, debt.currency)}
            </span>
          </div>
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

        {/* Monto del abono */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
              <DollarSign size={13} className="text-[var(--orange-400)]" />
              <span>Monto a abonar ({debt.currency}) *</span>
            </label>
            <button
              type="button"
              onClick={() => setAmountInput(centsToInput(remainingCents))}
              className="text-[10px] font-semibold text-[var(--orange-400)] hover:underline"
            >
              Liquidar total ({centsToInput(remainingCents)})
            </button>
          </div>

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
              className="w-full pl-7 pr-3 py-2.5 rounded-xl text-white font-mono text-base font-bold outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                minHeight: '44px',
              }}
            />
          </div>
        </div>

        {/* Advertencia de sobrepago */}
        {inputToCents(amountInput) > remainingCents && (
          <div
            className="p-3 rounded-xl flex flex-col gap-2"
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
            }}
          >
            <div className="flex items-center gap-2 text-[var(--color-warning)] font-semibold">
              <AlertTriangle size={15} className="flex-shrink-0" />
              <span>El abono supera el saldo pendiente</span>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              Estás registrando un pago mayor al saldo restante de esta deuda.
            </p>
            <label className="flex items-center gap-2 cursor-pointer mt-1">
              <input
                type="checkbox"
                checked={allowOverpayment}
                onChange={(e) => setAllowOverpayment(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--orange-500)] focus:ring-0"
              />
              <span className="text-xs text-white font-medium">
                Sí, deseo registrar este sobrepago
              </span>
            </label>
          </div>
        )}

        {/* Fecha del abono */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
            <Calendar size={13} className="text-[var(--orange-400)]" />
            <span>Fecha del abono *</span>
          </label>
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

        {/* Interruptor: Afectar saldo de cuenta */}
        <div
          className="p-3 rounded-xl flex flex-col gap-2.5"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <label className="flex items-center justify-between cursor-pointer">
            <div className="flex flex-col">
              <span className="font-semibold text-xs text-white">Afectar el saldo de una cuenta</span>
              <span className="text-[10px] text-[var(--text-muted)]">
                {isOwedToMe
                  ? 'Sumar el abono cobrado al saldo de tu cuenta'
                  : 'Descontar el abono pagado del saldo de tu cuenta'}
              </span>
            </div>
            <input
              type="checkbox"
              checked={affectAccount}
              onChange={(e) => setAffectAccount(e.target.checked)}
              className="w-4 h-4 rounded text-[var(--orange-500)] focus:ring-0 cursor-pointer"
            />
          </label>

          {affectAccount && (
            <div className="flex flex-col gap-1.5 pt-2 border-t border-[var(--border-subtle)]">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                <CreditCard size={13} className="text-[var(--orange-400)]" />
                <span>
                  {isOwedToMe
                    ? 'Cuenta donde ingresó el dinero cobrado:'
                    : 'Cuenta de donde salió el dinero para pagar:'}
                </span>
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
              <span className="text-[10px] text-[var(--orange-400)]">
                Crea un ajuste neutro sin alterar tus ingresos ni gastos.
              </span>
            </div>
          )}
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
            <span>Confirmar abono</span>
          </Button>
        </div>
      </form>
    </Modal>
  )
}

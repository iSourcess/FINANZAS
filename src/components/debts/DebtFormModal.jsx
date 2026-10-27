/**
 * src/components/debts/DebtFormModal.jsx
 *
 * Modal para crear o editar una deuda o préstamo ("me deben" o "debo").
 *
 * Campos:
 *   - Dirección: "Me deben" (owed_to_me) o "Debo" (i_owe)
 *   - Persona / Contacto
 *   - Monto original (principalCents)
 *   - Moneda: MXN / USD
 *   - Fecha de apertura (openedAt)
 *   - Fecha de vencimiento opcional (dueDate)
 *   - Nota libre
 *   - Interruptor opcional: "Afectar el saldo de una cuenta" con selección de cuenta
 */

import { useState, useEffect } from 'react'
import {
  HandCoins,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Calendar,
  Check,
} from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { centsToInput, inputToCents, accountLabel } from '../../lib/format.js'
import { toISODate } from '../../domain/periods.js'

export default function DebtFormModal({
  isOpen,
  onClose,
  debt = null,
  accounts = [],
  onSave,
}) {
  const isEditing = Boolean(debt && debt.id)

  const [direction, setDirection] = useState('owed_to_me') // 'owed_to_me' | 'i_owe'
  const [person, setPerson] = useState('')
  const [amountInput, setAmountInput] = useState('')
  const [currency, setCurrency] = useState('MXN')
  const [openedAt, setOpenedAt] = useState(toISODate(new Date()))
  const [hasDueDate, setHasDueDate] = useState(false)
  const [dueDate, setDueDate] = useState('')
  const [note, setNote] = useState('')

  // Efecto en cuenta bancaria
  const [affectAccount, setAffectAccount] = useState(false)
  const [accountId, setAccountId] = useState('')

  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const usableAccounts = accounts.filter(a => a.type !== 'credit')

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('')
      setIsSubmitting(false)

      if (debt) {
        setDirection(debt.direction || 'owed_to_me')
        setPerson(debt.person || '')
        setAmountInput(debt.principalCents ? centsToInput(debt.principalCents) : '')
        setCurrency(debt.currency || 'MXN')
        setOpenedAt(debt.openedAt || toISODate(new Date()))
        setHasDueDate(Boolean(debt.dueDate))
        setDueDate(debt.dueDate || '')
        setNote(debt.note || '')
        setAffectAccount(false) // Al editar no vuelve a afectar cuenta automáticamente
        setAccountId(usableAccounts[0]?.id || '')
      } else {
        setDirection('owed_to_me')
        setPerson('')
        setAmountInput('')
        setCurrency('MXN')
        setOpenedAt(toISODate(new Date()))
        setHasDueDate(false)
        setDueDate('')
        setNote('')
        setAffectAccount(false)
        setAccountId(usableAccounts[0]?.id || '')
      }
    }
  }, [isOpen, debt])

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setErrorMsg('')

    if (!person.trim()) {
      setErrorMsg('Ingresa el nombre de la persona.')
      return
    }

    const cents = inputToCents(amountInput)
    if (!cents || cents <= 0) {
      setErrorMsg('Ingresa un monto válido mayor a 0.')
      return
    }

    if (affectAccount && !accountId) {
      setErrorMsg('Selecciona la cuenta que deseas afectar.')
      return
    }

    const payload = {
      direction,
      person: person.trim(),
      principalCents: cents,
      currency,
      openedAt: openedAt || toISODate(new Date()),
      dueDate: hasDueDate && dueDate ? dueDate : null,
      note: note.trim(),
      status: debt?.status || 'open',
    }

    const options = {
      affectAccount,
      accountId: affectAccount ? accountId : null,
    }

    try {
      setIsSubmitting(true)
      await onSave(payload, options)
      onClose()
    } catch (err) {
      console.error('Error al guardar deuda:', err)
      setErrorMsg('Ocurrió un error al guardar. Intenta de nuevo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Editar deuda / préstamo' : 'Nuevo registro de deuda'}
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

        {/* Tipo de Deuda (Pills) */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
            Tipo de operación *
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDirection('owed_to_me')}
              className="py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              style={{
                background: direction === 'owed_to_me' ? 'var(--orange-500)' : 'var(--bg-elevated)',
                color: direction === 'owed_to_me' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                border: direction === 'owed_to_me' ? '1px solid var(--orange-500)' : '1px solid var(--border-default)',
                minHeight: '44px',
              }}
            >
              <ArrowDownLeft size={16} />
              <span>Me deben dinero</span>
            </button>

            <button
              type="button"
              onClick={() => setDirection('i_owe')}
              className="py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              style={{
                background: direction === 'i_owe' ? 'var(--orange-500)' : 'var(--bg-elevated)',
                color: direction === 'i_owe' ? 'var(--text-inverse)' : 'var(--text-secondary)',
                border: direction === 'i_owe' ? '1px solid var(--orange-500)' : '1px solid var(--border-default)',
                minHeight: '44px',
              }}
            >
              <ArrowUpRight size={16} />
              <span>Yo debo dinero</span>
            </button>
          </div>
        </div>

        {/* Persona */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
            {direction === 'owed_to_me' ? '¿Quién te debe? *' : '¿A quién le debes? *'}
          </label>
          <input
            type="text"
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            placeholder="ej. Juan Pérez, Hermano, Amigo"
            className="w-full px-3 py-2.5 rounded-xl text-white outline-none"
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
              Monto prestado *
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
                className="w-full pl-7 pr-3 py-2.5 rounded-xl text-white font-mono text-sm font-bold outline-none"
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

        {/* Fechas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
              <Calendar size={13} className="text-[var(--orange-400)]" />
              <span>Fecha del préstamo *</span>
            </label>
            <input
              type="date"
              value={openedAt}
              onChange={(e) => setOpenedAt(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl text-white font-mono outline-none cursor-pointer"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                minHeight: '44px',
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                <Calendar size={13} className="text-[var(--orange-400)]" />
                <span>Fecha límite de pago</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-[var(--text-muted)]">
                <input
                  type="checkbox"
                  checked={hasDueDate}
                  onChange={(e) => setHasDueDate(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-[var(--orange-500)] focus:ring-0"
                />
                <span>Definir fecha</span>
              </label>
            </div>

            {hasDueDate ? (
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl text-white font-mono outline-none cursor-pointer"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  minHeight: '44px',
                }}
              />
            ) : (
              <div
                className="px-3 py-2.5 rounded-xl text-[var(--text-muted)] italic flex items-center"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  minHeight: '44px',
                }}
              >
                Sin fecha de vencimiento fija
              </div>
            )}
          </div>
        </div>

        {/* Nota libre */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
            Nota o motivo (opcional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="ej. Para refacción del auto, devolver a fin de quincena"
            className="w-full px-3 py-2.5 rounded-xl text-white outline-none"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              minHeight: '44px',
            }}
            maxLength={100}
          />
        </div>

        {/* Interruptor: Afectar saldo de cuenta (solo al crear) */}
        {!isEditing && (
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
                  {direction === 'owed_to_me'
                    ? 'Descontar el dinero prestado de tu saldo actual'
                    : 'Sumar el dinero prestado a tu saldo actual'}
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
                    {direction === 'owed_to_me'
                      ? 'Cuenta de donde salió el dinero:'
                      : 'Cuenta donde cayó el dinero prestado:'}
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
                  Crea un movimiento neutro (ajuste) sin afectar tus ingresos ni gastos.
                </span>
              </div>
            )}
          </div>
        )}

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
            <span>{isEditing ? 'Guardar cambios' : 'Registrar deuda'}</span>
          </Button>
        </div>
      </form>
    </Modal>
  )
}

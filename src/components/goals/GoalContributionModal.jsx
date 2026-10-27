/**
 * src/components/goals/GoalContributionModal.jsx
 *
 * Modal para registrar un nuevo aporte vinculado a una cuenta bancaria o efectivo.
 */

import { useState } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { useGoals } from '../../store/useGoals.js'
import { useAccounts } from '../../store/useAccounts.js'
import { accountLabel, formatMoney, todayLocalISO } from '../../lib/format.js'

export default function GoalContributionModal({
  isOpen,
  onClose,
  goal,
}) {
  const { addContribution } = useGoals()
  const { accounts } = useAccounts()

  // Solo cuentas de tipo débito, ahorro o efectivo son aptas para aportar ahorros
  const eligibleAccounts = accounts.filter(
    a => a.type === 'debit' || a.type === 'savings' || a.type === 'cash'
  )

  const [accountId, setAccountId] = useState(() => eligibleAccounts[0]?.id || '')
  const [amountPesos, setAmountPesos] = useState('')
  const [date, setDate] = useState(() => todayLocalISO())
  const [note, setNote] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const parsedPesos = parseFloat(amountPesos.replace(/[^0-9.]/g, ''))
    if (!parsedPesos || parsedPesos <= 0) {
      setError('Ingresa un monto válido mayor a $0.')
      return
    }

    if (!accountId) {
      setError('Debes seleccionar una cuenta vinculada para este aporte.')
      return
    }

    const amountCents = Math.round(parsedPesos * 100)

    try {
      setSubmitting(true)
      await addContribution({
        goalId: goal.id,
        accountId,
        amount: amountCents,
        date,
        note,
      })
      onClose()
    } catch (err) {
      setError(err.message || 'Error al guardar el aporte.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!goal) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Aportar a: ${goal.name}`}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        {error && (
          <div
            className="p-3 rounded-xl text-xs font-medium border"
            style={{
              background: 'var(--red-900)',
              color: 'var(--red-400)',
              borderColor: 'var(--red-700)',
            }}
          >
            {error}
          </div>
        )}

        {/* Monto del aporte */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Monto del aporte (MXN)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-[var(--text-muted)] font-bold">
              $
            </span>
            <input
              type="number"
              step="any"
              min="0.01"
              required
              placeholder="0.00"
              value={amountPesos}
              onChange={(e) => setAmountPesos(e.target.value)}
              className="w-full pl-8 pr-4 py-2.5 rounded-xl font-mono text-base font-bold text-white focus:outline-none transition-colors"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
              }}
              autoFocus
            />
          </div>
        </div>

        {/* Cuenta vinculada */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Cuenta de origen (vinculada)
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 rounded-xl text-xs font-medium text-white focus:outline-none transition-colors cursor-pointer"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
            }}
          >
            {eligibleAccounts.length === 0 ? (
              <option value="">No hay cuentas de débito o efectivo disponibles</option>
            ) : (
              eligibleAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {accountLabel(acc)} — Saldo: {formatMoney(acc.balance)}
                </option>
              ))
            )}
          </select>
          <span className="text-[11px] text-[var(--text-muted)]">
            El aporte quedará registrado como proveniente de esta cuenta.
          </span>
        </div>

        {/* Fecha */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Fecha del aporte
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono text-white focus:outline-none transition-colors"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
            }}
          />
        </div>

        {/* Nota opcional */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Nota (opcional)
          </label>
          <input
            type="text"
            placeholder="Ej. Quincena, ahorro extra, bono..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={100}
            className="w-full px-3.5 py-2.5 rounded-xl text-xs text-white focus:outline-none transition-colors placeholder:text-[var(--text-muted)]"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
            }}
          />
        </div>

        {/* Botones de acción */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            disabled={submitting || eligibleAccounts.length === 0}
          >
            {submitting ? 'Guardando...' : '+ Registrar Aporte'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

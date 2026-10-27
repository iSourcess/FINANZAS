/**
 * src/components/wallet/ReconcileModal.jsx
 *
 * Modal para cuadrar el saldo de una cuenta con el saldo real del banco.
 *
 * Características:
 *   - Campo "Saldo real en el banco" (o "Deuda real" en crédito).
 *   - Muestra saldo de la app, diferencia y vista previa ("Se registrará un ajuste de +$X").
 *   - Manejo en moneda de la cuenta (MXN / USD).
 *   - Nu Cajita Turbo: alerta suave si saldo < capital configurado sin mostrar negativos.
 *   - Selección de motivo ('reconcile', 'interest', 'fee', etc.), fecha y nota.
 *   - Validación si diferencia es 0.
 *   - Áreas táctiles >= 44 px y tokens del sistema de diseño.
 */

import { useState, useEffect, useId } from 'react'
import {
  Scale,
  Calendar,
  AlertTriangle,
  FileText,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import {
  calculateReconcileDelta,
  validateReconcileTurbo,
  RECONCILE_REASONS,
} from '../../domain/reconcile.js'
import { formatMoney, centsToInput, inputToCents, todayLocalISO } from '../../lib/format.js'
import { useMovements } from '../../store/useMovements.js'

export default function ReconcileModal({
  account,
  isOpen,
  onClose,
  initialAdjustment = null,
  onSuccess,
}) {
  const { addMovement, updateMovement } = useMovements()
  const realBalanceInputId = useId()
  const reasonSelectId = useId()
  const dateInputId = useId()
  const noteInputId = useId()

  const isCredit = account?.type === 'credit'
  const isTurbo = account?.themeKey === 'nu' && account?.yieldCapBase === 'principal'

  // Saldo real que el usuario escribe
  const [realInput, setRealInput] = useState('')
  const [reason, setReason] = useState('reconcile')
  const [date, setDate] = useState(todayLocalISO())
  const [note, setNote] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Inicializar campos cuando se abre el modal
  useEffect(() => {
    if (isOpen && account) {
      setErrorMsg('')
      setIsSubmitting(false)

      if (initialAdjustment) {
        // Modo edición de ajuste previo
        const currentBalance = account.balance || 0
        // Reconstruir el saldo real objetivo: actual + delta (o según sea)
        const targetCents = currentBalance
        setRealInput(centsToInput(targetCents))
        setReason(initialAdjustment.reason || 'reconcile')
        setDate(initialAdjustment.date || todayLocalISO())
        setNote(initialAdjustment.note || '')
      } else {
        // Modo nuevo cuadre: prellenar con el saldo actual de la app
        setRealInput(centsToInput(account.balance || 0))
        setReason('reconcile')
        setDate(todayLocalISO())
        setNote('')
      }
    }
  }, [isOpen, account, initialAdjustment])

  if (!account) return null

  const currency = account.currency || 'MXN'
  const appBalanceCents = account.balance || 0
  const realBalanceCents = inputToCents(realInput)

  const { deltaCents, isZero, sign, absDeltaCents } = calculateReconcileDelta({
    currentBalanceCents: appBalanceCents,
    realBalanceCents,
    isCredit,
  })

  // Validación de Cajita Turbo si aplica
  const turboValidation = isTurbo
    ? validateReconcileTurbo({
        realBalanceCents,
        capitalCents: account.yieldTiers?.[0]?.upTo || 2_500_000,
      })
    : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (isZero && !initialAdjustment) {
      setErrorMsg('La diferencia es de $0.00. No se requiere ningún ajuste de saldo.')
      return
    }

    setIsSubmitting(true)

    try {
      if (initialAdjustment) {
        await updateMovement(initialAdjustment.id, {
          deltaCents,
          amount: absDeltaCents,
          reason,
          date,
          note: note.trim(),
        })
        onSuccess?.('Ajuste actualizado correctamente', initialAdjustment.id)
      } else {
        const created = await addMovement({
          type: 'adjustment',
          accountId: account.id,
          deltaCents,
          amount: absDeltaCents,
          reason,
          date,
          note: note.trim(),
          currency,
        })
        onSuccess?.('Saldo cuadrado correctamente', created.id)
      }
      onClose()
    } catch (err) {
      console.error('[ReconcileModal] Error al guardar ajuste:', err)
      setErrorMsg(err.message || 'No se pudo guardar el ajuste de saldo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Cuadrar saldo · ${account.name}`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errorMsg && (
          <div
            role="alert"
            className="p-3 rounded-xl flex items-start gap-2.5 text-xs animate-in fade-in duration-200"
            style={{
              background: 'var(--red-900)',
              border: '1px solid var(--red-600)',
              color: 'var(--red-400)',
            }}
          >
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* ── Comparativa Visual: App vs Banco ── */}
        <div
          className="rounded-xl p-3.5 flex flex-col gap-3"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-secondary)]">
              {isCredit ? 'Deuda actual en la app:' : 'Saldo actual en la app:'}
            </span>
            <span
              className="text-sm font-bold font-mono text-white"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatMoney(appBalanceCents, currency)}
            </span>
          </div>

          <div className="h-px w-full" style={{ background: 'var(--border-subtle)' }} />

          {/* ── Input Saldo Real ── */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={realBalanceInputId}
              className="text-xs font-semibold text-white flex items-center justify-between"
            >
              <span>{isCredit ? 'Deuda real en el banco *' : 'Saldo real en el banco *'}</span>
              <span className="text-[11px] font-mono text-[var(--text-muted)] font-normal">
                {currency}
              </span>
            </label>

            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-base font-bold text-[var(--text-muted)] font-mono">
                $
              </span>
              <input
                id={realBalanceInputId}
                type="number"
                step="0.01"
                required
                value={realInput}
                onChange={(e) => setRealInput(e.target.value)}
                placeholder="0.00"
                className="w-full pl-8 pr-3.5 py-3 rounded-xl text-lg font-bold font-mono text-white outline-none transition-all focus:ring-2 focus:ring-[var(--orange-400)]"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-default)',
                  fontVariantNumeric: 'tabular-nums',
                  minHeight: '48px',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Vista Previa de la Diferencia (Ajuste) ── */}
        <div
          className="rounded-xl p-3 flex flex-col gap-1 text-xs"
          style={{
            background: isZero
              ? 'var(--bg-elevated)'
              : deltaCents > 0
              ? 'rgba(255, 122, 26, 0.08)'
              : 'rgba(248, 113, 113, 0.08)',
            border: `1px solid ${
              isZero
                ? 'var(--border-subtle)'
                : deltaCents > 0
                ? 'var(--orange-700)'
                : 'var(--red-600)'
            }`,
          }}
        >
          <div className="flex items-center justify-between font-medium">
            <span className="text-[var(--text-secondary)]">Diferencia calculada:</span>
            <span
              className="font-bold font-mono text-sm"
              style={{
                color: isZero
                  ? 'var(--text-muted)'
                  : deltaCents > 0
                  ? 'var(--orange-400)'
                  : 'var(--red-400)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {isZero ? '$0.00' : `${sign}${formatMoney(absDeltaCents, currency)}`}
            </span>
          </div>

          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed mt-0.5">
            {isZero ? (
              'El saldo de la app ya coincide con el saldo del banco (diferencia de $0.00).'
            ) : isCredit ? (
              deltaCents > 0
                ? `Se registrará un ajuste de +${formatMoney(absDeltaCents, currency)} (tu deuda en la tarjeta aumentará).`
                : `Se registrará un ajuste de -${formatMoney(absDeltaCents, currency)} (tu deuda en la tarjeta disminuirá).`
            ) : deltaCents > 0 ? (
              `Se registrará un ajuste de +${formatMoney(absDeltaCents, currency)} a favor de tu cuenta.`
            ) : (
              `Se registrará un ajuste de -${formatMoney(absDeltaCents, currency)} en tu cuenta.`
            )}
          </p>
        </div>

        {/* ── Alerta especial Nu Cajita Turbo ── */}
        {turboValidation?.isBelowCapital && (
          <div
            className="p-3 rounded-xl flex items-start gap-2.5 text-xs animate-in fade-in duration-200"
            style={{
              background: 'var(--orange-900)',
              border: '1px solid var(--orange-700)',
              color: 'var(--orange-200)',
            }}
          >
            <AlertTriangle size={16} className="text-[var(--orange-400)] flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="font-bold text-white">Saldo inferior al capital</span>
              <span className="text-[11px] leading-relaxed">
                {turboValidation.warningMessage}
              </span>
            </div>
          </div>
        )}

        {/* ── Motivo del Ajuste ── */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={reasonSelectId} className="text-xs font-medium text-[var(--text-secondary)]">
            Motivo del ajuste
          </label>
          <select
            id={reasonSelectId}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl text-xs sm:text-sm text-white outline-none cursor-pointer transition-colors"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              minHeight: '44px',
            }}
          >
            {RECONCILE_REASONS.map((r) => (
              <option key={r.id} value={r.id} className="bg-[#1A1A1A] text-white">
                {r.label} — {r.description}
              </option>
            ))}
          </select>
        </div>

        {/* ── Fecha y Nota ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Fecha */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={dateInputId} className="text-xs font-medium text-[var(--text-secondary)]">
              Fecha del ajuste
            </label>
            <div className="relative flex items-center">
              <Calendar size={15} className="absolute left-3 text-[var(--text-muted)] pointer-events-none" />
              <input
                id={dateInputId}
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs sm:text-sm text-white outline-none"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  minHeight: '44px',
                }}
              />
            </div>
          </div>

          {/* Nota */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor={noteInputId} className="text-xs font-medium text-[var(--text-secondary)]">
              Nota (opcional)
            </label>
            <div className="relative flex items-center">
              <FileText size={15} className="absolute left-3 text-[var(--text-muted)] pointer-events-none" />
              <input
                id={noteInputId}
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej. Cuadre mensual corte"
                className="w-full pl-9 pr-3 py-2.5 rounded-xl text-xs sm:text-sm text-white outline-none"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-default)',
                  minHeight: '44px',
                }}
              />
            </div>
          </div>
        </div>

        {/* ── Botones de Acción ── */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={isSubmitting}
            style={{ minHeight: '44px' }}
          >
            Cancelar
          </Button>

          <Button
            type="submit"
            variant="primary"
            icon={CheckCircle2}
            disabled={isSubmitting || (isZero && !initialAdjustment)}
            style={{ minHeight: '44px' }}
          >
            {isSubmitting ? 'Guardando...' : initialAdjustment ? 'Actualizar ajuste' : 'Guardar ajuste'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

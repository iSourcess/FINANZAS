/**
 * src/components/goals/GoalFormModal.jsx
 *
 * Modal para crear o editar una meta de ahorro (nombre, monto objetivo y fecha opcional).
 */

import { useState, useEffect } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { useGoals } from '../../store/useGoals.js'

export default function GoalFormModal({
  isOpen,
  onClose,
  initialGoal = null,
}) {
  const { addGoal, updateGoal } = useGoals()

  const [name, setName] = useState('')
  const [targetPesos, setTargetPesos] = useState('')
  const [targetDate, setTargetDate] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (initialGoal) {
      setName(initialGoal.name || '')
      setTargetPesos(initialGoal.targetAmount ? (initialGoal.targetAmount / 100).toString() : '')
      setTargetDate(initialGoal.targetDate || '')
    } else {
      setName('')
      setTargetPesos('')
      setTargetDate('')
    }
    setError(null)
  }, [initialGoal, isOpen])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('El nombre de la meta es obligatorio.')
      return
    }

    const parsedPesos = parseFloat(targetPesos.replace(/[^0-9.]/g, ''))
    if (!parsedPesos || parsedPesos <= 0) {
      setError('Ingresa un monto objetivo válido mayor a $0.')
      return
    }

    const targetAmountCents = Math.round(parsedPesos * 100)

    try {
      setSubmitting(true)
      if (initialGoal) {
        await updateGoal(initialGoal.id, {
          name: trimmedName,
          targetAmount: targetAmountCents,
          targetDate: targetDate || null,
        })
      } else {
        await addGoal({
          name: trimmedName,
          targetAmount: targetAmountCents,
          targetDate: targetDate || null,
        })
      }
      onClose()
    } catch (err) {
      setError(err.message || 'Error al guardar la meta.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialGoal ? 'Editar Meta de Ahorro' : 'Nueva Meta de Ahorro'}
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

        {/* Nombre de la meta */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Nombre de la meta
          </label>
          <input
            type="text"
            required
            placeholder="Ej. Fondo de emergencia, Viaje, Auto..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl text-xs font-medium text-white focus:outline-none transition-colors placeholder:text-[var(--text-muted)]"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
            }}
            autoFocus
          />
        </div>

        {/* Monto objetivo */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold text-[var(--text-secondary)]">
            Monto objetivo (MXN)
          </label>
          <div className="relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-[var(--text-muted)] font-bold">
              $
            </span>
            <input
              type="number"
              step="any"
              min="1"
              required
              placeholder="Ej. 50000"
              value={targetPesos}
              onChange={(e) => setTargetPesos(e.target.value)}
              className="w-full pl-8 pr-4 py-2.5 rounded-xl font-mono text-base font-bold text-white focus:outline-none transition-colors"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
              }}
            />
          </div>
        </div>

        {/* Fecha objetivo opcional */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-[var(--text-secondary)]">
              Fecha límite (opcional)
            </label>
            {targetDate && (
              <button
                type="button"
                onClick={() => setTargetDate('')}
                className="text-[10px] text-[var(--text-muted)] hover:text-white"
              >
                Sin fecha
              </button>
            )}
          </div>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono text-white focus:outline-none transition-colors"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
            }}
          />
          <span className="text-[11px] text-[var(--text-muted)]">
            Si defines una fecha, calcularemos cuánto necesitas ahorrar cada mes.
          </span>
        </div>

        {/* Botones */}
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
            disabled={submitting}
          >
            {submitting ? 'Guardando...' : initialGoal ? 'Guardar Cambios' : 'Crear Meta'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

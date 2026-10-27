/**
 * src/components/forms/TemplateFormModal.jsx
 *
 * Modal para crear o editar una plantilla de movimiento frecuente.
 *
 * Campos:
 *   - Nombre de la plantilla (ej. "Café matutino", "Gasolina")
 *   - Tipo: Gasto / Ingreso / Transferencia
 *   - Monto: opcional (puede guardarse vacío para definirlo al momento)
 *   - Moneda: MXN / USD
 *   - Cuenta: selector de cuenta
 *   - Cuenta destino: si es transferencia
 *   - Categoría: con íconos de lucide-react y color (si no es transferencia)
 *   - Nota opcional
 */

import { useState, useEffect } from 'react'
import {
  Bookmark,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  ArrowRightLeft,
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
} from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import CardPicker from '../wallet/CardPicker.jsx'
import { centsToInput, inputToCents } from '../../lib/format.js'

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

export default function TemplateFormModal({
  isOpen,
  onClose,
  initialTemplate = null,
  template = null,
  accounts = [],
  categories = [],
  onSave,
}) {
  const activeTemplate = initialTemplate || template

  const [name, setName] = useState('')
  const [type, setType] = useState('expense')
  const [hasFixedAmount, setHasFixedAmount] = useState(false)
  const [amountInput, setAmountInput] = useState('')
  const [currency, setCurrency] = useState('MXN')
  const [accountId, setAccountId] = useState('')
  const [toAccountId, setToAccountId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [note, setNote] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setErrorMsg('')
      setIsSubmitting(false)

      if (activeTemplate) {
        setName(activeTemplate.name || '')
        setType(activeTemplate.type || 'expense')
        setCurrency(activeTemplate.currency || 'MXN')
        setAccountId(activeTemplate.accountId || (accounts[0]?.id || ''))
        setToAccountId(activeTemplate.toAccountId || '')
        setCategoryId(activeTemplate.categoryId || '')
        setNote(activeTemplate.note || '')

        if (activeTemplate.amountCents != null) {
          setHasFixedAmount(true)
          setAmountInput(centsToInput(activeTemplate.amountCents))
        } else {
          setHasFixedAmount(false)
          setAmountInput('')
        }
      } else {
        setName('')
        setType('expense')
        setHasFixedAmount(false)
        setAmountInput('')
        setCurrency('MXN')
        setAccountId(accounts[0]?.id || '')
        setToAccountId('')
        setCategoryId(categories.filter((c) => c.type === 'expense')[0]?.id || '')
        setNote('')
      }
    }
  }, [isOpen, activeTemplate, accounts, categories])

  if (!isOpen) return null

  const filteredCategories = categories.filter((c) => c.type === type)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!name.trim()) {
      setErrorMsg('El nombre de la plantilla es obligatorio.')
      return
    }

    if (!accountId) {
      setErrorMsg('Selecciona una cuenta para la plantilla.')
      return
    }

    if (type === 'transfer' && !toAccountId) {
      setErrorMsg('Selecciona una cuenta destino para la transferencia.')
      return
    }

    if (type === 'transfer' && accountId === toAccountId) {
      setErrorMsg('La cuenta origen y destino no pueden ser la misma.')
      return
    }

    const amountCents = hasFixedAmount && amountInput.trim() !== ''
      ? inputToCents(amountInput)
      : null

    setIsSubmitting(true)
    try {
      await onSave({
        name: name.trim(),
        type,
        amountCents,
        currency,
        accountId,
        toAccountId: type === 'transfer' ? toAccountId : null,
        categoryId: type === 'transfer' ? null : categoryId || null,
        note: note.trim(),
      })
      onClose()
    } catch (err) {
      setErrorMsg(err.message || 'Error al guardar la plantilla.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialTemplate ? 'Editar plantilla' : 'Nueva plantilla'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errorMsg && (
          <div
            role="alert"
            className="p-3 rounded-xl flex items-start gap-2 text-xs"
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

        {/* ── Nombre de la plantilla ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            Nombre de la plantilla *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej. Café matutino, Despensa, Uber trabajo"
            className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white outline-none"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              minHeight: '44px',
            }}
          />
        </div>

        {/* ── Selector de Tipo (Gasto / Ingreso / Transferencia) ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">Tipo</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'expense', label: 'Gasto', icon: TrendingDown, color: 'var(--red-400)' },
              { id: 'income', label: 'Ingreso', icon: TrendingUp, color: 'var(--orange-400)' },
              { id: 'transfer', label: 'Transferencia', icon: ArrowRightLeft, color: 'var(--text-secondary)' },
            ].map((t) => {
              const Icon = t.icon
              const isSelected = type === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setType(t.id)
                    if (t.id !== 'transfer') {
                      const firstCat = categories.find((c) => c.type === t.id)
                      if (firstCat) setCategoryId(firstCat.id)
                    }
                  }}
                  className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold transition-all active:scale-95"
                  style={{
                    minHeight: '44px',
                    background: isSelected ? 'var(--bg-overlay)' : 'var(--bg-elevated)',
                    border: `1.5px solid ${isSelected ? 'var(--orange-400)' : 'var(--border-subtle)'}`,
                    color: isSelected ? 'white' : 'var(--text-muted)',
                  }}
                >
                  <Icon size={14} style={{ color: t.color }} />
                  <span>{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Monto Opcional ── */}
        <div
          className="rounded-xl p-3.5 flex flex-col gap-3"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[var(--text-secondary)]">
              ¿Tiene monto fijo?
            </span>
            <button
              type="button"
              onClick={() => {
                setHasFixedAmount(!hasFixedAmount)
                if (!hasFixedAmount && !amountInput) setAmountInput('')
              }}
              className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors"
              style={{
                minHeight: '36px',
                background: hasFixedAmount ? 'var(--orange-900)' : 'var(--bg-surface)',
                color: hasFixedAmount ? 'var(--orange-400)' : 'var(--text-muted)',
                border: `1px solid ${hasFixedAmount ? 'var(--orange-700)' : 'var(--border-default)'}`,
              }}
            >
              {hasFixedAmount ? 'Con monto fijo' : 'Sin monto (definir al usar)'}
            </button>
          </div>

          {hasFixedAmount && (
            <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold font-mono text-[var(--text-muted)]">
                  $
                </span>
                <input
                  type="number"
                  step="0.01"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3 py-2 rounded-xl text-sm font-bold font-mono text-white outline-none"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                    minHeight: '44px',
                  }}
                />
              </div>

              {/* Selector MXN / USD */}
              <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border-default)' }}>
                {['MXN', 'USD'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className="px-3 py-2 text-xs font-mono font-bold transition-colors"
                    style={{
                      minHeight: '44px',
                      background: currency === c ? 'var(--orange-400)' : 'var(--bg-surface)',
                      color: currency === c ? 'var(--text-inverse)' : 'var(--text-secondary)',
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Cuenta Origen (CardPicker) ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            {type === 'transfer' ? 'Cuenta origen *' : 'Cuenta *'}
          </label>
          <CardPicker
            accounts={accounts}
            selectedAccountId={accountId}
            onSelect={setAccountId}
          />
        </div>

        {/* ── Cuenta Destino (Transferencias) ── */}
        {type === 'transfer' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Cuenta destino *
            </label>
            <CardPicker
              accounts={accounts.filter((a) => a.id !== accountId)}
              selectedAccountId={toAccountId}
              onSelect={setToAccountId}
            />
          </div>
        )}

        {/* ── Categoría (para gasto o ingreso) ── */}
        {type !== 'transfer' && (
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-[var(--text-secondary)]">
              Categoría
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto p-1">
              {filteredCategories.map((cat) => {
                const Icon = cat.icon && ICON_MAP[cat.icon] ? ICON_MAP[cat.icon] : MoreHorizontal
                const isSelected = categoryId === cat.id
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setCategoryId(cat.id)}
                    className="flex items-center gap-2 p-2 rounded-xl text-xs transition-all active:scale-95"
                    style={{
                      minHeight: '44px',
                      background: isSelected ? 'var(--bg-overlay)' : 'var(--bg-elevated)',
                      border: `1.5px solid ${isSelected ? (cat.color || 'var(--orange-400)') : 'var(--border-subtle)'}`,
                      color: isSelected ? 'white' : 'var(--text-secondary)',
                    }}
                  >
                    <span
                      className="w-5 h-5 rounded-md flex items-center justify-center text-white flex-shrink-0"
                      style={{ background: cat.color || 'var(--orange-400)' }}
                    >
                      <Icon size={12} />
                    </span>
                    <span className="truncate font-medium">{cat.name}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Nota opcional ── */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">
            Nota (opcional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej. Desayuno oficina"
            className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white outline-none"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              minHeight: '44px',
            }}
          />
        </div>

        {/* ── Botones de Guardar / Cancelar ── */}
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
            disabled={isSubmitting}
            style={{ minHeight: '44px' }}
          >
            {isSubmitting ? 'Guardando...' : initialTemplate ? 'Actualizar plantilla' : 'Guardar plantilla'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

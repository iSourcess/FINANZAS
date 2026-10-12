/**
 * src/components/forms/AccountForm.jsx
 *
 * Formulario para crear y editar cuentas y tarjetas.
 *
 * Incluye:
 *   - Selección de tema/banco (Nu, Revolut, Mercado Pago, BBVA, Efectivo).
 *   - Manejo de montos en centavos enteros con inputs amigables en pesos.
 *   - Configuración de crédito: límite, día de corte, día de pago.
 *   - Editor de tramos de rendimiento (yieldTiers) con presets bancarios.
 */

import { useState } from 'react'
import { Plus, Trash2, Sparkles, Check } from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { CARD_THEMES, DEFAULT_YIELD_TIERS } from '../../lib/constants.js'
import { centsToInput, inputToCents, formatMoney } from '../../lib/format.js'

export default function AccountForm({
  account = null, // null para crear, objeto para editar
  isOpen,
  onClose,
  onSave,
}) {
  const isEditing = Boolean(account?.id)

  // Estado del formulario
  const [name, setName] = useState(account?.name || '')
  const [type, setType] = useState(account?.type || 'debit')
  const [themeKey, setThemeKey] = useState(account?.themeKey || 'nu')
  const [currency, setCurrency] = useState(account?.currency || 'MXN')
  const [balanceInput, setBalanceInput] = useState(
    account ? centsToInput(account.balance) : '0'
  )
  const [last4, setLast4] = useState(account?.last4 || '')

  // Crédito
  const [creditLimitInput, setCreditLimitInput] = useState(
    account?.credit?.limit ? centsToInput(account.credit.limit) : '10000'
  )
  const [cutDay, setCutDay] = useState(account?.credit?.cutDay || 1)
  const [payDay, setPayDay] = useState(account?.credit?.payDay || 20)

  // Tramos de rendimiento (para débito/ahorro)
  const [yieldTiers, setYieldTiers] = useState(
    account?.yieldTiers ? JSON.parse(JSON.stringify(account.yieldTiers)) : []
  )

  const [errorMsg, setErrorMsg] = useState('')

  // Aplicar preset de rendimiento
  const handleApplyPreset = (presetKey) => {
    if (presetKey === 'none') {
      setYieldTiers([])
      return
    }
    const preset = DEFAULT_YIELD_TIERS[presetKey]
    if (preset) {
      setYieldTiers(JSON.parse(JSON.stringify(preset)))
    }
  }

  // Agregar tramo manual
  const handleAddTier = () => {
    setYieldTiers([
      ...yieldTiers,
      { upTo: null, rate: 0.05 },
    ])
  }

  // Actualizar tramo
  const handleUpdateTier = (index, field, value) => {
    const updated = [...yieldTiers]
    if (field === 'rate') {
      updated[index].rate = (parseFloat(value) || 0) / 100
    } else if (field === 'upTo') {
      updated[index].upTo = value === '' || value === null ? null : inputToCents(value)
    }
    setYieldTiers(updated)
  }

  // Eliminar tramo
  const handleRemoveTier = (index) => {
    setYieldTiers(yieldTiers.filter((_, idx) => idx !== index))
  }

  // Guardar
  const handleSubmit = (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!name.trim()) {
      setErrorMsg('El nombre de la cuenta es obligatorio.')
      return
    }

    const balanceCents = inputToCents(balanceInput)

    const accountData = {
      name: name.trim(),
      type,
      themeKey,
      currency,
      balance: balanceCents,
      last4: last4.trim() ? last4.trim().slice(-4) : null,
      yieldTiers: (type === 'debit' || type === 'savings') && yieldTiers.length > 0 ? yieldTiers : null,
      yieldCapBase: (type === 'debit' || type === 'savings') && yieldTiers.length > 0 ? (account?.yieldCapBase || (themeKey === 'nu' ? 'principal' : 'balance')) : null,
      credit: type === 'credit' ? {
        limit: inputToCents(creditLimitInput),
        cutDay: Math.min(31, Math.max(1, parseInt(cutDay, 10) || 1)),
        payDay: Math.min(31, Math.max(1, parseInt(payDay, 10) || 20)),
      } : null,
    }

    try {
      onSave(accountData)
      onClose()
    } catch (err) {
      setErrorMsg(err.message || 'Error al guardar la cuenta.')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Editar cuenta: ${account?.name}` : 'Nueva Cuenta'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {errorMsg && (
          <div
            className="p-3 rounded-lg text-xs"
            style={{
              background: 'var(--red-900)',
              color: 'var(--red-400)',
              border: '1px solid var(--red-600)',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* ── Nombre de la Cuenta ── */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            Nombre de la cuenta *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Nu Débito, BBVA Nómina, Revolut"
            className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white outline-none transition-colors"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
            }}
          />
        </div>

        {/* ── Tipo de Cuenta ── */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            Tipo de cuenta
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'debit', label: 'Débito' },
              { id: 'credit', label: 'Crédito' },
              { id: 'cash', label: 'Efectivo' },
              { id: 'savings', label: 'Ahorro' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setType(t.id)
                  if (t.id === 'cash') setThemeKey('cash')
                }}
                className={`py-2 px-3 rounded-lg text-xs font-medium border text-center transition-all ${
                  type === t.id
                    ? 'border-[var(--orange-400)] text-[var(--orange-400)] bg-[var(--orange-900)]'
                    : 'border-[var(--border-default)] text-[var(--text-secondary)] bg-[var(--bg-elevated)] hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Banco / Color de Tarjeta ── */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            Banco / Estilo visual
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {Object.entries(CARD_THEMES).map(([key, theme]) => {
              const isSelected = themeKey === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setThemeKey(key)}
                  className="flex items-center gap-2 p-2 rounded-lg border text-left transition-all"
                  style={{
                    background: 'var(--bg-elevated)',
                    borderColor: isSelected ? 'var(--orange-400)' : 'var(--border-default)',
                  }}
                >
                  <span
                    className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center text-xs"
                    style={{ background: theme.base, color: theme.text }}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </span>
                  <span className="text-xs font-medium text-white truncate">
                    {theme.name}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ── Saldo Inicial / Deuda y Moneda ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              {type === 'credit' ? 'Deuda actual ($ MXN)' : 'Saldo disponible ($ MXN)'}
            </label>
            <input
              type="number"
              step="0.01"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              placeholder="0.00"
              className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white font-mono outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Últimos 4 dígitos
            </label>
            <input
              type="text"
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
              placeholder="Ej: 4242"
              className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white font-mono outline-none text-center"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
              }}
            />
          </div>
        </div>

        {/* ── Configuración Específica de Tarjeta de Crédito ── */}
        {type === 'credit' && (
          <div
            className="p-4 rounded-xl flex flex-col gap-3"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span className="text-xs font-semibold text-white uppercase tracking-wider">
              Datos de Crédito
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Límite de crédito
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={creditLimitInput}
                  onChange={(e) => setCreditLimitInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white font-mono outline-none"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Día de corte (1-31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={cutDay}
                  onChange={(e) => setCutDay(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Día de pago (1-31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={payDay}
                  onChange={(e) => setPayDay(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Configuración de Rendimiento por Tramos (Débito / Ahorro) ── */}
        {(type === 'debit' || type === 'savings') && (
          <div
            className="p-4 rounded-xl flex flex-col gap-3"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-[var(--orange-400)]" />
                Rendimiento por Tramos
              </span>
              <button
                type="button"
                onClick={handleAddTier}
                className="text-xs text-[var(--orange-400)] hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> Agregar tramo
              </button>
            </div>

            {/* Presets rápidos */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-[var(--text-muted)]">Presets:</span>
              <button
                type="button"
                onClick={() => handleApplyPreset('nuTurbo')}
                className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-white"
              >
                Nu Turbo (13%)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('revolut')}
                className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-white"
              >
                Revolut (15%/7%)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('mercadoPago')}
                className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-white"
              >
                Mercado Pago (12%/6%)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('none')}
                className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-white"
              >
                Sin rendimiento
              </button>
            </div>

            {/* Lista de tramos editables */}
            {yieldTiers.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic">
                Sin tramos configurados (0% de rendimiento anual).
              </p>
            ) : (
              <div className="flex flex-col gap-2 mt-1">
                {yieldTiers.map((tier, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-lg"
                    style={{ background: 'var(--bg-surface)' }}
                  >
                    <div className="flex-1">
                      <label className="block text-[10px] text-[var(--text-muted)]">Hasta ($ MXN)</label>
                      <input
                        type="text"
                        value={tier.upTo ? centsToInput(tier.upTo) : ''}
                        placeholder="Sin límite"
                        onChange={(e) => handleUpdateTier(idx, 'upTo', e.target.value)}
                        className="w-full px-2 py-1 rounded text-xs text-white outline-none font-mono"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
                      />
                    </div>

                    <div className="w-24">
                      <label className="block text-[10px] text-[var(--text-muted)]">Tasa anual (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={(tier.rate * 100).toFixed(1)}
                        onChange={(e) => handleUpdateTier(idx, 'rate', e.target.value)}
                        className="w-full px-2 py-1 rounded text-xs text-white outline-none font-mono text-right"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveTier(idx)}
                      aria-label="Eliminar tramo"
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--red-400)] transition-colors mt-3"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Botones de Guardar / Cancelar ── */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit">
            {isEditing ? 'Guardar cambios' : 'Crear cuenta'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

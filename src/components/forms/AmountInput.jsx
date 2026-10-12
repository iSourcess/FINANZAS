/**
 * src/components/forms/AmountInput.jsx
 *
 * Input de monto monetario con visualización hero y números tabulares.
 *
 * Características:
 *   - Maneja montos en CENTAVOS ENTEROS.
 *   - Muestra el valor formateado con separadores de miles.
 *   - Botones rápidos de incremento (+50, +100, +200, +500).
 *   - Selector de moneda MXN / USD.
 */

import { useState } from 'react'
import { formatMoney } from '../../lib/format.js'

export default function AmountInput({
  cents = 0,
  onChangeCents,
  currency = 'MXN',
  onChangeCurrency,
  autoFocus = false,
}) {
  const [isEditingRaw, setIsEditingRaw] = useState(false)
  const [rawText, setRawText] = useState('')

  // Convertir centavos a string para el input nativo
  const displayValue = formatMoney(cents, currency)

  const handleInputChange = (e) => {
    const val = e.target.value
    setRawText(val)

    // Extraer número
    const clean = val.replace(/[^\d.]/g, '')
    const num = parseFloat(clean)
    if (!isNaN(num)) {
      onChangeCents(Math.round(num * 100))
    } else {
      onChangeCents(0)
    }
  }

  const handleAddCents = (addCents) => {
    onChangeCents((cents || 0) + addCents)
  }

  return (
    <div
      className="rounded-2xl p-4 flex flex-col items-center justify-center gap-3 relative transition-all"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
      }}
    >
      {/* ── Selector de Moneda (MXN / USD) ── */}
      <div className="w-full flex items-center justify-between">
        <span className="text-xs uppercase font-semibold tracking-wider text-[var(--text-muted)]">
          Monto
        </span>

        <div className="flex items-center gap-1 p-0.5 rounded-lg" style={{ background: 'var(--bg-surface)' }}>
          <button
            type="button"
            onClick={() => onChangeCurrency?.('MXN')}
            className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${
              currency === 'MXN'
                ? 'bg-[var(--orange-400)] text-[var(--text-inverse)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            MXN
          </button>
          <button
            type="button"
            onClick={() => onChangeCurrency?.('USD')}
            className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${
              currency === 'USD'
                ? 'bg-[var(--orange-400)] text-[var(--text-inverse)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            USD
          </button>
        </div>
      </div>

      {/* ── Visualización Hero del Monto ── */}
      <div className="w-full text-center py-2 relative">
        <input
          type="text"
          inputMode="decimal"
          autoFocus={autoFocus}
          value={isEditingRaw ? rawText : (cents ? (cents / 100).toFixed(2) : '')}
          placeholder="0.00"
          onFocus={() => {
            setIsEditingRaw(true)
            setRawText(cents ? (cents / 100).toString() : '')
          }}
          onBlur={() => {
            setIsEditingRaw(false)
          }}
          onChange={handleInputChange}
          className="w-full text-center bg-transparent border-none outline-none font-bold tracking-tight text-white transition-all font-mono"
          style={{
            fontFamily: "'Space Grotesk', monospace",
            fontSize: '36px',
            lineHeight: 1.2,
            fontVariantNumeric: 'tabular-nums',
            color: cents > 0 ? 'var(--text-primary)' : 'var(--text-muted)',
          }}
        />

        <div className="text-xs text-[var(--text-secondary)] mt-1 font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {displayValue}
        </div>
      </div>

      {/* ── Botones Rápidos de Incremento ── */}
      <div className="flex items-center gap-2 pt-1">
        {[
          { label: '+$50', add: 5000 },
          { label: '+$100', add: 10000 },
          { label: '+$200', add: 20000 },
          { label: '+$500', add: 50000 },
        ].map((btn) => (
          <button
            key={btn.label}
            type="button"
            onClick={() => handleAddCents(btn.add)}
            className="px-2.5 py-1 rounded-lg text-xs font-medium border transition-all text-[var(--text-secondary)] hover:text-white hover:border-[var(--orange-400)] active:scale-95"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
            }}
          >
            {btn.label}
          </button>
        ))}

        {cents > 0 && (
          <button
            type="button"
            onClick={() => onChangeCents(0)}
            className="px-2 py-1 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--red-400)] transition-colors"
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * src/components/investments/HoldingFormModal.jsx
 *
 * Modal para agregar o editar una posición de inversión (cripto o acción).
 */

import { useState, useEffect } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { inputToCents, centsToInput } from '../../lib/format.js'

const QUICK_SUGGESTIONS = [
  { symbol: 'BTC', name: 'Bitcoin', kind: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', kind: 'crypto' },
  { symbol: 'NVDA', name: 'NVIDIA', kind: 'stock' },
  { symbol: 'AMD', name: 'AMD', kind: 'stock' },
  { symbol: 'INTC', name: 'Intel', kind: 'stock' },
  { symbol: 'NFLX', name: 'Netflix', kind: 'stock' },
]

export default function HoldingFormModal({
  isOpen,
  onClose,
  holding = null,
  onSave,
}) {
  const [kind, setKind] = useState('stock') // 'stock' | 'crypto'
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [avgCostInput, setAvgCostInput] = useState('')
  const [costCurrency, setCostCurrency] = useState('USD')

  useEffect(() => {
    if (holding) {
      setKind(holding.kind || 'stock')
      setSymbol(holding.symbol || '')
      setName(holding.name || '')
      setQuantity(String(holding.quantity ?? ''))
      setAvgCostInput(centsToInput(holding.avgCost || 0))
      setCostCurrency(holding.costCurrency || 'USD')
    } else {
      setKind('stock')
      setSymbol('')
      setName('')
      setQuantity('')
      setAvgCostInput('')
      setCostCurrency('USD')
    }
  }, [holding, isOpen])

  const handleSelectSuggestion = (sug) => {
    setSymbol(sug.symbol)
    setName(sug.name)
    setKind(sug.kind)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!symbol.trim() || !quantity) return

    const avgCostCents = inputToCents(avgCostInput)
    onSave({
      kind,
      symbol: symbol.toUpperCase().trim(),
      name: name.trim() || symbol.toUpperCase().trim(),
      quantity: Number(quantity),
      avgCost: avgCostCents,
      costCurrency,
    })
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={holding ? `Editar posición: ${holding.symbol}` : 'Nueva posición de inversión'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Selector de Tipo */}
        <div className="flex rounded-xl p-1 bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setKind('stock')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              kind === 'stock'
                ? 'bg-[var(--orange-500)] text-black'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            Acción / ETF
          </button>
          <button
            type="button"
            onClick={() => setKind('crypto')}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
              kind === 'crypto'
                ? 'bg-[var(--orange-500)] text-black'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            Criptomoneda
          </button>
        </div>

        {/* Sugerencias Rápidas */}
        {!holding && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] text-[var(--text-muted)]">Sugerencias rápidas:</span>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_SUGGESTIONS.map(s => (
                <button
                  key={s.symbol}
                  type="button"
                  onClick={() => handleSelectSuggestion(s)}
                  className={`px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-colors ${
                    symbol === s.symbol
                      ? 'bg-[var(--orange-900)] text-[var(--orange-400)] border border-[var(--orange-400)]'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)] hover:border-[var(--text-secondary)]'
                  }`}
                >
                  {s.symbol}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Símbolo y Nombre */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Símbolo *
            </label>
            <input
              type="text"
              required
              placeholder="NVDA, BTC..."
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 rounded-lg text-xs text-white font-mono uppercase outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Nombre visible
            </label>
            <input
              type="text"
              placeholder="NVIDIA, Bitcoin..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
              }}
            />
          </div>
        </div>

        {/* Cantidad y Moneda */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Cantidad de títulos *
            </label>
            <input
              type="number"
              step="any"
              min="0.00000001"
              required
              placeholder="Ej. 10 ó 0.05"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs text-white font-mono outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
              Moneda de cotización
            </label>
            <select
              value={costCurrency}
              onChange={(e) => setCostCurrency(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
              }}
            >
              <option value="USD">USD (Dólares)</option>
              <option value="MXN">MXN (Pesos)</option>
            </select>
          </div>
        </div>

        {/* Costo Promedio Unitario */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
            Costo promedio por título ({costCurrency}) *
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-xs text-[var(--text-muted)] font-mono">$</span>
            <input
              type="text"
              inputMode="decimal"
              required
              placeholder="120.50"
              value={avgCostInput}
              onChange={(e) => setAvgCostInput(e.target.value)}
              className="w-full pl-7 pr-3 py-2 rounded-lg text-xs text-white font-mono outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
              }}
            />
          </div>
          <span className="text-[10px] text-[var(--text-muted)] mt-1 block">
            Precio unitario al que adquiriste tus activos para calcular ganancia o pérdida.
          </span>
        </div>

        {/* Botones */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <Button variant="ghost" size="sm" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button variant="primary" size="sm" type="submit">
            {holding ? 'Guardar cambios' : 'Agregar posición'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

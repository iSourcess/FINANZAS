/**
 * src/components/investments/HoldingFormModal.jsx
 *
 * Modal para agregar o editar una posición de inversión (cripto o acción).
 * Permite registrar directamente el TOTAL DE DÓLARES INVERTIDO (ej. $500 USD en AMD)
 * o de forma avanzada por número de títulos y costo promedio.
 */

import { useState, useEffect, useMemo } from 'react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { useInvestments } from '../../store/useInvestments.js'
import { inputToCents, centsToInput } from '../../lib/format.js'
import { Sparkles, DollarSign, ArrowRightLeft } from 'lucide-react'

const QUICK_SUGGESTIONS = [
  { symbol: 'AMD', name: 'AMD', kind: 'stock' },
  { symbol: 'NVDA', name: 'NVIDIA', kind: 'stock' },
  { symbol: 'INTC', name: 'Intel', kind: 'stock' },
  { symbol: 'NFLX', name: 'Netflix', kind: 'stock' },
  { symbol: 'BTC', name: 'Bitcoin', kind: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', kind: 'crypto' },
]

export default function HoldingFormModal({
  isOpen,
  onClose,
  holding = null,
  onSave,
}) {
  const { priceMap } = useInvestments()

  const [kind, setKind] = useState('stock') // 'stock' | 'crypto'
  const [symbol, setSymbol] = useState('')
  const [name, setName] = useState('')
  const [costCurrency, setCostCurrency] = useState('USD')

  // Modo de captura: 'totalInvested' (por defecto) o 'shares' (avanzado)
  const [inputMode, setInputMode] = useState('totalInvested')

  // Campos para modo total invertido
  const [totalInvestedInput, setTotalInvestedInput] = useState('')
  const [purchasePriceInput, setPurchasePriceInput] = useState('')

  // Campos directos de cantidad y costo
  const [quantity, setQuantity] = useState('')
  const [avgCostInput, setAvgCostInput] = useState('')

  // Precio actual del mercado para el símbolo seleccionado
  const livePrice = useMemo(() => {
    if (!symbol) return null
    const info = priceMap?.get(symbol.toUpperCase())
    return info?.price ? Number(info.price) : null
  }, [symbol, priceMap])

  useEffect(() => {
    if (holding) {
      setKind(holding.kind || 'stock')
      setSymbol(holding.symbol || '')
      setName(holding.name || '')
      setCostCurrency(holding.costCurrency || 'USD')

      const qty = Number(holding.quantity ?? 0)
      const unitCost = (holding.avgCost || 0) / 100
      const totalInv = (qty * unitCost).toFixed(2)

      setQuantity(String(holding.quantity ?? ''))
      setAvgCostInput(centsToInput(holding.avgCost || 0))
      setTotalInvestedInput(totalInv > 0 ? totalInv : '')
      setPurchasePriceInput(unitCost > 0 ? unitCost.toFixed(2) : '')
      setInputMode('totalInvested')
    } else {
      setKind('stock')
      setSymbol('')
      setName('')
      setQuantity('')
      setAvgCostInput('')
      setTotalInvestedInput('')
      setPurchasePriceInput('')
      setCostCurrency('USD')
      setInputMode('totalInvested')
    }
  }, [holding, isOpen])

  const handleSelectSuggestion = (sug) => {
    setSymbol(sug.symbol)
    setName(sug.name)
    setKind(sug.kind)

    const marketPrice = priceMap?.get(sug.symbol)?.price
    if (marketPrice && !purchasePriceInput) {
      setPurchasePriceInput(Number(marketPrice).toFixed(2))
    }
  }

  // Si cambia el símbolo y hay precio en vivo, sugerir el precio de compra
  useEffect(() => {
    if (livePrice && !purchasePriceInput && !holding) {
      setPurchasePriceInput(livePrice.toFixed(2))
    }
  }, [livePrice, purchasePriceInput, holding])

  // Cálculo automático de títulos cuando se usa "Total invertido"
  const calculatedShares = useMemo(() => {
    const total = parseFloat(totalInvestedInput)
    const price = parseFloat(purchasePriceInput) || livePrice || 1
    if (total > 0 && price > 0) {
      return (total / price).toFixed(6)
    }
    return null
  }, [totalInvestedInput, purchasePriceInput, livePrice])

  const handleSubmit = (e) => {
    e.preventDefault()
    const cleanSymbol = symbol.toUpperCase().trim()
    if (!cleanSymbol) return

    let finalQuantity = 0
    let finalAvgCostCents = 0

    if (inputMode === 'totalInvested') {
      const totalInvested = parseFloat(totalInvestedInput)
      if (!totalInvested || totalInvested <= 0) return

      const price = parseFloat(purchasePriceInput) || livePrice || 1
      finalQuantity = totalInvested / price
      finalAvgCostCents = Math.round(price * 100)
    } else {
      finalQuantity = Number(quantity)
      finalAvgCostCents = inputToCents(avgCostInput)
    }

    if (!finalQuantity || finalQuantity <= 0) return

    onSave({
      kind,
      symbol: cleanSymbol,
      name: name.trim() || cleanSymbol,
      quantity: finalQuantity,
      avgCost: finalAvgCostCents,
      costCurrency,
    })
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={holding ? `Editar inversión: ${holding.symbol}` : 'Nueva inversión'}
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
        {/* Selector de Tipo (Acción vs Cripto) */}
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
            <span className="text-[11px] text-[var(--text-muted)]">Activos sugeridos:</span>
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
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Símbolo *
            </label>
            <input
              type="text"
              required
              placeholder="AMD, NVDA..."
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full px-3 py-2 rounded-xl text-xs text-white font-mono uppercase outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Nombre descriptivo
            </label>
            <input
              type="text"
              placeholder="Ej. AMD, NVIDIA..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-xs text-white outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
              }}
            />
          </div>
        </div>

        {/* ── Modo de Captura: Total Invertido vs Títulos ── */}
        <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: 'var(--border-subtle)' }}>
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            {inputMode === 'totalInvested' ? 'Captura por monto total invertido' : 'Captura por títulos'}
          </span>
          <button
            type="button"
            onClick={() => setInputMode(inputMode === 'totalInvested' ? 'shares' : 'totalInvested')}
            className="text-[11px] text-[var(--orange-400)] hover:underline flex items-center gap-1 font-medium"
          >
            <ArrowRightLeft size={11} />
            <span>{inputMode === 'totalInvested' ? 'Cambiar a títulos' : 'Cambiar a total $'}</span>
          </button>
        </div>

        {inputMode === 'totalInvested' ? (
          /* ── MODO TOTAL INVERTIDO (Dólares) ── */
          <div className="flex flex-col gap-3">
            {/* Monto total invertido */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center justify-between">
                <span>Total de dólares invertido (USD) *</span>
                <span className="text-[10px] text-[var(--orange-400)] font-mono font-normal">
                  Base para medir subidas/bajadas
                </span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm text-[var(--text-muted)] font-mono font-bold">$</span>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  required
                  placeholder="Ej. 500.00"
                  value={totalInvestedInput}
                  onChange={(e) => setTotalInvestedInput(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 rounded-xl font-mono text-base font-bold text-white outline-none"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                  }}
                  autoFocus
                />
              </div>
            </div>

            {/* Precio de compra unitario */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">
                  Precio unitario de compra (USD)
                </label>
                {livePrice && (
                  <button
                    type="button"
                    onClick={() => setPurchasePriceInput(livePrice.toFixed(2))}
                    className="text-[10px] text-[var(--orange-400)] hover:underline flex items-center gap-1 font-mono"
                  >
                    <Sparkles size={10} />
                    Usar actual: ${livePrice.toFixed(2)}
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs text-[var(--text-muted)] font-mono">$</span>
                <input
                  type="number"
                  step="any"
                  min="0.0001"
                  placeholder={livePrice ? String(livePrice.toFixed(2)) : '100.00'}
                  value={purchasePriceInput}
                  onChange={(e) => setPurchasePriceInput(e.target.value)}
                  className="w-full pl-7 pr-3 py-2 rounded-xl font-mono text-xs text-white outline-none"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                  }}
                />
              </div>
            </div>

            {/* Resumen explicativo */}
            {calculatedShares && (
              <div
                className="p-3 rounded-xl text-xs flex flex-col gap-1"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between text-white font-semibold">
                  <span>Equivale a:</span>
                  <span className="font-mono text-[var(--orange-400)] font-bold">
                    {calculatedShares} títulos de {symbol || 'activo'}
                  </span>
                </div>
                <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                  Con ${parseFloat(totalInvestedInput || 0).toFixed(2)} USD invertidos a ${parseFloat(purchasePriceInput || livePrice || 1).toFixed(2)} USD c/u, la app calculará automáticamente si tu posición gana o pierde según fluctúe el mercado.
                </p>
              </div>
            )}
          </div>
        ) : (
          /* ── MODO AVANZADO (Títulos y costo) ── */
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Cantidad de títulos *
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.00000001"
                  required
                  placeholder="Ej. 10 ó 0.5"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs text-white font-mono outline-none"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Moneda
                </label>
                <select
                  value={costCurrency}
                  onChange={(e) => setCostCurrency(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs text-white outline-none cursor-pointer"
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

            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
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
                  className="w-full pl-7 pr-3 py-2 rounded-xl text-xs text-white font-mono outline-none"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Botones */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <Button variant="ghost" size="sm" onClick={onClose} type="button">
            Cancelar
          </Button>
          <Button variant="primary" size="sm" type="submit">
            {holding ? 'Guardar cambios' : 'Registrar inversión'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

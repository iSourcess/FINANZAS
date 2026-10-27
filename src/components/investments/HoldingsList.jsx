/**
 * src/components/investments/HoldingsList.jsx
 *
 * Lista de posiciones de inversión (acciones y criptomonedas).
 * Muestra:
 *   - Símbolo, nombre, cantidad y costo promedio.
 *   - Valor actual consolidado en MXN y moneda original.
 *   - Ganancia / pérdida en $ y % con ícono y texto explícito.
 *   - Variación en 24 horas.
 *   - Indicador de precio desactualizado / sin internet.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Edit2,
  Trash2,
  Plus,
  RefreshCw,
  KeyRound,
  Coins,
  CandlestickChart,
} from 'lucide-react'
import Button from '../ui/Button.jsx'
import HoldingFormModal from './HoldingFormModal.jsx'
import { formatMoney } from '../../lib/format.js'

export default function HoldingsList({
  holdingsCalculated = [],
  fxRate = 18.0,
  fxSource = 'default',
  hasFinnhubKey = false,
  refreshing = false,
  onRefresh,
  onAddHolding,
  onUpdateHolding,
  onDeleteHolding,
}) {
  const navigate = useNavigate()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingHolding, setEditingHolding] = useState(null)

  const handleOpenAdd = () => {
    setEditingHolding(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (h) => {
    setEditingHolding(h)
    setIsModalOpen(true)
  }

  const handleSave = async (data) => {
    if (editingHolding) {
      await onUpdateHolding(editingHolding.id, data)
    } else {
      await onAddHolding(data)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Barra Superior de Acciones de Inversión ── */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-[var(--text-primary)]">
            Cotizaciones de mercado
          </span>
          <span className="text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded-full border border-[var(--border-subtle)]">
            1 USD = ${fxRate.toFixed(2)} MXN {fxSource === 'manual' ? '(Manual)' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            title="Actualizar cotizaciones en vivo"
            className="flex items-center gap-1.5"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-[var(--orange-400)]' : ''} />
            <span>{refreshing ? 'Actualizando...' : 'Actualizar'}</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={Plus}
            onClick={handleOpenAdd}
          >
            Nuevo activo
          </Button>
        </div>
      </div>

      {/* ── Banner Informativo: Finnhub API Key ── */}
      {!hasFinnhubKey && (
        <div
          className="p-3.5 rounded-xl flex items-center justify-between gap-3 text-xs"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <KeyRound size={16} className="text-[var(--orange-400)] flex-shrink-0" />
            <p className="text-[var(--text-secondary)] truncate">
              Para cotizaciones en tiempo real de acciones (NFLX, NVDA, etc.), agrega tu API key de Finnhub.
            </p>
          </div>
          <button
            onClick={() => navigate('/ajustes')}
            className="text-[var(--orange-400)] hover:text-[var(--orange-300)] font-semibold flex-shrink-0 underline text-xs"
          >
            Configurar
          </button>
        </div>
      )}

      {/* ── Lista de Posiciones ── */}
      {holdingsCalculated.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center gap-3">
          <CandlestickChart size={36} className="text-[var(--text-muted)] opacity-40" />
          <div className="max-w-xs">
            <p className="text-sm font-semibold text-white">Sin inversiones registradas</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              Agrega tus posiciones de acciones o criptomonedas para monitorear valor en vivo y rendimiento.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={handleOpenAdd} icon={Plus}>
            Agregar primer activo
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {holdingsCalculated.map(item => {
            const isGain = item.gainLossCentsMXN >= 0
            const is24hUp = item.change24h >= 0
            const isCrypto = item.kind === 'crypto'

            return (
              <div
                key={item.holdingId}
                className="p-4 rounded-xl flex flex-col gap-3 transition-colors"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                {/* ── Encabezado de la Tarjeta ── */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isCrypto ? 'var(--orange-900)' : 'var(--bg-elevated)',
                        color: isCrypto ? 'var(--orange-400)' : 'var(--text-primary)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      {isCrypto ? <Coins size={16} /> : <CandlestickChart size={16} />}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-sm text-white font-mono">
                          {item.symbol}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--bg-elevated)] text-[var(--text-muted)]">
                          {isCrypto ? 'Cripto' : 'Acción'}
                        </span>
                        {item.isStale && (
                          <span
                            className="text-[9px] px-1.5 py-0.2 rounded flex items-center gap-0.5"
                            style={{
                              background: 'var(--bg-elevated)',
                              border: '1px solid var(--border-subtle)',
                              color: 'var(--text-muted)',
                            }}
                            title="Precio de caché local (sin conexión o mercado cerrado)"
                          >
                            <Clock size={10} />
                            Desactualizado
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[var(--text-muted)] block truncate max-w-[150px]">
                        {item.name}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleOpenEdit({
                        id: item.holdingId,
                        symbol: item.symbol,
                        name: item.name,
                        kind: item.kind,
                        quantity: item.quantity,
                        avgCost: item.avgCostCents,
                        costCurrency: item.currency,
                      })}
                      className="p-1.5 text-[var(--text-muted)] hover:text-white rounded-md transition-colors"
                      title="Editar posición"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => onDeleteHolding(item.holdingId)}
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--red-400)] rounded-md transition-colors"
                      title="Eliminar posición"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* ── Métricas Clave (Total invertido, Valor actual, Precio y 24h) ── */}
                <div
                  className="grid grid-cols-2 gap-2 p-2.5 rounded-lg text-[11px] font-mono"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px]">Total invertido</span>
                    <span className="text-white font-semibold">
                      {formatMoney(item.totalCostCentsOrig, item.currency)}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] block">
                      ({item.quantity} títulos)
                    </span>
                  </div>

                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px]">Valor actual</span>
                    <span className="text-white font-bold">
                      {formatMoney(item.currentTotalCentsOrig, item.currency)}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] block">
                      ≈ {formatMoney(item.currentTotalCentsMXN, 'MXN')}
                    </span>
                  </div>

                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px]">Precio unitario</span>
                    <span className="text-white font-medium">
                      ${item.currentUnitPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {item.currency}
                    </span>
                  </div>

                  <div>
                    <span className="text-[var(--text-muted)] block text-[10px]">Variación 24h</span>
                    <span
                      className="font-bold flex items-center gap-0.5"
                      style={{ color: is24hUp ? 'var(--orange-400)' : 'var(--red-400)' }}
                    >
                      {is24hUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {is24hUp ? '+' : ''}{item.change24h}%
                    </span>
                  </div>
                </div>

                {/* ── Fila Inferior: Valor Total y Ganancia / Pérdida ── */}
                <div className="flex items-center justify-between text-xs pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                  <div>
                    <span className="text-[10px] text-[var(--text-muted)] block">Valor actual en MXN</span>
                    <span className="font-bold text-white font-mono text-sm" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {formatMoney(item.currentTotalCentsMXN)}
                    </span>
                    {item.currency === 'USD' && (
                      <span className="text-[10px] text-[var(--text-muted)] font-mono block">
                        ≈ {formatMoney(item.currentTotalCentsOrig, 'USD')}
                      </span>
                    )}
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] text-[var(--text-muted)] block">
                      {isGain ? 'Ganancia estimada' : 'Pérdida estimada'}
                    </span>
                    <div
                      className="flex items-center justify-end gap-1 font-bold font-mono text-xs"
                      style={{
                        color: isGain ? 'var(--orange-400)' : 'var(--red-400)',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {isGain ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      <span>
                        {isGain ? '+' : ''}{formatMoney(item.gainLossCentsMXN)}
                      </span>
                      <span className="text-[10px]">
                        ({isGain ? '+' : ''}{item.gainLossPercent}%)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Modal de Creación / Edición ── */}
      <HoldingFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false)
          setEditingHolding(null)
        }}
        holding={editingHolding}
        onSave={handleSave}
      />
    </div>
  )
}

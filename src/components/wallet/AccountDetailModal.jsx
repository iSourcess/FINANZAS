/**
 * src/components/wallet/AccountDetailModal.jsx
 *
 * Modal de detalle de una cuenta/tarjeta al tocarla en la billetera.
 * Muestra información completa, límites, días de corte/pago y tramos de rendimiento.
 * Incluye botones "Subir" / "Bajar" como alternativa sin gestos al reordenamiento.
 */

import { useState } from 'react'
import {
  Edit2,
  Trash2,
  ShieldAlert,
  ChevronUp,
  ChevronDown,
  Scale,
  Clock,
  Plus,
  PiggyBank,
  Link2,
  FileSpreadsheet,
} from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import Toast from '../ui/Toast.jsx'
import WalletCard from './WalletCard.jsx'
import YieldPanel from './YieldPanel.jsx'
import CreditCardPanel from './CreditCardPanel.jsx'
import ReconcileModal from './ReconcileModal.jsx'
import { useMovements } from '../../store/useMovements.js'
import { useAccounts } from '../../store/useAccounts.js'
import { formatDaysSinceReconcile } from '../../domain/reconcile.js'
import { formatMoney, formatPercent } from '../../lib/format.js'

export default function AccountDetailModal({
  account,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onPayCard,
  onAddCaja,
  onImportCsv,
}) {
  const { movements, deleteMovement } = useMovements()
  const { accounts, reorderAccounts, updateAccount } = useAccounts()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isReconcileOpen, setIsReconcileOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState('')
  const [toastUndoId, setToastUndoId] = useState(null)

  if (!account) return null

  const isCredit = account.type === 'credit'
  const isDebitOrSavings = account.type === 'debit' || account.type === 'savings'

  // Índice de esta cuenta en la lista completa ordenada por sortOrder
  const sortedAll = [...accounts].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const currentIndex = sortedAll.findIndex(a => a.id === account.id)
  const canMoveUp   = currentIndex > 0
  const canMoveDown = currentIndex < sortedAll.length - 1

  const handleMoveUp = async () => {
    if (!canMoveUp) return
    const overId = sortedAll[currentIndex - 1].id
    await reorderAccounts(account.id, overId)
  }

  const handleMoveDown = async () => {
    if (!canMoveDown) return
    const overId = sortedAll[currentIndex + 1].id
    await reorderAccounts(account.id, overId)
  }

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(account.id)
      onClose()
    } else {
      setConfirmDelete(true)
    }
  }

  // Fecha del último cuadre para esta cuenta
  const latestAdjustment = movements.find(
    (m) => m.accountId === account.id && m.type === 'adjustment'
  )
  const lastReconciledDate = account.lastReconciledAt || latestAdjustment?.date || null
  const reconcileInfo = formatDaysSinceReconcile(lastReconciledDate)

  const handleReconcileSuccess = (msg, movementId) => {
    setToastMessage(msg)
    setToastUndoId(movementId)
  }

  const handleUndo = async () => {
    if (!toastUndoId) return
    try {
      await deleteMovement(toastUndoId)
      setToastMessage('Ajuste revertido')
      setToastUndoId(null)
    } catch (err) {
      console.error('[AccountDetailModal] Error al deshacer ajuste:', err)
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={() => {
          setConfirmDelete(false)
          onClose()
        }}
        title={`Detalle de ${account.name}`}
      >
        <div className="flex flex-col gap-5">
          {/* Vista previa de la tarjeta */}
          <div className="w-full">
            <WalletCard account={account} isStacked={false} />
          </div>

          {/* ── Conciliación Bancaria y Cuadre de Saldo ── */}
          <div
            className="rounded-xl p-3.5 flex flex-col gap-2.5"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="p-2 rounded-lg bg-[var(--orange-900)] text-[var(--orange-400)] flex-shrink-0">
                  <Scale size={16} />
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-white">Conciliación bancaria</span>
                  <span className="text-[11px] text-[var(--text-secondary)] truncate">
                    {reconcileInfo.text}
                  </span>
                </div>
              </div>

              <Button
                variant="secondary"
                icon={Scale}
                onClick={() => setIsReconcileOpen(true)}
                className="text-xs flex-shrink-0"
                style={{ minHeight: '44px' }}
              >
                Cuadrar saldo
              </Button>
            </div>

            {reconcileInfo.isWarning && (
              <div
                className="p-2.5 rounded-lg flex items-start gap-2 text-xs animate-in fade-in duration-200"
                style={{
                  background: 'rgba(245, 158, 11, 0.1)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#F59E0B',
                }}
              >
                <Clock size={15} className="flex-shrink-0 mt-0.5" />
                <span className="text-[11px] leading-relaxed">
                  Han pasado más de 30 días sin cuadrar esta cuenta. Te sugerimos verificar tu saldo bancario real.
                </span>
              </div>
            )}
          </div>

          {/* ── Botones de orden (alternativa sin gestos) ── */}
          <div
            className="flex items-center gap-3 rounded-xl p-3"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
          >
            <span
              className="text-xs font-medium flex-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              Posición en la billetera
            </span>
            <button
              onClick={handleMoveUp}
              disabled={!canMoveUp}
              aria-label="Mover tarjeta hacia arriba"
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium
                         transition-colors disabled:opacity-40"
              style={{
                minHeight: '44px',
                minWidth: '44px',
                background: canMoveUp ? 'var(--bg-overlay)' : 'transparent',
                color: canMoveUp ? 'var(--text-primary)' : 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <ChevronUp size={16} />
              Subir
            </button>
            <button
              onClick={handleMoveDown}
              disabled={!canMoveDown}
              aria-label="Mover tarjeta hacia abajo"
              className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium
                         transition-colors disabled:opacity-40"
              style={{
                minHeight: '44px',
                minWidth: '44px',
                background: canMoveDown ? 'var(--bg-overlay)' : 'transparent',
                color: canMoveDown ? 'var(--text-primary)' : 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <ChevronDown size={16} />
              Bajar
            </button>
          </div>

          {/* ── Panel de Tarjeta de Crédito (Corte, Pago, MSI) ── */}
          {isCredit && (
            <CreditCardPanel
              account={account}
              movements={movements}
              onPayCard={onPayCard}
            />
          )}

          {/* ── Cajas de Ahorro y Apartados (Dentro de la misma tarjeta de débito) ── */}
          {isDebitOrSavings && !account.parentId && (
            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PiggyBank size={16} className="text-[var(--orange-400)]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-white">
                    Cajas de ahorro y apartados
                  </span>
                </div>
                {onAddCaja && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Plus}
                    onClick={() => {
                      onClose()
                      onAddCaja(account.id)
                    }}
                  >
                    Nueva caja
                  </Button>
                )}
              </div>

              {/* Lista de cajas pertenecientes a esta tarjeta de débito */}
              {(() => {
                const childCajas = accounts.filter((a) => a.parentId === account.id)
                const unlinkedSameBank = accounts.filter(
                  (a) => a.id !== account.id && !a.parentId && a.type === 'savings' && a.themeKey === account.themeKey
                )

                if (childCajas.length === 0 && unlinkedSameBank.length === 0) {
                  return (
                    <div
                      className="p-3.5 rounded-lg text-center flex flex-col items-center gap-2"
                      style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-default)' }}
                    >
                      <p className="text-xs text-[var(--text-secondary)]">
                        Esta tarjeta aún no tiene cajas de ahorro vinculadas.
                      </p>
                      {onAddCaja && (
                        <button
                          type="button"
                          onClick={() => {
                            onClose()
                            onAddCaja(account.id)
                          }}
                          className="text-xs font-semibold text-[var(--orange-400)] hover:underline flex items-center gap-1"
                          style={{ minHeight: '36px' }}
                        >
                          <Plus size={13} />
                          Agregar Cajita Turbo o Apartado a esta tarjeta
                        </button>
                      )}
                    </div>
                  )
                }

                return (
                  <div className="flex flex-col gap-2">
                    {/* Cajas vinculadas */}
                    {childCajas.map((caja) => {
                      const yieldRate = caja.yieldTiers && caja.yieldTiers.length > 0
                        ? caja.yieldTiers[0].rate
                        : null

                      return (
                        <div
                          key={caja.id}
                          className="p-3 rounded-lg flex items-center justify-between gap-3 transition-colors"
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-white truncate">{caja.name}</span>
                              {yieldRate !== null && yieldRate > 0 && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[var(--orange-950)] text-[var(--orange-400)] border border-[var(--orange-900)]">
                                  ⚡ {formatPercent(yieldRate)}
                                </span>
                              )}
                            </div>
                            <span className="text-xs font-mono font-semibold text-white mt-0.5 block">
                              {formatMoney(caja.balance, caja.currency)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                onClose()
                                onEdit(caja)
                              }}
                              aria-label={`Editar ${caja.name}`}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-elevated)] transition-colors"
                              style={{ minHeight: '44px' }}
                            >
                              <Edit2 size={14} />
                            </button>
                          </div>
                        </div>
                      )
                    })}

                    {/* Sugerencias para vincular cajas existentes del mismo banco */}
                    {unlinkedSameBank.map((unlinked) => (
                      <div
                        key={unlinked.id}
                        className="p-2.5 rounded-lg flex items-center justify-between gap-2 text-xs"
                        style={{ background: 'var(--bg-surface)', border: '1px dashed var(--orange-400)' }}
                      >
                        <span className="text-[11px] text-[var(--text-secondary)]">
                          ¿Vincular <strong>{unlinked.name}</strong> a esta tarjeta de débito?
                        </span>
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={Link2}
                          onClick={async () => {
                            await updateAccount(unlinked.id, { parentId: account.id })
                            setToastMessage(`"${unlinked.name}" vinculada a ${account.name}`)
                          }}
                        >
                          Vincular
                        </Button>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── Panel de Rendimiento Estimado (Débito / Ahorro) ── */}
          {isDebitOrSavings && account.yieldTiers && account.yieldTiers.length > 0 && (
            <YieldPanel account={account} />
          )}

          {/* ── Reordenar tarjeta (Alternativa táctil sin arrastre) ── */}
          {accounts.length > 1 && (
            <div
              className="flex items-center justify-between p-3 rounded-xl gap-2"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">Posición en la billetera</span>
                <span className="text-[11px] text-[var(--text-secondary)]">
                  {currentIndex + 1} de {sortedAll.length}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ChevronUp}
                  disabled={!canMoveUp}
                  onClick={handleMoveUp}
                  title="Mover arriba"
                >
                  Subir
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={ChevronDown}
                  disabled={!canMoveDown}
                  onClick={handleMoveDown}
                  title="Mover abajo"
                >
                  Bajar
                </Button>
              </div>
            </div>
          )}

          {/* ── Botones de Acción ── */}
          <div className="flex flex-col gap-2.5 mt-2 pt-3 border-t border-[var(--border-subtle)]">
            <Button
              variant="secondary"
              className="w-full text-white"
              icon={FileSpreadsheet}
              style={{ minHeight: '44px' }}
              onClick={() => {
                onClose()
                onImportCsv?.(account)
              }}
            >
              Importar estado de cuenta CSV
            </Button>

            <Button
              variant="secondary"
              className="w-full"
              icon={Edit2}
              style={{ minHeight: '44px' }}
              onClick={() => {
                onClose()
                onEdit(account)
              }}
            >
              Editar cuenta
            </Button>

            <Button
              variant={confirmDelete ? 'danger' : 'secondary'}
              className="w-full font-medium transition-colors"
              style={{
                borderColor: confirmDelete ? 'var(--red-500)' : 'rgba(239, 68, 68, 0.4)',
                background: confirmDelete ? 'var(--red-900)' : 'rgba(239, 68, 68, 0.08)',
                color: 'var(--red-400)',
                minHeight: '44px',
              }}
              icon={confirmDelete ? ShieldAlert : Trash2}
              onClick={handleDelete}
            >
              {confirmDelete ? '¿Confirmar: Eliminar esta tarjeta?' : 'Eliminar tarjeta'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ── Modal de Cuadrar Saldo ── */}
      <ReconcileModal
        account={account}
        isOpen={isReconcileOpen}
        onClose={() => setIsReconcileOpen(false)}
        onSuccess={handleReconcileSuccess}
      />

      {/* ── Notificación Toast flotante con Deshacer ── */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          onUndo={toastUndoId ? handleUndo : null}
          onClose={() => {
            setToastMessage('')
            setToastUndoId(null)
          }}
        />
      )}
    </>
  )
}

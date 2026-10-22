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
} from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import WalletCard from './WalletCard.jsx'
import YieldPanel from './YieldPanel.jsx'
import CreditCardPanel from './CreditCardPanel.jsx'
import { useMovements } from '../../store/useMovements.js'
import { useAccounts } from '../../store/useAccounts.js'

export default function AccountDetailModal({
  account,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onPayCard,
}) {
  const { movements } = useMovements()
  const { accounts, reorderAccounts } = useAccounts()
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  return (
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

        {/* ── Panel de Rendimiento Estimado (Débito / Ahorro) ── */}
        {isDebitOrSavings && account.yieldTiers && account.yieldTiers.length > 0 && (
          <YieldPanel account={account} />
        )}

        {/* ── Botones de Acción ── */}
        <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
          <Button
            variant="secondary"
            className="w-full flex-1"
            icon={Edit2}
            onClick={() => {
              onClose()
              onEdit(account)
            }}
          >
            Editar cuenta
          </Button>

          <Button
            variant={confirmDelete ? 'danger' : 'ghost'}
            className="w-full sm:w-auto text-xs"
            icon={confirmDelete ? ShieldAlert : Trash2}
            onClick={handleDelete}
          >
            {confirmDelete ? '¿Confirmar eliminación?' : 'Eliminar'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

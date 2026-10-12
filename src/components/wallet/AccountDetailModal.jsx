/**
 * src/components/wallet/AccountDetailModal.jsx
 *
 * Modal de detalle de una cuenta/tarjeta al tocarla en la billetera.
 * Muestra información completa, límites, días de corte/pago y tramos de rendimiento.
 */

import { useState } from 'react'
import { Edit2, Trash2, Calendar, ShieldAlert, Sparkles, CreditCard } from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import WalletCard from './WalletCard.jsx'
import YieldPanel from './YieldPanel.jsx'
import CreditCardPanel from './CreditCardPanel.jsx'
import { useMovements } from '../../store/useMovements.js'
import { formatMoney, formatPercent } from '../../lib/format.js'

export default function AccountDetailModal({
  account,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onPayCard,
}) {
  const { movements } = useMovements()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (!account) return null

  const isCredit = account.type === 'credit'
  const isDebitOrSavings = account.type === 'debit' || account.type === 'savings'
  const debt = isCredit ? (account.balance || 0) : 0
  const limit = account.credit?.limit || 0
  const availableCredit = Math.max(0, limit - debt)

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

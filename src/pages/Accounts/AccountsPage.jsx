/**
 * src/pages/Accounts/AccountsPage.jsx
 *
 * Pantalla principal de Cuentas y Billetera.
 *
 * Muestra:
 *   1. Patrimonio Total (Efectivo + Débito/Ahorro − Deuda de Crédito) con desglose.
 *   2. Billetera visual estilo Google Wallet (CardStack con tarjetas apiladas y desplegadas).
 *   3. Modal de detalle por tarjeta y formulario para crear/editar cuentas.
 */

import { useEffect, useState, useMemo } from 'react'
import { Plus, Wallet, TrendingUp, TrendingDown, ShieldCheck } from 'lucide-react'
import { useAccounts } from '../../store/useAccounts.js'
import { useMovements } from '../../store/useMovements.js'
import CardStack from '../../components/wallet/CardStack.jsx'
import AccountDetailModal from '../../components/wallet/AccountDetailModal.jsx'
import AccountForm from '../../components/forms/AccountForm.jsx'
import MovementForm from '../../components/forms/MovementForm.jsx'
import Modal from '../../components/ui/Modal.jsx'
import Button from '../../components/ui/Button.jsx'
import { formatMoney } from '../../lib/format.js'

export default function AccountsPage() {
  const {
    accounts,
    loading,
    error,
    fetchAccounts,
    addAccount,
    updateAccount,
    deleteAccount,
  } = useAccounts()

  // Modales
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)
  const [payingCard, setPayingCard] = useState(null)

  const { addMovement } = useMovements()

  // Cargar cuentas de Dexie al montar
  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  // ── Cálculo del Patrimonio Total ──
  // Patrimonio = (Efectivo + Débito + Ahorro) - Deuda de crédito
  const { totalAssets, totalDebt, netWorth } = useMemo(() => {
    let assets = 0
    let debt = 0

    accounts.forEach((acc) => {
      const bal = acc.balance || 0
      if (acc.type === 'credit') {
        debt += bal // En crédito, balance representa la deuda
      } else {
        assets += bal // En débito, efectivo y ahorro representa saldo a favor
      }
    })

    return {
      totalAssets: assets,
      totalDebt: debt,
      netWorth: assets - debt,
    }
  }, [accounts])

  // Abrir modal de creación
  const handleOpenCreate = () => {
    setEditingAccount(null)
    setIsFormOpen(true)
  }

  // Abrir modal de edición desde detalle
  const handleOpenEdit = (acc) => {
    setEditingAccount(acc)
    setIsFormOpen(true)
  }

  // Guardar cuenta (crear o editar)
  const handleSaveAccount = async (data) => {
    if (editingAccount) {
      await updateAccount(editingAccount.id, data)
    } else {
      await addAccount(data)
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto flex flex-col gap-6">
      {/* ── Encabezado ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'var(--font-size-2xl)',
              fontWeight: 700,
              color: 'var(--text-primary)',
            }}
          >
            Cuentas
          </h1>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            Billetera digital y patrimonio neto
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={handleOpenCreate}
        >
          Nueva cuenta
        </Button>
      </div>

      {/* ── Mensaje de Error si ocurre ── */}
      {error && (
        <div
          className="p-3 rounded-xl text-xs"
          style={{
            background: 'var(--red-900)',
            color: 'var(--red-400)',
            border: '1px solid var(--red-600)',
          }}
        >
          {error}
        </div>
      )}

      {/* ── Hero: Tarjeta de Patrimonio Total ── */}
      <div
        className="rounded-2xl p-5 sm:p-6 relative overflow-hidden"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Decoración de fondo sutil */}
        <div
          className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none opacity-10"
          style={{
            background: 'radial-gradient(circle, var(--orange-400) 0%, transparent 70%)',
            transform: 'translate(30%, -30%)',
          }}
          aria-hidden="true"
        />

        <div className="flex items-center gap-2 mb-2">
          <Wallet size={18} className="text-[var(--orange-400)]" />
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
            Patrimonio Neto Total
          </span>
        </div>

        {/* Monto Principal */}
        <div className="mb-4">
          <span
            className="block text-3xl sm:text-4xl font-bold tracking-tight"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              color: netWorth >= 0 ? 'var(--text-primary)' : 'var(--red-400)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatMoney(netWorth)}
          </span>
          <span className="text-xs text-[var(--text-muted)] mt-1 block">
            Efectivo + Débito − Deuda en tarjetas
          </span>
        </div>

        {/* ── Desglose de Activos y Deuda ── */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          {/* Activos Disponibles */}
          <div
            className="p-3 rounded-xl"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mb-1">
              <TrendingUp size={14} className="text-[var(--orange-400)]" />
              <span>Activos disponibles</span>
            </div>
            <span
              className="block font-bold text-base sm:text-lg text-white"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatMoney(totalAssets)}
            </span>
          </div>

          {/* Deuda en Tarjetas */}
          <div
            className="p-3 rounded-xl"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mb-1">
              <TrendingDown size={14} className="text-[var(--red-400)]" />
              <span>Deuda en tarjetas</span>
            </div>
            <span
              className="block font-bold text-base sm:text-lg"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                color: totalDebt > 0 ? 'var(--red-400)' : 'var(--text-muted)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatMoney(totalDebt)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Sección de la Billetera Visual (Google Wallet) ── */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'var(--font-size-lg)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            Billetera
          </h2>
          <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
            <ShieldCheck size={14} /> Datos en tu dispositivo
          </span>
        </div>

        {loading && accounts.length === 0 ? (
          <div className="py-12 text-center text-xs text-[var(--text-muted)]">
            Cargando billetera...
          </div>
        ) : (
          <CardStack
            accounts={accounts}
            onSelectAccount={(acc) => setSelectedAccount(acc)}
            onAddNew={handleOpenCreate}
          />
        )}
      </section>

      {/* ── Modal de Detalle de Cuenta ── */}
      <AccountDetailModal
        account={selectedAccount}
        isOpen={Boolean(selectedAccount)}
        onClose={() => setSelectedAccount(null)}
        onEdit={(acc) => handleOpenEdit(acc)}
        onDelete={async (id) => {
          await deleteAccount(id)
          setSelectedAccount(null)
        }}
        onPayCard={(acc) => {
          setSelectedAccount(null)
          setPayingCard(acc)
        }}
      />

      {/* ── Modal para Pagar Tarjeta (Transferencia desde Débito) ── */}
      {payingCard && (
        <Modal
          isOpen={Boolean(payingCard)}
          onClose={() => setPayingCard(null)}
          title={`Pagar tarjeta: ${payingCard.name}`}
        >
          <MovementForm
            accounts={accounts}
            categories={[]}
            initialMovement={{
              type: 'transfer',
              toAccountId: payingCard.id,
              amount: payingCard.balance || 0,
              note: `Pago de tarjeta ${payingCard.name}`,
            }}
            onSave={async (data) => {
              await addMovement(data)
              setPayingCard(null)
            }}
            onCancel={() => setPayingCard(null)}
          />
        </Modal>
      )}

      {/* ── Modal de Formulario (Crear / Editar) ── */}
      <AccountForm
        account={editingAccount}
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false)
          setEditingAccount(null)
        }}
        onSave={handleSaveAccount}
      />
    </div>
  )
}

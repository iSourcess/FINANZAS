/**
 * src/components/wallet/CreditCardPanel.jsx
 *
 * Panel de condiciones de tarjeta de crédito y compras a Meses Sin Intereses (MSI).
 *
 * Muestra:
 *   - Próximo corte y fecha límite de pago con días restantes.
 *   - Crédito disponible y desglose de deuda (corriente + MSI pendientes).
 *   - Compras activas a MSI con barra de progreso 'Pago X de Y'.
 *   - Botón para registrar el pago de la tarjeta desde débito (transferencia).
 */

import { Calendar, CreditCard, ArrowRightLeft, Clock, ShoppingBag } from 'lucide-react'
import { getCreditCardStatus } from '../../domain/creditCards.js'
import { formatMoney, formatDate } from '../../lib/format.js'
import Button from '../ui/Button.jsx'

export default function CreditCardPanel({
  account,
  movements = [],
  onPayCard,
}) {
  if (!account || account.type !== 'credit') return null

  const status = getCreditCardStatus({
    account,
    movements,
  })

  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-4"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* ── Encabezado y Crédito Disponible ── */}
      <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div>
          <span className="block text-[10px] text-[var(--text-muted)] uppercase font-semibold">
            Crédito disponible
          </span>
          <span
            className="block text-2xl font-bold font-mono text-[var(--orange-400)] tracking-tight"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {formatMoney(status.availableCreditCents)}
          </span>
          <span className="text-[11px] text-[var(--text-secondary)] font-mono">
            de {formatMoney(status.limitCents)} límite
          </span>
        </div>

        {onPayCard && (
          <Button
            size="sm"
            variant="primary"
            icon={ArrowRightLeft}
            onClick={() => onPayCard(account)}
          >
            Pagar tarjeta
          </Button>
        )}
      </div>

      {/* ── Fechas de Corte y Límite de Pago ── */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* Próximo Corte */}
        <div className="p-2.5 rounded-lg flex flex-col gap-1" style={{ background: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <Calendar size={13} className="text-[var(--orange-400)]" />
            <span className="font-semibold">Próximo corte</span>
          </div>
          <span className="text-sm font-bold text-white font-mono">
            {formatDate(status.nextCutDate)}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">
            {status.daysToCut === 0
              ? 'Hoy es día de corte'
              : status.daysToCut === 1
              ? 'Mañana'
              : `Faltan ${status.daysToCut} días`}
          </span>
        </div>

        {/* Fecha Límite de Pago */}
        <div className="p-2.5 rounded-lg flex flex-col gap-1" style={{ background: 'var(--bg-surface)' }}>
          <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <Clock size={13} className="text-[var(--text-secondary)]" />
            <span className="font-semibold">Límite de pago</span>
          </div>
          <span className="text-sm font-bold text-white font-mono">
            {formatDate(status.nextPayDate)}
          </span>
          <span className="text-[10px] text-[var(--text-muted)]">
            {status.daysToPay === 0
              ? 'Hoy vence el pago'
              : status.daysToPay === 1
              ? 'Mañana'
              : `Faltan ${status.daysToPay} días`}
          </span>
        </div>
      </div>

      {/* ── Desglose de Deuda: Corriente vs MSI ── */}
      <div className="flex items-center justify-between p-2.5 rounded-lg text-xs" style={{ background: 'var(--bg-surface)' }}>
        <div>
          <span className="block text-[10px] text-[var(--text-muted)]">Deuda corriente</span>
          <span className="font-mono font-semibold text-white">
            {formatMoney(status.currentDebtCents)}
          </span>
        </div>
        <div className="text-right">
          <span className="block text-[10px] text-[var(--text-muted)]">Deuda MSI restante</span>
          <span className="font-mono font-semibold text-[var(--orange-400)]">
            {formatMoney(status.pendingMsiDebtCents)}
          </span>
        </div>
      </div>

      {/* ── Compras a MSI Activas ── */}
      <div className="flex flex-col gap-2.5 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
            <CreditCard size={14} className="text-[var(--orange-400)]" />
            Compras a MSI Activas ({status.activeMsiList.length})
          </span>
        </div>

        {status.activeMsiList.length === 0 ? (
          <p className="text-xs text-[var(--text-muted)] italic py-1">
            No tienes compras a Meses Sin Intereses activas en esta tarjeta.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {status.activeMsiList.map((item) => (
              <div
                key={item.movementId}
                className="p-3 rounded-xl flex flex-col gap-2"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate">
                    <ShoppingBag size={14} className="text-[var(--orange-400)] flex-shrink-0" />
                    <span className="text-xs font-bold text-white truncate">{item.note}</span>
                  </div>
                  <span className="text-xs font-bold font-mono text-[var(--orange-400)] flex-shrink-0">
                    {formatMoney(item.monthlyAmountCents)} / mes
                  </span>
                </div>

                {/* Barra de progreso 'Pago X de Y' */}
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-[var(--text-primary)] font-semibold">
                      Pago {item.paidMonths} de {item.totalMonths}
                    </span>
                    <span className="text-[var(--text-muted)] text-[10px]">
                      Resta: {formatMoney(item.remainingDebtCents)}
                    </span>
                  </div>

                  <div
                    className="w-full h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'var(--bg-elevated)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${item.progressPercent}%`,
                        background: 'var(--orange-400)',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * src/components/wallet/WalletCard.jsx
 *
 * Tarjeta visual estilo física/Google Wallet.
 *
 * Reglas de diseño:
 *   - Usa los colores oficiales de CARD_THEMES de src/lib/constants.js.
 *   - El texto respeta estrictamente theme.text para garantizar contraste >= 4.5:1.
 *   - Los números usan font-variant-numeric: tabular-nums.
 *   - Muestra nombre, tipo (crédito/débito/efectivo), últimos 4 dígitos y saldo o deuda.
 */

import { CreditCard, Wifi } from 'lucide-react'
import { getCardTheme } from '../../lib/constants.js'
import { formatMoney, formatPercent, formatCardDigits } from '../../lib/format.js'
import { useMovements } from '../../store/useMovements.js'
import { calculatePendingMsiDebt } from '../../domain/msi.js'

export default function WalletCard({
  account,
  onClick,
  isStacked = false,
  stackOffset = 0,
  isActive = false,
  className = '',
}) {
  const theme = getCardTheme(account.themeKey)
  const isCredit = account.type === 'credit'
  const isCash = account.type === 'cash'

  // Para crédito: balance es la deuda acumulada
  const debt = isCredit ? (account.balance || 0) : 0
  const limit = account.credit?.limit || 0
  const pendingMsi = isCredit ? calculatePendingMsiDebt(useMovements.getState().movements, account.id) : 0
  const availableCredit = Math.max(0, limit - debt - pendingMsi)

  // Tipo amigable
  const typeLabel = {
    credit: 'Crédito',
    debit: 'Débito',
    cash: 'Efectivo',
    savings: 'Ahorro',
  }[account.type] || 'Cuenta'

  // Rendimiento si existe
  const highestYield = account.yieldTiers && account.yieldTiers.length > 0
    ? Math.max(...account.yieldTiers.map(t => t.rate))
    : null

  // Texto adaptativo
  const textColor = theme.text
  const isDarkText = textColor === '#0A0A0A' || textColor === '#111111'
  const subtleTextColor = isDarkText ? 'rgba(0, 0, 0, 0.70)' : 'rgba(255, 255, 255, 0.75)'
  const badgeBg = isDarkText ? 'rgba(0, 0, 0, 0.12)' : 'rgba(255, 255, 255, 0.18)'
  const badgeBorder = isDarkText ? 'rgba(0, 0, 0, 0.20)' : 'rgba(255, 255, 255, 0.25)'

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      aria-label={`Tarjeta ${account.name}, ${typeLabel}`}
      className={`relative w-full rounded-2xl select-none cursor-pointer transition-all duration-200 outline-none ${className}`}
      style={{
        background: `linear-gradient(135deg, ${theme.base} 0%, ${theme.accent} 100%)`,
        color: textColor,
        minHeight: isStacked ? '84px' : '180px',
        padding: '18px 20px',
        boxShadow: isActive
          ? '0 12px 30px -4px rgba(0, 0, 0, 0.6), 0 0 0 2px var(--orange-400)'
          : '0 6px 18px -2px rgba(0, 0, 0, 0.45)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        transform: isStacked ? `translateY(${stackOffset}px)` : 'none',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* ── Fila Superior: Nombre y Tipo ── */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '18px',
              fontWeight: 700,
              letterSpacing: '-0.02em',
            }}
          >
            {account.name}
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-semibold"
            style={{
              background: badgeBg,
              border: `1px solid ${badgeBorder}`,
              color: textColor,
              fontSize: '10px',
              fontFamily: "'DM Sans', sans-serif",
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            {typeLabel}
          </span>
        </div>

        {/* Íconos chip / contactless */}
        <div className="flex items-center gap-2 opacity-80" aria-hidden="true">
          <Wifi size={16} className="rotate-90" />
          <CreditCard size={18} />
        </div>
      </div>

      {/* ── Fila Media: Dígitos de tarjeta y Badge de Rendimiento ── */}
      <div className="mt-3 flex items-center justify-between">
        <span
          style={{
            fontFamily: "'Space Grotesk', monospace",
            fontSize: '13px',
            letterSpacing: '0.12em',
            color: subtleTextColor,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {formatCardDigits(account.last4)}
        </span>

        {highestYield !== null && highestYield > 0 && (
          <span
            className="px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1"
            style={{
              background: isDarkText ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.22)',
              border: `1px solid ${badgeBorder}`,
              color: textColor,
              fontSize: '11px',
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            ⚡ {formatPercent(highestYield)} anual
          </span>
        )}
      </div>

      {/* ── Fila Inferior: Saldos / Límites ── */}
      <div className="mt-4 pt-3 flex items-end justify-between border-t" style={{ borderColor: badgeBorder }}>
        <div>
          <span
            className="block text-xs uppercase font-medium tracking-wider"
            style={{ color: subtleTextColor, fontSize: '10px' }}
          >
            {isCredit ? 'Deuda actual' : 'Saldo disponible'}
          </span>
          <span
            className="block font-bold tracking-tight"
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: '22px',
              lineHeight: 1.2,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatMoney(account.balance, account.currency)}
          </span>
        </div>

        {isCredit && limit > 0 && (
          <div className="text-right">
            <span
              className="block text-xs uppercase font-medium tracking-wider"
              style={{ color: subtleTextColor, fontSize: '10px' }}
            >
              Disponible
            </span>
            <span
              className="block font-semibold"
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: '14px',
                color: textColor,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatMoney(availableCredit, account.currency)}
            </span>
          </div>
        )}

        {isCash && (
          <span
            className="text-xs font-medium px-2 py-0.5 rounded"
            style={{ background: badgeBg, color: textColor }}
          >
            Billetes y monedas
          </span>
        )}
      </div>
    </div>
  )
}

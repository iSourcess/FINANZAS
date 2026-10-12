/**
 * src/components/wallet/CardPicker.jsx
 *
 * Selector visual de tarjeta estilo Google Wallet para registrar movimientos.
 * Muestra las tarjetas disponibles en carrusel horizontal o lista compacta.
 */

import { getCardTheme } from '../../lib/constants.js'
import { formatMoney, formatCardDigits } from '../../lib/format.js'

export default function CardPicker({
  accounts = [],
  selectedAccountId,
  onSelect,
}) {
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-2 pt-1 scrollbar-none">
      {accounts.map((account) => {
        const theme = getCardTheme(account.themeKey)
        const isSelected = account.id === selectedAccountId
        const isCredit = account.type === 'credit'
        const textColor = theme.text
        const subtleText = textColor === '#0A0A0A' || textColor === '#111111'
          ? 'rgba(0, 0, 0, 0.7)'
          : 'rgba(255, 255, 255, 0.75)'

        return (
          <button
            key={account.id}
            type="button"
            onClick={() => onSelect(account.id)}
            className="flex-shrink-0 rounded-xl p-3 text-left transition-all relative outline-none"
            style={{
              width: '160px',
              minHeight: '84px',
              background: `linear-gradient(135deg, ${theme.base} 0%, ${theme.accent} 100%)`,
              color: textColor,
              boxShadow: isSelected
                ? '0 0 0 2px var(--orange-400), 0 8px 16px rgba(0,0,0,0.4)'
                : '0 2px 8px rgba(0,0,0,0.25)',
              opacity: selectedAccountId && !isSelected ? 0.65 : 1,
              transform: isSelected ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            <div className="flex items-center justify-between gap-1 mb-1">
              <span
                className="font-bold text-xs truncate"
                style={{ fontFamily: "'Space Grotesk', sans-serif" }}
              >
                {account.name}
              </span>
              <span
                className="text-[9px] font-mono tracking-wider opacity-80"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatCardDigits(account.last4)}
              </span>
            </div>

            <div className="mt-2">
              <span className="block text-[9px] uppercase font-medium" style={{ color: subtleText }}>
                {isCredit ? 'Deuda' : 'Saldo'}
              </span>
              <span
                className="block text-xs font-bold font-mono tracking-tight"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatMoney(account.balance, account.currency)}
              </span>
            </div>
          </button>
        )
      })}
    </div>
  )
}

/**
 * src/components/wallet/CardPicker.jsx
 *
 * Selector visual de tarjeta estilo Google Wallet para registrar movimientos.
 * Muestra las tarjetas disponibles en carrusel horizontal o lista compacta.
 *
 * - Muestra "Nombre · Tipo" para identificar crédito vs débito de la misma marca.
 * - Las tarjetas no seleccionadas se atenúan con opacity (sin cambiar el tono de la marca).
 */

import { getCardTheme } from '../../lib/constants.js'
import { formatMoney, formatCardDigits } from '../../lib/format.js'

const TYPE_LABELS = {
  credit: 'Crédito',
  debit: 'Débito',
  cash: 'Efectivo',
  savings: 'Ahorro',
}

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
        const typeLabel = TYPE_LABELS[account.type] || ''

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
              // Atenuar sin cambiar el tono del color de marca (opacity, no filter/brightness)
              opacity: selectedAccountId && !isSelected ? 0.55 : 1,
              transform: isSelected ? 'scale(1.02)' : 'scale(1)',
            }}
          >
            {/* Fila superior: nombre y últimos 4 dígitos */}
            <div className="flex items-start justify-between gap-1">
              <div className="min-w-0">
                <span
                  className="block font-bold text-xs truncate"
                  style={{ fontFamily: "'Space Grotesk', sans-serif" }}
                >
                  {account.name}
                </span>
                {/* Tipo de cuenta — diferencia crédito vs débito de la misma marca */}
                {typeLabel && (
                  <span
                    className="block text-[9px] uppercase font-semibold tracking-wider mt-0.5"
                    style={{ color: subtleText }}
                  >
                    {typeLabel}
                  </span>
                )}
              </div>
              {/* Últimos 4 dígitos — white-space nowrap para que no salten de línea */}
              <span
                className="text-[9px] font-mono tracking-wider opacity-80 flex-shrink-0 whitespace-nowrap"
                style={{ fontVariantNumeric: 'tabular-nums' }}
              >
                {formatCardDigits(account.last4)}
              </span>
            </div>

            {/* Saldo / Deuda */}
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

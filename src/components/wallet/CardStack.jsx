/**
 * src/components/wallet/CardStack.jsx
 *
 * Billetera visual estilo Google Wallet.
 *
 * Características:
 *   - Modo Apilado (Google Wallet): tarjetas superpuestas donde asoma la cabecera de cada una.
 *   - Modo Desplegado: cuadrícula o lista limpia con todas las tarjetas completas.
 *   - Filtros rápidos: Todas | Débito y Efectivo | Crédito.
 *   - Al tocar cualquier tarjeta se abre su modal de detalle.
 */

import { useState } from 'react'
import { Layers, LayoutGrid, Plus } from 'lucide-react'
import WalletCard from './WalletCard.jsx'
import Button from '../ui/Button.jsx'

export default function CardStack({
  accounts = [],
  onSelectAccount,
  onAddNew,
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [filter, setFilter] = useState('all') // 'all' | 'debit' | 'credit'
  const [activeCardId, setActiveCardId] = useState(null)

  // Filtrado de cuentas
  const filteredAccounts = accounts.filter(acc => {
    if (filter === 'debit') return acc.type === 'debit' || acc.type === 'cash' || acc.type === 'savings'
    if (filter === 'credit') return acc.type === 'credit'
    return true
  })

  // En modo apilado, si el usuario selecciona una tarjeta, la traemos al frente
  const sortedAccounts = [...filteredAccounts]
  if (!isExpanded && activeCardId) {
    const activeIndex = sortedAccounts.findIndex(a => a.id === activeCardId)
    if (activeIndex > 0) {
      const [activeItem] = sortedAccounts.splice(activeIndex, 1)
      sortedAccounts.unshift(activeItem)
    }
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {/* ── Controles superiores: Filtros y modo de visualización ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'all'
                ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            Todas ({accounts.length})
          </button>
          <button
            onClick={() => setFilter('debit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'debit'
                ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            Débito
          </button>
          <button
            onClick={() => setFilter('credit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === 'credit'
                ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-white'
            }`}
          >
            Crédito
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Alternar modo pila / cuadrícula */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Modo pila Google Wallet' : 'Ver todas desplegadas'}
            className="p-2 rounded-xl text-[var(--text-secondary)] hover:text-white transition-colors"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
          >
            {isExpanded ? <Layers size={18} /> : <LayoutGrid size={18} />}
          </button>

          {/* Botón agregar cuenta */}
          <Button
            size="sm"
            variant="secondary"
            icon={Plus}
            onClick={onAddNew}
          >
            Nueva
          </Button>
        </div>
      </div>

      {/* ── Visualización de las Tarjetas ── */}
      {sortedAccounts.length === 0 ? (
        <div
          className="rounded-2xl p-8 text-center flex flex-col items-center justify-center gap-3"
          style={{
            background: 'var(--bg-surface)',
            border: '1px dashed var(--border-default)',
            color: 'var(--text-muted)',
          }}
        >
          <p className="text-sm">No hay tarjetas registradas en esta vista.</p>
          <Button size="sm" variant="primary" icon={Plus} onClick={onAddNew}>
            Agregar primera cuenta
          </Button>
        </div>
      ) : isExpanded ? (
        /* ── MODO DESPLEGADO (Lista / Grilla) ── */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sortedAccounts.map((account) => (
            <div key={account.id} className="transition-transform hover:-translate-y-1">
              <WalletCard
                account={account}
                isStacked={false}
                onClick={() => onSelectAccount(account)}
              />
            </div>
          ))}
        </div>
      ) : (
        /* ── MODO PILA GOOGLE WALLET ── */
        <div className="relative pt-2 pb-6">
          <div
            className="relative flex flex-col items-center"
            style={{
              // Espacio total para que la pila no corte las tarjetas inferiores
              minHeight: `${Math.max(220, 180 + (sortedAccounts.length - 1) * 60)}px`,
            }}
          >
            {sortedAccounts.map((account, index) => {
              const isTop = index === 0
              // Offset vertical acumulado estilo Google Wallet
              const peekOffset = index * 58

              return (
                <div
                  key={account.id}
                  className="absolute w-full max-w-md transition-all duration-300"
                  style={{
                    top: `${peekOffset}px`,
                    zIndex: index + 1,
                  }}
                >
                  <WalletCard
                    account={account}
                    isStacked={!isTop}
                    isActive={activeCardId === account.id}
                    onClick={() => {
                      if (!isTop) {
                        setActiveCardId(account.id)
                      }
                      onSelectAccount(account)
                    }}
                  />
                </div>
              )
            })}
          </div>

          <p className="text-center text-xs text-[var(--text-muted)] mt-2">
            Toca cualquier tarjeta para ver su detalle o editarla
          </p>
        </div>
      )}
    </div>
  )
}

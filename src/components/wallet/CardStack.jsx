/**
 * src/components/wallet/CardStack.jsx
 *
 * Billetera visual estilo Google Wallet con reordenamiento por pulsación larga.
 *
 * Características:
 *   - Modo Apilado (Google Wallet): tarjetas superpuestas donde asoma la cabecera de cada una.
 *   - Modo Desplegado: cuadrícula/lista con todas las tarjetas completas.
 *   - Filtros rápidos: Todas | Débito y Efectivo | Crédito.
 *   - Al tocar cualquier tarjeta (toque corto) se abre su modal de detalle.
 *   - Pulsación larga (400 ms) activa el reordenamiento con @dnd-kit.
 *   - Al soltar: persiste el orden y muestra un toast "Orden guardado" con Deshacer.
 *   - Scroll vertical normal sigue funcionando (tolerance: 8 px).
 *   - navigator.vibrate(10) al activarse el drag.
 */

import { useState, useCallback, useRef } from 'react'
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { Layers, LayoutGrid, Plus, CheckCircle, RotateCcw } from 'lucide-react'
import WalletCard from './WalletCard.jsx'
import Button from '../ui/Button.jsx'
import { useAccounts } from '../../store/useAccounts.js'

/* ── Toast de confirmación de orden guardado ─────────────────── */

function OrderToast({ visible, onUndo, onDismiss }) {
  if (!visible) return null
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50
                 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl
                 transition-all duration-300"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        color: 'var(--text-primary)',
        minWidth: '220px',
        maxWidth: '90vw',
      }}
    >
      <CheckCircle size={18} style={{ color: 'var(--orange-400)', flexShrink: 0 }} />
      <span className="text-sm font-medium flex-1">Orden guardado</span>
      <button
        onClick={onUndo}
        className="flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg
                   transition-colors hover:bg-[var(--bg-overlay)]"
        style={{ color: 'var(--orange-400)', minHeight: '44px', minWidth: '44px' }}
        aria-label="Deshacer reordenamiento"
      >
        <RotateCcw size={14} />
        Deshacer
      </button>
    </div>
  )
}

/* ── CardStack ───────────────────────────────────────────────── */

export default function CardStack({
  accounts = [],
  onSelectAccount,
  onAddNew,
}) {
  const { reorderAccounts, undoReorder } = useAccounts()
  const [isExpanded, setIsExpanded] = useState(false)
  const [filter, setFilter] = useState('all') // 'all' | 'debit' | 'credit'
  const [activeCardId, setActiveCardId] = useState(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const toastTimer = useRef(null)

  /* ── Sensores dnd-kit ─────────────────────────────────────── */
  // PointerSensor y TouchSensor con delay de 400 ms y tolerancia de 8 px
  // para distinguir toque corto (abrir detalle) de pulsación larga (drag)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 400, tolerance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 400, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  /* ── Filtrado y orden de cuentas ──────────────────────────── */
  // Orden de la pila: débito/ahorro primero, crédito después, efectivo al final
  const TYPE_ORDER = { debit: 0, savings: 0, credit: 1, cash: 2 }

  const filteredAccounts = accounts
    .filter(acc => {
      // Las cajas y apartados vinculados a una tarjeta de débito viven dentro de ella, no como tarjeta suelta
      if (acc.parentId) return false
      if (filter === 'debit') return acc.type === 'debit' || acc.type === 'cash' || acc.type === 'savings'
      if (filter === 'credit') return acc.type === 'credit'
      return true
    })
    .sort((a, b) => (TYPE_ORDER[a.type] ?? 3) - (TYPE_ORDER[b.type] ?? 3))

  // En modo apilado, si el usuario selecciona una tarjeta la traemos al frente
  const sortedAccounts = [...filteredAccounts]
  if (!isExpanded && activeCardId) {
    const activeIndex = sortedAccounts.findIndex(a => a.id === activeCardId)
    if (activeIndex > 0) {
      const [activeItem] = sortedAccounts.splice(activeIndex, 1)
      sortedAccounts.unshift(activeItem)
    }
  }

  const visibleIds = filter === 'all' ? null : filteredAccounts.map(a => a.id)

  /* ── Handlers de drag ─────────────────────────────────────── */
  const handleDragStart = useCallback(() => {
    setIsDragActive(true)
    // Vibrar levemente al activar el drag
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10)
      }
    } catch { /* no-op si vibrate no está disponible */ }
  }, [])

  const handleDragEnd = useCallback(async ({ active, over }) => {
    setIsDragActive(false)
    if (!over || active.id === over.id) return

    const saved = await reorderAccounts(active.id, over.id, visibleIds)

    if (saved) {
      // Mostrar toast "Orden guardado" durante 4 segundos
      setShowToast(true)
      clearTimeout(toastTimer.current)
      toastTimer.current = setTimeout(() => setShowToast(false), 4000)
    }
  }, [reorderAccounts, visibleIds])

  const handleDragCancel = useCallback(() => {
    setIsDragActive(false)
  }, [])

  const handleUndo = useCallback(async () => {
    setShowToast(false)
    clearTimeout(toastTimer.current)
    await undoReorder()
  }, [undoReorder])

  /* ── IDs para SortableContext ─────────────────────────────── */
  const sortableIds = sortedAccounts.map(a => a.id)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      autoScroll
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="w-full flex flex-col gap-4">
        {/* ── Controles superiores: Filtros y modo de visualización ── */}
        <div className="flex items-center justify-between gap-2">
          {/* Segmented controls de filtro */}
          <div
            className="flex items-center gap-1 p-1 rounded-xl"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
          >
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center ${
                filter === 'all'
                  ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
              style={{ minHeight: '36px' }}
            >
              Todas ({accounts.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('debit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center ${
                filter === 'debit'
                  ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
              style={{ minHeight: '36px' }}
            >
              Débito
            </button>
            <button
              type="button"
              onClick={() => setFilter('credit')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center justify-center ${
                filter === 'credit'
                  ? 'bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-white'
              }`}
              style={{ minHeight: '36px' }}
            >
              Crédito
            </button>
          </div>

          {/* Alternar modo pila / lista completa (perfectamente centrado) */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Agrupar tarjetas (modo pila)' : 'Desagrupar tarjetas (ver todas)'}
            aria-label={isExpanded ? 'Agrupar tarjetas' : 'Desagrupar tarjetas'}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-white transition-all flex-shrink-0"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {isExpanded ? (
              <Layers size={18} className="text-[var(--orange-400)]" />
            ) : (
              <LayoutGrid size={18} />
            )}
          </button>
        </div>

        {/* Indicador de modo reordenamiento activo */}
        {!isDragActive && (
          <p className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            Mantén presionada una tarjeta para reordenar
          </p>
        )}

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
          /* ── MODO DESPLEGADO (Lista) ── */
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-4">
              {sortedAccounts.map((account) => (
                <WalletCard
                  key={account.id}
                  account={account}
                  childAccounts={accounts.filter(a => a.parentId === account.id)}
                  isStacked={false}
                  sortable
                  onClick={() => {
                    if (!isDragActive) onSelectAccount(account)
                  }}
                />
              ))}
            </div>
          </SortableContext>
        ) : (
          /* ── MODO PILA GOOGLE WALLET ── */
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <div className="relative pt-2 pb-6">
              <div
                className="relative flex flex-col items-center"
                style={{
                  minHeight: `${Math.max(220, 180 + (sortedAccounts.length - 1) * 60)}px`,
                }}
              >
                {sortedAccounts.map((account, index) => {
                  const isTop = index === 0
                  const peekOffset = index * 58

                  return (
                    <div
                      key={account.id}
                      className="absolute w-full max-w-md"
                      style={{
                        top: `${peekOffset}px`,
                        zIndex: index + 1,
                      }}
                    >
                      <WalletCard
                        account={account}
                        childAccounts={accounts.filter(a => a.parentId === account.id)}
                        isStacked={!isTop}
                        isActive={activeCardId === account.id}
                        sortable
                        onClick={() => {
                          if (isDragActive) return
                          if (!isTop) setActiveCardId(account.id)
                          onSelectAccount(account)
                        }}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          </SortableContext>
        )}
      </div>

      {/* ── Toast "Orden guardado" con Deshacer ── */}
      <OrderToast
        visible={showToast}
        onUndo={handleUndo}
        onDismiss={() => setShowToast(false)}
      />
    </DndContext>
  )
}

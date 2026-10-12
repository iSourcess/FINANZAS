/**
 * src/pages/Register/RegisterPage.jsx
 *
 * Pantalla para registrar movimientos financieros y ver los movimientos de hoy.
 *
 * Incluye:
 *   - Formulario de captura rápida (MovementForm).
 *   - Lista de "Movimientos de hoy" con opciones de editar y eliminar.
 *   - Toast de confirmación con botón 'Deshacer' tras eliminar.
 */

import { useEffect, useState, useMemo } from 'react'
import {
  Edit2,
  Trash2,
  ArrowRightLeft,
  UtensilsCrossed,
  Car,
  Home,
  Zap,
  HeartPulse,
  Gamepad2,
  ShoppingBag,
  GraduationCap,
  MoreHorizontal,
  Banknote,
  TrendingUp,
  Clock,
  Sparkles,
} from 'lucide-react'
import { useMovements } from '../../store/useMovements.js'
import { useAccounts } from '../../store/useAccounts.js'
import MovementForm from '../../components/forms/MovementForm.jsx'
import Toast from '../../components/ui/Toast.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { formatMoney } from '../../lib/format.js'
import { getCardTheme } from '../../lib/constants.js'

const ICON_MAP = {
  UtensilsCrossed,
  Car,
  Home,
  Zap,
  HeartPulse,
  Gamepad2,
  ShoppingBag,
  GraduationCap,
  MoreHorizontal,
  Banknote,
  TrendingUp,
}

export default function RegisterPage() {
  const {
    movements,
    categories,
    lastDeleted,
    fetchMovements,
    addMovement,
    updateMovement,
    deleteMovement,
    undoDelete,
    clearLastDeleted,
  } = useMovements()

  const { accounts, fetchAccounts } = useAccounts()

  const [editingMovement, setEditingMovement] = useState(null)
  const [toastMessage, setToastMessage] = useState('')

  useEffect(() => {
    fetchMovements()
    fetchAccounts()
  }, [fetchMovements, fetchAccounts])

  // Filtrar movimientos del día de hoy
  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const todayMovements = useMemo(() => {
    return movements.filter(m => m.date === todayStr)
  }, [movements, todayStr])

  // Mapas rápidos para nombres y colores
  const accountsMap = useMemo(() => {
    return new Map(accounts.map(a => [a.id, a]))
  }, [accounts])

  const categoriesMap = useMemo(() => {
    return new Map(categories.map(c => [c.id, c]))
  }, [categories])

  // Guardar nuevo movimiento
  const handleSaveMovement = async (data) => {
    if (editingMovement) {
      await updateMovement(editingMovement.id, data)
      setEditingMovement(null)
      setToastMessage('Movimiento actualizado.')
    } else {
      await addMovement(data)
      setToastMessage('Movimiento registrado.')
    }
  }

  // Eliminar movimiento
  const handleDeleteMovement = async (id) => {
    await deleteMovement(id)
    setToastMessage('Movimiento eliminado.')
  }

  // Deshacer eliminación
  const handleUndo = async () => {
    await undoDelete()
    setToastMessage('Movimiento restaurado.')
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto flex flex-col gap-6">
      {/* ── Encabezado ── */}
      <div>
        <h1
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'var(--font-size-2xl)',
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          Registrar
        </h1>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5">
          Captura tus gastos, ingresos y transferencias
        </p>
      </div>

      {/* ── Formulario de Registro ── */}
      <MovementForm
        accounts={accounts}
        categories={categories}
        onSave={handleSaveMovement}
      />

      {/* ── Sección: Movimientos de Hoy ── */}
      <section className="flex flex-col gap-3 mt-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={16} className="text-[var(--orange-400)]" />
            <h2
              style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 'var(--font-size-lg)',
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              Movimientos de hoy
            </h2>
          </div>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            {todayMovements.length} {todayMovements.length === 1 ? 'registro' : 'registros'}
          </span>
        </div>

        {todayMovements.length === 0 ? (
          <div
            className="rounded-2xl p-6 text-center text-xs text-[var(--text-muted)] flex flex-col items-center justify-center gap-1.5"
            style={{
              background: 'var(--bg-surface)',
              border: '1px dashed var(--border-default)',
            }}
          >
            <Sparkles size={20} className="text-[var(--text-muted)] opacity-60 mb-1" />
            <span>Aún no hay movimientos registrados hoy.</span>
            <span>Usa el formulario arriba para agregar uno.</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {todayMovements.map((movement) => {
              const category = categoriesMap.get(movement.categoryId)
              const account = accountsMap.get(movement.accountId)
              const destAccount = movement.toAccountId ? accountsMap.get(movement.toAccountId) : null

              const IconComp = movement.type === 'transfer'
                ? ArrowRightLeft
                : (category?.icon && ICON_MAP[category.icon] ? ICON_MAP[category.icon] : MoreHorizontal)

              const theme = account ? getCardTheme(account.themeKey) : null
              const isIncome = movement.type === 'income'
              const isTransfer = movement.type === 'transfer'

              return (
                <div
                  key={movement.id}
                  className="rounded-xl p-3.5 flex items-center justify-between gap-3 transition-colors"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {/* Ícono de categoría / transferencia */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white"
                      style={{
                        background: isTransfer
                          ? 'var(--bg-overlay)'
                          : (category?.color || 'var(--orange-400)'),
                      }}
                    >
                      <IconComp size={18} />
                    </span>

                    {/* Detalle: Nota / Categoría y Cuenta */}
                    <div className="min-w-0">
                      <span className="block text-sm font-semibold text-white truncate">
                        {movement.note || (isTransfer ? 'Transferencia' : category?.name || 'Movimiento')}
                      </span>
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)] mt-0.5">
                        {theme && (
                          <span
                            className="w-2 h-2 rounded-full inline-block flex-shrink-0"
                            style={{ background: theme.base }}
                          />
                        )}
                        <span className="truncate">
                          {isTransfer
                            ? `${account?.name || 'Origen'} → ${destAccount?.name || 'Destino'}`
                            : account?.name || 'Cuenta'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Monto y Botones de Acción */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <span
                        className="block font-bold text-sm sm:text-base font-mono"
                        style={{
                          color: isIncome
                            ? 'var(--orange-400)'
                            : isTransfer
                            ? 'var(--text-secondary)'
                            : 'var(--text-primary)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {isIncome ? '+' : isTransfer ? '' : '-'}{formatMoney(movement.amount, movement.currency)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setEditingMovement(movement)}
                        aria-label="Editar movimiento"
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-white transition-colors"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMovement(movement.id)}
                        aria-label="Eliminar movimiento"
                        className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--red-400)] transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ── Modal de Edición de Movimiento ── */}
      {editingMovement && (
        <Modal
          isOpen={Boolean(editingMovement)}
          onClose={() => setEditingMovement(null)}
          title="Editar Movimiento"
        >
          <MovementForm
            accounts={accounts}
            categories={categories}
            initialMovement={editingMovement}
            onSave={handleSaveMovement}
            onCancel={() => setEditingMovement(null)}
          />
        </Modal>
      )}

      {/* ── Toast con soporte para Deshacer ── */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          onUndo={lastDeleted ? handleUndo : null}
          onClose={() => {
            setToastMessage('')
            clearLastDeleted()
          }}
        />
      )}
    </div>
  )
}

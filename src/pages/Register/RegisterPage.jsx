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
import { useSearchParams } from 'react-router-dom'
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
  Scale,
  Bookmark,
} from 'lucide-react'
import { useMovements } from '../../store/useMovements.js'
import { useAccounts } from '../../store/useAccounts.js'
import { useTemplates } from '../../store/useTemplates.js'
import { useSettings } from '../../store/useSettings.js'
import MovementForm from '../../components/forms/MovementForm.jsx'
import TemplateChipsRow from '../../components/forms/TemplateChipsRow.jsx'
import TemplateFormModal from '../../components/forms/TemplateFormModal.jsx'
import ReconcileModal from '../../components/wallet/ReconcileModal.jsx'
import PendingDetectionsCard from '../../components/notifications/PendingDetectionsCard.jsx'
import ReviewDetectionsModal from '../../components/notifications/ReviewDetectionsModal.jsx'
import Toast from '../../components/ui/Toast.jsx'
import Modal from '../../components/ui/Modal.jsx'
import { applyTemplate } from '../../domain/templates.js'
import { formatMoney } from '../../lib/format.js'
import { accountLabel, todayLocalISO } from '../../lib/format.js'
import { getCardTheme } from '../../lib/constants.js'
import { getReconcileReasonLabel } from '../../domain/reconcile.js'

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
  const {
    templates,
    fetchTemplates,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    incrementUseCount,
  } = useTemplates()
  const { settings, fetchSettings } = useSettings()

  const [editingMovement, setEditingMovement] = useState(null)
  const [editingAdjustment, setEditingAdjustment] = useState(null)
  const [formDraftMovement, setFormDraftMovement] = useState(null)
  const [formKey, setFormKey] = useState(0)

  // Modales de plantillas
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [templateToEdit, setTemplateToEdit] = useState(null)

  // Modal de revisión de movimientos detectados
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false)

  // Toast
  const [toastMessage, setToastMessage] = useState('')
  const [toastAction, setToastAction] = useState(null)
  const [toastUndo, setToastUndo] = useState(null)

  const [searchParams] = useSearchParams()

  useEffect(() => {
    fetchMovements()
    fetchAccounts()
    fetchTemplates()
    fetchSettings()
  }, [fetchMovements, fetchAccounts, fetchTemplates, fetchSettings])

  // Pre-seleccionar tipo de movimiento si se abrió mediante deep link (ej: finanzas://registrar?type=expense)
  useEffect(() => {
    const rawType = searchParams.get('type')
    if (rawType) {
      const typeLower = rawType.toLowerCase()
      let resolvedType = null
      if (typeLower === 'expense' || typeLower === 'gasto') resolvedType = 'expense'
      else if (typeLower === 'income' || typeLower === 'ingreso') resolvedType = 'income'
      else if (typeLower === 'transfer' || typeLower === 'transferencia') resolvedType = 'transfer'

      if (resolvedType) {
        setFormDraftMovement((prev) => ({
          ...(prev || {}),
          type: resolvedType,
        }))
        setFormKey((k) => k + 1)
      }
    }
  }, [searchParams])

  // Filtrar movimientos del día de hoy (fecha en hora local)
  const todayStr = useMemo(() => todayLocalISO(), [])
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

  // Abrir modal para guardar movimiento como plantilla
  const handleOpenCreateTemplateFromMovement = (movementData) => {
    const cat = categoriesMap.get(movementData.categoryId)
    const defaultName = movementData.note || cat?.name || 'Plantilla frecuente'
    setTemplateToEdit({
      name: defaultName,
      type: movementData.type || 'expense',
      amountCents: movementData.amount || null,
      currency: movementData.currency || 'MXN',
      categoryId: movementData.categoryId || null,
      accountId: movementData.accountId || null,
      note: movementData.note || '',
    })
    setIsTemplateModalOpen(true)
  }

  // Guardar nuevo movimiento o actualización
  const handleSaveMovement = async (data, templateMeta) => {
    if (editingMovement) {
      await updateMovement(editingMovement.id, data)
      setEditingMovement(null)
      setToastMessage('Movimiento actualizado.')
      setToastAction(null)
      setToastUndo(null)
    } else {
      await addMovement(data)
      if (templateMeta?.saveAsTemplate) {
        const cat = categoriesMap.get(data.categoryId)
        const tplName = templateMeta.templateName || data.note || cat?.name || 'Plantilla frecuente'
        await addTemplate({
          name: tplName,
          type: data.type,
          amountCents: data.amount,
          currency: data.currency || 'MXN',
          categoryId: data.categoryId || null,
          accountId: data.accountId || null,
          note: data.note || '',
        })
        setToastMessage('Movimiento y plantilla guardados.')
        setToastAction(null)
      } else {
        setToastMessage('Movimiento registrado.')
        setToastAction({
          label: 'Guardar plantilla',
          icon: Bookmark,
          onClick: () => handleOpenCreateTemplateFromMovement(data),
        })
      }
      setToastUndo(null)
      setFormDraftMovement(null)
    }
  }

  // Tap en chip de plantilla
  const handleSelectTemplate = async (template) => {
    await incrementUseCount(template.id)
    const isInstant = settings?.templateTapBehavior === 'instant' && template.amountCents !== null

    if (isInstant) {
      const draft = applyTemplate(template)
      const newId = await addMovement(draft)
      setToastMessage(`Registrado: ${template.name}`)
      setToastAction(null)
      setToastUndo(async () => {
        await deleteMovement(newId)
        setToastMessage('Registro deshecho.')
        setToastUndo(null)
      })
    } else {
      const draft = applyTemplate(template)
      setFormDraftMovement(draft)
      setFormKey(k => k + 1)
    }
  }

  // Editar plantilla desde chip "⋯"
  const handleEditTemplateFromChip = (template) => {
    setTemplateToEdit(template)
    setIsTemplateModalOpen(true)
  }

  // Eliminar plantilla desde chip "⋯"
  const handleDeleteTemplateFromChip = async (template) => {
    if (window.confirm(`¿Eliminar la plantilla "${template.name}"?`)) {
      await deleteTemplate(template.id)
      setToastMessage('Plantilla eliminada.')
      setToastAction(null)
      setToastUndo(null)
    }
  }

  // Guardar plantilla desde modal
  const handleSaveTemplateModal = async (templateData) => {
    if (templateToEdit?.id) {
      await updateTemplate(templateToEdit.id, templateData)
      setToastMessage('Plantilla actualizada.')
    } else {
      await addTemplate(templateData)
      setToastMessage('Plantilla guardada.')
    }
    setToastAction(null)
    setToastUndo(null)
    setIsTemplateModalOpen(false)
    setTemplateToEdit(null)
  }

  // Eliminar movimiento con confirmación
  const handleDeleteMovement = async (id, name) => {
    const label = name || 'este movimiento'
    if (!window.confirm(`¿Eliminar ${label}? Esta acción se puede deshacer.`)) return
    await deleteMovement(id)
    setToastMessage('Movimiento eliminado.')
    setToastAction(null)
    setToastUndo(handleUndo)
  }

  // Deshacer eliminación
  const handleUndo = async () => {
    await undoDelete()
    setToastMessage('Movimiento restaurado.')
    setToastUndo(null)
    setToastAction(null)
  }

  return (
    <div className="p-4 sm:p-6 pb-10 max-w-2xl mx-auto flex flex-col gap-6">
      {/* ── Tarjeta "Por confirmar (N)" ── */}
      <PendingDetectionsCard onOpenReview={() => setIsReviewModalOpen(true)} />

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

      {/* ── Fila de Plantillas Frecuentes ── */}
      <TemplateChipsRow
        templates={templates}
        accounts={accounts}
        categories={categories}
        onSelectTemplate={handleSelectTemplate}
        onEditTemplate={handleEditTemplateFromChip}
        onDeleteTemplate={handleDeleteTemplateFromChip}
        onCreateTemplate={() => {
          setTemplateToEdit(null)
          setIsTemplateModalOpen(true)
        }}
      />

      {/* ── Formulario de Registro ── */}
      <MovementForm
        key={formKey}
        accounts={accounts}
        categories={categories}
        initialMovement={formDraftMovement}
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

              const isIncome = movement.type === 'income'
              const isTransfer = movement.type === 'transfer'
              const isAdjustment = movement.type === 'adjustment'

              const IconComp = isAdjustment
                ? Scale
                : isTransfer
                ? ArrowRightLeft
                : (category?.icon && ICON_MAP[category.icon] ? ICON_MAP[category.icon] : MoreHorizontal)

              const theme = account ? getCardTheme(account.themeKey) : null

              // Para ajuste: delta con signo
              const deltaCents = isAdjustment
                ? (movement.deltaCents !== undefined && movement.deltaCents !== null ? movement.deltaCents : movement.amount)
                : 0
              const adjSign = deltaCents > 0 ? '+' : deltaCents < 0 ? '-' : ''

              return (
                <div
                  key={movement.id}
                  className="rounded-xl p-3.5 flex items-center justify-between gap-3 transition-colors"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {/* Ícono de categoría / transferencia / ajuste */}
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isAdjustment ? 'text-[var(--orange-400)]' : 'text-white'
                      }`}
                      style={{
                        background: isAdjustment
                          ? 'var(--orange-900)'
                          : isTransfer
                          ? 'var(--bg-overlay)'
                          : (category?.color || 'var(--orange-400)'),
                      }}
                    >
                      <IconComp size={18} />
                    </span>

                    {/* Detalle: Nota / Categoría / Ajuste y Cuenta */}
                    <div className="min-w-0">
                      <span className="block text-sm font-semibold text-white truncate">
                        {movement.note || (isAdjustment ? 'Ajuste de saldo' : isTransfer ? 'Transferencia' : category?.name || 'Movimiento')}
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
                            ? `${accountLabel(account)} → ${accountLabel(destAccount)}`
                            : isAdjustment
                            ? `${accountLabel(account)} • ${getReconcileReasonLabel(movement.reason)}`
                            : accountLabel(account)}
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
                          color: isIncome || (isAdjustment && deltaCents > 0)
                            ? 'var(--orange-400)'
                            : isAdjustment && deltaCents < 0
                            ? 'var(--red-400)'
                            : isTransfer
                            ? 'var(--text-secondary)'
                            : 'var(--text-primary)',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {isAdjustment
                          ? `${adjSign}${formatMoney(Math.abs(deltaCents), movement.currency)}`
                          : `${isIncome ? '+' : isTransfer ? '' : '-'}${formatMoney(movement.amount, movement.currency)}`}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (isAdjustment) {
                            setEditingAdjustment(movement)
                          } else {
                            setEditingMovement(movement)
                          }
                        }}
                        aria-label="Editar movimiento"
                        className="flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-white transition-colors"
                        style={{ minWidth: '44px', minHeight: '44px' }}
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMovement(
                          movement.id,
                          movement.note || category?.name
                        )}
                        aria-label="Eliminar movimiento"
                        className="flex items-center justify-center rounded-lg text-[var(--text-muted)] hover:text-[var(--red-400)] transition-colors"
                        style={{ minWidth: '44px', minHeight: '44px' }}
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

      {/* ── Modal de Edición de Ajuste de Saldo ── */}
      {editingAdjustment && (
        <ReconcileModal
          account={accountsMap.get(editingAdjustment.accountId)}
          isOpen={Boolean(editingAdjustment)}
          initialAdjustment={editingAdjustment}
          onClose={() => setEditingAdjustment(null)}
          onSuccess={(msg) => {
            setToastMessage(msg)
            setToastAction(null)
            setToastUndo(null)
          }}
        />
      )}

      {/* ── Modal de Crear / Editar Plantilla ── */}
      <TemplateFormModal
        isOpen={isTemplateModalOpen}
        onClose={() => {
          setIsTemplateModalOpen(false)
          setTemplateToEdit(null)
        }}
        onSave={handleSaveTemplateModal}
        template={templateToEdit}
        accounts={accounts}
        categories={categories}
      />

      {/* ── Modal de Revisión de Movimientos Detectados ── */}
      <ReviewDetectionsModal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        onToast={(msg, actionLabel, onAction) => {
          setToastMessage(msg)
          setToastAction(actionLabel)
          setToastUndo(() => onAction)
        }}
      />

      {/* ── Toast con soporte para Acción y Deshacer ── */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          action={toastAction}
          onUndo={toastUndo || (lastDeleted ? handleUndo : null)}
          onClose={() => {
            setToastMessage('')
            setToastAction(null)
            setToastUndo(null)
            clearLastDeleted()
          }}
        />
      )}
    </div>
  )
}

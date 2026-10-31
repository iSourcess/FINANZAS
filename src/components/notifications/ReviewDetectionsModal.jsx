/**
 * src/components/notifications/ReviewDetectionsModal.jsx
 *
 * Hoja / Modal de revisión "Por confirmar":
 *   - Visualiza detecciones bancarias pendientes con "hace X min".
 *   - Avisos proactivos:
 *       1. Posible duplicado (misma cuenta, monto y ±1 día).
 *       2. Emparejamiento con gasto fijo pendiente (±1%, ±3 días).
 *       3. Emparejamiento con ingreso recurrente pendiente.
 *       4. Detección de pares de transferencia propia (ventana 10 min).
 *   - Edición completa con selector visual de tarjetas (CardPicker), tipo, categoría, fecha y nota.
 *   - Acciones: Confirmar, Editar y confirmar, Descartar, "No es un movimiento" (con opción de ignorar patrón),
 *     y confirmación múltiple (bulk confirm).
 *   - Modo privado: montos ocultos hasta tocar.
 *   - Transacción atómica en Dexie con toast Deshacer.
 */

import { useState, useMemo, useEffect } from 'react'
import {
  Sparkles,
  Check,
  CheckCheck,
  Trash2,
  Ban,
  Edit2,
  AlertTriangle,
  ArrowRightLeft,
  Calendar,
  Tag,
  Building2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Link as LinkIcon,
  RotateCcw,
  RefreshCw,
} from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import CardPicker from '../wallet/CardPicker.jsx'
import { useNotificationDetection } from '../../store/useNotificationDetection.js'
import { useAccounts } from '../../store/useAccounts.js'
import { useMovements } from '../../store/useMovements.js'
import { useBudgets } from '../../store/useBudgets.js'
import { useRecurringIncomes } from '../../store/useRecurringIncomes.js'
import { useSettings } from '../../store/useSettings.js'
import {
  applyDetection,
  detectDuplicatesAgainstMovements,
  matchFixedExpense,
  matchRecurringIncome,
  detectTransferPairs,
} from '../../domain/detections.js'
import { formatMoney, formatRelativeTime, centsToInput, inputToCents, todayLocalISO } from '../../lib/format.js'

export default function ReviewDetectionsModal({
  isOpen,
  onClose,
  onToast,
}) {
  const {
    pendingDetections,
    loading: loadingDetections,
    fetchPendingDetections,
    confirmDetection,
    confirmMultipleDetections,
    undoConfirm,
    dismissDetection,
    ignorePatternAndDismiss,
    confirmTransferPair,
  } = useNotificationDetection()

  const { accounts, fetchAccounts } = useAccounts()
  const { movements, categories, fetchMovements } = useMovements()
  const { fixedExpenses, fetchFixedExpenses } = useBudgets()
  const { recurringIncomes, occurrences, fetchRecurringIncomes } = useRecurringIncomes()
  const { settings } = useSettings()

  // Selección múltiple
  const [selectedIds, setSelectedIds] = useState(new Set())

  // Estado de edición expandida por detección: { [detectionId]: { type, amount, accountId, toAccountId, categoryId, date, note, fixedId, recurringIncomeId } }
  const [expandedId, setExpandedId] = useState(null)
  const [editingDrafts, setEditingDrafts] = useState({})

  // Diálogo para "No es un movimiento" (ignorar patrón)
  const [ignoringDetection, setIgnoringDetection] = useState(null)
  const [ignorePatternInput, setIgnorePatternInput] = useState('')

  // Control de privacidad (revelar montos)
  const [revealedIds, setRevealedIds] = useState(new Set())
  const [isProcessing, setIsProcessing] = useState(false)
  const [loadError, setLoadError] = useState(null)

  // Cargar datos al abrir
  useEffect(() => {
    if (isOpen) {
      setLoadError(null)
      Promise.all([
        fetchPendingDetections(),
        fetchAccounts(),
        fetchMovements(),
        fetchFixedExpenses(),
        fetchRecurringIncomes(),
      ]).catch((err) => {
        setLoadError(err?.message || 'Error cargando datos para la revisión.')
      })
    }
  }, [isOpen, fetchPendingDetections, fetchAccounts, fetchMovements, fetchFixedExpenses, fetchRecurringIncomes])

  // Pares de transferencias propias detectadas
  const transferPairs = useMemo(() => {
    return detectTransferPairs(pendingDetections)
  }, [pendingDetections])

  // Gastos fijos ya pagados en el mes
  const paidFixedIds = useMemo(() => {
    return (movements || []).filter(m => m.fixedId).map(m => m.fixedId)
  }, [movements])

  // Inicializar o leer borrador editado de una detección
  const getDraft = (det) => {
    if (editingDrafts[det.id]) {
      return editingDrafts[det.id]
    }
    return applyDetection(det, accounts, categories) || {}
  }

  const updateDraft = (detId, patch) => {
    setEditingDrafts(prev => {
      const current = prev[detId] || applyDetection(
        pendingDetections.find(d => d.id === detId),
        accounts,
        categories
      ) || {}
      return {
        ...prev,
        [detId]: { ...current, ...patch },
      }
    })
  }

  // Alternar máscara privada para un elemento
  const toggleReveal = (detId) => {
    setRevealedIds(prev => {
      const next = new Set(prev)
      if (next.has(detId)) next.delete(detId)
      else next.add(detId)
      return next
    })
  }

  // Alternar selección de un elemento
  const toggleSelect = (detId) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(detId)) next.delete(detId)
      else next.add(detId)
      return next
    })
  }

  // Seleccionar / Deseleccionar todos
  const toggleSelectAll = () => {
    if (selectedIds.size === pendingDetections.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(pendingDetections.map(d => d.id)))
    }
  }

  // ── ACCIÓN: Confirmar detección individual ──
  const handleConfirmSingle = async (det) => {
    setIsProcessing(true)
    try {
      const draft = getDraft(det)
      const res = await confirmDetection(det.id, draft)

      if (typeof onToast === 'function') {
        const amountStr = formatMoney(res.movement.amount, res.movement.currency)
        onToast(
          `Movimiento confirmado por ${amountStr}`,
          'Deshacer',
          () => undoConfirm(res)
        )
      }

      if (pendingDetections.length <= 1) {
        onClose()
      }
    } catch (err) {
      console.error('[ReviewDetectionsModal] Error confirmando:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  // ── ACCIÓN: Confirmación múltiple ──
  const handleConfirmSelected = async () => {
    if (selectedIds.size === 0) return
    setIsProcessing(true)
    try {
      const idsArray = Array.from(selectedIds)
      const overridesMap = {}
      for (const id of idsArray) {
        if (editingDrafts[id]) {
          overridesMap[id] = editingDrafts[id]
        }
      }

      const confirmedItems = await confirmMultipleDetections(idsArray, overridesMap)
      setSelectedIds(new Set())

      if (typeof onToast === 'function') {
        onToast(
          `Se confirmaron ${confirmedItems.length} movimientos`,
          'Deshacer',
          () => undoConfirm(confirmedItems)
        )
      }

      if (pendingDetections.length <= confirmedItems.length) {
        onClose()
      }
    } catch (err) {
      console.error('[ReviewDetectionsModal] Error en confirmación múltiple:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  // ── ACCIÓN: Confirmar par de transferencia propia ──
  const handleConfirmPair = async (pair) => {
    setIsProcessing(true)
    try {
      const res = await confirmTransferPair(pair)
      if (typeof onToast === 'function') {
        const amountStr = formatMoney(res.movement.amount, res.movement.currency)
        onToast(
          `Transferencia confirmada por ${amountStr}`,
          'Deshacer',
          () => undoConfirm({ movementId: res.movement.id, detectionIds: res.detectionIds })
        )
      }
      if (pendingDetections.length <= 2) {
        onClose()
      }
    } catch (err) {
      console.error('[ReviewDetectionsModal] Error confirmando par de transferencias:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  // ── ACCIÓN: Descartar ──
  const handleDismiss = async (detId) => {
    try {
      await dismissDetection(detId)
      setSelectedIds(prev => {
        const next = new Set(prev)
        next.delete(detId)
        return next
      })
      if (pendingDetections.length <= 1) {
        onClose()
      }
    } catch (err) {
      console.error('[ReviewDetectionsModal] Error descartando:', err)
    }
  }

  // ── ACCIÓN: "No es un movimiento" (con ignorar patrón) ──
  const handleIgnoreAndDismiss = async () => {
    if (!ignoringDetection) return
    try {
      await ignorePatternAndDismiss(ignoringDetection.id, ignorePatternInput)
      setIgnoringDetection(null)
      setIgnorePatternInput('')
      if (pendingDetections.length <= 1) {
        onClose()
      }
    } catch (err) {
      console.error('[ReviewDetectionsModal] Error ignorando patrón:', err)
    }
  }

  const isGlobalPrivate = Boolean(settings?.privacyMode)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Movimientos por confirmar"
      maxWidth="max-w-2xl"
    >
      <div className="flex flex-col h-full max-h-[82vh] text-left">
        {/* ── BARRA DE HERRAMIENTAS SUPERIOR ── */}
        <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-white">
              Por confirmar ({pendingDetections.length})
            </span>
            {pendingDetections.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-[var(--orange-400)] hover:underline ml-2"
              >
                {selectedIds.size === pendingDetections.length
                  ? 'Deseleccionar todos'
                  : 'Seleccionar todos'}
              </button>
            )}
          </div>

          {selectedIds.size > 0 && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleConfirmSelected}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--text-inverse)] bg-[var(--orange-400)] hover:bg-[var(--orange-500)] flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
              style={{ minHeight: '38px' }}
            >
              <CheckCheck size={14} />
              <span>Confirmar ({selectedIds.size})</span>
            </button>
          )}
        </div>

        {/* ── CUERPO CON SCROLL ── */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {/* Estado de Carga */}
          {loadingDetections && pendingDetections.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
              <RefreshCw size={24} className="animate-spin text-[var(--orange-400)]" />
              <span className="text-xs">Cargando detecciones...</span>
            </div>
          )}

          {/* Estado de Error */}
          {loadError && (
            <div className="p-3 rounded-xl bg-[var(--red-900)] border border-[var(--red-600)] text-[var(--red-400)] flex items-center gap-2 text-xs">
              <AlertTriangle size={16} className="flex-shrink-0" />
              <span>{loadError}</span>
            </div>
          )}

          {/* Estado Vacío */}
          {!loadingDetections && pendingDetections.length === 0 && (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-center">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-[var(--orange-400)]"
                style={{
                  background: 'rgba(255, 122, 26, 0.1)',
                  border: '1px solid rgba(255, 122, 26, 0.25)',
                }}
              >
                <Sparkles size={24} />
              </div>
              <div className="max-w-xs">
                <h4 className="font-bold text-sm text-white">¡Todo al día!</h4>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  No tienes movimientos bancarios pendientes por confirmar.
                </p>
              </div>
            </div>
          )}

          {/* ── AVISO DE TRANSFERENCIAS PROPIAS DETECTADAS ── */}
          {transferPairs.length > 0 && (
            <div className="flex flex-col gap-2">
              {transferPairs.map((pair, pIdx) => {
                const fromAcc = accounts.find(a => a.id === pair.fromAccountId)
                const toAcc = accounts.find(a => a.id === pair.toAccountId)
                const fromName = fromAcc ? fromAcc.name : 'Cuenta Origen'
                const toName = toAcc ? toAcc.name : 'Cuenta Destino'

                return (
                  <div
                    key={`pair-${pIdx}`}
                    className="p-3 rounded-xl flex items-center justify-between gap-3 text-xs"
                    style={{
                      background: 'rgba(255, 122, 26, 0.12)',
                      border: '1px solid var(--orange-500)',
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <ArrowRightLeft size={16} className="text-[var(--orange-400)] flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="font-bold text-white block truncate">
                          Transferencia propia detectada ({formatMoney(pair.amountCents)})
                        </span>
                        <span className="text-[11px] text-[var(--orange-200)] block truncate">
                          De {fromName} a {toName}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleConfirmPair(pair)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-[var(--text-inverse)] bg-[var(--orange-400)] hover:bg-[var(--orange-500)] flex-shrink-0 transition-colors shadow-sm disabled:opacity-50"
                      style={{ minHeight: '36px' }}
                    >
                      Registrar como 1 transferencia
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── LISTA DE DETECCIONES ── */}
          {pendingDetections.map((det) => {
            const isSelected = selectedIds.has(det.id)
            const isExpanded = expandedId === det.id
            const draft = getDraft(det)

            // Evaluación de avisos inteligentes
            const dupCheck = detectDuplicatesAgainstMovements(det, movements)
            const fixedMatch = draft.type === 'expense' ? matchFixedExpense(det, fixedExpenses, paidFixedIds) : { isMatch: false }
            const recurringMatch = draft.type === 'income' ? matchRecurringIncome(det, recurringIncomes, occurrences) : { isMatch: false }

            const timeAgo = formatRelativeTime(det.postedAt || det.detectedAt)
            const isMasked = isGlobalPrivate && !revealedIds.has(det.id)

            const targetAccount = accounts.find(a => a.id === draft.accountId)
            const targetCategory = categories.find(c => c.id === draft.categoryId)

            return (
              <div
                key={det.id}
                className="rounded-xl transition-all duration-200 text-xs"
                style={{
                  background: 'var(--bg-base)',
                  border: isSelected
                    ? '1px solid var(--orange-400)'
                    : '1px solid var(--border-subtle)',
                  boxShadow: isSelected ? '0 0 12px rgba(255, 122, 26, 0.15)' : 'none',
                }}
              >
                {/* ── Cabecera / Resumen del ítem ── */}
                <div className="p-3 flex items-start justify-between gap-3">
                  {/* Checkbox de selección */}
                  <div className="pt-0.5 flex-shrink-0">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(det.id)}
                      className="w-4 h-4 rounded cursor-pointer accent-[var(--orange-400)]"
                      aria-label="Seleccionar para confirmar"
                    />
                  </div>

                  {/* Datos principales */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-white text-xs truncate">
                        {draft.note || det.merchant || 'Movimiento bancario'}
                      </span>
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">
                        · {timeAgo}
                      </span>
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
                        {draft.type === 'income' ? 'Ingreso' : draft.type === 'transfer' ? 'Transferencia' : 'Gasto'}
                      </span>
                    </div>

                    {/* Cuenta y Categoría sugerida */}
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-[var(--text-secondary)] truncate">
                      <span className="truncate">
                        {targetAccount ? targetAccount.name : 'Sin cuenta asignada'}
                      </span>
                      {targetCategory && draft.type !== 'transfer' && (
                        <>
                          <span>·</span>
                          <span className="truncate text-[var(--orange-300)]">
                            {targetCategory.name}
                          </span>
                        </>
                      )}
                    </div>

                    {/* ── AVISO: Posible Duplicado ── */}
                    {dupCheck.isDuplicate && (
                      <div className="mt-2 p-2 rounded-lg bg-[rgba(239,68,68,0.1)] border border-[var(--red-600)] text-[var(--red-400)] flex items-start gap-1.5 text-[11px]">
                        <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                        <div>
                          <strong className="block font-bold">Posible duplicado</strong>
                          <span>{dupCheck.reason}</span>
                        </div>
                      </div>
                    )}

                    {/* ── AVISO: Coincidencia con Gasto Fijo ── */}
                    {fixedMatch.isMatch && (
                      <div className="mt-2 p-2 rounded-lg bg-[rgba(255,122,26,0.1)] border border-[rgba(255,122,26,0.3)] text-[var(--orange-300)] flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <LinkIcon size={13} className="flex-shrink-0 text-[var(--orange-400)]" />
                          <span className="truncate">
                            Coincide con gasto fijo: <strong>{fixedMatch.fixedExpense.name}</strong> ({formatMoney(fixedMatch.fixedExpense.amount)})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            updateDraft(det.id, { fixedId: fixedMatch.fixedExpense.id })
                          }}
                          className="text-[10px] underline font-bold text-white flex-shrink-0"
                        >
                          {draft.fixedId === fixedMatch.fixedExpense.id ? 'Vincularlo' : 'Vincular'}
                        </button>
                      </div>
                    )}

                    {/* ── AVISO: Coincidencia con Ingreso Recurrente ── */}
                    {recurringMatch.isMatch && (
                      <div className="mt-2 p-2 rounded-lg bg-[rgba(255,122,26,0.1)] border border-[rgba(255,122,26,0.3)] text-[var(--orange-300)] flex items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <LinkIcon size={13} className="flex-shrink-0 text-[var(--orange-400)]" />
                          <span className="truncate">
                            Coincide con ingreso esperado: <strong>{recurringMatch.recurringIncome.name}</strong>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            updateDraft(det.id, {
                              recurringIncomeId: recurringMatch.recurringIncome.id,
                              recurringDueDate: recurringMatch.candidateDate,
                            })
                          }}
                          className="text-[10px] underline font-bold text-white flex-shrink-0"
                        >
                          {draft.recurringIncomeId ? 'Vincularlo' : 'Vincular'}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Monto y switch de revelación */}
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => toggleReveal(det.id)}
                      className="flex items-center gap-1 text-white font-bold text-sm tabular-nums hover:opacity-80"
                      title={isMasked ? 'Toca para revelar monto' : 'Ocultar'}
                    >
                      <span>
                        {isMasked ? '••••' : formatMoney(draft.amount, draft.currency)}
                      </span>
                      {isGlobalPrivate && (
                        <span className="text-[var(--text-muted)] text-[10px]">
                          {isMasked ? <Eye size={12} /> : <EyeOff size={12} />}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : det.id)}
                      className="text-[11px] text-[var(--text-muted)] hover:text-white flex items-center gap-0.5 mt-0.5"
                    >
                      <span>{isExpanded ? 'Cerrar' : 'Editar'}</span>
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                </div>

                {/* ── FORMULARIO DE EDICIÓN EXPANDIDO ── */}
                {isExpanded && (
                  <div className="p-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] rounded-b-xl flex flex-col gap-3">
                    {/* Fila: Tipo y Monto */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                          Tipo
                        </label>
                        <div className="grid grid-cols-3 gap-1 p-0.5 rounded-lg bg-[var(--bg-base)] border border-[var(--border-subtle)]">
                          {['expense', 'income', 'transfer'].map(t => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => updateDraft(det.id, { type: t })}
                              className="py-1 text-[10px] font-bold rounded capitalize transition-colors"
                              style={{
                                background: draft.type === t ? 'var(--orange-400)' : 'transparent',
                                color: draft.type === t ? 'var(--text-inverse)' : 'var(--text-secondary)',
                                minHeight: '32px',
                              }}
                            >
                              {t === 'expense' ? 'Gasto' : t === 'income' ? 'Ingreso' : 'Transf'}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                          Monto ({draft.currency || 'MXN'})
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          defaultValue={centsToInput(draft.amount)}
                          onChange={(e) => updateDraft(det.id, { amount: inputToCents(e.target.value) })}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs font-bold text-white bg-[var(--bg-base)] border border-[var(--border-subtle)] focus:border-[var(--orange-400)] outline-none"
                          style={{ minHeight: '34px' }}
                        />
                      </div>
                    </div>

                    {/* Selector visual de tarjetas (CardPicker) */}
                    <div>
                      <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                        Cuenta bancaria
                      </label>
                      <CardPicker
                        accounts={accounts}
                        selectedAccountId={draft.accountId}
                        onSelect={(accId) => updateDraft(det.id, { accountId: accId })}
                      />
                    </div>

                    {/* Si es transferencia: cuenta destino */}
                    {draft.type === 'transfer' && (
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                          Cuenta destino
                        </label>
                        <CardPicker
                          accounts={accounts.filter(a => a.id !== draft.accountId)}
                          selectedAccountId={draft.toAccountId}
                          onSelect={(destId) => updateDraft(det.id, { toAccountId: destId })}
                        />
                      </div>
                    )}

                    {/* Categoría (solo si no es transferencia) */}
                    {draft.type !== 'transfer' && (
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                          Categoría
                        </label>
                        <select
                          value={draft.categoryId || ''}
                          onChange={(e) => updateDraft(det.id, { categoryId: e.target.value || null })}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs text-white bg-[var(--bg-base)] border border-[var(--border-subtle)] focus:border-[var(--orange-400)] outline-none cursor-pointer"
                          style={{ minHeight: '36px' }}
                        >
                          <option value="">(Sin categoría)</option>
                          {categories
                            .filter(c => c.type === draft.type || !c.type)
                            .map(cat => (
                              <option key={cat.id} value={cat.id}>
                                {cat.name}
                              </option>
                            ))}
                        </select>
                      </div>
                    )}

                    {/* Fecha y Nota */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                          Fecha
                        </label>
                        <input
                          type="date"
                          value={draft.date || todayLocalISO()}
                          onChange={(e) => updateDraft(det.id, { date: e.target.value })}
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs text-white bg-[var(--bg-base)] border border-[var(--border-subtle)] focus:border-[var(--orange-400)] outline-none"
                          style={{ minHeight: '34px' }}
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                          Nota / Comercio
                        </label>
                        <input
                          type="text"
                          value={draft.note || ''}
                          onChange={(e) => updateDraft(det.id, { note: e.target.value })}
                          placeholder="Comercio..."
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs text-white bg-[var(--bg-base)] border border-[var(--border-subtle)] focus:border-[var(--orange-400)] outline-none"
                          style={{ minHeight: '34px' }}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── BOTONES DE ACCIÓN DEL ÍTEM ── */}
                <div className="px-3 py-2 border-t border-[var(--border-subtle)] bg-[rgba(255,255,255,0.02)] flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => handleDismiss(det.id)}
                      className="px-2 py-1 rounded text-[11px] text-[var(--text-muted)] hover:text-[var(--red-400)] hover:bg-[var(--bg-elevated)] transition-colors"
                      style={{ minHeight: '34px' }}
                      title="Descartar sin registrar"
                    >
                      <Trash2 size={13} className="inline mr-1" />
                      <span>Descartar</span>
                    </button>

                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={() => {
                        setIgnoringDetection(det)
                        setIgnorePatternInput(det.merchant || '')
                      }}
                      className="px-2 py-1 rounded text-[11px] text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-elevated)] transition-colors"
                      style={{ minHeight: '34px' }}
                      title="Marcar que no es un movimiento bancario e ignorar patrones similares"
                    >
                      <Ban size={13} className="inline mr-1" />
                      <span>No es movimiento</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleConfirmSingle(det)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold text-[var(--text-inverse)] bg-[var(--orange-400)] hover:bg-[var(--orange-500)] flex items-center gap-1 transition-colors shadow-sm disabled:opacity-50"
                    style={{ minHeight: '36px' }}
                  >
                    <Check size={14} />
                    <span>Confirmar</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* ── DIÁLOGO "NO ES UN MOVIMIENTO" (IGNORAR PATRÓN) ── */}
        {ignoringDetection && (
          <div
            className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setIgnoringDetection(null)}
          >
            <div
              className="w-full max-w-sm rounded-2xl p-4 flex flex-col gap-3"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 text-white font-bold text-xs">
                <Ban size={16} className="text-[var(--orange-400)]" />
                <span>Descartar e ignorar notificaciones</span>
              </div>

              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Esta notificación se descartará. Si deseas que no vuelva a ser detectada en el futuro, confirma el texto o palabra clave a ignorar:
              </p>

              <div>
                <label className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                  Patrón a ignorar
                </label>
                <input
                  type="text"
                  value={ignorePatternInput}
                  onChange={(e) => setIgnorePatternInput(e.target.value)}
                  placeholder="Ej: Retiro sin tarjeta, Promoción..."
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs text-white bg-[var(--bg-base)] border border-[var(--border-subtle)] focus:border-[var(--orange-400)] outline-none"
                  style={{ minHeight: '36px' }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => setIgnoringDetection(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-muted)] hover:text-white"
                  style={{ minHeight: '36px' }}
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={handleIgnoreAndDismiss}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-[var(--text-inverse)] bg-[var(--orange-400)] hover:bg-[var(--orange-500)]"
                  style={{ minHeight: '36px' }}
                >
                  Confirmar y descartar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}


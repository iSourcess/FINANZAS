/**
 * src/components/forms/TemplateChipsRow.jsx
 *
 * Fila horizontal desplazable de chips de plantillas frecuentes.
 * Máximo 12 plantillas visibles ordenadas por uso frecuente (useCount descendente).
 *
 * Cada chip incluye:
 *   - Ícono de categoría / transferencia
 *   - Nombre de la plantilla y monto formateado (si aplica)
 *   - Indicador si la plantilla es inválida (cuenta o categoría eliminada)
 *   - Botón de menú "⋯" para editar o eliminar
 *   - Botón rápido "+" para crear nueva plantilla
 */

import { useState, useRef, useEffect } from 'react'
import {
  MoreVertical,
  Plus,
  AlertTriangle,
  ArrowRightLeft,
  Bookmark,
  Edit2,
  Trash2,
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
} from 'lucide-react'
import { sortTemplates, validateTemplate } from '../../domain/templates.js'
import { formatMoney } from '../../lib/format.js'

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

export default function TemplateChipsRow({
  templates = [],
  accounts = [],
  categories = [],
  onSelectTemplate,
  onEditTemplate,
  onDeleteTemplate,
  onCreateTemplate,
  onAddNewTemplate,
}) {
  const handleCreate = onCreateTemplate || onAddNewTemplate
  const [activeMenuId, setActiveMenuId] = useState(null)
  const menuRef = useRef(null)

  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setActiveMenuId(null)
      }
    }
    if (activeMenuId) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [activeMenuId])

  // Máximo 12 plantillas ordenadas por mayor frecuencia de uso
  const visibleTemplates = sortTemplates(templates, 'usage').slice(0, 12)

  const categoriesMap = new Map(categories.map((c) => [c.id, c]))

  return (
    <div className="w-full flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs text-[var(--text-secondary)] px-1">
        <span className="font-semibold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <Bookmark size={13} className="text-[var(--orange-400)]" />
          Plantillas frecuentes
        </span>
        <button
          type="button"
          onClick={handleCreate}
          className="text-[11px] text-[var(--orange-400)] hover:underline flex items-center gap-0.5"
          style={{ minHeight: '32px' }}
        >
          <Plus size={13} />
          Nueva
        </button>
      </div>

      <div
        className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 no-scrollbar"
        style={{
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {visibleTemplates.map((template) => {
          const validation = validateTemplate(template, { accounts, categories })
          const category = categoriesMap.get(template.categoryId)

          const IconComp = template.type === 'transfer'
            ? ArrowRightLeft
            : (category?.icon && ICON_MAP[category.icon] ? ICON_MAP[category.icon] : Bookmark)

          const isMenuOpen = activeMenuId === template.id

          return (
            <div
              key={template.id}
              className="relative flex-shrink-0 flex items-center rounded-xl transition-all"
              style={{
                background: 'var(--bg-elevated)',
                border: `1.5px solid ${validation.isValid ? 'var(--border-subtle)' : 'var(--red-600)'}`,
                minHeight: '44px',
              }}
            >
              {/* Botón principal del chip (tocar para aplicar) */}
              <button
                type="button"
                onClick={() => onSelectTemplate(template, validation)}
                className="flex items-center gap-2 px-3 py-2 text-left active:scale-95 transition-transform"
                style={{ minHeight: '44px' }}
                title={validation.isValid ? template.name : validation.warningMessage}
              >
                <span
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-white"
                  style={{
                    background: !validation.isValid
                      ? 'var(--red-900)'
                      : template.type === 'transfer'
                      ? 'var(--bg-overlay)'
                      : (category?.color || 'var(--orange-400)'),
                  }}
                >
                  {!validation.isValid ? (
                    <AlertTriangle size={13} className="text-[var(--red-400)]" />
                  ) : (
                    <IconComp size={13} />
                  )}
                </span>

                <div className="flex flex-col min-w-0 pr-1">
                  <span className="text-xs font-semibold text-white max-w-[120px] truncate leading-tight">
                    {template.name}
                  </span>
                  <span className="text-[10px] font-mono font-medium text-[var(--text-secondary)] leading-tight" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {!validation.isValid ? (
                      <span className="text-[var(--red-400)]">Corregir</span>
                    ) : template.amountCents != null ? (
                      formatMoney(template.amountCents, template.currency)
                    ) : (
                      'Variable'
                    )}
                  </span>
                </div>
              </button>

              {/* Menú de 3 puntos (Editar / Eliminar) */}
              <div className="relative pr-1" ref={isMenuOpen ? menuRef : null}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setActiveMenuId(isMenuOpen ? null : template.id)
                  }}
                  aria-label={`Opciones de plantilla ${template.name}`}
                  className="p-1 rounded-lg text-[var(--text-muted)] hover:text-white hover:bg-[var(--bg-overlay)] transition-colors flex items-center justify-center"
                  style={{ minWidth: '32px', minHeight: '44px' }}
                >
                  <MoreVertical size={14} />
                </button>

                {/* Popover del menú */}
                {isMenuOpen && (
                  <div
                    className="absolute right-0 top-full mt-1 z-40 rounded-xl p-1 shadow-2xl flex flex-col gap-0.5 animate-in fade-in duration-150 min-w-[120px]"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-default)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenuId(null)
                        onEditTemplate(template)
                      }}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-white hover:bg-[var(--bg-elevated)] transition-colors text-left"
                      style={{ minHeight: '36px' }}
                    >
                      <Edit2 size={13} className="text-[var(--text-secondary)]" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setActiveMenuId(null)
                        onDeleteTemplate(template.id)
                      }}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs font-medium text-[var(--red-400)] hover:bg-[var(--red-900)] transition-colors text-left"
                      style={{ minHeight: '36px' }}
                    >
                      <Trash2 size={13} />
                      <span>Eliminar</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Chip para agregar si no hay plantillas */}
        {visibleTemplates.length === 0 && (
          <button
            type="button"
            onClick={onAddNewTemplate}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-[var(--text-secondary)] hover:text-white transition-colors"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px dashed var(--border-default)',
              minHeight: '44px',
            }}
          >
            <Plus size={14} className="text-[var(--orange-400)]" />
            <span>Crear plantilla frecuente</span>
          </button>
        )}
      </div>
    </div>
  )
}

/**
 * src/pages/Settings/NotificationSamplesModal.jsx
 *
 * Pantalla / Modal "Muestras de notificaciones":
 *   - Muestra el texto íntegro capturado de notificaciones bancarias.
 *   - Botón "Copiar con datos ocultos" que enmascara números de 4+ dígitos no montos
 *     y permite editar antes de copiar.
 *   - Borrado automático de muestras a los 7 días (y botón para vaciar manualmente).
 *   - rawSamples NO entra en los respaldos.
 */

import { useState } from 'react'
import {
  FileText,
  Copy,
  Trash2,
  Calendar,
  Clock,
  ShieldCheck,
  AlertCircle,
  Smartphone,
} from 'lucide-react'
import Modal from '../../components/ui/Modal.jsx'
import Button from '../../components/ui/Button.jsx'
import MaskedSampleModal from '../../components/notifications/MaskedSampleModal.jsx'
import { useNotificationDetection } from '../../store/useNotificationDetection.js'

export default function NotificationSamplesModal({
  isOpen,
  onClose,
}) {
  const { rawSamples, deleteSample, clearAllSamples } = useNotificationDetection()
  const [selectedSample, setSelectedSample] = useState(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const formatTimestamp = (ts) => {
    if (!ts) return ''
    try {
      const d = new Date(ts)
      return d.toLocaleString('es-MX', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    } catch {
      return String(ts)
    }
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title="Muestras de Notificaciones"
      >
        <div className="flex flex-col gap-3.5 text-xs">
          {/* Badge Informativo de Privacidad y Auto-borrado */}
          <div
            className="p-3 rounded-xl flex items-start gap-2.5"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <ShieldCheck size={16} className="text-[var(--orange-400)] flex-shrink-0 mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold text-white text-[11px]">Almacenamiento temporal seguro</span>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Las muestras se eliminan automáticamente a los 7 días y <strong className="text-white">nunca se incluyen en los respaldos</strong> de la app.
              </p>
            </div>
          </div>

          {/* Barra superior de conteo y vaciar */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] font-medium text-[var(--text-secondary)]">
              {rawSamples.length} {rawSamples.length === 1 ? 'muestra registrada' : 'muestras registradas'}
            </span>
            {rawSamples.length > 0 && (
              confirmClear ? (
                <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                  <span className="text-[10px] text-[var(--red-400)]">¿Borrar todas?</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await clearAllSamples()
                      setConfirmClear(false)
                    }}
                    className="px-2 py-1 rounded bg-[var(--red-900)] text-[var(--red-400)] border border-[var(--red-600)] text-[10px] font-bold"
                    style={{ minHeight: '32px' }}
                  >
                    Sí, vaciar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-1 rounded text-[var(--text-muted)] text-[10px]"
                    style={{ minHeight: '32px' }}
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="flex items-center gap-1 text-[var(--text-muted)] hover:text-[var(--red-400)] transition-colors py-1 px-2"
                  style={{ minHeight: '36px' }}
                >
                  <Trash2 size={13} />
                  <span className="text-[11px]">Vaciar</span>
                </button>
              )
            )}
          </div>

          {/* Lista de muestras */}
          {rawSamples.length === 0 ? (
            <div
              className="py-10 px-4 rounded-xl flex flex-col items-center justify-center text-center gap-2"
              style={{
                background: 'var(--bg-surface)',
                border: '1px dashed var(--border-subtle)',
              }}
            >
              <FileText size={32} className="text-[var(--text-muted)] opacity-60" />
              <span className="font-semibold text-white">No hay muestras capturadas</span>
              <p className="text-[11px] text-[var(--text-muted)] max-w-xs leading-relaxed">
                Cuando el Modo Captura esté activo y recibas notificaciones de las apps marcadas como banco, se guardarán aquí para su análisis.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {rawSamples.map((sample) => (
                <div
                  key={sample.id}
                  className="p-3 rounded-xl flex flex-col gap-2 transition-colors"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {/* Cabecera de la muestra: app y fecha */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                      >
                        <Smartphone size={13} className="text-[var(--orange-400)]" />
                      </div>
                      <div className="truncate">
                        <span className="font-bold text-white text-xs block truncate">
                          {sample.appLabel || sample.packageName}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)] block truncate font-mono">
                          {sample.packageName}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1 font-mono">
                        <Clock size={11} />
                        {formatTimestamp(sample.postTime || sample.createdAt)}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteSample(sample.id)}
                        className="p-1 text-[var(--text-muted)] hover:text-[var(--red-400)] transition-colors"
                        style={{ minWidth: '32px', minHeight: '32px' }}
                        aria-label="Eliminar muestra"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Texto de la notificación */}
                  <div
                    className="p-2.5 rounded-lg flex flex-col gap-1 text-[11px]"
                    style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}
                  >
                    {sample.title && (
                      <span className="font-semibold text-white">{sample.title}</span>
                    )}
                    <p className="text-[var(--text-secondary)] whitespace-pre-wrap leading-relaxed font-mono">
                      {sample.text || sample.bigText || '(Sin texto)'}
                    </p>
                    {sample.bigText && sample.bigText !== sample.text && (
                      <p className="text-[var(--text-muted)] text-[10px] whitespace-pre-wrap leading-relaxed font-mono border-t border-[var(--border-subtle)] pt-1 mt-1">
                        {sample.bigText}
                      </p>
                    )}
                  </div>

                  {/* Botón copiar con datos ocultos */}
                  <div className="flex justify-end pt-0.5">
                    <button
                      type="button"
                      onClick={() => setSelectedSample(sample)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                      style={{
                        background: 'var(--orange-900)',
                        color: 'var(--orange-300)',
                        border: '1px solid var(--orange-700)',
                        minHeight: '40px',
                      }}
                    >
                      <Copy size={13} />
                      <span>Copiar con datos ocultos</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <Button
              variant="ghost"
              onClick={onClose}
              style={{ minHeight: '44px' }}
            >
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal de edición y copiado con datos ocultos */}
      <MaskedSampleModal
        isOpen={Boolean(selectedSample)}
        onClose={() => setSelectedSample(null)}
        sample={selectedSample}
      />
    </>
  )
}


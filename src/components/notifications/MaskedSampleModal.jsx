/**
 * src/components/notifications/MaskedSampleModal.jsx
 *
 * Modal para previsualizar y editar el texto de una muestra con datos ocultos
 * antes de copiarlo al portapapeles.
 */

import { useState, useEffect } from 'react'
import { Copy, Check, ShieldCheck, RotateCcw } from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { maskSensitiveData } from '../../domain/notificationDetection.js'

export default function MaskedSampleModal({
  isOpen,
  onClose,
  sample,
}) {
  const [editedText, setEditedText] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (sample) {
      const fullText = [
        sample.title,
        sample.text,
        sample.bigText && sample.bigText !== sample.text ? sample.bigText : '',
      ]
        .filter(Boolean)
        .join('\n')

      const masked = maskSensitiveData(fullText)
      setEditedText(masked)
      setCopied(false)
    }
  }, [sample])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(editedText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch (err) {
      console.warn('Error al copiar al portapapeles:', err)
    }
  }

  const handleResetToMasked = () => {
    if (!sample) return
    const fullText = [
      sample.title,
      sample.text,
      sample.bigText && sample.bigText !== sample.text ? sample.bigText : '',
    ]
      .filter(Boolean)
      .join('\n')
    setEditedText(maskSensitiveData(fullText))
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Copiar muestra con datos ocultos"
    >
      <div className="flex flex-col gap-3.5 text-xs">
        {/* Aviso de Privacidad y Enmascaramiento */}
        <div
          className="p-3 rounded-xl flex items-start gap-2.5"
          style={{
            background: 'var(--orange-900)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--orange-200)',
          }}
        >
          <ShieldCheck size={16} className="text-[var(--orange-400)] flex-shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed">
            Se han ocultado automáticamente números de 4 o más dígitos (tarjetas, folios, referencias), preservando los montos. Puedes editar el texto antes de copiarlo.
          </p>
        </div>

        {/* Textarea editable */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] text-[var(--text-secondary)] font-medium">
            Texto a copiar (editable):
          </label>
          <textarea
            value={editedText}
            onChange={(e) => setEditedText(e.target.value)}
            rows={5}
            className="w-full p-3 rounded-xl font-mono text-xs text-white outline-none resize-y transition-colors"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-default)',
              minHeight: '110px',
            }}
            placeholder="Texto de la notificación..."
          />
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={handleResetToMasked}
            className="flex items-center gap-1.5 text-[var(--text-muted)] hover:text-white transition-colors py-2 px-2.5 rounded-lg"
            style={{ minHeight: '44px' }}
          >
            <RotateCcw size={14} />
            <span className="text-[11px]">Reestablecer</span>
          </button>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={onClose}
              style={{ minHeight: '44px' }}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              onClick={handleCopy}
              className="flex items-center gap-1.5"
              style={{ minHeight: '44px' }}
            >
              {copied ? (
                <>
                  <Check size={16} />
                  <span>¡Copiado!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>Copiar texto</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}


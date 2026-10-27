/**
 * src/components/ui/Toast.jsx
 *
 * Notificación flotante inferior con soporte para botón 'Deshacer'.
 */

import { useEffect } from 'react'
import { CheckCircle2, RotateCcw, X } from 'lucide-react'

export default function Toast({
  message,
  onUndo,
  action,
  onClose,
  duration = 5000,
}) {
  useEffect(() => {
    if (!duration) return
    const timer = setTimeout(() => {
      onClose?.()
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!message) return null

  return (
    <div
      role="alert"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md rounded-xl p-3.5 shadow-2xl flex items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4 duration-200"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        color: 'var(--text-primary)',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.7)',
      }}
    >
      <div className="flex items-center gap-2.5 truncate">
        <CheckCircle2 size={18} className="text-[var(--orange-400)] flex-shrink-0" />
        <span className="text-xs font-medium truncate">{message}</span>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-[var(--orange-400)] hover:bg-[var(--orange-900)] transition-colors active:scale-95"
            style={{ minHeight: '32px' }}
          >
            {action.icon && <action.icon size={13} />}
            <span>{action.label}</span>
          </button>
        )}
        {onUndo && (
          <button
            type="button"
            onClick={onUndo}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-[var(--orange-400)] hover:bg-[var(--orange-900)] transition-colors active:scale-95"
            style={{ minHeight: '32px' }}
          >
            <RotateCcw size={13} />
            <span>Deshacer</span>
          </button>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar notificación"
          className="p-1 rounded text-[var(--text-muted)] hover:text-white transition-colors"
        >
          <X size={15} />
        </button>
      </div>
    </div>
  )
}

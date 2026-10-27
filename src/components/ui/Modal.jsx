/**
 * src/components/ui/Modal.jsx
 *
 * Modal accesible y responsivo con backdrop oscuro y safe scroll.
 */

import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className={`w-full ${maxWidth} rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200`}
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-default)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <h2
            style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 'var(--font-size-lg)',
              fontWeight: 600,
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Cerrar modal"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: 'var(--radius-md)',
              minHeight: '44px',
              minWidth: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            className="hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content body */}
        <div className="p-5 pb-8 sm:pb-5 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * src/components/ui/Badge.jsx
 *
 * Badge / Etiqueta compacta con tokens de color.
 */

export default function Badge({
  children,
  variant = 'neutral', // 'neutral' | 'orange' | 'danger' | 'bank'
  className = '',
  style = {},
}) {
  const variantStyles = {
    neutral: {
      background: 'var(--bg-elevated)',
      color: 'var(--text-secondary)',
      border: '1px solid var(--border-subtle)',
    },
    orange: {
      background: 'var(--orange-900)',
      color: 'var(--orange-300)',
      border: '1px solid var(--orange-700)',
    },
    danger: {
      background: 'var(--red-900)',
      color: 'var(--red-400)',
      border: '1px solid var(--red-600)',
    },
    bank: {
      background: 'rgba(255, 255, 255, 0.15)',
      color: 'inherit',
      border: '1px solid rgba(255, 255, 255, 0.25)',
    },
  }[variant] || {}

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium tracking-wide ${className}`}
      style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: '11px',
        lineHeight: 1.3,
        ...variantStyles,
        ...style,
      }}
    >
      {children}
    </span>
  )
}

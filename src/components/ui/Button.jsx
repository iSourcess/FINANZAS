/**
 * src/components/ui/Button.jsx
 *
 * Botón accesible con soporte para variantes del design system.
 * Cumple con altura mínima táctil de 44px o 48px según variante.
 */

export default function Button({
  children,
  type = 'button',
  variant = 'primary', // 'primary' | 'secondary' | 'ghost' | 'danger'
  size = 'md', // 'sm' | 'md' | 'lg'
  disabled = false,
  onClick,
  className = '',
  icon: Icon,
  ...props
}) {
  const baseStyles = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: 500,
    borderRadius: 'var(--radius-md)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all var(--transition-micro)',
    opacity: disabled ? 0.45 : 1,
    outline: 'none',
    border: 'none',
    WebkitTapHighlightColor: 'transparent',
    textDecoration: 'none',
  }

  const sizeStyles = {
    sm: {
      height: '36px',
      minHeight: '36px',
      padding: '0 12px',
      fontSize: 'var(--font-size-sm)',
    },
    md: {
      height: '44px',
      minHeight: '44px',
      padding: '0 16px',
      fontSize: 'var(--font-size-base)',
    },
    lg: {
      height: '48px',
      minHeight: '48px',
      padding: '0 24px',
      fontSize: 'var(--font-size-base)',
    },
  }[size] || {}

  const variantStyles = {
    primary: {
      background: 'var(--orange-400)',
      color: 'var(--text-inverse)',
      boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
    },
    secondary: {
      background: 'var(--bg-surface)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border-default)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-secondary)',
    },
    danger: {
      background: 'var(--red-900)',
      color: 'var(--red-400)',
      border: '1px solid var(--red-600)',
    },
  }[variant] || {}

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{
        ...baseStyles,
        ...sizeStyles,
        ...variantStyles,
      }}
      className={`active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[var(--border-focus)] ${className}`}
      {...props}
    >
      {Icon && <Icon size={size === 'sm' ? 16 : 18} aria-hidden="true" />}
      {children}
    </button>
  )
}

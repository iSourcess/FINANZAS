/**
 * src/components/layout/Header.jsx
 *
 * Header reutilizable con soporte para título y acción opcional.
 */

export default function Header({ title, rightAction }) {
  return (
    <header
      className="flex items-center justify-between px-4 py-3"
      style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <h1
        style={{
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-heading)',
          fontSize: 'var(--font-size-xl)',
          fontWeight: 700,
        }}
      >
        {title}
      </h1>
      {rightAction && <div>{rightAction}</div>}
    </header>
  )
}

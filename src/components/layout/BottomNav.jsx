/**
 * src/components/layout/BottomNav.jsx
 *
 * Navegación inferior con 3 pestañas + acceso a Ajustes.
 *
 * Pestaña activa: relleno naranja + label naranja.
 * Pestañas inactivas: ícono gris, sin label (o label muted).
 *
 * Íconos: lucide-react (SVG). Prohibido emojis.
 * Área táctil mínima: 44px (cumplido con padding).
 */

import { NavLink, useNavigate } from 'react-router-dom'
import { PlusCircle, BarChart2, Wallet, Settings } from 'lucide-react'

const TABS = [
  { to: '/registrar', label: 'Registrar', Icon: PlusCircle, id: 'nav-registrar' },
  { to: '/panorama', label: 'Panorama', Icon: BarChart2, id: 'nav-panorama' },
  { to: '/cuentas', label: 'Cuentas', Icon: Wallet, id: 'nav-cuentas' },
]

export default function BottomNav() {
  const navigate = useNavigate()

  return (
    <nav
      aria-label="Navegación principal"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        // Altura fija + safe area para notch/home indicator
        height: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'var(--bg-surface)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'stretch',
        zIndex: 50,
      }}
    >
      {/* ── Tres pestañas principales ── */}
      {TABS.map(({ to, label, Icon, id }) => (
        <NavLink
          key={to}
          to={to}
          id={id}
          style={({ isActive }) => ({
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            minHeight: '44px',
            padding: '8px 4px',
            color: isActive ? 'var(--orange-400)' : 'var(--text-muted)',
            textDecoration: 'none',
            transition: 'color var(--transition-micro)',
            WebkitTapHighlightColor: 'transparent',
            cursor: 'pointer',
          })}
        >
          {({ isActive }) => (
            <>
              <Icon
                size={22}
                strokeWidth={isActive ? 2.2 : 1.8}
                aria-hidden="true"
              />
              <span
                style={{
                  fontSize: '10px',
                  fontFamily: "'DM Sans', sans-serif",
                  fontWeight: isActive ? 600 : 400,
                  lineHeight: 1,
                  letterSpacing: '0.01em',
                }}
              >
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}

      {/* ── Separador vertical ── */}
      <div
        aria-hidden="true"
        style={{
          width: '1px',
          background: 'var(--border-subtle)',
          margin: '12px 0',
          flexShrink: 0,
        }}
      />

      {/* ── Botón Ajustes (engrane) ── */}
      <button
        id="nav-ajustes"
        aria-label="Ajustes"
        onClick={() => navigate('/ajustes')}
        style={{
          width: '64px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '3px',
          minHeight: '44px',
          padding: '8px 4px',
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          transition: 'color var(--transition-micro)',
          WebkitTapHighlightColor: 'transparent',
          flexShrink: 0,
        }}
        onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
        onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <Settings size={20} strokeWidth={1.8} aria-hidden="true" />
        <span
          style={{
            fontSize: '10px',
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: 400,
            lineHeight: 1,
          }}
        >
          Ajustes
        </span>
      </button>
    </nav>
  )
}

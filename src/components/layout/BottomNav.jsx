/**
 * src/components/layout/BottomNav.jsx
 *
 * Navegación inferior flotante con esquinas redondeadas.
 * 4 pestañas: Registrar, Panorama, Cuentas, Ajustes.
 *
 * Pestaña activa: relleno naranja + label naranja con peso 600.
 * Pestañas inactivas: ícono y texto gris sutil.
 *
 * Íconos: lucide-react (SVG). Prohibido emojis.
 * Área táctil mínima: 44px (cumplido con padding y flex).
 */

import { NavLink } from 'react-router-dom'
import { PlusCircle, BarChart2, Wallet, Settings } from 'lucide-react'
import { useNotificationDetection } from '../../store/useNotificationDetection.js'

const TABS = [
  { to: '/registrar', label: 'Registrar', Icon: PlusCircle, id: 'nav-registrar' },
  { to: '/panorama',  label: 'Panorama',  Icon: BarChart2,  id: 'nav-panorama'  },
  { to: '/cuentas',   label: 'Cuentas',   Icon: Wallet,    id: 'nav-cuentas'   },
  { to: '/ajustes',   label: 'Ajustes',   Icon: Settings,  id: 'nav-ajustes'   },
]

export default function BottomNav() {
  const { pendingDetections } = useNotificationDetection()
  const pendingCount = pendingDetections?.length || 0

  return (
    <nav
      aria-label="Navegación principal"
      style={{
        position: 'fixed',
        bottom: 'calc(14px + env(safe-area-inset-bottom, 0px))',
        left: '16px',
        right: '16px',
        maxWidth: '430px',
        margin: '0 auto',
        height: '62px',
        background: 'rgba(24, 24, 27, 0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '26px',
        boxShadow: '0 12px 36px -4px rgba(0, 0, 0, 0.65), 0 4px 12px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        padding: '0 6px',
        zIndex: 50,
      }}
    >
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
            padding: '6px 4px',
            color: isActive ? 'var(--orange-400)' : 'var(--text-muted)',
            textDecoration: 'none',
            transition: 'color var(--transition-micro), transform var(--transition-micro)',
            WebkitTapHighlightColor: 'transparent',
            cursor: 'pointer',
            outline: 'none',
            borderRadius: '18px',
          })}
        >
          {({ isActive }) => (
            <>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon
                  size={21}
                  strokeWidth={isActive ? 2.2 : 1.8}
                  aria-hidden="true"
                />
                {id === 'nav-registrar' && pendingCount > 0 && (
                  <span
                    aria-label={`${pendingCount} movimientos por confirmar`}
                    style={{
                      position: 'absolute',
                      top: '-6px',
                      right: '-10px',
                      background: 'var(--orange-400)',
                      color: 'var(--text-inverse)',
                      fontSize: '9px',
                      fontWeight: 700,
                      lineHeight: '14px',
                      minWidth: '14px',
                      height: '14px',
                      padding: '0 3px',
                      borderRadius: '7px',
                      textAlign: 'center',
                      fontFamily: "'DM Sans', sans-serif",
                      boxShadow: '0 0 6px rgba(255, 122, 26, 0.5)',
                    }}
                  >
                    {pendingCount}
                  </span>
                )}
              </div>
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
    </nav>
  )
}

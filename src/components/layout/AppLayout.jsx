/**
 * src/components/layout/AppLayout.jsx
 *
 * Layout principal de la app con área de contenido y BottomNav fijo.
 * Se usa como contenedor de las rutas con navegación inferior
 * (Registrar, Panorama, Cuentas). Ajustes no usa este layout.
 */

import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav.jsx'
import { useBudgets } from '../../store/useBudgets.js'

export default function AppLayout() {
  useEffect(() => {
    useBudgets.getState().fetchBudgets()
  }, [])
  return (
    <div
      className="flex flex-col"
      style={{
        minHeight: '100dvh',       // dvh: cuenta con la barra del navegador móvil
        background: 'var(--bg-base)',
      }}
    >
      {/* Contenido de la página activa */}
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden"
        style={{
          // Deja espacio para el BottomNav (64px) + safe area inferior
          paddingBottom: 'calc(64px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <Outlet />
      </main>

      {/* Navegación inferior fija */}
      <BottomNav />
    </div>
  )
}

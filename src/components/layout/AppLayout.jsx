/**
 * src/components/layout/AppLayout.jsx
 *
 * Layout principal de la app con área de contenido y BottomNav fijo.
 * Se usa como contenedor de las rutas con navegación inferior
 * (Registrar, Panorama, Cuentas). Ajustes no usa este layout.
 */

import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import BottomNav from './BottomNav.jsx'
import ErrorBoundary from '../ui/ErrorBoundary.jsx'
import SpotlightTour from '../ui/SpotlightTour.jsx'
import { useBudgets } from '../../store/useBudgets.js'
import { useSettings } from '../../store/useSettings.js'
import { useTour } from '../../store/useTour.js'

export default function AppLayout() {
  const navigate = useNavigate()
  const { fetchSettings } = useSettings()
  const { startTour, isOpen } = useTour()

  useEffect(() => {
    useBudgets.getState().fetchBudgets()
    fetchSettings().then((s) => {
      // Si el usuario es nuevo y nunca ha visto el tour, lo iniciamos automáticamente
      if (s && s.hasSeenTour === false && !isOpen) {
        const timer = setTimeout(() => {
          startTour(0, navigate)
        }, 900)
        return () => clearTimeout(timer)
      }
    })
  }, [fetchSettings, startTour, isOpen, navigate])

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
          // Deja espacio para el BottomNav flotante (62px + margen 14px) + safe area inferior
          paddingBottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <ErrorBoundary title="No se pudo cargar esta sección">
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Navegación inferior fija */}
      <BottomNav />

      {/* Tour Guiado Interactivo con Spotlight */}
      <SpotlightTour />
    </div>
  )
}

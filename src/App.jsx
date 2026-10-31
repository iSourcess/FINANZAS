import { useEffect, useState, useCallback } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import Register from './pages/Register/index.jsx'
import Overview from './pages/Overview/index.jsx'
import Accounts from './pages/Accounts/index.jsx'
import Settings from './pages/Settings/index.jsx'
import { setupNotificationNavigationListener, rescheduleAll } from './services/notifications.js'
import { setupDeepLinkListener } from './services/deeplinks.js'
import { runInterestAccrual } from './services/interestAccrual.js'
import {
  setupNotificationListener,
  drainNotificationQueue,
  saveRawSample,
} from './services/notificationDetection.js'
import { db } from './db/database.js'
import { useAccounts } from './store/useAccounts.js'
import Toast from './components/ui/Toast.jsx'
import { formatMoney } from './lib/format.js'

/**
 * Inicializador de recordatorios, deep links, navegación, acreditación de rendimientos
 * y escucha de notificaciones bancarias nativas.
 */
function AppNotificationInitializer({ onAccrualToast }) {
  const navigate = useNavigate()
  const { fetchAccounts } = useAccounts()

  const triggerAccrual = useCallback(async () => {
    try {
      const totalCents = await runInterestAccrual()
      if (totalCents > 0) {
        await fetchAccounts()
        onAccrualToast(`Se acreditaron ${formatMoney(totalCents)} de rendimientos`)
      }
    } catch (err) {
      console.warn('[App] Error al acreditar rendimientos:', err)
    }
  }, [fetchAccounts, onAccrualToast])

  const drainBankNotifications = useCallback(async () => {
    try {
      const settings = await db.settings.get('global')
      if (!settings?.notificationDetectionEnabled) return

      const queued = await drainNotificationQueue()
      if (queued && queued.length > 0 && settings?.captureModeEnabled) {
        for (const item of queued) {
          await saveRawSample(item)
        }
      }
    } catch (err) {
      console.warn('[App] Error al procesar cola de notificaciones:', err)
    }
  }, [])

  useEffect(() => {
    let cleanupNotif = null
    let cleanupDeepLink = null
    let cleanupDetection = null

    setupNotificationNavigationListener(navigate).then((fn) => {
      cleanupNotif = fn
    })

    setupDeepLinkListener(navigate).then((fn) => {
      cleanupDeepLink = fn
    })

    // Escucha en tiempo real de notificaciones bancarias con la app abierta
    setupNotificationListener(async (notif) => {
      try {
        const settings = await db.settings.get('global')
        if (settings?.notificationDetectionEnabled && settings?.captureModeEnabled) {
          await saveRawSample(notif)
        }
      } catch (err) {
        console.warn('[App] Error en listener en vivo de notificaciones:', err)
      }
    }).then((fn) => {
      cleanupDetection = fn
    })

    rescheduleAll().catch((err) => {
      console.warn('[App] Error al reprogramar recordatorios al inicio:', err)
    })

    // Acreditación y vaciado de notificaciones al iniciar
    triggerAccrual()
    drainBankNotifications()

    // Acciones al volver al primer plano
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        triggerAccrual()
        drainBankNotifications()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      if (typeof cleanupNotif === 'function') cleanupNotif()
      if (typeof cleanupDeepLink === 'function') cleanupDeepLink()
      if (typeof cleanupDetection === 'function') cleanupDetection()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [navigate, triggerAccrual, drainBankNotifications])

  return null
}

/**
 * App.jsx — Raíz de rutas.
 *
 * Usa HashRouter porque la app corre dentro de Capacitor (no hay servidor
 * que procese rutas del lado del cliente). Las rutas quedan como:
 *   /#/registrar
 *   /#/panorama
 *   /#/cuentas
 *   /#/ajustes
 */
export default function App() {
  const [accrualToast, setAccrualToast] = useState('')

  return (
    <HashRouter>
      <AppNotificationInitializer onAccrualToast={setAccrualToast} />
      <Routes>
        {/* Redirige la raíz a /registrar */}
        <Route path="/" element={<Navigate to="/registrar" replace />} />

        {/* Rutas con layout (BottomNav) */}
        <Route element={<AppLayout />}>
          <Route path="/registrar" element={<Register />} />
          <Route path="/panorama"  element={<Overview />}  />
          <Route path="/cuentas"   element={<Accounts />}  />
        </Route>

        {/* Ajustes sin BottomNav (pantalla completa) */}
        <Route path="/ajustes" element={<Settings />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/registrar" replace />} />
      </Routes>

      {/* Toast de acreditación de rendimientos */}
      {accrualToast && (
        <Toast
          message={accrualToast}
          onClose={() => setAccrualToast('')}
        />
      )}
    </HashRouter>
  )
}

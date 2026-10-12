import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import Register from './pages/Register/index.jsx'
import Overview from './pages/Overview/index.jsx'
import Accounts from './pages/Accounts/index.jsx'
import Settings from './pages/Settings/index.jsx'

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
  return (
    <HashRouter>
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
    </HashRouter>
  )
}

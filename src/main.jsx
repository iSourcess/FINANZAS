import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { runSeed } from './db/seed.js'

// Ejecuta el seed al arrancar si la base de datos está vacía.
// Falla silenciosamente para no romper la app si IndexedDB no está disponible.
runSeed().catch(console.error)

// Configuración de barra de estado y splash en Android
async function initNativePlatform() {
  try {
    const corePkg = '@capacitor/core'
    const coreModule = await import(/* @vite-ignore */ corePkg).catch(() => null)
    const Capacitor = coreModule?.Capacitor || (typeof window !== 'undefined' ? window.Capacitor : null)

    if (Capacitor && typeof Capacitor.isNativePlatform === 'function' && Capacitor.isNativePlatform()) {
      const sbPkg = '@capacitor/status-bar'
      const splashPkg = '@capacitor/splash-screen'
      const sbMod = await import(/* @vite-ignore */ sbPkg).catch(() => null)
      const splashMod = await import(/* @vite-ignore */ splashPkg).catch(() => null)

      const StatusBar = sbMod?.StatusBar || Capacitor.Plugins?.StatusBar
      const Style = sbMod?.Style || { Dark: 'DARK' }
      if (StatusBar) {
        await StatusBar.setStyle({ style: Style.Dark })
        await StatusBar.setBackgroundColor({ color: '#0A0A0A' })
      }

      const SplashScreen = splashMod?.SplashScreen || Capacitor.Plugins?.SplashScreen
      if (SplashScreen) {
        await SplashScreen.hide()
      }
    }
  } catch {
    // Entorno sin Capacitor o web
  }
}

initNativePlatform().catch(console.error)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

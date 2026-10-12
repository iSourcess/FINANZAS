import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { runSeed } from './db/seed.js'

// Ejecuta el seed al arrancar si la base de datos está vacía.
// Falla silenciosamente para no romper la app si IndexedDB no está disponible.
runSeed().catch(console.error)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

/**
 * src/store/useTour.js
 *
 * Store Zustand para el Tour Guiado Interactivo (Spotlight / Coachmarks).
 * Controla el paso actual, navegación automática entre pantallas y finalización.
 */

import { create } from 'zustand'
import { useSettings } from './useSettings.js'

export const TOUR_STEPS = [
  {
    id: 'step-registrar',
    route: '/registrar',
    targetSelector: '#nav-registrar',
    title: 'Registra tus Movimientos',
    badge: 'Paso 1 de 5',
    description: 'Agrega tus gastos, ingresos o transferencias en segundos con plantillas rápidas. Si activas la detección en Ajustes, tus compras bancarias se capturan solas sin tener que escribirlas.',
    position: 'top',
  },
  {
    id: 'step-cuentas',
    route: '/cuentas',
    targetSelector: '#nav-cuentas',
    title: 'Tus Tarjetas con Rendimiento',
    badge: 'Paso 2 de 5',
    description: 'Administra tus tarjetas de débito, crédito y efectivo. Al elegir tu banco (Nu, Mercado Pago, Revolut, etc.) se autocompleta su tasa para calcular tus intereses diarios.',
    position: 'top',
  },
  {
    id: 'step-panorama',
    route: '/panorama',
    targetSelector: '#nav-panorama',
    title: 'Panorama Financiero',
    badge: 'Paso 3 de 5',
    description: 'Tu centro de control financiero: analiza gastos por categoría, visualiza tus presupuestos mensuales y supervisa tus metas de ahorro.',
    position: 'top',
  },
  {
    id: 'step-intereses',
    route: '/panorama',
    targetSelector: '#tour-interest-chart',
    fallbackSelector: '#nav-panorama',
    title: 'Intereses Acumulados',
    badge: 'Paso 4 de 5',
    description: 'La línea naranja muestra tus intereses ganados día a día acumulándose hasta hoy. La línea gris proyecta lo que se espera acumular al final del mes según tus saldos.',
    position: 'bottom',
  },
  {
    id: 'step-ajustes',
    route: '/ajustes',
    targetSelector: '#nav-ajustes',
    title: 'Ajustes y Respaldo Seguro',
    badge: 'Paso 5 de 5',
    description: 'Configura recordatorios de pago de tarjetas, activa la detección inteligente de notificaciones y exporta copias de respaldo encriptadas.',
    position: 'top',
  },
]

export const useTour = create((set, get) => ({
  isOpen: false,
  currentStepIndex: 0,

  startTour: (stepIndex = 0, navigate = null) => {
    const step = TOUR_STEPS[stepIndex] || TOUR_STEPS[0]
    set({ isOpen: true, currentStepIndex: stepIndex })
    // Marcar como visto desde el inicio para garantizar que jamás se repita automáticamente
    try {
      useSettings.getState().updateSettings({ hasSeenTour: true })
    } catch (err) {
      console.warn('[useTour] No se pudo guardar hasSeenTour:', err)
    }
    if (navigate && step?.route) {
      navigate(step.route)
    }
  },

  nextStep: (navigate = null) => {
    const nextIdx = get().currentStepIndex + 1
    if (nextIdx >= TOUR_STEPS.length) {
      get().endTour()
      return
    }
    const step = TOUR_STEPS[nextIdx]
    set({ currentStepIndex: nextIdx })
    if (navigate && step?.route) {
      navigate(step.route)
    }
  },

  prevStep: (navigate = null) => {
    const prevIdx = Math.max(0, get().currentStepIndex - 1)
    const step = TOUR_STEPS[prevIdx]
    set({ currentStepIndex: prevIdx })
    if (navigate && step?.route) {
      navigate(step.route)
    }
  },

  endTour: () => {
    set({ isOpen: false, currentStepIndex: 0 })
    try {
      useSettings.getState().updateSettings({ hasSeenTour: true })
    } catch (err) {
      console.warn('[useTour] No se pudo guardar hasSeenTour:', err)
    }
  },
}))


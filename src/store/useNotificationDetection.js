/**
 * src/store/useNotificationDetection.js
 *
 * Store Zustand para administrar la detección de notificaciones bancarias:
 *   - Estado del listener nativo (permiso, conexión, switch general).
 *   - Lista de apps vistas en el dispositivo.
 *   - Allowlist de bancos permitidos.
 *   - Mapeo de paquetes bancarios a cuentas (ej. Nu -> Débito y Crédito).
 *   - Modo captura de muestras (opt-in) y administración de rawSamples.
 *   - Reglas declarativas por app y cuenta (detectionRules).
 *   - Detecciones pendientes por confirmar (pendingDetections).
 *   - Ajustes de notificación propia ("Mostrar monto en la notificación").
 */

import { create } from 'zustand'
import { db } from '../db/database.js'
import {
  getListenerStatus,
  syncAllowlist,
  syncDetectionRules,
  fetchSeenApps,
  drainNotificationQueue,
  drainPendingDetections,
  saveRawSample,
  savePendingDetection,
  purgeExpiredSamples,
  requestRebindService,
} from '../services/notificationDetection.js'

export const useNotificationDetection = create((set, get) => ({
  isPermissionGranted: false,
  isConnected: false,
  isDetectionEnabled: false,
  captureModeEnabled: false,
  showAmountInNotification: true,
  seenApps: [],
  allowlist: [],
  bankAccountMappings: {},
  rawSamples: [],
  detectionRules: [],
  pendingDetections: [],
  genericOptions: {
    expensePattern: '',
    incomePattern: '',
    ignorePatterns: [],
  },
  loading: false,

  /**
   * Inicializa y refresca el estado del listener, ajustes de Dexie, reglas y apps vistas.
   */
  init: async () => {
    set({ loading: true })
    try {
      // 1. Cargar ajustes desde Dexie
      const settings = (await db.settings.get('global')) || {}
      const isDetectionEnabled = Boolean(settings.notificationDetectionEnabled)
      const captureModeEnabled = Boolean(settings.captureModeEnabled)
      const showAmountInNotification =
        settings.showAmountInNotification !== undefined ? settings.showAmountInNotification : true
      const hideAmounts = Boolean(settings.hideAmounts)
      const allowlist = Array.isArray(settings.notificationAllowlist)
        ? settings.notificationAllowlist
        : []
      const bankAccountMappings = settings.bankAccountMappings || {}
      const genericOptions = {
        expensePattern: settings.genericExpensePattern || '',
        incomePattern: settings.genericIncomePattern || '',
        ignorePatterns: Array.isArray(settings.genericIgnorePatterns) ? settings.genericIgnorePatterns : [],
      }

      // 2. Cargar reglas y detecciones pendientes
      const rules = await db.detectionRules.toArray()
      const pending = await db.pendingDetections
        .where('status')
        .equals('pending')
        .reverse()
        .toArray()

      // 3. Consultar estado del plugin nativo
      const status = await getListenerStatus()

      // Sincronizar allowlist y reglas con el motor nativo
      await syncAllowlist(allowlist, isDetectionEnabled)
      await syncDetectionRules({
        rules,
        showAmountInNotification,
        hideAmounts,
        genericOptions,
        bankAccountMappings,
      })

      // 4. Consultar apps vistas
      const seen = await fetchSeenApps()

      // 5. Purgar muestras con más de 7 días
      await purgeExpiredSamples(7)
      const samples = await db.rawSamples.reverse().toArray()

      set({
        isPermissionGranted: status.isPermissionGranted,
        isConnected: status.isConnected,
        isDetectionEnabled,
        captureModeEnabled,
        showAmountInNotification,
        allowlist,
        bankAccountMappings,
        detectionRules: rules,
        pendingDetections: pending,
        genericOptions,
        seenApps: seen,
        rawSamples: samples,
        loading: false,
      })

      // Drenar notificaciones y detecciones pendientes
      if (isDetectionEnabled) {
        await get().drainAllQueues()
      }
    } catch (err) {
      console.warn('[useNotificationDetection] Error al inicializar:', err)
      set({ loading: false })
    }
  },

  /**
   * Refresca el estado de permisos y conexión del servicio.
   */
  refreshStatus: async () => {
    try {
      const status = await getListenerStatus()
      const seen = await fetchSeenApps()
      set({
        isPermissionGranted: status.isPermissionGranted,
        isConnected: status.isConnected,
        seenApps: seen,
      })
      return status
    } catch (err) {
      console.warn('[useNotificationDetection] Error al refrescar estado:', err)
    }
  },

  /**
   * Alterna el interruptor general de detección de movimientos.
   */
  toggleDetection: async (enabled) => {
    const nextVal = typeof enabled === 'boolean' ? enabled : !get().isDetectionEnabled
    try {
      await db.settings.update('global', { notificationDetectionEnabled: nextVal })
      await syncAllowlist(get().allowlist, nextVal)
      set({ isDetectionEnabled: nextVal })

      if (nextVal) {
        await get().drainAllQueues()
      }
    } catch (err) {
      console.error('[useNotificationDetection] Error al alternar detección:', err)
    }
  },

  /**
   * Alterna la opción "Mostrar monto en la notificación".
   */
  toggleShowAmountInNotification: async (enabled) => {
    const nextVal = typeof enabled === 'boolean' ? enabled : !get().showAmountInNotification
    try {
      await db.settings.update('global', { showAmountInNotification: nextVal })
      set({ showAmountInNotification: nextVal })
      await syncDetectionRules({
        rules: get().detectionRules,
        showAmountInNotification: nextVal,
        hideAmounts: false,
        genericOptions: get().genericOptions,
        bankAccountMappings: get().bankAccountMappings,
      })
    } catch (err) {
      console.error('[useNotificationDetection] Error actualizando showAmountInNotification:', err)
    }
  },

  /**
   * Alterna el modo captura de muestras (opt-in).
   */
  toggleCaptureMode: async (enabled) => {
    const nextVal = typeof enabled === 'boolean' ? enabled : !get().captureModeEnabled
    try {
      await db.settings.update('global', { captureModeEnabled: nextVal })
      set({ captureModeEnabled: nextVal })
    } catch (err) {
      console.error('[useNotificationDetection] Error al alternar modo captura:', err)
    }
  },

  /**
   * Marca o desmarca una aplicación como banco (añade/quita de allowlist).
   */
  toggleBankApp: async (packageName) => {
    if (!packageName) return

    const currentAllowlist = get().allowlist
    let updated
    if (currentAllowlist.includes(packageName)) {
      updated = currentAllowlist.filter((pkg) => pkg !== packageName)
    } else {
      updated = [...currentAllowlist, packageName]
    }

    try {
      await db.settings.update('global', { notificationAllowlist: updated })
      await syncAllowlist(updated, get().isDetectionEnabled)
      set({ allowlist: updated })
    } catch (err) {
      console.error('[useNotificationDetection] Error al actualizar allowlist:', err)
    }
  },

  /**
   * Asigna una o varias cuentas bancarias a una app de banco.
   */
  setAccountMapping: async (packageName, accountIds) => {
    if (!packageName) return

    const currentMappings = { ...get().bankAccountMappings }
    if (!accountIds || accountIds.length === 0) {
      delete currentMappings[packageName]
    } else {
      currentMappings[packageName] = accountIds
    }

    try {
      await db.settings.update('global', { bankAccountMappings: currentMappings })
      set({ bankAccountMappings: currentMappings })
      await syncDetectionRules({
        rules: get().detectionRules,
        showAmountInNotification: get().showAmountInNotification,
        hideAmounts: false,
        genericOptions: get().genericOptions,
        bankAccountMappings: currentMappings,
      })
    } catch (err) {
      console.error('[useNotificationDetection] Error al guardar mapeo de cuentas:', err)
    }
  },

  /**
   * Guarda o actualiza una regla declarativa de detección.
   */
  saveRule: async (ruleData) => {
    try {
      let savedId = ruleData.id
      if (ruleData.id) {
        await db.detectionRules.put(ruleData)
      } else {
        savedId = await db.detectionRules.add({
          ...ruleData,
          enabled: ruleData.enabled !== false,
          priority: Number(ruleData.priority) || 10,
        })
      }

      const updatedRules = await db.detectionRules.toArray()
      set({ detectionRules: updatedRules })

      await syncDetectionRules({
        rules: updatedRules,
        showAmountInNotification: get().showAmountInNotification,
        hideAmounts: false,
        genericOptions: get().genericOptions,
        bankAccountMappings: get().bankAccountMappings,
      })

      return savedId
    } catch (err) {
      console.error('[useNotificationDetection] Error guardando regla:', err)
      throw err
    }
  },

  /**
   * Elimina una regla de detección.
   */
  deleteRule: async (ruleId) => {
    try {
      await db.detectionRules.delete(ruleId)
      const updatedRules = await db.detectionRules.toArray()
      set({ detectionRules: updatedRules })

      await syncDetectionRules({
        rules: updatedRules,
        showAmountInNotification: get().showAmountInNotification,
        hideAmounts: false,
        genericOptions: get().genericOptions,
        bankAccountMappings: get().bankAccountMappings,
      })
    } catch (err) {
      console.error('[useNotificationDetection] Error eliminando regla:', err)
    }
  },

  /**
   * Actualiza las opciones globales del modo genérico (patrones ignorados, etc.).
   */
  updateGenericOptions: async (optionsUpdates) => {
    try {
      const merged = { ...get().genericOptions, ...optionsUpdates }
      await db.settings.update('global', {
        genericExpensePattern: merged.expensePattern,
        genericIncomePattern: merged.incomePattern,
        genericIgnorePatterns: merged.ignorePatterns,
      })
      set({ genericOptions: merged })

      await syncDetectionRules({
        rules: get().detectionRules,
        showAmountInNotification: get().showAmountInNotification,
        hideAmounts: false,
        genericOptions: merged,
        bankAccountMappings: get().bankAccountMappings,
      })
    } catch (err) {
      console.error('[useNotificationDetection] Error actualizando opciones genéricas:', err)
    }
  },

  /**
   * Drena tanto la cola de notificaciones brutas como la de detecciones pendientes nativas.
   */
  drainAllQueues: async () => {
    try {
      // 1. Drenar detecciones parseadas nativamente
      const nativeDetections = await drainPendingDetections()
      if (nativeDetections && nativeDetections.length > 0) {
        const accounts = await db.accounts.toArray()
        for (const det of nativeDetections) {
          await savePendingDetection(det, accounts, get().bankAccountMappings)
        }
        await get().fetchPendingDetections()
      }

      // 2. Drenar muestras brutas (Modo Captura)
      if (get().captureModeEnabled) {
        const queuedNotifs = await drainNotificationQueue()
        if (queuedNotifs && queuedNotifs.length > 0) {
          for (const notif of queuedNotifs) {
            await saveRawSample(notif)
          }
          await get().fetchSamples()
        }
      }
    } catch (err) {
      console.warn('[useNotificationDetection] Error drenando colas:', err)
    }
  },

  /**
   * Recarga las detecciones pendientes de Dexie.
   */
  fetchPendingDetections: async () => {
    try {
      const pending = await db.pendingDetections
        .where('status')
        .equals('pending')
        .reverse()
        .toArray()
      set({ pendingDetections: pending })
      return pending
    } catch (err) {
      console.error('[useNotificationDetection] Error al consultar pendingDetections:', err)
      return []
    }
  },

  /**
   * Descarta una detección pendiente.
   */
  dismissDetection: async (detectionId) => {
    try {
      await db.pendingDetections.update(detectionId, { status: 'dismissed' })
      set((state) => ({
        pendingDetections: state.pendingDetections.filter((d) => d.id !== detectionId),
      }))
    } catch (err) {
      console.error('[useNotificationDetection] Error descartando detección:', err)
    }
  },

  /**
   * Confirma una detección individual: crea el movimiento y actualiza la detección en UNA transacción.
   */
  confirmDetection: async (detectionId, overrides = {}) => {
    try {
      const { applyDetection } = await import('../domain/detections.js')
      const { applyMovementToAccount } = await import('../domain/movements.js')
      const { useMovements } = await import('./useMovements.js')
      const { useAccounts } = await import('./useAccounts.js')

      const detection = await db.pendingDetections.get(detectionId)
      if (!detection) throw new Error('Detección no encontrada')

      const accounts = await db.accounts.toArray()
      const categories = await db.categories.toArray()
      const draft = applyDetection(detection, accounts, categories)

      const movementData = {
        id: crypto.randomUUID(),
        type: overrides.type || draft.type || 'expense',
        amount: Math.round(Number(overrides.amount !== undefined ? overrides.amount : draft.amount) || 0),
        currency: overrides.currency || draft.currency || 'MXN',
        accountId: overrides.accountId || draft.accountId,
        toAccountId: (overrides.type || draft.type) === 'transfer' ? (overrides.toAccountId || draft.toAccountId) : null,
        categoryId: (overrides.type || draft.type) === 'transfer' ? null : (overrides.categoryId !== undefined ? overrides.categoryId : draft.categoryId),
        date: overrides.date || draft.date,
        note: (overrides.note !== undefined ? overrides.note : draft.note || '').trim(),
        fixedId: overrides.fixedId || draft.fixedId || null,
        recurringIncomeId: overrides.recurringIncomeId || null,
        createdAt: new Date().toISOString(),
      }

      await db.transaction('rw', [db.movements, db.accounts, db.pendingDetections], async () => {
        await db.movements.add(movementData)

        if (movementData.accountId) {
          const srcAcc = await db.accounts.get(movementData.accountId)
          if (srcAcc) {
            const updatedSrc = applyMovementToAccount(srcAcc, movementData, true)
            await db.accounts.update(srcAcc.id, { balance: updatedSrc.balance })
          }
        }

        if (movementData.type === 'transfer' && movementData.toAccountId) {
          const destAcc = await db.accounts.get(movementData.toAccountId)
          if (destAcc) {
            const updatedDest = applyMovementToAccount(destAcc, movementData, false)
            await db.accounts.update(destAcc.id, { balance: updatedDest.balance })
          }
        }

        await db.pendingDetections.update(detectionId, {
          status: 'confirmed',
          confirmedMovementId: movementData.id,
          confirmedAt: new Date().toISOString(),
        })
      })

      await get().fetchPendingDetections()
      useMovements.getState().fetchMovements()
      useAccounts.getState().fetchAccounts()

      return { movement: movementData, detectionId }
    } catch (err) {
      console.error('[useNotificationDetection] Error confirmando detección:', err)
      throw err
    }
  },

  /**
   * Confirma múltiples detecciones en una sola transacción atómica.
   */
  confirmMultipleDetections: async (detectionIds, overridesMap = {}) => {
    try {
      const { applyDetection } = await import('../domain/detections.js')
      const { applyMovementToAccount } = await import('../domain/movements.js')
      const { useMovements } = await import('./useMovements.js')
      const { useAccounts } = await import('./useAccounts.js')

      const accounts = await db.accounts.toArray()
      const categories = await db.categories.toArray()
      const confirmedList = []

      await db.transaction('rw', [db.movements, db.accounts, db.pendingDetections], async () => {
        for (const detId of detectionIds) {
          const detection = await db.pendingDetections.get(detId)
          if (!detection || detection.status === 'confirmed') continue

          const draft = applyDetection(detection, accounts, categories)
          const ovr = overridesMap[detId] || {}

          const movementData = {
            id: crypto.randomUUID(),
            type: ovr.type || draft.type || 'expense',
            amount: Math.round(Number(ovr.amount !== undefined ? ovr.amount : draft.amount) || 0),
            currency: ovr.currency || draft.currency || 'MXN',
            accountId: ovr.accountId || draft.accountId,
            toAccountId: (ovr.type || draft.type) === 'transfer' ? (ovr.toAccountId || draft.toAccountId) : null,
            categoryId: (ovr.type || draft.type) === 'transfer' ? null : (ovr.categoryId !== undefined ? ovr.categoryId : draft.categoryId),
            date: ovr.date || draft.date,
            note: (ovr.note !== undefined ? ovr.note : draft.note || '').trim(),
            fixedId: ovr.fixedId || draft.fixedId || null,
            createdAt: new Date().toISOString(),
          }

          await db.movements.add(movementData)

          if (movementData.accountId) {
            const srcAcc = await db.accounts.get(movementData.accountId)
            if (srcAcc) {
              const updatedSrc = applyMovementToAccount(srcAcc, movementData, true)
              await db.accounts.update(srcAcc.id, { balance: updatedSrc.balance })
            }
          }

          if (movementData.type === 'transfer' && movementData.toAccountId) {
            const destAcc = await db.accounts.get(movementData.toAccountId)
            if (destAcc) {
              const updatedDest = applyMovementToAccount(destAcc, movementData, false)
              await db.accounts.update(destAcc.id, { balance: updatedDest.balance })
            }
          }

          await db.pendingDetections.update(detId, {
            status: 'confirmed',
            confirmedMovementId: movementData.id,
            confirmedAt: new Date().toISOString(),
          })

          confirmedList.push({ movement: movementData, detectionId: detId })
        }
      })

      await get().fetchPendingDetections()
      useMovements.getState().fetchMovements()
      useAccounts.getState().fetchAccounts()

      return confirmedList
    } catch (err) {
      console.error('[useNotificationDetection] Error confirmando múltiples detecciones:', err)
      throw err
    }
  },

  /**
   * Revierte la confirmación de una o más detecciones (Deshacer).
   */
  undoConfirm: async (confirmedItems) => {
    try {
      const { revertMovementFromAccount } = await import('../domain/movements.js')
      const { useMovements } = await import('./useMovements.js')
      const { useAccounts } = await import('./useAccounts.js')

      const items = Array.isArray(confirmedItems) ? confirmedItems : [confirmedItems]

      await db.transaction('rw', [db.movements, db.accounts, db.pendingDetections], async () => {
        for (const item of items) {
          if (!item) continue
          const movId = item.movement?.id || item.movementId
          const detId = item.detectionId

          if (movId) {
            const mov = await db.movements.get(movId)
            if (mov) {
              if (mov.accountId) {
                const srcAcc = await db.accounts.get(mov.accountId)
                if (srcAcc) {
                  const revertedSrc = revertMovementFromAccount(srcAcc, mov, true)
                  await db.accounts.update(srcAcc.id, { balance: revertedSrc.balance })
                }
              }
              if (mov.type === 'transfer' && mov.toAccountId) {
                const destAcc = await db.accounts.get(mov.toAccountId)
                if (destAcc) {
                  const revertedDest = revertMovementFromAccount(destAcc, mov, false)
                  await db.accounts.update(destAcc.id, { balance: revertedDest.balance })
                }
              }
              await db.movements.delete(movId)
            }
          }

          if (detId) {
            await db.pendingDetections.update(detId, {
              status: 'pending',
              confirmedMovementId: null,
              confirmedAt: null,
            })
          }
        }
      })

      await get().fetchPendingDetections()
      useMovements.getState().fetchMovements()
      useAccounts.getState().fetchAccounts()
    } catch (err) {
      console.error('[useNotificationDetection] Error revirtiendo confirmación:', err)
    }
  },

  /**
   * Confirma un par de detecciones complementarias como una sola transferencia propia.
   */
  confirmTransferPair: async (pair, overrides = {}) => {
    try {
      const { applyMovementToAccount } = await import('../domain/movements.js')
      const { useMovements } = await import('./useMovements.js')
      const { useAccounts } = await import('./useAccounts.js')
      const { todayLocalISO } = await import('../lib/format.js')

      const fromAccId = overrides.fromAccountId || pair.fromAccountId
      const toAccId = overrides.toAccountId || pair.toAccountId
      const amount = overrides.amount !== undefined ? overrides.amount : pair.amountCents
      const date = overrides.date || pair.date || todayLocalISO()

      const newMovement = {
        id: crypto.randomUUID(),
        type: 'transfer',
        amount: Math.round(Number(amount) || 0),
        currency: overrides.currency || 'MXN',
        accountId: fromAccId,
        toAccountId: toAccId,
        categoryId: null,
        date,
        note: (overrides.note || 'Transferencia entre cuentas').trim(),
        createdAt: new Date().toISOString(),
      }

      await db.transaction('rw', [db.movements, db.accounts, db.pendingDetections], async () => {
        await db.movements.add(newMovement)

        if (newMovement.accountId) {
          const srcAcc = await db.accounts.get(newMovement.accountId)
          if (srcAcc) {
            const updatedSrc = applyMovementToAccount(srcAcc, newMovement, true)
            await db.accounts.update(srcAcc.id, { balance: updatedSrc.balance })
          }
        }

        if (newMovement.toAccountId) {
          const destAcc = await db.accounts.get(newMovement.toAccountId)
          if (destAcc) {
            const updatedDest = applyMovementToAccount(destAcc, newMovement, false)
            await db.accounts.update(destAcc.id, { balance: updatedDest.balance })
          }
        }

        if (pair.fromDetection?.id) {
          await db.pendingDetections.update(pair.fromDetection.id, {
            status: 'confirmed',
            confirmedMovementId: newMovement.id,
            confirmedAt: new Date().toISOString(),
          })
        }

        if (pair.toDetection?.id) {
          await db.pendingDetections.update(pair.toDetection.id, {
            status: 'confirmed',
            confirmedMovementId: newMovement.id,
            confirmedAt: new Date().toISOString(),
          })
        }
      })

      await get().fetchPendingDetections()
      useMovements.getState().fetchMovements()
      useAccounts.getState().fetchAccounts()

      return {
        movement: newMovement,
        detectionIds: [pair.fromDetection?.id, pair.toDetection?.id].filter(Boolean),
      }
    } catch (err) {
      console.error('[useNotificationDetection] Error confirmando par de transferencias:', err)
      throw err
    }
  },

  /**
   * Descarta una detección y opcionalmente añade un patrón ignorado.
   */
  ignorePatternAndDismiss: async (detectionId, patternText) => {
    try {
      const cleanPattern = (patternText || '').trim()
      if (cleanPattern) {
        const settings = (await db.settings.get('global')) || {}
        const currentPatterns = Array.isArray(settings.genericIgnorePatterns)
          ? settings.genericIgnorePatterns
          : []
        if (!currentPatterns.includes(cleanPattern)) {
          const updatedPatterns = [...currentPatterns, cleanPattern]
          await db.settings.update('global', { genericIgnorePatterns: updatedPatterns })
          set((state) => ({
            genericOptions: {
              ...state.genericOptions,
              ignorePatterns: updatedPatterns,
            },
          }))
          const rules = await db.detectionRules.toArray()
          await syncDetectionRules({
            rules,
            showAmountInNotification: get().showAmountInNotification,
            hideAmounts: false,
            genericOptions: {
              ...get().genericOptions,
              ignorePatterns: updatedPatterns,
            },
            bankAccountMappings: get().bankAccountMappings,
          })
        }
      }

      await get().dismissDetection(detectionId)
    } catch (err) {
      console.error('[useNotificationDetection] Error al ignorar patrón y descartar:', err)
    }
  },

  /**
   * Recarga las muestras de la tabla rawSamples y purga las que superan 7 días.
   */
  fetchSamples: async () => {
    try {
      await purgeExpiredSamples(7)
      const samples = await db.rawSamples.reverse().toArray()
      set({ rawSamples: samples })
      return samples
    } catch (err) {
      console.error('[useNotificationDetection] Error consultando muestras:', err)
      return []
    }
  },

  /**
   * Elimina una muestra individual de Dexie.
   */
  deleteSample: async (id) => {
    try {
      await db.rawSamples.delete(id)
      set((state) => ({
        rawSamples: state.rawSamples.filter((s) => s.id !== id),
      }))
    } catch (err) {
      console.error('[useNotificationDetection] Error al borrar muestra:', err)
    }
  },

  /**
   * Vacía todas las muestras capturadas.
   */
  clearAllSamples: async () => {
    try {
      await db.rawSamples.clear()
      set({ rawSamples: [] })
    } catch (err) {
      console.error('[useNotificationDetection] Error vaciando muestras:', err)
    }
  },

  /**
   * Solicita reconectar el servicio tras desconexión del sistema.
   */
  rebindService: async () => {
    try {
      const success = await requestRebindService()
      const status = await getListenerStatus()
      set({
        isConnected: status.isConnected,
        isPermissionGranted: status.isPermissionGranted,
      })
      return success
    } catch (err) {
      console.warn('[useNotificationDetection] Error en rebind:', err)
      return false
    }
  },
}))

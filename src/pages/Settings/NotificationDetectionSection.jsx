/**
 * src/pages/Settings/NotificationDetectionSection.jsx
 *
 * Sección de Ajustes para la "Detección de movimientos" por notificaciones bancarias:
 *   1. Interruptor general de detección (apagado por defecto).
 *   2. Estado de escucha visible ("Escuchando: sí / no") y aviso cuando el sistema desconecta
 *      el servicio con requestRebind.
 *   3. Ajuste "Mostrar monto en la notificación" (encendido por defecto).
 *   4. Lista de "Apps vistas" para marcar cuáles son bancos y asignar cuentas vinculadas.
 *   5. Editor de reglas declarativas por app con simulador "Probar con un texto".
 *   6. Detecciones pendientes por confirmar.
 *   7. Modo captura de muestras (opt-in) y acceso al modal de muestras.
 */

import { useState, useEffect } from 'react'
import {
  Bell,
  BellRing,
  BellOff,
  BatteryCharging,
  ShieldCheck,
  RefreshCw,
  Smartphone,
  Check,
  FileText,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Building2,
  Lock,
  Eye,
  EyeOff,
  Code2,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react'
import { useNotificationDetection } from '../../store/useNotificationDetection.js'
import { useAccounts } from '../../store/useAccounts.js'
import NotificationListenerModal from '../../components/notifications/NotificationListenerModal.jsx'
import NotificationSamplesModal from './NotificationSamplesModal.jsx'
import RuleEditorModal from '../../components/notifications/RuleEditorModal.jsx'
import { formatMoney } from '../../lib/format.js'

export default function NotificationDetectionSection() {
  const {
    isPermissionGranted,
    isConnected,
    isDetectionEnabled,
    captureModeEnabled,
    showAmountInNotification,
    seenApps,
    allowlist,
    bankAccountMappings,
    rawSamples,
    detectionRules,
    pendingDetections,
    init,
    refreshStatus,
    toggleDetection,
    toggleCaptureMode,
    toggleShowAmountInNotification,
    toggleBankApp,
    setAccountMapping,
    saveRule,
    deleteRule,
    dismissDetection,
    rebindService,
  } = useNotificationDetection()

  const { accounts, fetchAccounts } = useAccounts()

  const [isListenerModalOpen, setIsListenerModalOpen] = useState(false)
  const [isSamplesModalOpen, setIsSamplesModalOpen] = useState(false)
  const [editingRule, setEditingRule] = useState(null)
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false)
  const [expandedApp, setExpandedApp] = useState(null)
  const [isRebinding, setIsRebinding] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    init()
    fetchAccounts()
  }, [init, fetchAccounts])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await refreshStatus()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  const handleRebind = async () => {
    setIsRebinding(true)
    await rebindService()
    setTimeout(() => setIsRebinding(false), 600)
  }

  const handleAccountToggle = (packageName, accountId) => {
    const current = bankAccountMappings[packageName] || []
    let updated
    if (current.includes(accountId)) {
      updated = current.filter((id) => id !== accountId)
    } else {
      updated = [...current, accountId]
    }
    setAccountMapping(packageName, updated)
  }

  const formatLastSeen = (isoStr) => {
    if (!isoStr) return 'Reciente'
    try {
      const d = new Date(isoStr)
      return d.toLocaleDateString('es-MX', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return 'Reciente'
    }
  }

  return (
    <div
      className="p-4 sm:p-5 rounded-2xl flex flex-col gap-4 text-xs transition-colors"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      {/* ── Cabecera y Switch General ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{
              background: isDetectionEnabled ? 'var(--orange-900)' : 'var(--bg-elevated)',
              color: isDetectionEnabled ? 'var(--orange-400)' : 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <BellRing size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm text-white">Detección de movimientos</h3>
            <p className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-snug">
              Lee notificaciones de tus bancos para registrar movimientos automáticamente.
            </p>
          </div>
        </div>

        {/* Switch general */}
        <button
          type="button"
          role="switch"
          aria-checked={isDetectionEnabled}
          onClick={() => toggleDetection()}
          className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
          style={{
            background: isDetectionEnabled ? 'var(--orange-400)' : 'var(--bg-elevated)',
            minHeight: '44px',
            minWidth: '44px',
            alignItems: 'center',
          }}
          aria-label="Activar detección de movimientos"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out"
            style={{
              transform: isDetectionEnabled ? 'translateX(20px)' : 'translateX(0px)',
            }}
          />
        </button>
      </div>

      {/* ── Estado visible del servicio ("Escuchando: sí / no") ── */}
      <div
        className="p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
        style={{
          background: 'var(--bg-base)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--text-secondary)] font-medium">Estado del servicio:</span>
          {isPermissionGranted && isConnected ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[10px]"
              style={{
                background: 'var(--orange-900)',
                color: 'var(--orange-300)',
                border: '1px solid var(--orange-700)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--orange-400)] animate-pulse" />
              Escuchando: sí
            </span>
          ) : isPermissionGranted && !isConnected ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[10px]"
              style={{
                background: 'var(--red-900)',
                color: 'var(--red-400)',
                border: '1px solid var(--red-600)',
              }}
            >
              <AlertTriangle size={11} />
              Desconectado por el sistema
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-medium text-[10px]"
              style={{
                background: 'var(--bg-elevated)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <BellOff size={11} />
              Escuchando: no (sin permiso)
            </span>
          )}
        </div>

        {/* Botones de acción del estado */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {!isPermissionGranted ? (
            <button
              type="button"
              onClick={() => setIsListenerModalOpen(true)}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-[var(--text-inverse)] bg-[var(--orange-400)] hover:bg-[var(--orange-500)] transition-colors flex items-center gap-1"
              style={{ minHeight: '36px' }}
            >
              <span>Activar permiso</span>
              <ExternalLink size={12} />
            </button>
          ) : !isConnected ? (
            <button
              type="button"
              onClick={handleRebind}
              disabled={isRebinding}
              className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--orange-400)] transition-colors flex items-center gap-1"
              style={{ minHeight: '36px' }}
            >
              <RotateCcw size={12} className={isRebinding ? 'animate-spin' : ''} />
              <span>Reconectar</span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setIsListenerModalOpen(true)}
            className="p-1.5 text-[var(--text-muted)] hover:text-white rounded-lg transition-colors"
            style={{ minWidth: '36px', minHeight: '36px' }}
            title="Guía de batería y permisos"
            aria-label="Ver guía de batería y permisos"
          >
            <BatteryCharging size={16} />
          </button>
        </div>
      </div>

      {/* ── Aviso si el sistema desconectó el servicio ── */}
      {isPermissionGranted && !isConnected && (
        <div
          className="p-3 rounded-xl flex items-start gap-2.5"
          style={{
            background: 'var(--red-900)',
            border: '1px solid var(--red-600)',
            color: 'var(--red-400)',
          }}
        >
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="font-bold text-white text-[11px]">Android suspendió el servicio</span>
            <p className="text-[11px] leading-relaxed text-white opacity-90">
              El sistema cerró el lector en segundo plano. Toca &quot;Reconectar&quot; o desactiva la optimización de batería para mantenerlo siempre activo.
            </p>
          </div>
        </div>
      )}

      {/* ── Ajuste: Mostrar monto en la notificación ── */}
      <div
        className="p-3 rounded-xl flex items-center justify-between gap-3"
        style={{
          background: 'var(--bg-base)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-bold text-xs text-white">Mostrar monto en la notificación</span>
          <p className="text-[10px] text-[var(--text-secondary)] leading-snug">
            Si se desactiva o el modo privado está activo, el aviso dirá &quot;MOVIMIENTO DETECTADO EN LA CUENTA&quot; sin revelar la cifra.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={showAmountInNotification}
          onClick={() => toggleShowAmountInNotification()}
          className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
          style={{
            background: showAmountInNotification ? 'var(--orange-400)' : 'var(--bg-elevated)',
            minHeight: '36px',
            minWidth: '36px',
            alignItems: 'center',
          }}
          aria-label="Alternar mostrar monto en notificación"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
            style={{
              transform: showAmountInNotification ? 'translateX(16px)' : 'translateX(0px)',
            }}
          />
        </button>
      </div>

      {/* ── Detecciones Pendientes por Confirmar (N) ── */}
      {pendingDetections.length > 0 && (
        <div
          className="p-3.5 rounded-xl flex flex-col gap-2.5"
          style={{
            background: 'var(--orange-900)',
            border: '1px solid var(--orange-500)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-white font-bold text-xs">
              <Sparkles size={15} className="text-[var(--orange-400)]" />
              <span>Movimientos detectados ({pendingDetections.length})</span>
            </div>
            <span className="text-[10px] text-[var(--orange-200)]">Pendientes de confirmar</span>
          </div>

          <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-0.5">
            {pendingDetections.map((det) => (
              <div
                key={det.id}
                className="p-2.5 rounded-lg flex items-center justify-between gap-2"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-white text-xs">
                      {det.amountCents != null ? formatMoney(det.amountCents) : 'Monto no detectado'}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      {det.currency}
                    </span>
                    {det.kind && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-[var(--bg-elevated)] text-[var(--orange-400)]">
                        {det.kind === 'income' ? 'Ingreso' : 'Gasto'}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-[var(--text-secondary)] truncate">
                    <span className="truncate">{det.merchant || det.appLabel || det.packageName}</span>
                    {det.last4 && <span>(terminación *{det.last4})</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => dismissDetection(det.id)}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--red-400)] transition-colors"
                    title="Descartar detección"
                    style={{ minWidth: '36px', minHeight: '36px' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Sección "Apps vistas" (Privacidad central) ── */}
      <div className="flex flex-col gap-2.5 pt-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Smartphone size={15} className="text-[var(--orange-400)]" />
            <span className="font-bold text-white text-xs">Apps vistas ({seenApps.length})</span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="flex items-center gap-1 text-[11px] text-[var(--text-muted)] hover:text-white transition-colors py-1 px-2"
            style={{ minHeight: '36px' }}
          >
            <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-[var(--orange-400)]' : ''} />
            <span>Actualizar</span>
          </button>
        </div>

        <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
          Marca cuáles de estas aplicaciones son tus bancos. <strong className="text-white">Solo se leerá el contenido de las apps marcadas</strong>; de las demás no se guarda ningún texto.
        </p>

        {seenApps.length === 0 ? (
          <div
            className="p-4 rounded-xl text-center flex flex-col items-center justify-center gap-1.5"
            style={{
              background: 'var(--bg-base)',
              border: '1px dashed var(--border-subtle)',
            }}
          >
            <Building2 size={24} className="text-[var(--text-muted)] opacity-60" />
            <span className="text-[11px] font-medium text-white">Aún no hay apps detectadas</span>
            <p className="text-[10px] text-[var(--text-muted)] max-w-xs leading-relaxed">
              Cuando tu celular reciba notificaciones de tus bancos con el servicio activo, se listarán automáticamente aquí para que las vincules.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-0.5">
            {seenApps.map((app) => {
              const isAllowed = allowlist.includes(app.packageName)
              const mappedAccounts = bankAccountMappings[app.packageName] || []
              const isExpanded = expandedApp === app.packageName
              const appRules = detectionRules.filter(
                (r) => (r.packageName || '').toLowerCase() === app.packageName.toLowerCase()
              )

              return (
                <div
                  key={app.packageName}
                  className="p-3 rounded-xl flex flex-col gap-2 transition-colors"
                  style={{
                    background: isAllowed ? 'var(--bg-elevated)' : 'var(--bg-base)',
                    border: isAllowed ? '1px solid var(--orange-700)' : '1px solid var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isAllowed ? 'var(--orange-900)' : 'var(--bg-surface)',
                          color: isAllowed ? 'var(--orange-400)' : 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <Building2 size={16} />
                      </div>
                      <div className="truncate">
                        <span className="font-bold text-white text-xs block truncate">
                          {app.appLabel || app.packageName}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)]">
                          <span className="truncate font-mono">{app.packageName}</span>
                          <span>·</span>
                          <span>{formatLastSeen(app.lastSeenAt)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Switch Es Banco */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] font-medium text-[var(--text-secondary)]">
                        {isAllowed ? 'Banco' : 'Ignorar'}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isAllowed}
                        onClick={() => toggleBankApp(app.packageName)}
                        className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
                        style={{
                          background: isAllowed ? 'var(--orange-400)' : 'var(--border-subtle)',
                          minHeight: '36px',
                          minWidth: '36px',
                          alignItems: 'center',
                        }}
                        aria-label={`Marcar ${app.appLabel} como banco`}
                      >
                        <span
                          aria-hidden="true"
                          className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                          style={{
                            transform: isAllowed ? 'translateX(16px)' : 'translateX(0px)',
                          }}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Asignación de cuentas y reglas para este banco */}
                  {isAllowed && (
                    <div
                      className="pt-2 border-t flex flex-col gap-1.5"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <button
                        type="button"
                        onClick={() => setExpandedApp(isExpanded ? null : app.packageName)}
                        className="flex items-center justify-between text-[11px] text-[var(--orange-300)] font-medium hover:underline py-1"
                        style={{ minHeight: '36px' }}
                      >
                        <span>
                          Cuentas ({mappedAccounts.length}) · Reglas ({appRules.length === 0 ? 'Modo genérico' : `${appRules.length} regla(s)`})
                        </span>
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>

                      {isExpanded && (
                        <div className="flex flex-col gap-2 pt-1 pl-1">
                          <p className="text-[10px] text-[var(--text-muted)]">
                            Cuentas asociadas a las notificaciones de esta app:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                            {accounts.map((acc) => {
                              const isSelected = mappedAccounts.includes(acc.id)
                              return (
                                <button
                                  key={acc.id}
                                  type="button"
                                  onClick={() => handleAccountToggle(app.packageName, acc.id)}
                                  className="flex items-center gap-2 p-2 rounded-lg text-left transition-colors"
                                  style={{
                                    background: isSelected ? 'var(--orange-900)' : 'var(--bg-surface)',
                                    border: isSelected ? '1px solid var(--orange-500)' : '1px solid var(--border-subtle)',
                                    minHeight: '40px',
                                  }}
                                >
                                  <div
                                    className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                                    style={{
                                      background: isSelected ? 'var(--orange-400)' : 'transparent',
                                      border: isSelected ? 'none' : '1px solid var(--border-default)',
                                      color: 'var(--text-inverse)',
                                    }}
                                  >
                                    {isSelected && <Check size={12} strokeWidth={3} />}
                                  </div>
                                  <div className="truncate">
                                    <span className="text-[11px] font-medium text-white block truncate">
                                      {acc.name}
                                    </span>
                                    <span className="text-[9px] text-[var(--text-muted)] block capitalize">
                                      {acc.type === 'credit' ? 'Crédito' : acc.type === 'debit' ? 'Débito' : acc.type}
                                    </span>
                                  </div>
                                </button>
                              )
                            })}
                          </div>

                          {/* Botón para crear regla personalizada para esta app */}
                          <div className="pt-1 flex items-center justify-between">
                            <span className="text-[10px] text-[var(--text-muted)]">
                              {appRules.length === 0 ? 'Sin regla personalizada: opera con modo genérico' : `${appRules.length} regla(s) activa(s)`}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRule({ packageName: app.packageName })
                                setIsRuleModalOpen(true)
                              }}
                              className="flex items-center gap-1 text-[11px] text-[var(--orange-400)] hover:underline py-1"
                              style={{ minHeight: '36px' }}
                            >
                              <Plus size={12} />
                              <span>Crear regla</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── SECCIÓN: REGLAS DECLARATIVAS POR APP ── */}
      <div
        className="p-3.5 rounded-xl flex flex-col gap-3"
        style={{
          background: 'var(--bg-base)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-white font-bold text-xs">
            <Code2 size={16} className="text-[var(--orange-400)]" />
            <span>Reglas de interpretación ({detectionRules.length})</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingRule(null)
              setIsRuleModalOpen(true)
            }}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-[var(--text-inverse)] bg-[var(--orange-400)] hover:bg-[var(--orange-500)] transition-colors"
            style={{ minHeight: '36px' }}
          >
            <Plus size={13} />
            <span>Nueva regla</span>
          </button>
        </div>

        <p className="text-[10px] text-[var(--text-secondary)] leading-relaxed">
          Las reglas se configuran como datos con expresiones regulares compartidas entre JS y Java nativo. Si una app bancaria no tiene regla, el <strong className="text-white">Modo Genérico</strong> extrae montos y tipos automáticamente.
        </p>

        {detectionRules.length > 0 && (
          <div className="flex flex-col gap-2 pt-1 max-h-48 overflow-y-auto">
            {detectionRules.map((rule) => (
              <div
                key={rule.id}
                className="p-2.5 rounded-lg flex items-center justify-between gap-2 text-xs"
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-bold text-white text-xs truncate">
                      {rule.description || rule.packageName}
                    </span>
                    <span className="text-[9px] px-1 py-0.2 rounded bg-[var(--bg-elevated)] font-mono text-[var(--text-muted)]">
                      {rule.packageName}
                    </span>
                  </div>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                    Prioridad: {rule.priority || 10} · {rule.defaultCurrency || 'MXN'}
                  </span>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingRule(rule)
                      setIsRuleModalOpen(true)
                    }}
                    className="p-1.5 text-[var(--text-muted)] hover:text-white"
                    style={{ minWidth: '32px', minHeight: '32px' }}
                    title="Editar regla"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteRule(rule.id)}
                    className="p-1.5 text-[var(--text-muted)] hover:text-[var(--red-400)]"
                    style={{ minWidth: '32px', minHeight: '32px' }}
                    title="Eliminar regla"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── MODO CAPTURA DE MUESTRAS (opt-in, apagado por defecto) ── */}
      <div
        className="p-3.5 rounded-xl flex flex-col gap-3"
        style={{
          background: 'var(--bg-base)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{
                background: captureModeEnabled ? 'var(--orange-900)' : 'var(--bg-elevated)',
                color: captureModeEnabled ? 'var(--orange-400)' : 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <FileText size={16} />
            </div>
            <div>
              <span className="font-bold text-xs text-white block">Modo captura de muestras</span>
              <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 leading-snug">
                Guarda temporalmente el texto tal cual de notificaciones bancarias para su análisis.
              </p>
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={captureModeEnabled}
            onClick={() => toggleCaptureMode()}
            className="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none"
            style={{
              background: captureModeEnabled ? 'var(--orange-400)' : 'var(--border-subtle)',
              minHeight: '36px',
              minWidth: '36px',
              alignItems: 'center',
            }}
            aria-label="Activar modo captura de muestras"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
              style={{
                transform: captureModeEnabled ? 'translateX(16px)' : 'translateX(0px)',
              }}
            />
          </button>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-subtle)]">
          <span className="text-[10px] text-[var(--text-muted)]">
            Auto-borrado a los 7 días · Excluido de respaldos
          </span>

          <button
            type="button"
            onClick={() => setIsSamplesModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold text-white bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--orange-400)] transition-colors"
            style={{ minHeight: '36px' }}
          >
            <span>Ver muestras ({rawSamples.length})</span>
          </button>
        </div>
      </div>

      {/* ── Modales ── */}
      <NotificationListenerModal
        isOpen={isListenerModalOpen}
        onClose={() => setIsListenerModalOpen(false)}
        onSettingsOpened={() => refreshStatus()}
      />

      <NotificationSamplesModal
        isOpen={isSamplesModalOpen}
        onClose={() => setIsSamplesModalOpen(false)}
      />

      <RuleEditorModal
        isOpen={isRuleModalOpen}
        onClose={() => setIsRuleModalOpen(false)}
        rule={editingRule}
        seenApps={seenApps}
        onSave={(data) => saveRule(data)}
      />
    </div>
  )
}

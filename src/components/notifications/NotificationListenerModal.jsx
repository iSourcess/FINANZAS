/**
 * src/components/notifications/NotificationListenerModal.jsx
 *
 * Pantalla explicativa previa a abrir Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS
 * e instrucciones para desactivar la optimización de batería en Android.
 */

import { useState } from 'react'
import {
  ShieldCheck,
  BellRing,
  BatteryCharging,
  ExternalLink,
  Lock,
  Smartphone,
  CheckCircle2,
  Info,
  AlertTriangle,
} from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import {
  openListenerSettings,
  openAppSettings,
  openBatteryOptimizationSettings,
} from '../../services/notificationDetection.js'

export default function NotificationListenerModal({
  isOpen,
  onClose,
  onSettingsOpened,
}) {
  const [activeTab, setActiveTab] = useState('permission') // 'permission' | 'battery'

  const handleOpenSettings = async () => {
    await openListenerSettings()
  }

  const handleOpenAppSettings = async () => {
    await openAppSettings()
  }

  const handleOpenBatterySettings = async () => {
    await openBatteryOptimizationSettings()
  }

  const handleCheckAndClose = () => {
    if (typeof onSettingsOpened === 'function') {
      onSettingsOpened()
    } else {
      onClose()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={activeTab === 'permission' ? 'Acceso a notificaciones bancarias' : 'Optimización de batería'}
    >
      <div className="flex flex-col gap-4 text-xs">
        {/* Selector de pestañas */}
        <div
          className="flex p-1 rounded-xl"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('permission')}
            className="flex-1 py-2 text-center rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5"
            style={{
              background: activeTab === 'permission' ? 'var(--orange-400)' : 'transparent',
              color: activeTab === 'permission' ? 'var(--text-inverse)' : 'var(--text-secondary)',
              minHeight: '40px',
            }}
          >
            <BellRing size={15} />
            <span>Permiso de acceso</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('battery')}
            className="flex-1 py-2 text-center rounded-lg font-medium transition-colors flex items-center justify-center gap-1.5"
            style={{
              background: activeTab === 'battery' ? 'var(--orange-400)' : 'transparent',
              color: activeTab === 'battery' ? 'var(--text-inverse)' : 'var(--text-secondary)',
              minHeight: '40px',
            }}
          >
            <BatteryCharging size={15} />
            <span>Batería en 2º plano</span>
          </button>
        </div>

        {activeTab === 'permission' ? (
          <div className="flex flex-col gap-3.5">
            {/* Tarjeta de Privacidad central */}
            <div
              className="p-3.5 rounded-xl flex items-start gap-3"
              style={{
                background: 'var(--orange-900)',
                border: '1px solid var(--orange-500)',
                color: 'var(--orange-200)',
              }}
            >
              <ShieldCheck size={20} className="text-[var(--orange-400)] flex-shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-bold text-white text-xs">Privacidad total y datos locales</span>
                <p className="text-[11px] leading-relaxed text-[var(--orange-100)]">
                  Finanzas <span className="font-semibold text-white">solo leerá el texto de las apps que marques como bancos</span>. De las demás aplicaciones solo registra el nombre para que puedas elegirlas, sin tocar jamás su texto ni mensajes personales.
                </p>
              </div>
            </div>

            {/* Puntos clave */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-2.5 text-[var(--text-secondary)]">
                <Lock size={15} className="text-[var(--orange-400)] flex-shrink-0 mt-0.5" />
                <p className="leading-snug">
                  Tus datos nunca salen del teléfono: no hay servidores ni sincronización en la nube.
                </p>
              </div>
              <div className="flex items-start gap-2.5 text-[var(--text-secondary)]">
                <CheckCircle2 size={15} className="text-[var(--orange-400)] flex-shrink-0 mt-0.5" />
                <p className="leading-snug">
                  En los ajustes de Android, activa la casilla de <strong className="text-white">Finanzas</strong> bajo &quot;Acceso a notificaciones&quot;.
                </p>
              </div>
            </div>

            {/* Botón principal para abrir ajustes de notificaciones */}
            <div className="pt-1 flex flex-col gap-2">
              <Button
                variant="primary"
                onClick={handleOpenSettings}
                className="w-full flex items-center justify-center gap-2"
                style={{ minHeight: '44px' }}
              >
                <span>1. Abrir Acceso a notificaciones</span>
                <ExternalLink size={16} />
              </Button>
            </div>

            {/* Aviso especial para Android 13+ (Ajustes restringidos) */}
            <div
              className="p-3 rounded-xl flex flex-col gap-2"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div className="flex items-center gap-2 text-[var(--orange-400)] font-bold">
                <AlertTriangle size={15} className="flex-shrink-0" />
                <span>¿Aparece en gris o dice &quot;Ajuste restringido&quot;?</span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
                Por seguridad, Android 13, 14 y 15 bloquea este permiso en apps instaladas por APK. Para desbloquearlo:
              </p>
              <ol className="text-[11px] text-[var(--text-secondary)] flex flex-col gap-1.5 list-decimal pl-4">
                <li>
                  Toca <strong className="text-white">&quot;Desbloquear en Info de la app&quot;</strong> abajo.
                </li>
                <li>
                  Toca los <strong className="text-white">3 puntos (⋮)</strong> en la esquina superior derecha.
                </li>
                <li>
                  Selecciona <strong className="text-white">&quot;Permitir ajustes restringidos&quot;</strong> e introduce tu huella o PIN.
                </li>
                <li>
                  Vuelve a presionar <strong className="text-white">&quot;1. Abrir Acceso a notificaciones&quot;</strong> y activa el interruptor de Finanzas.
                </li>
              </ol>
              <Button
                variant="outline"
                onClick={handleOpenAppSettings}
                className="w-full flex items-center justify-center gap-2 mt-1"
                style={{ minHeight: '38px', fontSize: '11px' }}
              >
                <span>Desbloquear en Info de la app</span>
                <ExternalLink size={14} />
              </Button>
            </div>

            {/* Botones de cierre / comprobación */}
            <div className="pt-2 flex flex-col gap-2">
              <Button
                variant="primary"
                onClick={handleCheckAndClose}
                className="w-full"
                style={{ minHeight: '40px', background: 'var(--green-500)', color: 'white' }}
              >
                <span>Ya lo activé / Comprobar</span>
              </Button>
              <Button
                variant="ghost"
                onClick={onClose}
                className="w-full"
                style={{ minHeight: '36px' }}
              >
                Cerrar
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {/* Guía de Optimización de batería */}
            <div
              className="p-3.5 rounded-xl flex items-start gap-3"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Info size={18} className="text-[var(--orange-400)] flex-shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-bold text-white text-xs">Evita que Android pause el lector</span>
                <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
                  Los sistemas Android cierran procesos en segundo plano para ahorrar energía. Para que Finanzas detecte compras con el teléfono bloqueado, configura la batería como &quot;Sin restricciones&quot;.
                </p>
              </div>
            </div>

            <ol className="flex flex-col gap-2.5 pl-1 text-[var(--text-secondary)]">
              <li className="flex items-start gap-2">
                <span className="font-bold text-[var(--orange-400)]">1.</span>
                <span>Toca el botón inferior para abrir la pantalla de batería de la app.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-[var(--orange-400)]">2.</span>
                <span>Selecciona <strong className="text-white">Sin restricciones</strong> o desactiva la optimización para Finanzas.</span>
              </li>
            </ol>

            <div className="pt-2 flex flex-col gap-2">
              <Button
                variant="primary"
                onClick={handleOpenBatterySettings}
                className="w-full flex items-center justify-center gap-2"
                style={{ minHeight: '44px' }}
              >
                <span>Abrir ajustes de batería</span>
                <ExternalLink size={16} />
              </Button>
              <Button
                variant="ghost"
                onClick={onClose}
                className="w-full"
                style={{ minHeight: '44px' }}
              >
                Cerrar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

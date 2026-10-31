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
} from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import {
  openListenerSettings,
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
    if (typeof onSettingsOpened === 'function') {
      onSettingsOpened()
    }
  }

  const handleOpenBatterySettings = async () => {
    await openBatteryOptimizationSettings()
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

            {/* Botón para abrir ajustes */}
            <div className="pt-2 flex flex-col gap-2">
              <Button
                variant="primary"
                onClick={handleOpenSettings}
                className="w-full flex items-center justify-center gap-2"
                style={{ minHeight: '44px' }}
              >
                <span>Abrir Ajustes de notificaciones</span>
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

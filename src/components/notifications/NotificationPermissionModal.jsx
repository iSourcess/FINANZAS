/**
 * src/components/notifications/NotificationPermissionModal.jsx
 *
 * Modal explicativo para permisos de notificación en Android 13+ (POST_NOTIFICATIONS):
 *   - Muestra la explicación ANTES de solicitar el permiso nativo.
 *   - Aclara que las notificaciones son 100% locales en el dispositivo.
 *   - En caso de rechazo, muestra instrucciones claras para activarlo en Ajustes del sistema.
 */

import { useState } from 'react'
import {
  Bell,
  ShieldCheck,
  CalendarDays,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { requestNotificationPermissions, checkNotificationPermissions } from '../../services/notifications.js'

export default function NotificationPermissionModal({
  isOpen,
  onClose,
  onPermissionGranted,
}) {
  const [status, setStatus] = useState('initial') // 'initial' | 'denied' | 'requesting'

  const handleRequest = async () => {
    setStatus('requesting')
    const granted = await requestNotificationPermissions()
    if (granted) {
      if (typeof onPermissionGranted === 'function') {
        onPermissionGranted()
      }
      onClose()
    } else {
      const current = await checkNotificationPermissions()
      if (current === 'denied') {
        setStatus('denied')
      } else {
        onClose()
      }
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Recordatorios Financieros"
    >
      <div className="flex flex-col gap-4 text-xs">
        {status === 'denied' ? (
          /* Pantalla de Permiso Rechazado: Guía para habilitarlo en Ajustes del Sistema */
          <div className="flex flex-col gap-3.5 animate-in fade-in duration-200">
            <div
              className="p-3.5 rounded-xl flex items-start gap-3"
              style={{
                background: 'var(--red-900)',
                border: '1px solid var(--red-600)',
                color: 'var(--red-400)',
              }}
            >
              <AlertTriangle size={18} className="flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-sm block text-white mb-0.5">
                  Permiso de notificaciones desactivado
                </span>
                <p className="text-[11px] leading-relaxed text-[var(--red-400)]">
                  El sistema operativo bloqueó las notificaciones para Finanzas. Para poder recibir avisos de corte de tarjetas y registro diario, actívalas manualmente:
                </p>
              </div>
            </div>

            <div
              className="p-3.5 rounded-xl flex flex-col gap-2"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <span className="text-[11px] font-bold text-white uppercase tracking-wider">
                Cómo activarlas en Android:
              </span>
              <ol className="list-decimal list-inside space-y-1.5 text-[var(--text-secondary)] text-xs">
                <li>Abre los <strong className="text-white">Ajustes</strong> o Configuración de tu celular.</li>
                <li>Ve a la sección <strong className="text-white">Aplicaciones</strong>.</li>
                <li>Busca y selecciona <strong className="text-white">Finanzas</strong>.</li>
                <li>Toca en <strong className="text-white">Notificaciones</strong> y activa el interruptor general o los canales deseados.</li>
              </ol>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" size="sm" onClick={onClose}>
                Entendido
              </Button>
            </div>
          </div>
        ) : (
          /* Pantalla Explicativa ANTES de pedir el permiso */
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
                style={{
                  background: 'var(--orange-900)',
                  border: '1px solid var(--orange-400)',
                  color: 'var(--orange-400)',
                }}
              >
                <Bell size={24} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Nunca olvides un pago o corte
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Recibe avisos oportunos sin spam y manteniendo tu información privada.
                </p>
              </div>
            </div>

            {/* Beneficios */}
            <div className="flex flex-col gap-2 pt-1">
              <div
                className="p-2.5 rounded-xl flex items-center gap-2.5"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
              >
                <CreditCard size={16} className="text-[var(--orange-400)] flex-shrink-0" />
                <span className="text-xs text-[var(--text-secondary)]">
                  <strong className="text-white">Cortes y pagos de tarjetas:</strong> Alertas para evitar cargos por mora e intereses.
                </span>
              </div>

              <div
                className="p-2.5 rounded-xl flex items-center gap-2.5"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
              >
                <CalendarDays size={16} className="text-[var(--orange-400)] flex-shrink-0" />
                <span className="text-xs text-[var(--text-secondary)]">
                  <strong className="text-white">Gastos fijos e ingresos:</strong> Recordatorios de rentas, suscripciones y quincenas.
                </span>
              </div>

              <div
                className="p-2.5 rounded-xl flex items-center gap-2.5"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
              >
                <ShieldCheck size={16} className="text-[var(--orange-400)] flex-shrink-0" />
                <span className="text-xs text-[var(--text-secondary)]">
                  <strong className="text-white">100% privado y local:</strong> Las notificaciones se programan en tu celular sin enviar datos a internet.
                </span>
              </div>
            </div>

            <span className="text-[11px] text-[var(--text-muted)] italic">
              Podrás silenciar o personalizar cada tipo de aviso en cualquier momento desde Ajustes.
            </span>

            {/* Acciones */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
              <Button variant="secondary" size="sm" onClick={onClose} disabled={status === 'requesting'}>
                Ahora no
              </Button>
              <Button
                variant="primary"
                size="sm"
                icon={Bell}
                onClick={handleRequest}
                disabled={status === 'requesting'}
              >
                {status === 'requesting' ? 'Solicitando...' : 'Activar recordatorios'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

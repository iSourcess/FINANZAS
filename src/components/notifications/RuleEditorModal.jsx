/**
 * src/components/notifications/RuleEditorModal.jsx
 *
 * Modal editor de reglas declarativas de detección con simulador interactivo
 * "Probar con un texto".
 *
 * REGLAS DE AGENTS.md:
 *   - Solo tokens de diseño de src/index.css.
 *   - Íconos lucide-react.
 *   - Textos en español (México).
 *   - Áreas táctiles de 44 px.
 */

import { useState, useEffect, useMemo } from 'react'
import {
  Code2,
  Play,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Trash2,
  Sparkles,
  HelpCircle,
} from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import { parseNotification } from '../../domain/detectionParser.js'
import { formatMoney } from '../../lib/format.js'

export default function RuleEditorModal({
  isOpen,
  onClose,
  rule,
  seenApps = [],
  onSave,
}) {
  const [packageName, setPackageName] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState(10)
  const [amountRegex, setAmountRegex] = useState('')
  const [amountGroup, setAmountGroup] = useState(1)
  const [defaultCurrency, setDefaultCurrency] = useState('MXN')
  const [currencyRegex, setCurrencyRegex] = useState('')
  const [merchantRegex, setMerchantRegex] = useState('')
  const [merchantGroup, setMerchantGroup] = useState(1)
  const [last4Regex, setLast4Regex] = useState('')
  const [last4Group, setLast4Group] = useState(1)
  const [expensePattern, setExpensePattern] = useState('compra|cargo|pago|retiro|enviaste')
  const [incomePattern, setIncomePattern] = useState('dep[oó]sito|abono|recibiste|n[oó]mina')
  const [ignorePatterns, setIgnorePatterns] = useState([])
  const [newIgnoreInput, setNewIgnoreInput] = useState('')

  // Texto para prueba en vivo
  const [testText, setTestText] = useState('')

  useEffect(() => {
    if (rule) {
      setPackageName(rule.packageName || '')
      setDescription(rule.description || '')
      setPriority(rule.priority || 10)
      setAmountRegex(rule.amountRegex || '')
      setAmountGroup(rule.amountGroup || 1)
      setDefaultCurrency(rule.defaultCurrency || 'MXN')
      setCurrencyRegex(rule.currencyRegex || '')
      setMerchantRegex(rule.merchantRegex || '')
      setMerchantGroup(rule.merchantGroup || 1)
      setLast4Regex(rule.last4Regex || '')
      setLast4Group(rule.last4Group || 1)

      const exp = rule.kindRules?.find((k) => k.kind === 'expense')?.pattern || ''
      const inc = rule.kindRules?.find((k) => k.kind === 'income')?.pattern || ''
      setExpensePattern(exp || 'compra|cargo|pago|retiro|enviaste')
      setIncomePattern(inc || 'dep[oó]sito|abono|recibiste|n[oó]mina')

      setIgnorePatterns(Array.isArray(rule.ignorePatterns) ? rule.ignorePatterns : [])
    } else {
      setPackageName(seenApps[0]?.packageName || '')
      setDescription('')
      setPriority(10)
      setAmountRegex('(?:\\$|USD|MXN)\\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\\.[0-9]{2})?|[0-9]+(?:\\.[0-9]{2})?)')
      setAmountGroup(1)
      setDefaultCurrency('MXN')
      setCurrencyRegex('\\b(MXN|USD|EUR)\\b')
      setMerchantRegex('(?:en|para|a favor de)\\s+([A-Za-z0-9áéíóúÁÉÍÓÚñÑ\\s.\\*\\-]{2,30}?)(?:\\s+con|\\s+por|\\s+el|\\.|\\$|$)')
      setMerchantGroup(1)
      setLast4Regex('(?:tarjeta|cuenta|terminaci[oó]n|terminada en|termina en|\\*{1,8})\\s*([0-9]{4})\\b')
      setLast4Group(1)
      setExpensePattern('compra|cargo|pago|retiro|enviaste')
      setIncomePattern('dep[oó]sito|abono|recibiste|n[oó]mina')
      setIgnorePatterns(['promoci[oó]n', 'descuento', 'oferta', 'cr[eé]dito preaprobado'])
    }
  }, [rule, seenApps])

  // Objeto de regla compilada para la prueba
  const compiledRule = useMemo(() => ({
    id: rule?.id || 'preview_rule',
    packageName,
    description,
    priority: Number(priority) || 10,
    amountRegex,
    amountGroup: Number(amountGroup) || 1,
    defaultCurrency,
    currencyRegex,
    merchantRegex,
    merchantGroup: Number(merchantGroup) || 1,
    last4Regex,
    last4Group: Number(last4Group) || 1,
    kindRules: [
      { kind: 'expense', pattern: expensePattern },
      { kind: 'income', pattern: incomePattern },
    ],
    ignorePatterns,
    enabled: true,
  }), [
    rule,
    packageName,
    description,
    priority,
    amountRegex,
    amountGroup,
    defaultCurrency,
    currencyRegex,
    merchantRegex,
    merchantGroup,
    last4Regex,
    last4Group,
    expensePattern,
    incomePattern,
    ignorePatterns,
  ])

  // Resultado de la prueba en vivo
  const testResult = useMemo(() => {
    if (!testText.trim()) return null
    return parseNotification(
      {
        packageName,
        text: testText,
      },
      [compiledRule]
    )
  }, [testText, packageName, compiledRule])

  const handleAddIgnore = () => {
    if (!newIgnoreInput.trim()) return
    setIgnorePatterns([...ignorePatterns, newIgnoreInput.trim()])
    setNewIgnoreInput('')
  }

  const handleRemoveIgnore = (index) => {
    setIgnorePatterns(ignorePatterns.filter((_, i) => i !== index))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(compiledRule)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={rule ? 'Editar Regla de Detección' : 'Nueva Regla de Detección'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-xs">
        {/* Selector de App */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
            Aplicación bancaria *
          </label>
          <select
            value={packageName}
            onChange={(e) => setPackageName(e.target.value)}
            required
            className="w-full p-2.5 rounded-xl text-xs text-white outline-none cursor-pointer"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              minHeight: '44px',
            }}
          >
            {seenApps.map((app) => (
              <option key={app.packageName} value={app.packageName}>
                {app.appLabel} ({app.packageName})
              </option>
            ))}
            {seenApps.length === 0 && (
              <option value="com.nu.production">Nu México (com.nu.production)</option>
            )}
          </select>
        </div>

        {/* Nombre / Descripción */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
            Descripción de la regla *
          </label>
          <input
            type="text"
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ej: Compras y retiros con tarjeta"
            className="w-full p-2.5 rounded-xl text-xs text-white outline-none"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              minHeight: '44px',
            }}
          />
        </div>

        {/* Expresiones Regulares */}
        <div
          className="p-3.5 rounded-xl flex flex-col gap-3"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-1.5 text-white font-bold text-xs">
            <Code2 size={15} className="text-[var(--orange-400)]" />
            <span>Patrones de extracción (Regex)</span>
          </div>

          {/* Regex de Monto */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[var(--text-muted)] font-mono">
              Regex de Monto:
            </label>
            <input
              type="text"
              value={amountRegex}
              onChange={(e) => setAmountRegex(e.target.value)}
              className="w-full p-2 rounded-lg text-xs font-mono text-white outline-none"
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-default)',
                minHeight: '36px',
              }}
            />
          </div>

          {/* Regex de Comercio */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[var(--text-muted)] font-mono">
              Regex de Comercio / Destinatario:
            </label>
            <input
              type="text"
              value={merchantRegex}
              onChange={(e) => setMerchantRegex(e.target.value)}
              className="w-full p-2 rounded-lg text-xs font-mono text-white outline-none"
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-default)',
                minHeight: '36px',
              }}
            />
          </div>

          {/* Regex de Últimos 4 Dígitos */}
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-[var(--text-muted)] font-mono">
              Regex de Últimos 4 Dígitos:
            </label>
            <input
              type="text"
              value={last4Regex}
              onChange={(e) => setLast4Regex(e.target.value)}
              className="w-full p-2 rounded-lg text-xs font-mono text-white outline-none"
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-default)',
                minHeight: '36px',
              }}
            />
          </div>

          {/* Patrones de Gasto e Ingreso */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[var(--text-muted)]">Palabras de Gasto:</label>
              <input
                type="text"
                value={expensePattern}
                onChange={(e) => setExpensePattern(e.target.value)}
                className="w-full p-2 rounded-lg text-xs font-mono text-white outline-none"
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)' }}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] text-[var(--text-muted)]">Palabras de Ingreso:</label>
              <input
                type="text"
                value={incomePattern}
                onChange={(e) => setIncomePattern(e.target.value)}
                className="w-full p-2 rounded-lg text-xs font-mono text-white outline-none"
                style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)' }}
              />
            </div>
          </div>
        </div>

        {/* Patrones Ignorados (Publicidad, Promociones) */}
        <div
          className="p-3.5 rounded-xl flex flex-col gap-2.5"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <span className="font-bold text-xs text-white">Patrones a ignorar (Promociones, spam)</span>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newIgnoreInput}
              onChange={(e) => setNewIgnoreInput(e.target.value)}
              placeholder="Ej: descuento|oferta|crédito preaprobado"
              className="flex-1 p-2 rounded-lg text-xs text-white font-mono outline-none"
              style={{ background: 'var(--bg-base)', border: '1px solid var(--border-default)', minHeight: '38px' }}
            />
            <button
              type="button"
              onClick={handleAddIgnore}
              className="px-3 py-2 rounded-lg bg-[var(--orange-400)] text-[var(--text-inverse)] font-bold flex items-center gap-1"
              style={{ minHeight: '38px' }}
            >
              <Plus size={14} />
              <span>Añadir</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            {ignorePatterns.map((pat, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)]"
              >
                <span>{pat}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveIgnore(idx)}
                  className="hover:text-[var(--red-400)] ml-0.5"
                >
                  <Trash2 size={11} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* ── SIMULADOR EN VIVO: "Probar con un texto" ── */}
        <div
          className="p-3.5 rounded-xl flex flex-col gap-2.5"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center gap-1.5 text-white font-bold text-xs">
            <Play size={14} className="text-[var(--orange-400)]" />
            <span>Probar con un texto</span>
          </div>

          <textarea
            value={testText}
            onChange={(e) => setTestText(e.target.value)}
            rows={2}
            placeholder="Pega aquí el texto de una notificación para verificar qué extrae la regla..."
            className="w-full p-2.5 rounded-xl font-mono text-xs text-white outline-none"
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border-default)',
              minHeight: '65px',
            }}
          />

          {testResult && (
            <div
              className="p-3 rounded-xl flex flex-col gap-2 text-xs font-mono animate-in fade-in duration-150"
              style={{
                background: testResult.ignored ? 'var(--red-900)' : 'var(--bg-elevated)',
                border: testResult.ignored ? '1px solid var(--red-600)' : '1px solid var(--border-subtle)',
              }}
            >
              {testResult.ignored ? (
                <div className="flex items-center gap-2 text-[var(--red-400)] font-bold">
                  <AlertTriangle size={15} />
                  <span>Notificación ignorada por patrón de promoción/spam</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-[11px] pb-1 border-b border-[var(--border-subtle)]">
                    <span className="text-[var(--text-muted)] font-sans">Resultado del parseo:</span>
                    <span
                      className="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-sans"
                      style={{
                        background: 'var(--orange-900)',
                        color: 'var(--orange-400)',
                      }}
                    >
                      Confianza: {testResult.parseConfidence}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-white">
                    <div>
                      <span className="text-[var(--text-muted)] block text-[10px]">Monto:</span>
                      <strong>
                        {testResult.amountCents != null ? formatMoney(testResult.amountCents) : '(Sin monto)'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block text-[10px]">Moneda:</span>
                      <strong>{testResult.currency}</strong>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block text-[10px]">Tipo:</span>
                      <strong>{testResult.kind === 'income' ? 'Ingreso' : testResult.kind === 'expense' ? 'Gasto' : 'No detectado'}</strong>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block text-[10px]">Comercio / Destino:</span>
                      <strong>{testResult.merchant || '(No detectado)'}</strong>
                    </div>
                    <div>
                      <span className="text-[var(--text-muted)] block text-[10px]">Últimos 4 dígitos:</span>
                      <strong>{testResult.last4 ? `*${testResult.last4}` : '(No detectado)'}</strong>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} style={{ minHeight: '44px' }}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" style={{ minHeight: '44px' }}>
            Guardar regla
          </Button>
        </div>
      </form>
    </Modal>
  )
}


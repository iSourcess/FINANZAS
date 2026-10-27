/**
 * src/components/forms/AccountForm.jsx
 *
 * Formulario para crear y editar cuentas y tarjetas.
 *
 * Incluye:
 *   - Selección de tema/banco (Nu, Revolut, Mercado Pago, BBVA, Efectivo).
 *   - Manejo de montos en centavos enteros con inputs amigables en pesos.
 *   - Configuración de crédito: límite, día de corte, día de pago.
 *   - Editor de tramos de rendimiento (yieldTiers) con presets bancarios.
 */

import { useState, useEffect, useMemo } from 'react'
import {
  Plus,
  Trash2,
  ShieldAlert,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  Search,
  X,
  Layers,
} from 'lucide-react'
import Modal from '../ui/Modal.jsx'
import Button from '../ui/Button.jsx'
import {
  DEFAULT_YIELD_TIERS,
  BANK_STYLES,
  BANK_GROUPS,
} from '../../lib/constants.js'
import { centsToInput, inputToCents } from '../../lib/format.js'

const DEFAULT_5_BANK_IDS = ['nu', 'bbva', 'mercadoPago', 'banorte', 'cash']

export default function AccountForm({
  account = null, // null para crear, objeto para editar
  accounts = [], // lista completa para seleccionar cuenta padre
  initialParentId = null, // ID de tarjeta padre sugerida (p. ej. al agregar caja desde detalle)
  isOpen,
  onClose,
  onSave,
  onDelete = null,
}) {
  const isEditing = Boolean(account?.id)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Estado del formulario
  const [name, setName] = useState('')
  const [type, setType] = useState('debit')
  const [themeKey, setThemeKey] = useState('nu')
  const [currency, setCurrency] = useState('MXN')
  const [balanceInput, setBalanceInput] = useState('0')
  const [last4, setLast4] = useState('')

  // Crédito
  const [creditLimitInput, setCreditLimitInput] = useState('10000')
  const [cutDay, setCutDay] = useState(1)
  const [payDay, setPayDay] = useState(20)

  // Tramos de rendimiento (para débito/ahorro)
  const [yieldTiers, setYieldTiers] = useState([])
  const [yieldCapBase, setYieldCapBase] = useState(null)

  // Vinculación a tarjeta de débito padre (para cajitas y apartados)
  const [parentId, setParentId] = useState(initialParentId || null)

  // Selector de bancos: 5 visibles por defecto y opción de expandir
  const [showAllBanks, setShowAllBanks] = useState(false)
  const [bankSearch, setBankSearch] = useState('')
  const [selectedBankGroup, setSelectedBankGroup] = useState('all')

  const [errorMsg, setErrorMsg] = useState('')

  // Sincronizar y resetear estados cada vez que se abre o cambia la cuenta (evita fuga de datos)
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('')
      setShowAllBanks(false)
      setBankSearch('')
      setSelectedBankGroup('all')

      if (account) {
        setName(account.name || '')
        setType(account.type || 'debit')
        setThemeKey(account.themeKey || 'nu')
        setCurrency(account.currency || 'MXN')
        setBalanceInput(account.balance != null ? centsToInput(account.balance) : '0')
        setLast4(account.last4 || '')
        setCreditLimitInput(account.credit?.limit ? centsToInput(account.credit.limit) : '10000')
        setCutDay(account.credit?.cutDay || 1)
        setPayDay(account.credit?.payDay || 20)
        setYieldTiers(account.yieldTiers ? JSON.parse(JSON.stringify(account.yieldTiers)) : [])
        setYieldCapBase(account.yieldCapBase || null)
        setParentId(account.parentId || null)
      } else {
        const parentAccount = initialParentId ? accounts.find(a => a.id === initialParentId) : null
        setName('')
        setType(parentAccount ? 'savings' : 'debit')
        setThemeKey(parentAccount ? parentAccount.themeKey : 'nu')
        setCurrency(parentAccount ? parentAccount.currency : 'MXN')
        setBalanceInput('0')
        setLast4('')
        setCreditLimitInput('10000')
        setCutDay(1)
        setPayDay(20)
        setYieldTiers([])
        setYieldCapBase(null)
        setParentId(initialParentId || null)
      }
    }
  }, [isOpen, account, initialParentId, accounts])

  // Cuentas de débito/efectivo elegibles como padre
  const debitAccounts = useMemo(() => {
    return accounts.filter((a) => (a.type === 'debit' || a.type === 'cash') && a.id !== account?.id)
  }, [accounts, account])

  // Bancos visibles en el selector (5 por defecto o todos según filtro/búsqueda)
  const visibleBanks = useMemo(() => {
    if (!showAllBanks) {
      const defaultList = BANK_STYLES.filter((b) => DEFAULT_5_BANK_IDS.includes(b.id))
      if (themeKey && !defaultList.some((b) => b.id === themeKey)) {
        const custom = BANK_STYLES.find((b) => b.id === themeKey)
        if (custom) defaultList.push(custom)
      }
      return defaultList
    }

    let filtered = BANK_STYLES
    if (selectedBankGroup !== 'all') {
      filtered = filtered.filter((b) => b.group === selectedBankGroup)
    }
    if (bankSearch.trim()) {
      const q = bankSearch.toLowerCase()
      filtered = filtered.filter((b) => b.label.toLowerCase().includes(q) || b.id.toLowerCase().includes(q))
    }
    return filtered
  }, [showAllBanks, themeKey, selectedBankGroup, bankSearch])

  // Aplicar preset de rendimiento
  const handleApplyPreset = (presetKey) => {
    if (presetKey === 'none') {
      setYieldTiers([])
      setYieldCapBase(null)
      return
    }
    const preset = DEFAULT_YIELD_TIERS[presetKey]
    if (preset) {
      setYieldTiers(JSON.parse(JSON.stringify(preset)))
      if (presetKey === 'nuTurbo') {
        setThemeKey('nu')
        setType('savings')
        setYieldCapBase('principal')
        if (!name) setName('Cajita Turbo')
        if (!parentId) {
          const nuDebit = debitAccounts.find(a => a.themeKey === 'nu')
          if (nuDebit) setParentId(nuDebit.id)
        }
      } else if (presetKey === 'nuCajita') {
        setThemeKey('nu')
        setType('savings')
        setYieldCapBase('balance')
        if (!name) setName('Cajita Ahorro')
        if (!parentId) {
          const nuDebit = debitAccounts.find(a => a.themeKey === 'nu')
          if (nuDebit) setParentId(nuDebit.id)
        }
      } else if (presetKey === 'mercadoPago') {
        setThemeKey('mercadoPago')
        setType('savings')
        setYieldCapBase('balance')
        if (!name) setName('Apartado Mercado Pago')
        if (!parentId) {
          const mpDebit = debitAccounts.find(a => a.themeKey === 'mercadoPago')
          if (mpDebit) setParentId(mpDebit.id)
        }
      } else if (presetKey === 'revolut') {
        setThemeKey('revolut')
        setYieldCapBase('balance')
        if (!parentId) {
          const revDebit = debitAccounts.find(a => a.themeKey === 'revolut')
          if (revDebit) setParentId(revDebit.id)
        }
      }
    }
  }

  // Agregar tramo manual
  const handleAddTier = () => {
    setYieldTiers([
      ...yieldTiers,
      { upTo: null, rate: 0.05 },
    ])
  }

  // Actualizar tramo
  const handleUpdateTier = (index, field, value) => {
    const updated = [...yieldTiers]
    if (field === 'rate') {
      updated[index].rate = (parseFloat(value) || 0) / 100
    } else if (field === 'upTo') {
      updated[index].upTo = value === '' || value === null ? null : inputToCents(value)
    }
    setYieldTiers(updated)
  }

  // Eliminar tramo
  const handleRemoveTier = (index) => {
    setYieldTiers(yieldTiers.filter((_, idx) => idx !== index))
  }

  // Guardar
  const handleSubmit = (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!name.trim()) {
      setErrorMsg('El nombre de la cuenta es obligatorio.')
      return
    }

    const balanceCents = inputToCents(balanceInput)

    const accountData = {
      name: name.trim(),
      type,
      themeKey,
      currency,
      balance: balanceCents,
      last4: last4.trim() ? last4.trim().slice(-4) : null,
      parentId: parentId || null,
      yieldTiers: (type === 'debit' || type === 'savings') && yieldTiers.length > 0 ? yieldTiers : null,
      yieldCapBase: (type === 'debit' || type === 'savings') && yieldTiers.length > 0
        ? (yieldCapBase || (themeKey === 'nu' && yieldTiers[0]?.rate === 0.13 ? 'principal' : 'balance'))
        : null,
      accumulatedInterestCents: account?.accumulatedInterestCents || 0,
      credit: type === 'credit' ? {
        limit: inputToCents(creditLimitInput),
        cutDay: Math.min(31, Math.max(1, parseInt(cutDay, 10) || 1)),
        payDay: Math.min(31, Math.max(1, parseInt(payDay, 10) || 20)),
      } : null,
    }

    try {
      onSave(accountData)
      onClose()
    } catch (err) {
      setErrorMsg(err.message || 'Error al guardar la cuenta.')
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? `Editar cuenta: ${account?.name}` : 'Nueva Cuenta'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {errorMsg && (
          <div
            className="p-3 rounded-lg text-xs"
            style={{
              background: 'var(--red-900)',
              color: 'var(--red-400)',
              border: '1px solid var(--red-600)',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* ── Nombre de la Cuenta ── */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            Nombre de la cuenta *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Nu Débito, BBVA Nómina, Revolut"
            className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white outline-none transition-colors"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
            }}
          />
        </div>

        {/* ── Tipo de Cuenta ── */}
        <div>
          <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
            Tipo de cuenta
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'debit', label: 'Débito' },
              { id: 'credit', label: 'Crédito' },
              { id: 'cash', label: 'Efectivo' },
              { id: 'savings', label: 'Ahorro' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setType(t.id)
                  if (t.id === 'cash') setThemeKey('cash')
                  if (t.id === 'credit') setParentId(null)
                }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                  type === t.id
                    ? 'border-[var(--orange-400)] bg-[var(--bg-surface)] text-[var(--orange-400)] shadow-sm'
                    : 'border-[var(--border-default)] bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white'
                }`}
                style={{ minHeight: '44px' }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Vincular a Tarjeta de Débito (Cajas / Apartados) ── */}
        {debitAccounts.length > 0 && type !== 'credit' && (
          <div
            className="p-3.5 rounded-xl flex flex-col gap-2.5"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                <Layers size={14} className="text-[var(--orange-400)]" />
                Vincular a Tarjeta de Débito (Caja o Apartado)
              </label>
              {parentId && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-[var(--orange-950)] text-[var(--orange-400)] font-semibold border border-[var(--orange-900)]">
                  Caja vinculada
                </span>
              )}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">
              Si es una caja o apartado (ej: Cajita Turbo o Apartado de Mercado Pago), vincúlala a su tarjeta de débito para que viva adentro de ella y no como tarjeta suelta.
            </p>
            <select
              value={parentId || ''}
              onChange={(e) => {
                const val = e.target.value || null
                setParentId(val)
                if (val) {
                  const parent = debitAccounts.find((a) => a.id === val)
                  if (parent) {
                    setThemeKey(parent.themeKey)
                    setCurrency(parent.currency)
                    if (type === 'debit') setType('savings')
                  }
                }
              }}
              className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none cursor-pointer"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-default)',
                minHeight: '44px',
              }}
            >
              <option value="">Ninguna (Tarjeta o cuenta independiente)</option>
              {debitAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.currency})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* ── Banco / Color de Tarjeta (Solo 5 visibles por defecto y opción de ver más) ── */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-medium text-[var(--text-secondary)]">
              Banco / Estilo visual
            </label>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              {showAllBanks ? `${visibleBanks.length} estilos` : '5 principales'}
            </span>
          </div>

          {/* Opciones cuando está expandido: búsqueda y grupos */}
          {showAllBanks && (
            <div className="flex flex-col gap-2.5 mb-2.5">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Buscar banco, neobanco o plataforma..."
                  value={bankSearch}
                  onChange={(e) => setBankSearch(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 rounded-lg text-xs text-white outline-none"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-default)',
                  }}
                />
                {bankSearch && (
                  <button
                    type="button"
                    onClick={() => setBankSearch('')}
                    className="absolute right-2.5 top-2.5 text-[var(--text-muted)] hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Grupos de bancos */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedBankGroup('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                    selectedBankGroup === 'all'
                      ? 'bg-[var(--orange-400)] text-[var(--text-inverse)] font-semibold'
                      : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white'
                  }`}
                  style={{ minHeight: '32px' }}
                >
                  Todos ({BANK_STYLES.length})
                </button>
                {BANK_GROUPS.map((grp) => (
                  <button
                    key={grp.id}
                    type="button"
                    onClick={() => setSelectedBankGroup(grp.id)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
                      selectedBankGroup === grp.id
                        ? 'bg-[var(--orange-400)] text-[var(--text-inverse)] font-semibold'
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-white'
                    }`}
                    style={{ minHeight: '32px' }}
                  >
                    {grp.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Grid de bancos visibles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {visibleBanks.map((theme) => {
              const isSelected = themeKey === theme.id
              const isPending = theme.status === 'pending'

              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setThemeKey(theme.id)}
                  className="flex items-center gap-2 p-2 rounded-lg border text-left transition-all"
                  style={{
                    background: 'var(--bg-elevated)',
                    borderColor: isSelected ? 'var(--orange-400)' : 'var(--border-default)',
                    minHeight: '44px',
                  }}
                >
                  <span
                    className="w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center text-xs"
                    style={{
                      background: theme.color,
                      color: theme.textColor,
                      border: theme.border || '1px solid rgba(255, 255, 255, 0.25)',
                    }}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="text-xs font-medium text-white truncate block">
                      {theme.label}
                    </span>
                    {isPending && (
                      <span className="text-[9px] text-[var(--text-muted)] block truncate">
                        Color pendiente
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Botón para expandir o colapsar bancos */}
          <button
            type="button"
            onClick={() => setShowAllBanks(!showAllBanks)}
            className="w-full mt-2 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all text-[var(--orange-400)] hover:bg-[var(--orange-950)] border border-dashed border-[var(--border-default)] hover:border-[var(--orange-400)]"
            style={{ minHeight: '44px' }}
          >
            {showAllBanks ? (
              <>
                <ChevronUp size={15} />
                <span>Ver solo 5 principales</span>
              </>
            ) : (
              <>
                <ChevronDown size={15} />
                <span>Más bancos y estilos visuales ({BANK_STYLES.length})</span>
              </>
            )}
          </button>
        </div>

        {/* ── Saldo Inicial / Deuda y Moneda ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              {type === 'credit' ? 'Deuda actual ($ MXN)' : 'Saldo disponible ($ MXN)'}
            </label>
            <input
              type="number"
              step="0.01"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              placeholder="0.00"
              className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white font-mono outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
                fontVariantNumeric: 'tabular-nums',
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1.5">
              Últimos 4 dígitos
            </label>
            <input
              type="text"
              maxLength={4}
              value={last4}
              onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
              placeholder="Ej: 4242"
              className="w-full px-3.5 py-2.5 rounded-lg text-sm text-white font-mono outline-none text-center"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-default)',
              }}
            />
          </div>
        </div>

        {/* ── Configuración Específica de Tarjeta de Crédito ── */}
        {type === 'credit' && (
          <div
            className="p-4 rounded-xl flex flex-col gap-3"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <span className="text-xs font-semibold text-white uppercase tracking-wider">
              Datos de Crédito
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Límite de crédito
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={creditLimitInput}
                  onChange={(e) => setCreditLimitInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white font-mono outline-none"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Día de corte (1-31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={cutDay}
                  onChange={(e) => setCutDay(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                  }}
                />
              </div>

              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">
                  Día de pago (1-31)
                </label>
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={payDay}
                  onChange={(e) => setPayDay(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-xs text-white outline-none"
                  style={{
                    background: 'var(--bg-surface)',
                    border: '1px solid var(--border-default)',
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Configuración de Rendimiento por Tramos (Débito / Ahorro) ── */}
        {(type === 'debit' || type === 'savings') && (
          <div
            className="p-4 rounded-xl flex flex-col gap-3"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles size={14} className="text-[var(--orange-400)]" />
                Rendimiento por Tramos
              </span>
              <button
                type="button"
                onClick={handleAddTier}
                className="text-xs text-[var(--orange-400)] hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> Agregar tramo
              </button>
            </div>

            {/* Presets rápidos */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-[var(--text-muted)]">Presets:</span>
              <button
                type="button"
                onClick={() => handleApplyPreset('nuTurbo')}
                className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-white"
              >
                Nu Cajita Turbo (13%)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('nuCajita')}
                className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-white"
              >
                Nu Cajita Ahorro (7%)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('mercadoPago')}
                className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-white"
              >
                Mercado Pago Apartado (15%/5.3%)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('revolut')}
                className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-white"
              >
                Revolut (15%/7%)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('none')}
                className="text-[11px] px-2 py-0.5 rounded bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-white"
              >
                Sin rendimiento
              </button>
            </div>

            {/* Lista de tramos editables */}
            {yieldTiers.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] italic">
                Sin tramos configurados (0% de rendimiento anual).
              </p>
            ) : (
              <div className="flex flex-col gap-2 mt-1">
                {yieldTiers.map((tier, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-2 rounded-lg"
                    style={{ background: 'var(--bg-surface)' }}
                  >
                    <div className="flex-1">
                      <label className="block text-[10px] text-[var(--text-muted)]">Hasta ($ MXN)</label>
                      <input
                        type="text"
                        value={tier.upTo ? centsToInput(tier.upTo) : ''}
                        placeholder="Sin límite"
                        onChange={(e) => handleUpdateTier(idx, 'upTo', e.target.value)}
                        className="w-full px-2 py-1 rounded text-xs text-white outline-none font-mono"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
                      />
                    </div>

                    <div className="w-24">
                      <label className="block text-[10px] text-[var(--text-muted)]">Tasa anual (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={(tier.rate * 100).toFixed(1)}
                        onChange={(e) => handleUpdateTier(idx, 'rate', e.target.value)}
                        className="w-full px-2 py-1 rounded text-xs text-white outline-none font-mono text-right"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveTier(idx)}
                      aria-label="Eliminar tramo"
                      className="p-1.5 text-[var(--text-muted)] hover:text-[var(--red-400)] transition-colors mt-3"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Botones de Guardar / Cancelar / Eliminar ── */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          {isEditing && onDelete ? (
            <Button
              type="button"
              variant={confirmDelete ? 'danger' : 'secondary'}
              size="sm"
              className="w-full sm:w-auto font-medium"
              style={{
                borderColor: confirmDelete ? 'var(--red-500)' : 'rgba(239, 68, 68, 0.4)',
                background: confirmDelete ? 'var(--red-900)' : 'rgba(239, 68, 68, 0.08)',
                color: 'var(--red-400)',
                minHeight: '40px',
              }}
              icon={confirmDelete ? ShieldAlert : Trash2}
              onClick={() => {
                if (confirmDelete) {
                  onDelete(account.id)
                } else {
                  setConfirmDelete(true)
                }
              }}
            >
              {confirmDelete ? '¿Confirmar eliminación?' : 'Eliminar cuenta'}
            </Button>
          ) : <div className="hidden sm:block" />}

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="ghost"
              type="button"
              className="flex-1 sm:flex-none"
              onClick={onClose}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              type="submit"
              className="flex-1 sm:flex-none"
            >
              {isEditing ? 'Guardar cambios' : 'Crear cuenta'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

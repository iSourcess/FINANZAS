/**
 * src/db/database.js
 *
 * Esquema de Dexie (IndexedDB).
 *
 * CONVENCIÓN IMPORTANTE:
 *   Todos los montos de dinero se almacenan en CENTAVOS ENTEROS.
 *   Ejemplo: $125.50 MXN → 12550
 *   La conversión a pesos solo ocurre en src/lib/format.js al mostrar.
 *
 *   Las fechas de movimientos se guardan como texto ISO "YYYY-MM-DD".
 *   Los campos createdAt se guardan como ISO completo (Date.toISOString()).
 *
 * ACTUALIZACIÓN DE VERSIÓN:
 *   Si necesitas cambiar el esquema, incrementa la versión y agrega
 *   un bloque `.version(N).stores(...)` nuevo. No modifiques el bloque
 *   de versión anterior para no romper usuarios existentes.
 */

import Dexie from 'dexie'

export const db = new Dexie('FinanzasDB')

db.version(1).stores({
  /**
   * accounts — Cuentas del usuario.
   *
   * Campos principales:
   *   id           string  UUID v4
   *   name         string  Nombre visible ("Nu", "BBVA", etc.)
   *   type         string  'cash' | 'debit' | 'credit' | 'savings'
   *   currency     string  'MXN' | 'USD'
   *   balance      number  Saldo actual en centavos (debit/cash/savings)
   *                        Para crédito: deuda acumulada en centavos (positivo = debes)
   *   themeKey     string  Clave en CARD_THEMES de constants.js
   *   color        string  Hex override opcional (null = usar themeKey)
   *   hidden       boolean Si la cuenta se oculta en la billetera
   *   sortOrder    number  Orden en la billetera visual
   *   yieldTiers   JSON    [{ upTo: number|null, rate: number }] o null
   *                        upTo en centavos, rate decimal (0.13 = 13%)
   *   yieldCapBase string  'balance' | 'principal' (para Cajita Turbo)
   *   parentId     string  UUID de la cuenta padre (para cajitas dentro de Nu)
   *   credit       JSON    { limit, cutDay, payDay } | null
   *                        limit en centavos
   *   createdAt    string  ISO timestamp
   *
   * Índices: id (pk), type, currency, parentId
   */
  accounts: '++id, type, currency, parentId',

  /**
   * movements — Movimientos financieros.
   *
   * Campos:
   *   id          string  UUID v4
   *   type        string  'income' | 'expense' | 'transfer'
   *   amount      number  Monto en centavos (siempre positivo)
   *   currency    string  'MXN' | 'USD'
   *   fxRate      number  Tipo de cambio al registrar (MXN por 1 USD)
   *                       Para operaciones MXN = 1
   *   accountId   string  UUID de la cuenta origen
   *   toAccountId string  UUID de la cuenta destino (solo transfers)
   *   categoryId  string  UUID de la categoría
   *   date        string  "YYYY-MM-DD"
   *   note        string  Nota libre (puede ser vacío)
   *   msi         JSON    { months, startDate, monthlyAmount } | null
   *                       monthlyAmount en centavos
   *   fixedId     string  UUID de gastoFijo origen (si aplica, sino null)
   *   createdAt   string  ISO timestamp completo
   *
   * Índices: id (pk), accountId, toAccountId, categoryId, date, type
   */
  movements: '++id, accountId, toAccountId, categoryId, date, type',

  /**
   * categories — Categorías de movimientos.
   *
   * Campos:
   *   id       string  UUID v4
   *   name     string  Nombre en español ("Comida", "Transporte", …)
   *   type     string  'expense' | 'income'
   *   icon     string  Nombre del ícono en lucide-react
   *   color    string  Hex del donut slot (--donut-N de index.css)
   *   sortOrder number Orden en selectors
   *   hidden   boolean
   *
   * Índices: id (pk), type
   */
  categories: '++id, type',

  /**
   * budgets — Presupuesto mensual por categoría.
   *
   * Campos:
   *   id           string  UUID v4
   *   categoryId   string  FK → categories.id
   *   monthlyLimit number  Límite en centavos
   *
   * Índices: id (pk), categoryId
   */
  budgets: '++id, categoryId',

  /**
   * fixedExpenses — Gastos fijos mensuales recurrentes.
   *
   * Campos:
   *   id         string  UUID v4
   *   name       string  "Netflix", "Renta", etc.
   *   amount     number  Monto en centavos
   *   currency   string  'MXN' | 'USD'
   *   categoryId string  FK → categories.id
   *   accountId  string  FK → accounts.id (cuenta sugerida para pagar)
   *   dayOfMonth number  Día del mes en que vence (1–31)
   *   active     boolean
   *   createdAt  string  ISO timestamp
   *
   * Índices: id (pk), categoryId, accountId
   */
  fixedExpenses: '++id, categoryId, accountId',

  /**
   * holdings — Posiciones de inversión.
   *
   * Campos:
   *   id             string  UUID v4
   *   kind           string  'crypto' | 'stock'
   *   symbol         string  "BTC", "NFLX", etc.
   *   name           string  Nombre legible "Bitcoin", "Netflix"
   *   quantity       number  Cantidad de activos (decimal)
   *   avgCost        number  Costo promedio en costCurrency (centavos)
   *   costCurrency   string  'MXN' | 'USD'
   *   priceSourceId  string  'coingecko' | 'finnhub'
   *   createdAt      string  ISO timestamp
   *
   * Índices: id (pk), symbol, kind
   */
  holdings: '++id, symbol, kind',

  /**
   * priceCache — Caché de precios para inversiones.
   *
   * Campos:
   *   symbol    string  "BTC", "NFLX" — también es la clave primaria
   *   price     number  Precio en costCurrency (decimal, no centavos —
   *                     los precios de mercado se guardan como float)
   *   currency  string  'MXN' | 'USD'
   *   change24h number  Variación porcentual en 24h
   *   fetchedAt string  ISO timestamp de cuándo se obtuvo el precio
   *
   * Clave primaria: symbol (string)
   */
  priceCache: 'symbol',

  /**
   * settings — Ajustes globales de la app (una sola fila con id='global').
   *
   * Campos:
   *   id              string  Siempre 'global'
   *   baseCurrency    string  'MXN'
   *   fxMode          string  'auto' | 'manual'
   *   fxRateManual    number  Tipo de cambio manual USD→MXN (decimal)
   *   lastBackupAt    string  ISO timestamp o null
   *   finnhubApiKey   string  API key de Finnhub (solo en dispositivo, nunca en repo)
   *
   * Clave primaria: id
   */
  settings: 'id',
})

db.version(2)
  .stores({
    /**
     * Igual que v1 pero con sortOrder indexado para ordenar eficientemente.
     * Se agrega sortOrder al índice de accounts.
     */
    accounts: '++id, type, currency, parentId, sortOrder',
    movements: '++id, accountId, toAccountId, categoryId, date, type',
    categories: '++id, type',
    budgets: '++id, categoryId',
    fixedExpenses: '++id, categoryId, accountId',
    holdings: '++id, symbol, kind',
    priceCache: 'symbol',
    settings: 'id',
  })
  .upgrade(async (tx) => {
    /**
     * Migración v1 → v2:
     * Asigna sortOrder a cuentas existentes siguiendo el orden de visualización:
     *   1. Débito y ahorro (debit, savings) — por nombre
     *   2. Crédito (credit) — por nombre
     *   3. Efectivo (cash) — por nombre
     * Cuentas que ya tienen sortOrder se ordenan dentro de su grupo respetando
     * su sortOrder previo para no perder orden personalizado.
     */
    const accounts = await tx.table('accounts').toArray()

    const GROUP_ORDER = { debit: 0, savings: 0, credit: 1, cash: 2 }

    // Ordenar: primero por grupo, luego por sortOrder existente (o createdAt como fallback)
    accounts.sort((a, b) => {
      const ga = GROUP_ORDER[a.type] ?? 3
      const gb = GROUP_ORDER[b.type] ?? 3
      if (ga !== gb) return ga - gb
      const sa = a.sortOrder ?? 999
      const sb = b.sortOrder ?? 999
      if (sa !== sb) return sa - sb
      return (a.createdAt || '').localeCompare(b.createdAt || '')
    })

    // Reasignar sortOrder de 0 a n-1
    for (let i = 0; i < accounts.length; i++) {
      await tx.table('accounts').update(accounts[i].id, { sortOrder: i })
    }
  })

db.version(3).stores({
  /**
   * Versión 3:
   * Agrega fxHistory para persistir el historial diario de tipos de cambio (USD/MXN, EUR/MXN)
   * con índice compuesto [pair+date] para garantizar una sola tasa por día y búsquedas rápidas.
   */
  accounts: '++id, type, currency, parentId, sortOrder',
  movements: '++id, accountId, toAccountId, categoryId, date, type',
  categories: '++id, type',
  budgets: '++id, categoryId',
  fixedExpenses: '++id, categoryId, accountId',
  holdings: '++id, symbol, kind',
  priceCache: 'symbol',
  settings: 'id',
  fxHistory: '++id, [pair+date], pair, date',
})

db.version(4)
  .stores({
    /**
     * Versión 4:
     * - lots: lotes de adquisición individuales por activo (fecha, cantidad, precio unitario).
     * - priceHistory: historial diario de precios por símbolo con clave compuesta [symbol+date].
     */
    accounts: '++id, type, currency, parentId, sortOrder',
    movements: '++id, accountId, toAccountId, categoryId, date, type',
    categories: '++id, type',
    budgets: '++id, categoryId',
    fixedExpenses: '++id, categoryId, accountId',
    holdings: '++id, symbol, kind',
    lots: '++id, holdingId, symbol, date',
    priceCache: 'symbol',
    priceHistory: '++id, [symbol+date], symbol, date',
    settings: 'id',
    fxHistory: '++id, [pair+date], pair, date',
  })
  .upgrade(async (tx) => {
    // Migración v3 -> v4: para cada holding existente con cantidad > 0, crear un lote inicial
    const holdings = await tx.table('holdings').toArray()
    for (const h of holdings) {
      if (h.quantity > 0) {
        await tx.table('lots').add({
          id: crypto.randomUUID(),
          holdingId: h.id,
          symbol: h.symbol,
          date: (h.createdAt || '').slice(0, 10) || '2026-10-01',
          quantity: Number(h.quantity),
          priceCents: Math.round(Number(h.avgCost) || 0),
          costCurrency: h.costCurrency || 'USD',
          createdAt: h.createdAt || new Date().toISOString(),
        })
      }
    }
  })

db.version(5).stores({
  /**
   * Versión 5:
   * - goals: Metas de ahorro personales con nombre, monto objetivo y fecha opcional.
   * - goalContributions: Aportes registrados vinculados a una cuenta bancaria / efectivo.
   */
  accounts: '++id, type, currency, parentId, sortOrder',
  movements: '++id, accountId, toAccountId, categoryId, date, type',
  categories: '++id, type',
  budgets: '++id, categoryId',
  fixedExpenses: '++id, categoryId, accountId',
  holdings: '++id, symbol, kind',
  lots: '++id, holdingId, symbol, date',
  priceCache: 'symbol',
  priceHistory: '++id, [symbol+date], symbol, date',
  settings: 'id',
  fxHistory: '++id, [pair+date], pair, date',
  goals: '++id, name, targetDate, status, createdAt',
  goalContributions: '++id, goalId, accountId, date, createdAt',
})

db.version(6)
  .stores({
    /**
     * Versión 6:
     * - accounts: agrega lastReconciledAt (último cuadre de saldo) indexado.
     * - movements: agrega reason (motivo del movimiento / ajuste) indexado.
     */
    accounts: '++id, type, currency, parentId, sortOrder, lastReconciledAt',
    movements: '++id, accountId, toAccountId, categoryId, date, type, reason',
    categories: '++id, type',
    budgets: '++id, categoryId',
    fixedExpenses: '++id, categoryId, accountId',
    holdings: '++id, symbol, kind',
    lots: '++id, holdingId, symbol, date',
    priceCache: 'symbol',
    priceHistory: '++id, [symbol+date], symbol, date',
    settings: 'id',
    fxHistory: '++id, [pair+date], pair, date',
    goals: '++id, name, targetDate, status, createdAt',
    goalContributions: '++id, goalId, accountId, date, createdAt',
  })
  .upgrade(async (tx) => {
    // Migración v5 -> v6: inicializar lastReconciledAt en null para cuentas existentes
    const accounts = await tx.table('accounts').toArray()
    for (const acc of accounts) {
      if (acc.lastReconciledAt === undefined) {
        await tx.table('accounts').update(acc.id, { lastReconciledAt: null })
      }
    }
  })

db.version(7)
  .stores({
    /**
     * Versión 7:
     * - templates: plantillas de movimientos frecuentes
     */
    accounts: '++id, type, currency, parentId, sortOrder, lastReconciledAt',
    movements: '++id, accountId, toAccountId, categoryId, date, type, reason',
    categories: '++id, type',
    budgets: '++id, categoryId',
    fixedExpenses: '++id, categoryId, accountId',
    holdings: '++id, symbol, kind',
    lots: '++id, holdingId, symbol, date',
    priceCache: 'symbol',
    priceHistory: '++id, [symbol+date], symbol, date',
    settings: 'id',
    fxHistory: '++id, [pair+date], pair, date',
    goals: '++id, name, targetDate, status, createdAt',
    goalContributions: '++id, goalId, accountId, date, createdAt',
    templates: '++id, sortOrder, useCount, type, categoryId, accountId',
  })
  .upgrade(async (tx) => {
    // Migración v6 -> v7: asegurar que settings tenga templateTapBehavior
    const settings = await tx.table('settings').get('global')
    if (settings && settings.templateTapBehavior === undefined) {
      await tx.table('settings').update('global', { templateTapBehavior: 'fill' })
    }
  })

db.version(8).stores({
  /**
   * Versión 8:
   * - recurringIncomes: ingresos recurrentes (sueldo, quincena, renta cobrada, etc.)
   * - recurringIncomeOccurrences: ocurrencias pendientes, recibidas u omitidas
   */
  accounts: '++id, type, currency, parentId, sortOrder, lastReconciledAt',
  movements: '++id, accountId, toAccountId, categoryId, date, type, reason',
  categories: '++id, type',
  budgets: '++id, categoryId',
  fixedExpenses: '++id, categoryId, accountId',
  holdings: '++id, symbol, kind',
  lots: '++id, holdingId, symbol, date',
  priceCache: 'symbol',
  priceHistory: '++id, [symbol+date], symbol, date',
  settings: 'id',
  fxHistory: '++id, [pair+date], pair, date',
  goals: '++id, name, targetDate, status, createdAt',
  goalContributions: '++id, goalId, accountId, date, createdAt',
  templates: '++id, sortOrder, useCount, type, categoryId, accountId',
  recurringIncomes: '++id, frequency, categoryId, accountId, active, startDate',
  recurringIncomeOccurrences: '++id, [recurringId+dueDate], recurringId, dueDate, status',
})

db.version(9)
  .stores({
    /**
     * Versión 9:
     * - debts: deudas y préstamos ("me deben" y "debo")
     * - debtPayments: abonos y pagos de deudas
     */
    accounts: '++id, type, currency, parentId, sortOrder, lastReconciledAt',
    movements: '++id, accountId, toAccountId, categoryId, date, type, reason, debtId',
    categories: '++id, type',
    budgets: '++id, categoryId',
    fixedExpenses: '++id, categoryId, accountId',
    holdings: '++id, symbol, kind',
    lots: '++id, holdingId, symbol, date',
    priceCache: 'symbol',
    priceHistory: '++id, [symbol+date], symbol, date',
    settings: 'id',
    fxHistory: '++id, [pair+date], pair, date',
    goals: '++id, name, targetDate, status, createdAt',
    goalContributions: '++id, goalId, accountId, date, createdAt',
    templates: '++id, sortOrder, useCount, type, categoryId, accountId',
    recurringIncomes: '++id, frequency, categoryId, accountId, active, startDate',
    recurringIncomeOccurrences: '++id, [recurringId+dueDate], recurringId, dueDate, status',
    debts: '++id, direction, person, status, openedAt, dueDate',
    debtPayments: '++id, debtId, date, accountId, adjustmentId',
  })
  .upgrade(async (tx) => {
    // Migración v8 -> v9: asegurar que settings tenga includeDebtsInNetWorth (por defecto false)
    const settings = await tx.table('settings').get('global')
    if (settings && settings.includeDebtsInNetWorth === undefined) {
      await tx.table('settings').update('global', { includeDebtsInNetWorth: false })
    }
  })

db.version(10)
  .stores({
    /**
     * Versión 10:
     * - movements: agrega índice importBatchId para trazabilidad y reversión en lote.
     * - importProfiles: perfiles de mapeo guardados por cuenta para no repetir la configuración.
     * - categoryRules: reglas de categorización automática (palabra clave -> categoría con hitCount).
     * - importBatches: historial de lotes de importación para auditoría y opción de deshacer.
     */
    accounts: '++id, type, currency, parentId, sortOrder, lastReconciledAt',
    movements: '++id, accountId, toAccountId, categoryId, date, type, reason, debtId, importBatchId',
    categories: '++id, type',
    budgets: '++id, categoryId',
    fixedExpenses: '++id, categoryId, accountId',
    holdings: '++id, symbol, kind',
    lots: '++id, holdingId, symbol, date',
    priceCache: 'symbol',
    priceHistory: '++id, [symbol+date], symbol, date',
    settings: 'id',
    fxHistory: '++id, [pair+date], pair, date',
    goals: '++id, name, targetDate, status, createdAt',
    goalContributions: '++id, goalId, accountId, date, createdAt',
    templates: '++id, sortOrder, useCount, type, categoryId, accountId',
    recurringIncomes: '++id, frequency, categoryId, accountId, active, startDate',
    recurringIncomeOccurrences: '++id, [recurringId+dueDate], recurringId, dueDate, status',
    debts: '++id, direction, person, status, openedAt, dueDate',
    debtPayments: '++id, debtId, date, accountId, adjustmentId',
    importProfiles: '++id, accountId, name, updatedAt',
    categoryRules: '++id, keyword, categoryId, hitCount, createdAt',
    importBatches: '++id, accountId, date, fileName, status, createdAt',
  })
  .upgrade(async (tx) => {
    // Migración v9 -> v10: asegurar que movements existentes tengan importBatchId en null si no existía
    const movements = await tx.table('movements').toArray()
    for (const m of movements) {
      if (m.importBatchId === undefined) {
        await tx.table('movements').update(m.id, { importBatchId: null })
      }
    }
  })

export default db





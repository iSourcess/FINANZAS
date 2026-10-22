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

export default db

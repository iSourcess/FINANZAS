/**
 * src/db/seed.js
 *
 * Datos iniciales de la base de datos.
 * Solo se ejecuta si la base está vacía (primera instalación).
 *
 * Categorías:
 *   - Gasto: Comida, Transporte, Casa, Servicios, Salud, Ocio,
 *            Compras, Educación, Otros
 *   - Ingreso: Sueldo, Extras, Otros
 *
 * Cuentas:
 *   - Crédito:       Nu, Revolut, Mercado Pago
 *   - Débito/Ahorro: Nu, Revolut, Mercado Pago, BBVA
 *   - Efectivo:      Efectivo (MXN)
 *
 * Todos los montos en centavos enteros.
 * Los colores de donut usan los tokens definidos en src/index.css
 * como strings hex para guardar en DB; los componentes los pueden
 * comparar con las variables CSS si lo necesitan.
 */

import { db } from './database.js'
import { DEFAULT_YIELD_TIERS } from '../lib/constants.js'

/* ── Helpers ──────────────────────────────────────────────── */

/** Genera un UUID v4 simple (no criptográfico). */
function uuid() {
  return crypto.randomUUID()
}

/** ISO timestamp completo del momento actual. */
const now = () => new Date().toISOString()

/* ── Datos de categorías ──────────────────────────────────── */

/**
 * Colores hex que corresponden a los tokens --donut-N de index.css.
 * Se guardan en DB para poder usarse como fill de Recharts sin acceso
 * a las variables CSS.
 */
const DONUT_COLORS = {
  1: '#FF7A1A', // --donut-1 Comida
  2: '#FF9A45', // --donut-2 Transporte
  3: '#FFBA80', // --donut-3 Entretenimiento / Ocio
  4: '#FFE0C0', // --donut-4 Salud
  5: '#C45200', // --donut-5 Casa
  6: '#8A3A00', // --donut-6 Compras / Ropa
  7: '#F59E0B', // --donut-7 Educación
  8: '#6B6B6B', // --donut-8 Otros
}

const EXPENSE_CATEGORIES = [
  { id: uuid(), name: 'Comida',     type: 'expense', icon: 'UtensilsCrossed', color: DONUT_COLORS[1], sortOrder: 1, hidden: false },
  { id: uuid(), name: 'Transporte',type: 'expense', icon: 'Car',             color: DONUT_COLORS[2], sortOrder: 2, hidden: false },
  { id: uuid(), name: 'Casa',      type: 'expense', icon: 'Home',            color: DONUT_COLORS[5], sortOrder: 3, hidden: false },
  { id: uuid(), name: 'Servicios', type: 'expense', icon: 'Zap',             color: DONUT_COLORS[8], sortOrder: 4, hidden: false },
  { id: uuid(), name: 'Salud',     type: 'expense', icon: 'HeartPulse',      color: DONUT_COLORS[4], sortOrder: 5, hidden: false },
  { id: uuid(), name: 'Ocio',      type: 'expense', icon: 'Gamepad2',        color: DONUT_COLORS[3], sortOrder: 6, hidden: false },
  { id: uuid(), name: 'Compras',   type: 'expense', icon: 'ShoppingBag',     color: DONUT_COLORS[6], sortOrder: 7, hidden: false },
  { id: uuid(), name: 'Educación', type: 'expense', icon: 'GraduationCap',   color: DONUT_COLORS[7], sortOrder: 8, hidden: false },
  { id: uuid(), name: 'Otros',     type: 'expense', icon: 'MoreHorizontal',  color: DONUT_COLORS[8], sortOrder: 9, hidden: false },
]

const INCOME_CATEGORIES = [
  { id: uuid(), name: 'Sueldo', type: 'income', icon: 'Banknote',       color: '#FF7A1A', sortOrder: 1, hidden: false },
  { id: uuid(), name: 'Extras', type: 'income', icon: 'TrendingUp',     color: '#FF9A45', sortOrder: 2, hidden: false },
  { id: uuid(), name: 'Otros',  type: 'income', icon: 'MoreHorizontal', color: '#6B6B6B', sortOrder: 3, hidden: false },
]

/* ── Datos de cuentas ─────────────────────────────────────── */

/**
 * Tramos de rendimiento por cuenta (referencia a constants.js).
 * Se clonan para guardar en DB sin referenciar el objeto original.
 */
function tiers(key) {
  return JSON.parse(JSON.stringify(DEFAULT_YIELD_TIERS[key]))
}

const SEED_ACCOUNTS = [
  /* ── Crédito ─────────────────────────────────────────────── */
  {
    id: uuid(),
    name: 'Nu',
    type: 'credit',
    currency: 'MXN',
    balance: 0,          // deuda en centavos (0 = sin deuda)
    themeKey: 'nu',
    color: null,
    hidden: false,
    sortOrder: 1,
    yieldTiers: null,
    yieldCapBase: null,
    parentId: null,
    credit: {
      limit: 1_500_000,  // $15,000.00 en centavos (editable en Ajustes)
      cutDay: 17,        // Día de corte (editable)
      payDay: 7,         // Día límite de pago (editable)
    },
    createdAt: now(),
  },
  {
    id: uuid(),
    name: 'Revolut',
    type: 'credit',
    currency: 'MXN',
    balance: 0,
    themeKey: 'revolut',
    color: null,
    hidden: false,
    sortOrder: 2,
    yieldTiers: null,
    yieldCapBase: null,
    parentId: null,
    credit: {
      limit: 1_000_000,  // $10,000.00
      cutDay: 1,
      payDay: 21,
    },
    createdAt: now(),
  },
  {
    id: uuid(),
    name: 'Mercado Pago',
    type: 'credit',
    currency: 'MXN',
    balance: 0,
    themeKey: 'mercadoPago',
    color: null,
    hidden: false,
    sortOrder: 3,
    yieldTiers: null,
    yieldCapBase: null,
    parentId: null,
    credit: {
      limit: 800_000,    // $8,000.00
      cutDay: 12,
      payDay: 2,
    },
    createdAt: now(),
  },

  /* ── Débito / Ahorro ──────────────────────────────────────── */
  {
    id: uuid(),
    name: 'Nu Débito',
    type: 'debit',
    currency: 'MXN',
    balance: 0,
    themeKey: 'nu',
    color: null,
    hidden: false,
    sortOrder: 4,
    yieldTiers: null,
    yieldCapBase: null,
    parentId: null,
    credit: null,
    createdAt: now(),
  },
  {
    id: uuid(),
    name: 'Cajita Turbo',
    type: 'savings',
    currency: 'MXN',
    balance: 0,
    themeKey: 'nu',
    color: null,
    hidden: false,
    sortOrder: 5,
    // Cajita Turbo: 13% hasta $25,000 con interés compuesto diario
    yieldTiers: tiers('nuTurbo'),
    yieldCapBase: 'principal',
    parentId: null,
    credit: null,
    createdAt: now(),
  },
  {
    id: uuid(),
    name: 'Cajita Ahorro',
    type: 'savings',
    currency: 'MXN',
    balance: 0,
    themeKey: 'nu',
    color: null,
    hidden: false,
    sortOrder: 6,
    // Cajita Ahorro Nu: 7% anual sin límite
    yieldTiers: tiers('nuCajita'),
    yieldCapBase: 'balance',
    parentId: null,
    credit: null,
    createdAt: now(),
  },
  {
    id: uuid(),
    name: 'Revolut',
    type: 'debit',
    currency: 'MXN',
    balance: 0,
    themeKey: 'revolut',
    color: null,
    hidden: false,
    sortOrder: 7,
    yieldTiers: tiers('revolut'),
    yieldCapBase: 'balance',
    parentId: null,
    credit: null,
    createdAt: now(),
  },
  {
    id: uuid(),
    name: 'Mercado Pago',
    type: 'debit',
    currency: 'MXN',
    balance: 0,
    themeKey: 'mercadoPago',
    color: null,
    hidden: false,
    sortOrder: 8,
    // Mercado Pago: 15% hasta $25,000, 5.3% excedente
    yieldTiers: tiers('mercadoPago'),
    yieldCapBase: 'balance',
    parentId: null,
    credit: null,
    createdAt: now(),
  },
  {
    id: uuid(),
    name: 'BBVA',
    type: 'debit',
    currency: 'MXN',
    balance: 0,
    themeKey: 'bbva',
    color: null,
    hidden: false,
    sortOrder: 9,
    yieldTiers: tiers('bbva'),
    yieldCapBase: 'balance',
    parentId: null,
    credit: null,
    createdAt: now(),
  },

  /* ── Efectivo ─────────────────────────────────────────────── */
  {
    id: uuid(),
    name: 'Efectivo',
    type: 'cash',
    currency: 'MXN',
    balance: 0,
    themeKey: 'cash',
    color: null,
    hidden: false,
    sortOrder: 10,
    yieldTiers: null,
    yieldCapBase: null,
    parentId: null,
    credit: null,
    createdAt: now(),
  },
]

/* ── Ajustes iniciales ────────────────────────────────────── */

const INITIAL_SETTINGS = {
  id: 'global',
  baseCurrency: 'MXN',
  fxMode: 'auto',
  fxRateManual: 1700,  // $17.00 MXN/USD como fallback offline (en centavos)
  lastBackupAt: null,
  finnhubApiKey: '',
}

/* ── Función principal de seed ────────────────────────────── */

/**
 * runSeed — Ejecuta el seed solo si la base está vacía.
 *
 * Se llama una vez desde src/main.jsx al arrancar la app.
 * Es seguro llamarla múltiples veces: verifica antes de insertar.
 */
export async function runSeed() {
  try {
    const categoryCount = await db.categories.count()

    // Si ya hay categorías, solo aseguramos settings si faltan
    if (categoryCount > 0) {
      const existingSettings = await db.settings.get('global')
      if (!existingSettings) {
        await db.settings.add(INITIAL_SETTINGS)
      }
      return
    }

    // Insertar categorías y configuración inicial (cuentas inician vacías para agregar manualmente)
    await db.transaction(
      'rw',
      [db.categories, db.settings],
      async () => {
        await db.categories.bulkAdd([
          ...EXPENSE_CATEGORIES,
          ...INCOME_CATEGORIES,
        ])

        const existingSettings = await db.settings.get('global')
        if (!existingSettings) {
          await db.settings.add(INITIAL_SETTINGS)
        }
      }
    )

    console.info('[seed] Categorías y configuración inicializadas correctamente. Cuentas limpias.')
  } catch (error) {
    // No romper la app si el seed falla (p. ej. IndexedDB no disponible)
    console.error('[seed] Error al inicializar la base de datos:', error)
  }
}

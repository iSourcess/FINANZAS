/**
 * src/lib/constants.js
 *
 * Colores oficiales de cada tarjeta de banco/billetera.
 *
 * REGLA: estos colores se usan SOLO dentro de los componentes
 * de billetera (src/components/wallet/). No los importes en
 * pantallas ni en componentes de UI genéricos.
 *
 * Fuente: colores oficiales aproximados de cada marca.
 * Editables por el usuario en Ajustes.
 */

/** @typedef {{ base: string, accent: string, text: string, name: string, status?: string, border?: string }} CardTheme */

export const BANK_GROUPS = [
  { id: 'neobancos_mx', label: 'Neobancos y Fintech MX' },
  { id: 'bancos_mx', label: 'Bancos tradicionales MX' },
  { id: 'inversion_mx', label: 'Inversión MX' },
  { id: 'internacional', label: 'Internacional' },
  { id: 'otros', label: 'Otros' },
]

export const BANK_STYLES = [
  // ── Neobancos y Fintech MX ──
  { id: 'nu', label: 'Nu', group: 'neobancos_mx', color: '#820AD1', accent: '#A855F7', textColor: '#FFFFFF', status: 'verified' },
  { id: 'revolut', label: 'Revolut', group: 'neobancos_mx', color: '#494FDF', accent: '#191C1F', textColor: '#FFFFFF', status: 'verified', border: 'rgba(255, 255, 255, 0.25)' },
  { id: 'mercadoPago', label: 'Mercado Pago', group: 'neobancos_mx', color: '#FFE600', accent: '#FFF159', textColor: '#111111', status: 'verified' },
  { id: 'openbank', label: 'Openbank', group: 'neobancos_mx', color: '#EC0000', accent: '#FF3333', textColor: '#FFFFFF', status: 'memory' },
  { id: 'klar', label: 'Klar', group: 'neobancos_mx', color: '#2B2D42', accent: '#3A3D5A', textColor: '#FFFFFF', status: 'pending' },
  { id: 'stori', label: 'Stori', group: 'neobancos_mx', color: '#2B2D42', accent: '#3A3D5A', textColor: '#FFFFFF', status: 'pending' },
  { id: 'uala', label: 'Ualá', group: 'neobancos_mx', color: '#2B2D42', accent: '#3A3D5A', textColor: '#FFFFFF', status: 'pending' },
  { id: 'heyBanco', label: 'Hey Banco', group: 'neobancos_mx', color: '#2B2D42', accent: '#3A3D5A', textColor: '#FFFFFF', status: 'pending' },

  // ── Bancos tradicionales MX ──
  { id: 'bbva', label: 'BBVA', group: 'bancos_mx', color: '#004481', accent: '#1973B8', textColor: '#FFFFFF', status: 'verified', border: 'rgba(255, 255, 255, 0.25)' },
  { id: 'banorte', label: 'Banorte', group: 'bancos_mx', color: '#EC0029', accent: '#FF2E54', textColor: '#FFFFFF', status: 'verified' },
  { id: 'santander', label: 'Santander', group: 'bancos_mx', color: '#EC0000', accent: '#FF3333', textColor: '#FFFFFF', status: 'memory' },
  { id: 'hsbc', label: 'HSBC', group: 'bancos_mx', color: '#DB0011', accent: '#FF2A3A', textColor: '#FFFFFF', status: 'memory' },
  { id: 'scotiabank', label: 'Scotiabank', group: 'bancos_mx', color: '#EC111A', accent: '#FF3D45', textColor: '#FFFFFF', status: 'memory' },
  { id: 'banamex', label: 'Banamex', group: 'bancos_mx', color: '#2B2D42', accent: '#3A3D5A', textColor: '#FFFFFF', status: 'pending' },
  { id: 'inbursa', label: 'Inbursa', group: 'bancos_mx', color: '#2B2D42', accent: '#3A3D5A', textColor: '#FFFFFF', status: 'pending' },
  { id: 'bancoppel', label: 'BanCoppel', group: 'bancos_mx', color: '#2B2D42', accent: '#3A3D5A', textColor: '#FFFFFF', status: 'pending' },
  { id: 'bancoAzteca', label: 'Banco Azteca', group: 'bancos_mx', color: '#2B2D42', accent: '#3A3D5A', textColor: '#FFFFFF', status: 'pending' },
  { id: 'banregio', label: 'BanRegio', group: 'bancos_mx', color: '#2B2D42', accent: '#3A3D5A', textColor: '#FFFFFF', status: 'pending' },

  // ── Inversión MX ──
  { id: 'cetesDirecto', label: 'Cetes Directo', group: 'inversion_mx', color: '#2B2D42', accent: '#3A3D5A', textColor: '#FFFFFF', status: 'pending' },
  { id: 'gbm', label: 'GBM+', group: 'inversion_mx', color: '#2B2D42', accent: '#3A3D5A', textColor: '#FFFFFF', status: 'pending' },
  { id: 'kuspit', label: 'Kuspit', group: 'inversion_mx', color: '#2B2D42', accent: '#3A3D5A', textColor: '#FFFFFF', status: 'pending' },
  { id: 'fintual', label: 'Fintual', group: 'inversion_mx', color: '#2B2D42', accent: '#3A3D5A', textColor: '#FFFFFF', status: 'pending' },
  { id: 'bitso', label: 'Bitso', group: 'inversion_mx', color: '#2B2D42', accent: '#3A3D5A', textColor: '#FFFFFF', status: 'pending' },

  // ── Internacional ──
  { id: 'wise', label: 'Wise', group: 'internacional', color: '#9FE870', accent: '#B8F293', textColor: '#163300', status: 'memory' },
  { id: 'n26', label: 'N26', group: 'internacional', color: '#088177', accent: '#36A18B', textColor: '#FFFFFF', status: 'verified' },
  { id: 'chime', label: 'Chime', group: 'internacional', color: '#1EC677', accent: '#4AE098', textColor: '#0A331A', status: 'memory' },
  { id: 'paypal', label: 'PayPal', group: 'internacional', color: '#003087', accent: '#0079C1', textColor: '#FFFFFF', status: 'memory' },
  { id: 'ibkr', label: 'Interactive Brokers', group: 'internacional', color: '#D81222', accent: '#FF3D4B', textColor: '#FFFFFF', status: 'memory' },
  { id: 'schwab', label: 'Charles Schwab', group: 'internacional', color: '#00A0DF', accent: '#33B8EB', textColor: '#052838', status: 'memory' },
  { id: 'fidelity', label: 'Fidelity', group: 'internacional', color: '#368727', accent: '#4DA83B', textColor: '#FFFFFF', status: 'memory' },
  { id: 'vanguard', label: 'Vanguard', group: 'internacional', color: '#96151D', accent: '#BD262F', textColor: '#FFFFFF', status: 'memory' },
  { id: 'robinhood', label: 'Robinhood', group: 'internacional', color: '#00C805', accent: '#26E62B', textColor: '#053308', status: 'memory' },
  { id: 'etoro', label: 'eToro', group: 'internacional', color: '#13C636', accent: '#32DF54', textColor: '#05330C', status: 'memory' },
  { id: 'trading212', label: 'Trading 212', group: 'internacional', color: '#0098DB', accent: '#33B4E6', textColor: '#FFFFFF', status: 'memory' },
  { id: 'coinbase', label: 'Coinbase', group: 'internacional', color: '#0052FF', accent: '#3375FF', textColor: '#FFFFFF', status: 'memory' },
  { id: 'binance', label: 'Binance', group: 'internacional', color: '#F0B90B', accent: '#F5CA38', textColor: '#1A1600', status: 'memory' },
  { id: 'kraken', label: 'Kraken', group: 'internacional', color: '#5741D9', accent: '#7562E3', textColor: '#FFFFFF', status: 'memory' },

  // ── Otros ──
  { id: 'cash', label: 'Efectivo', group: 'otros', color: '#FF7A1A', accent: '#FF9A45', textColor: '#0A0A0A', status: 'verified' },
  { id: 'other', label: 'Otro / Personalizado', group: 'otros', color: '#222222', accent: '#383838', textColor: '#FFFFFF', status: 'verified' },
]

/**
 * Mapa de temas visuales para las tarjetas de la billetera.
 * Garantiza retrocompatibilidad total con las cuentas ya existentes.
 * @type {Record<string, CardTheme>}
 */
export const CARD_THEMES = BANK_STYLES.reduce((acc, bank) => {
  acc[bank.id] = {
    name: bank.label,
    base: bank.color,
    accent: bank.accent,
    text: bank.textColor,
    status: bank.status,
    border: bank.border,
  }
  return acc
}, {})

/**
 * Obtiene el tema de tarjeta correspondiente o un fallback seguro.
 * @param {string} themeKey
 * @returns {CardTheme}
 */
export function getCardTheme(themeKey) {
  return CARD_THEMES[themeKey] || {
    name: 'Personalizada',
    base: '#222222',
    accent: '#383838',
    text: '#FFFFFF',
  };
}

/**
 * Orden por defecto de las tarjetas en la billetera visual.
 * El usuario puede reordenarlas en Ajustes.
 */
export const DEFAULT_CARD_ORDER = [
  'nu',
  'revolut',
  'mercadoPago',
  'bbva',
  'cash',
];

/* ── Cuentas semilla (usadas en src/db/seed.js) ────────────
   Cada cuenta referencia su tema por la key de CARD_THEMES.  */

export const SEED_ACCOUNTS = [
  /* ── Crédito ─────────────────────────────────────────── */
  { id: 'credit-nu', name: 'Nu', type: 'credit', currency: 'MXN', themeKey: 'nu' },
  { id: 'credit-revolut', name: 'Revolut', type: 'credit', currency: 'MXN', themeKey: 'revolut' },
  { id: 'credit-mp', name: 'Mercado Pago', type: 'credit', currency: 'MXN', themeKey: 'mercadoPago' },

  /* ── Débito / Ahorro ──────────────────────────────────── */
  { id: 'debit-nu', name: 'Nu', type: 'debit', currency: 'MXN', themeKey: 'nu' },
  { id: 'debit-revolut', name: 'Revolut', type: 'debit', currency: 'MXN', themeKey: 'revolut' },
  { id: 'debit-mp', name: 'Mercado Pago', type: 'debit', currency: 'MXN', themeKey: 'mercadoPago' },
  { id: 'debit-bbva', name: 'BBVA', type: 'debit', currency: 'MXN', themeKey: 'bbva' },

  /* ── Efectivo ─────────────────────────────────────────── */
  { id: 'cash-mxn', name: 'Efectivo', type: 'cash', currency: 'MXN', themeKey: 'cash' },
];

/* ── Tramos de rendimiento por defecto ─────────────────────
   Los tramos siguen el formato: [{ upTo, rate }]
   upTo = monto máximo en ese tramo (en CENTAVOS, valor entero)
         null = sin límite superior
   rate = tasa anual decimal (ej. 0.13 = 13%)                */

export const DEFAULT_YIELD_TIERS = {
  /** Cajita Turbo Nu: 13% anual hasta $25,000 MXN de depósito. Los intereses generados a diario se suman y capitalizan al 13%. El excedente en la Turbo no rinde (0%). */
  nuTurbo: [
    { upTo: 2_500_000, rate: 0.13 },  /* $25,000 en centavos */
  ],

  /** Cajita Ahorro Nu: 7% anual sin límite */
  nuCajita: [
    { upTo: null, rate: 0.07 },
  ],

  /** Revolut: 15% hasta $25,000; 7% de $25,001 a $1,000,000 */
  revolut: [
    { upTo: 2_500_000, rate: 0.15 },
    { upTo: 100_000_000, rate: 0.07 },
  ],

  /** Mercado Pago Apartados: 15% anual hasta $25,000; 5.3% sobre el excedente sin límite */
  mercadoPago: [
    { upTo: 2_500_000, rate: 0.15 },
    { upTo: null, rate: 0.053 },
  ],

  /** BBVA débito: sin rendimiento */
  bbva: [
    { upTo: null, rate: 0.00 },
  ],
};

/* ── Inversiones preconfiguradas ───────────────────────────*/

export const PRESET_HOLDINGS = [
  { symbol: 'BTC', name: 'Bitcoin', kind: 'crypto', priceSourceId: 'coingecko', costCurrency: 'USD' },
  { symbol: 'ETH', name: 'Ethereum', kind: 'crypto', priceSourceId: 'coingecko', costCurrency: 'USD' },
  { symbol: 'NFLX', name: 'Netflix', kind: 'stock', priceSourceId: 'finnhub', costCurrency: 'USD' },
  { symbol: 'INTC', name: 'Intel', kind: 'stock', priceSourceId: 'finnhub', costCurrency: 'USD' },
  { symbol: 'AMD', name: 'AMD', kind: 'stock', priceSourceId: 'finnhub', costCurrency: 'USD' },
  { symbol: 'NVDA', name: 'NVIDIA', kind: 'stock', priceSourceId: 'finnhub', costCurrency: 'USD' },
];

/* ── Monedas soportadas y Tipo de Cambio ────────────────── */
export const CURRENCIES = ['MXN', 'USD', 'EUR']
export const BASE_CURRENCY = 'MXN'

/** Intervalo de auto-refresco del widget de tipo de cambio en primer plano (5 min) */
export const FX_REFRESH_INTERVAL_MS = 5 * 60 * 1000

/** Duración del destello visual al cambiar la cotización (1.2s) */
export const FX_FLASH_DURATION_MS = 1200

/**
 * Catálogo de pares de divisas disponibles para el widget FxWidget y Ajustes.
 * Preparado para agregar fácilmente nuevas divisas en el futuro.
 */
export const AVAILABLE_FX_PAIRS = [
  {
    code: 'USD',
    pair: 'USD/MXN',
    name: 'Dólar estadounidense',
    label: 'USD / MXN',
    symbol: '$',
    flag: 'US',
  },
  {
    code: 'EUR',
    pair: 'EUR/MXN',
    name: 'Euro',
    label: 'EUR / MXN',
    symbol: '€',
    flag: 'EU',
  },
]

/** Tasas fijas de respaldo si no hay conexión a internet ni datos guardados en caché */
export const DEFAULT_FALLBACK_FX_RATES = {
  USD: 18.5,
  EUR: 20.2,
  'USD/MXN': 18.5,
  'EUR/MXN': 20.2,
}


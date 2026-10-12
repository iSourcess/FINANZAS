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

/** @typedef {{ base: string, accent: string, text: string, name: string }} CardTheme */

/** @type {Record<string, CardTheme>} */
export const CARD_THEMES = {
  /**
   * Nu — Morado corporativo + morado claro de acento.
   * Contraste texto blanco sobre base: ~5.7:1 ✅
   */
  nu: {
    name: 'Nu',
    base: '#820AD1',
    accent: '#A855F7',
    text: '#FFFFFF',
  },

  /**
   * Revolut — Negro muy oscuro con acento azul eléctrico.
   * Contraste texto blanco sobre base: ~20:1 ✅
   */
  revolut: {
    name: 'Revolut',
    base: '#191C1F',
    accent: '#0666EB',
    text: '#FFFFFF',
  },

  /**
   * Mercado Pago — Amarillo institucional.
   * ATENCIÓN: texto negro obligatorio (blanco no cumple contraste).
   * Contraste texto negro sobre base: ~14:1 ✅
   */
  mercadoPago: {
    name: 'Mercado Pago',
    base: '#dfdb14',
    accent: '#FFEE33',
    text: '#111111',
  },

  /**
   * BBVA — Azul marino profundo con acento azul cielo.
   * Contraste texto blanco sobre base: ~13.8:1 ✅
   */
  bbva: {
    name: 'BBVA',
    base: '#072146',
    accent: '#1973B8',
    text: '#FFFFFF',
  },

  /**
   * Efectivo — Naranja del sistema de diseño (#FF7A1A).
   * Texto negro sobre fondo naranja (#0A0A0A) para contraste óptimo (~6.2:1).
   */
  cash: {
    name: 'Efectivo',
    base: '#FF7A1A',
    accent: '#FF9A45',
    text: '#0A0A0A',
  },
};

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
  /** Cajita Turbo: 13% hasta $25,000, luego avisar */
  nuTurbo: [
    { upTo: 2_500_000, rate: 0.13 },  /* $25,000 en centavos */
    { upTo: null, rate: 0.07 },  /* Excedente → cajita normal */
  ],

  /** Otras cajitas Nu: 7% sin límite */
  nuCajita: [
    { upTo: null, rate: 0.07 },
  ],

  /** Revolut: 15% hasta $25,000; 7% de $25,001 a $1,000,000 */
  revolut: [
    { upTo: 2_500_000, rate: 0.15 },
    { upTo: 100_000_000, rate: 0.07 },
  ],

  /** Mercado Pago: 12% hasta $25,000; 6% excedente */
  mercadoPago: [
    { upTo: 2_500_000, rate: 0.12 },
    { upTo: null, rate: 0.06 },
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

/* ── Monedas soportadas ────────────────────────────────── */
export const CURRENCIES = ['MXN', 'USD'];
export const BASE_CURRENCY = 'MXN';

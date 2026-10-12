/**
 * tailwind.config.js
 *
 * Configuración de Tailwind CSS para la app Finanzas.
 * Extiende el tema con los tokens del design-system/MASTER.md.
 *
 * Stack: React + Vite + Tailwind CSS
 */

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      /* ── Fuentes ─────────────────────────────────────── */
      fontFamily: {
        heading: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body:    ['DM Sans',       'system-ui', 'sans-serif'],
        sans:    ['DM Sans',       'system-ui', 'sans-serif'],
      },

      /* ── Colores del Design System ───────────────────── */
      colors: {
        /* Fondos */
        app: {
          base:     '#0A0A0A',
          surface:  '#111111',
          elevated: '#1A1A1A',
          overlay:  '#222222',
        },

        /* Naranja — acento único */
        orange: {
          50:  '#FFF3E8',
          100: '#FFE0C0',
          200: '#FFBA80',
          300: '#FF9A45',
          400: '#FF7A1A',   /* ← ACENTO PRINCIPAL */
          500: '#E86200',
          600: '#C45200',
          700: '#8A3A00',
          800: '#5C2600',
          900: '#2E1200',
        },

        /* Rojo — solo negativo y alertas */
        danger: {
          400: '#F87171',
          500: '#EF4444',
          600: '#DC2626',
          900: '#3B0A0A',
        },

        /* Texto */
        content: {
          primary:   '#F5F5F5',
          secondary: '#A3A3A3',
          muted:     '#6B6B6B',
          inverse:   '#0A0A0A',
        },

        /* Bordes */
        border: {
          subtle:  '#2A2A2A',
          default: '#383838',
          focus:   '#FF7A1A',
        },

        /* Semánticos */
        positive: '#FF7A1A',
        negative: '#F87171',
        warning:  '#F59E0B',

        /* Donut — 8 categorías */
        donut: {
          1: '#FF7A1A',
          2: '#FF9A45',
          3: '#FFBA80',
          4: '#FFE0C0',
          5: '#C45200',
          6: '#8A3A00',
          7: '#F59E0B',
          8: '#6B6B6B',
        },
      },

      /* ── Radios ──────────────────────────────────────── */
      borderRadius: {
        sm:   '6px',
        md:   '10px',
        lg:   '14px',
        xl:   '20px',
        full: '9999px',
      },

      /* ── Espaciado (base 4px) ────────────────────────── */
      spacing: {
        4.5: '1.125rem',  /* 18px — gap útil */
        13:  '3.25rem',   /* 52px */
        15:  '3.75rem',   /* 60px */
        18:  '4.5rem',    /* 72px — bottom nav area */
        22:  '5.5rem',    /* 88px */
      },

      /* ── Escala tipográfica ───────────────────────────── */
      fontSize: {
        'display':  ['2rem',      { lineHeight: '1.2', fontWeight: '700' }],
        'title-lg': ['1.5rem',    { lineHeight: '1.3', fontWeight: '600' }],
        'title':    ['1.25rem',   { lineHeight: '1.4', fontWeight: '600' }],
        'body-lg':  ['1rem',      { lineHeight: '1.5', fontWeight: '500' }],
        'body':     ['0.875rem',  { lineHeight: '1.5', fontWeight: '400' }],
        'caption':  ['0.75rem',   { lineHeight: '1.4', fontWeight: '400' }],
        'label':    ['0.6875rem', { lineHeight: '1.3', fontWeight: '500' }],
      },

      /* ── Breakpoints (móvil primero) ─────────────────── */
      screens: {
        xs:  '375px',
        sm:  '640px',
        md:  '768px',
        lg:  '1024px',
        xl:  '1440px',
      },

      /* ── Transiciones ────────────────────────────────── */
      transitionDuration: {
        micro:  '150',
        base:   '200',
        enter:  '300',
        number: '400',
      },

      /* ── Sombras (OLED: se usa borde, no sombra real) ── */
      boxShadow: {
        'top-border': '0 -1px 0 0 #2A2A2A',
        'card':       '0 1px 3px 0 rgba(0,0,0,0.4)',
      },

      /* ── Altura mínima táctil ────────────────────────── */
      minHeight: {
        touch: '44px',
      },
      minWidth: {
        touch: '44px',
      },
    },
  },
  plugins: [],
};

# 🎨 MASTER — Sistema de Diseño · Finanzas App

> Generado por la skill **ui-ux-pro-max** · 2026-10-12  
> Stack: **React + JSX + Vite + Tailwind CSS**  
> Estilo base: **Dark Mode OLED + Micro-interactions + Minimal Swiss**

---

## 1. Filosofía

La app de finanzas personales opera en un contexto de **alta densidad de datos** y **uso frecuente**. El diseño prioriza:

- **Legibilidad antes que decoración**: los números deben ser el protagonista.
- **Un solo acento**: naranja. El rojo es solo para alertas y valores negativos.
- **Jerarquía clara**: la pantalla responde a la pregunta *"¿cuánto tengo?"* en menos de 1 segundo visual.
- **Confianza**: fondo negro profundo + superficies sutilmente elevadas → sensación de instrumento financiero, no de aplicación de juegos.

---

## 2. Paleta de Colores

### 2.1 Fondo y superficies

| Token | Hex | Uso |
|---|---|---|
| `--bg-base` | `#0A0A0A` | Fondo raíz de la app |
| `--bg-surface` | `#111111` | Tarjetas, paneles, modales |
| `--bg-elevated` | `#1A1A1A` | Inputs, dropdowns, tooltips |
| `--bg-overlay` | `#222222` | Hover de items de lista |

### 2.2 Bordes

| Token | Hex | Uso |
|---|---|---|
| `--border-subtle` | `#2A2A2A` | Bordes de tarjetas y separadores |
| `--border-default` | `#383838` | Inputs, divisores visibles |
| `--border-focus` | `#FF7A1A` | Anillo de foco (naranja) |

### 2.3 Naranja — Acento único

| Token | Hex | HSL | Uso |
|---|---|---|---|
| `--orange-50` | `#FFF3E8` | `28 100% 95%` | Fondos hover muy suaves (modo claro) |
| `--orange-100` | `#FFE0C0` | `28 100% 87%` | Badges suaves |
| `--orange-200` | `#FFBA80` | `28 100% 75%` | Donut cat. 1 |
| `--orange-300` | `#FF9A45` | `28 100% 63%` | Donut cat. 2 |
| `--orange-400` | `#FF7A1A` | `28 100% 55%` | **Acento principal / CTA** |
| `--orange-500` | `#E86200` | `26 100% 45%` | Hover del acento |
| `--orange-600` | `#C45200` | `25 100% 38%` | Pressed / active |
| `--orange-700` | `#8A3A00` | `26 100% 27%` | Donut cat. 3 (oscuro) |
| `--orange-800` | `#5C2600` | `26 100% 18%` | Donut cat. 4 (oscuro) |
| `--orange-900` | `#2E1200` | `26 100% 9%` | Fondo tinted muy oscuro |

### 2.4 Rojo — Solo negativo y alertas

| Token | Hex | Uso |
|---|---|---|
| `--red-400` | `#F87171` | Texto de valor negativo (sobre fondo oscuro) |
| `--red-500` | `#EF4444` | Ícono de alerta, badge de error |
| `--red-600` | `#DC2626` | Botón destructivo hover |
| `--red-900` | `#3B0A0A` | Fondo de alerta crítica |

### 2.5 Neutros de texto

| Token | Hex | Uso |
|---|---|---|
| `--text-primary` | `#F5F5F5` | Texto principal, montos grandes |
| `--text-secondary` | `#A3A3A3` | Labels, metadata, fechas |
| `--text-muted` | `#6B6B6B` | Placeholders, texto deshabilitado |
| `--text-inverse` | `#0A0A0A` | Texto sobre el acento naranja |

### 2.6 Semánticos

| Token | Alias | Uso |
|---|---|---|
| `--color-positive` | `--orange-400` | Ingresos, balance positivo, ganancias |
| `--color-negative` | `--red-400` | Gastos, balance negativo, pérdidas |
| `--color-warning` | `#F59E0B` | Alerta al 80% de presupuesto |
| `--color-neutral` | `--text-secondary` | Sin movimiento, sin dato |

### 2.7 Escala donut (8 categorías)

| Slot | Token | Hex | Ejemplo de categoría |
|---|---|---|---|
| 1 | `--donut-1` | `#FF7A1A` | Comida |
| 2 | `--donut-2` | `#FF9A45` | Transporte |
| 3 | `--donut-3` | `#FFBA80` | Entretenimiento |
| 4 | `--donut-4` | `#FFE0C0` | Salud |
| 5 | `--donut-5` | `#C45200` | Hogar |
| 6 | `--donut-6` | `#8A3A00` | Ropa |
| 7 | `--donut-7` | `#F59E0B` | Educación |
| 8 | `--donut-8` | `#6B6B6B` | Otros |

---

## 3. Tipografía

### Fuentes seleccionadas

**Estilo: Tech Startup / Financial Dashboard**

| Rol | Familia | Peso | Uso |
|---|---|---|---|
| Heading | **Space Grotesk** | 500, 600, 700 | Títulos de pantalla, nombre de cuenta |
| Body | **DM Sans** | 400, 500 | Texto general, labels, notas |
| Números | **Space Grotesk** + `font-variant-numeric: tabular-nums` | 600, 700 | Montos, saldos, porcentajes |

**Google Fonts import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,700;1,9..40,400&display=swap');
```

### Escala tipográfica

| Token | Tamaño | Peso | Line-height | Uso |
|---|---|---|---|---|
| `text-display` | `2rem / 32px` | 700 | 1.2 | Patrimonio total, monto hero |
| `text-title-lg` | `1.5rem / 24px` | 600 | 1.3 | Título de pantalla |
| `text-title` | `1.25rem / 20px` | 600 | 1.4 | Nombre de tarjeta, sección |
| `text-body-lg` | `1rem / 16px` | 500 | 1.5 | Montos secundarios |
| `text-body` | `0.875rem / 14px` | 400 | 1.5 | Texto general |
| `text-caption` | `0.75rem / 12px` | 400 | 1.4 | Metadata, fechas, notas |
| `text-label` | `0.6875rem / 11px` | 500 | 1.3 | Labels de inputs, badges |

### Regla de números tabulares

Todos los montos monetarios deben usar:
```css
font-variant-numeric: tabular-nums;
font-feature-settings: "tnum";
```
Esto evita que los dígitos "bailen" al actualizar valores en tiempo real.

---

## 4. Espaciado y Layout

### Escala de espaciado

Base: `4px`. Escala: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`.

### Layout móvil (375px base)

```
┌─────────────────────────────┐  ← 375px
│  Header (safe area top)     │  44px min
│                             │
│  Contenido principal        │  flex-1
│  padding: 16px horizontal   │
│                             │
│  BottomNav                  │  64px + safe area
└─────────────────────────────┘
```

- **Áreas táctiles**: mínimo `44 × 44px`.
- **Padding horizontal estándar**: `16px` en móvil, `24px` en tablet.
- **Máx. width de contenido**: `640px` centrado en pantallas grandes.

### Breakpoints

| Nombre | `px` | Descripción |
|---|---|---|
| `xs` | `375` | Móvil pequeño (base) |
| `sm` | `640` | Móvil grande |
| `md` | `768` | Tablet |
| `lg` | `1024` | Desktop pequeño |
| `xl` | `1440` | Desktop grande |

---

## 5. Elevación y Sombras

El sistema usa **diferencia de color**, no sombras reales (OLED friendly):

| Nivel | Fondo | Borde | Uso |
|---|---|---|---|
| Base | `#0A0A0A` | ninguno | Fondo de app |
| Surface | `#111111` | `#2A2A2A` | Tarjetas, panels |
| Elevated | `#1A1A1A` | `#383838` | Modales, dropdowns |
| Interactive | `#222222` | `#383838` | Hover sobre items |

Sombra sutil para componentes que flotan (bottom nav, modales):
```css
box-shadow: 0 -1px 0 0 var(--border-subtle);
```

---

## 6. Bordes y Radios

| Token | Valor | Uso |
|---|---|---|
| `--radius-sm` | `6px` | Badges, tags |
| `--radius-md` | `10px` | Inputs, botones |
| `--radius-lg` | `14px` | Tarjetas, paneles |
| `--radius-xl` | `20px` | Modales, bottom sheets |
| `--radius-full` | `9999px` | Pills, avatares circulares |

---

## 7. Componentes Clave

### Botón principal (CTA)

```
bg: --orange-400  (#FF7A1A)
text: --text-inverse  (#0A0A0A)
font: DM Sans 500
height: 48px
radius: --radius-md (10px)
hover: bg --orange-500, transition 150ms
active: scale 0.98, bg --orange-600
focus: ring 2px --border-focus
```

### Tarjeta de resumen

```
bg: --bg-surface (#111111)
border: 1px solid --border-subtle (#2A2A2A)
radius: --radius-lg (14px)
padding: 16px
```

### Input de monto

```
bg: --bg-elevated (#1A1A1A)
border: 1px solid --border-default (#383838)
font: Space Grotesk 600, tabular-nums, 24px
color: --text-primary
focus-border: --border-focus (naranja)
radius: --radius-md
height: 56px
```

### Badge / Etiqueta

```
bg: --orange-900 (tinted)
text: --orange-300
font: DM Sans 500, 11px
radius: --radius-full
padding: 2px 8px
```

---

## 8. Tarjetas de Banco (Wallet)

Los colores de banco se usan **SOLO** dentro de los componentes de billetera (`components/wallet/`). Están definidos en `src/lib/constants.js`.

| Tarjeta | Color base | Acento | Texto |
|---|---|---|---|
| Nu | `#820AD1` | `#A855F7` | Blanco `#FFFFFF` |
| Revolut | `#191C1F` | `#0666EB` | Blanco `#FFFFFF` |
| Mercado Pago | `#dfdb14` | `#FFEE33` | Negro `#111111` |
| BBVA | `#072146` | `#1973B8` | Blanco `#FFFFFF` |
| Efectivo | `#FF7A1A` | `#FF9A45` | Negro `#0A0A0A` |

**Regla de contraste**: el texto sobre cada tarjeta debe cumplir ≥4.5:1. Blanco sobre morado Nu: ✅. Blanco sobre amarillo Mercado Pago: ❌ → usar negro.

---

## 9. Íconos

- Librería: **lucide-react** exclusivamente.
- Tamaño estándar: `20px` (interfaz general), `24px` (acciones principales), `16px` (inline en texto).
- Color: heredado del contexto (`currentColor`). Nunca hardcodeado.
- **Prohibido**: emojis como íconos.

---

## 10. Motion y Animaciones

| Tipo | Duración | Easing | Uso |
|---|---|---|---|
| Micro (hover, focus) | `150ms` | `ease-out` | Cambios de color, bordes |
| Transición de estado | `200ms` | `ease-in-out` | Botones, badges |
| Entrada de panel | `300ms` | `cubic-bezier(0.4, 0, 0.2, 1)` | Modales, bottom sheets |
| Número animado | `400ms` | `ease-out` | Actualización de montos |

**Respeto a `prefers-reduced-motion`**:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 11. Accesibilidad

- Contraste mínimo texto: **4.5:1** (WCAG AA).
- Contraste mínimo texto grande (>18px bold): **3:1**.
- Los estados de error y éxito nunca se comunican solo con color: siempre acompañados de ícono y texto.
- Los valores negativos: rojo + ícono de flecha abajo + signo negativo.
- Focus ring: `2px solid #FF7A1A` con `outline-offset: 2px`.
- `aria-label` en todos los iconos standalone.

---

## 12. Checklist pre-entrega

- [ ] Sin colores hex sueltos en componentes (solo tokens CSS o clases Tailwind).
- [ ] Sin emojis como íconos.
- [ ] Números monetarios con `font-variant-numeric: tabular-nums`.
- [ ] Áreas táctiles ≥ 44px.
- [ ] Sin `console.log` olvidados.
- [ ] `prefers-reduced-motion` aplicado.
- [ ] Contraste verificado en tarjetas de banco.
- [ ] Sin scroll horizontal en 375px.
- [ ] Focus visible en todos los interactivos.
- [ ] `npm test` + `npm run build` en verde.

# Plan del proyecto: App de finanzas personales

App personal para **Android** (después escritorio), hecha en **JSX (React)**, con datos guardados **solo en tu dispositivo**, diseño **negro y naranja**.

---

## 1. Qué hace la app

### Tres apartados principales (navegación inferior)

1. **Registrar**: carga rápida de ingresos, gastos y transferencias del día.
2. **Panorama**: resumen filtrable por semana, mes, año, todo o rango de fechas.
3. **Cuentas**: efectivo, débito con rendimiento, tarjetas de crédito (con MSI) e inversiones.

Un ícono de engrane abre **Ajustes** (categorías, tipo de cambio, respaldo).

### Registrar
- Selector Ingreso / Gasto / Transferencia.
- Monto, moneda (MXN o USD), categoría, cuenta o tarjeta, fecha (hoy por defecto) y nota.
- La cuenta se elige con un **selector visual tipo Google Wallet**: tus tarjetas apiladas o en carrusel horizontal, y tocas la que usaste. Queda preseleccionada la sugerida (última usada o por defecto de la categoría).
- Si eliges tarjeta de crédito, aparece la opción **"A meses sin intereses"** (3, 6, 9, 12, 18, 24 meses).
- Lista "movimientos de hoy" con editar, borrar y deshacer.

### Panorama
Filtro de periodo arriba y, en orden:
1. Tarjetas resumen: ingresos, gastos, balance (positivo en naranja, negativo en rojo con ícono y texto).
2. Comparativa contra el periodo anterior ("gastaste 12% menos").
3. Gráfica circular (donut) de gastos por categoría.
4. Gráfica de tendencia de ingresos vs. gastos.
5. Presupuesto por categoría (barras con alertas al 80% y 100%).
6. Gastos fijos del mes (pagados / pendientes).
7. Historial de movimientos con búsqueda y filtros.

### Cuentas
Arriba, una **billetera visual** (estilo Google Wallet) con todas tus tarjetas como tarjetas físicas apiladas. Al tocar una, se abre su detalle: saldo o deuda, últimos movimientos, rendimiento (débito) o corte, pago y MSI (crédito).

Tarjetas iniciales que se cargan al instalar:

| Tipo | Tarjetas |
|---|---|
| Crédito | Nu, Revolut, Mercado Pago |
| Débito | Nu, Revolut, Mercado Pago, BBVA |
| Efectivo | Efectivo |

Cada una se puede editar, ocultar o agregar nuevas.

Pestañas internas:
- **Efectivo y débito**: saldos, rendimiento estimado, cuánto falta para llegar al tope de cada tasa.
- **Crédito**: límite, disponible, fecha de corte, fecha límite de pago, saldo actual y MSI.
- **Inversiones**: criptos y acciones con precio actualizado desde internet, ganancia o pérdida.
- **Patrimonio total** arriba: efectivo + débito + inversiones − deuda de tarjetas.

---

## 2. Tecnologías

| Capa | Herramienta | Por qué |
|---|---|---|
| UI | **React + JSX** (sin TypeScript) | Lo que pediste |
| Build | **Vite** | Rápido y simple |
| Estilos | **Tailwind CSS** | Rápido para un diseño consistente con tokens de color |
| Rutas | **React Router** (HashRouter) | Funciona dentro de la app Android sin servidor |
| Estado | **Zustand** | Pequeño y fácil |
| Base de datos local | **Dexie (IndexedDB)** | Más robusta que localStorage para muchos movimientos |
| Gráficas | **Recharts** | Donut, líneas y barras con colores personalizables |
| Íconos | **lucide-react** | SVG consistentes (la skill de UI prohíbe emojis como íconos) |
| Fechas | **date-fns** | Periodos, cortes, mensualidades |
| Android | **Capacitor** | Empaqueta el mismo código web como app Android |
| Plugins Capacitor | Filesystem, Share, Local Notifications, Http | Respaldo, recordatorios de pago y llamadas a APIs sin problemas de CORS |
| Pruebas | **Vitest** | Para la lógica de rendimientos y MSI |
| Escritorio (después) | **Tauri** | Mismo código, app de escritorio ligera |
| Diseño | **ui-ux-pro-max** (skill del repo nextlevelbuilder) | Sistema de diseño, paleta y reglas de calidad |

**Requisitos en tu computadora:** Node 20+, Git, Android Studio (trae el SDK y el JDK), y un celular Android con depuración USB o el emulador.

---

## 3. Estructura del proyecto

```
finanzas/
├── design-system/              # Generado por la skill ui-ux-pro-max
│   ├── MASTER.md
│   └── pages/
├── android/                    # Lo genera Capacitor
├── src/
│   ├── main.jsx
│   ├── App.jsx                 # Rutas + layout
│   ├── index.css               # Tailwind + tokens de color
│   ├── db/
│   │   ├── database.js         # Esquema de Dexie
│   │   └── seed.js             # Categorías y cuentas iniciales
│   ├── store/
│   │   ├── useAccounts.js
│   │   ├── useMovements.js
│   │   ├── useBudgets.js
│   │   ├── useInvestments.js
│   │   └── useSettings.js
│   ├── domain/                 # Lógica pura (se prueba con Vitest)
│   │   ├── periods.js          # semana / mes / año / todo / rango
│   │   ├── summaries.js        # totales, balance, por categoría
│   │   ├── yield.js            # rendimiento por tramos
│   │   ├── creditCards.js      # corte, pago, disponible
│   │   ├── msi.js              # mensualidades y deuda restante
│   │   ├── recurring.js        # gastos fijos mensuales
│   │   ├── currency.js         # conversión MXN/USD
│   │   └── netWorth.js         # patrimonio total
│   ├── services/
│   │   ├── prices.js           # CoinGecko / acciones
│   │   ├── fx.js               # tipo de cambio USD/MXN
│   │   ├── backup.js           # exportar / importar JSON y CSV
│   │   └── notifications.js    # recordatorios de pago
│   ├── pages/
│   │   ├── Register/
│   │   ├── Overview/           # "Panorama"
│   │   ├── Accounts/           # Efectivo, Crédito, Inversiones
│   │   └── Settings/
│   ├── components/
│   │   ├── layout/             # BottomNav, Header, PeriodFilter
│   │   ├── wallet/             # CardStack, WalletCard, CardPicker (estilo Google Wallet)
│   │   ├── charts/             # DonutChart, TrendChart, BudgetBar
│   │   ├── forms/              # MovementForm, AccountForm, AmountInput
│   │   └── ui/                 # Button, Card, Modal, Toast, Badge
│   └── lib/
│       ├── format.js           # Dinero, fechas, porcentajes
│       └── constants.js
├── tests/                      # Pruebas de domain/
├── capacitor.config.json
├── vite.config.js
└── package.json
```

Regla de oro: **toda la lógica de dinero vive en `domain/`**, sin React. Así se prueba fácil y no se rompe al cambiar el diseño.

---

## 4. Modelo de datos

**accounts**
```
id, name, type ('cash' | 'debit' | 'credit' | 'savings'),
currency ('MXN' | 'USD'), balance, color,
yieldTiers: [{ upTo, rate }] | null,   // solo débito/ahorro
yieldCapBase: 'balance' | 'principal',
parentId (para cajitas dentro de Nu),
credit: { limit, cutDay, payDay } | null
```

**movements**
```
id, type ('income' | 'expense' | 'transfer'),
amount, currency, fxRate (al momento de registrar),
accountId, toAccountId (transferencias),
categoryId, date, note,
msi: { months, startDate, monthlyAmount } | null,
fixedId (si viene de un gasto fijo), createdAt
```

**categories**: `id, name, type, icon, color`

**budgets**: `id, categoryId, monthlyLimit`

**fixedExpenses**: `id, name, amount, categoryId, accountId, dayOfMonth, active`

**holdings (inversiones)**
```
id, kind ('crypto' | 'stock'), symbol, name,
quantity, avgCost, costCurrency, priceSourceId
```

**priceCache**: `symbol, price, currency, change24h, fetchedAt`

**settings**: moneda base, tipo de cambio manual o automático, última fecha de respaldo.

---

## 5. Lógica clave

### 5.1 Rendimientos por tramos

Fórmula diaria: `interés_dia = Σ (monto en cada tramo × tasa del tramo / 365)`

Cuentas configuradas con tus datos:

| Cuenta | Tramos |
|---|---|
| **Nu, Cajita Turbo** | 13% sobre un depósito de hasta $25,000. Los intereses generados se capitalizan y **siguen rindiendo al 13%** (interés compuesto), aunque el saldo total pase de $25,000 |
| **Nu, otras cajitas** | 7% sin límite |
| **Revolut** | 15% de $0 a $25,000, 7% de $25,001 a $1,000,000 |
| **Mercado Pago** | 12% hasta $25,000, 6% el excedente |
| **BBVA (débito)** | Sin rendimiento (0%), editable si tiene alguno |

**Cómo se modela la Cajita Turbo:** la app separa el *capital depositado* (tope $25,000 a tasa alta) de los *intereses acumulados* (siempre al 13%). Cada día: `interés = (capital con tasa alta + intereses acumulados) × 13% / 365`, y ese interés se suma a lo acumulado. Con capitalización diaria, el 13% nominal equivale a unos 13.9% al año; la app te muestra ambos números. Si intentas depositar capital arriba de $25,000 en la Turbo, te avisa y te sugiere moverlo a otra cajita al 7%.

La app muestra:
- Rendimiento estimado diario, mensual y anual.
- "Te faltan $X para llegar al tope de $25,000".
- Aviso si te pasaste del tope (ya no rinde la tasa alta en ese excedente).

Las tasas son editables en cada cuenta, porque cambian con frecuencia. Los números son **estimados**, no los intereses oficiales del banco.

### 5.2 Tarjetas de crédito y MSI

- **Disponible** = límite − deuda actual − mensualidades MSI pendientes.
- Un gasto a MSI de $12,000 a 12 meses crea 12 mensualidades de $1,000; solo la mensualidad del mes entra al pago del periodo, pero **todo el monto** reduce tu crédito disponible.
- **Corte:** una compra antes del día de corte entra al estado de cuenta actual; después del corte, al siguiente.
- Panel por tarjeta: próximo corte, próxima fecha límite de pago, MSI activos (con barra "pago 3 de 12") y deuda MSI restante.
- Pagar la tarjeta desde débito se registra como **transferencia** (no cuenta como gasto, para no duplicar).

### 5.3 Transferencias
No afectan ingresos ni gastos; solo mueven saldo entre cuentas (por ejemplo, retirar de Nu al efectivo).

### 5.4 Multi-moneda
- Cada cuenta tiene su moneda. Cada movimiento guarda el tipo de cambio del día.
- El Panorama convierte todo a MXN para sumar.
- Tipo de cambio automático desde internet, con valor manual de respaldo si no hay conexión.

### 5.5 Inversiones
- Capturas tus posiciones (símbolo, cantidad, costo promedio).
- Acciones iniciales: **Netflix (NFLX), Intel (INTC), AMD (AMD) y NVIDIA (NVDA)**, todas cotizan en dólares (USD) en bolsas de EE. UU. Su valor se convierte a MXN con el tipo de cambio.
- La app consulta precios por internet: **CoinGecko** para criptos (gratis, sin llave) y **Finnhub** para acciones (plan gratuito con API key personal, que pegas una vez en Ajustes y se guarda solo en tu dispositivo). Alternativa de respaldo: Twelve Data. Antes de la fase 9 verificamos los límites vigentes del plan gratuito, porque pueden cambiar.
- Los precios de acciones solo se mueven en horario de mercado; fuera de horario se muestra el último cierre.
- Muestra valor actual, ganancia o pérdida en $ y %, y variación de 24 h.
- Si no hay internet, usa el último precio guardado y lo marca como "desactualizado".

### 5.6 Presupuesto y gastos fijos
- Límite mensual por categoría con barra de progreso (naranja normal, ámbar al 80%, rojo al 100%).
- Gastos fijos mensuales: al abrir la app se generan los del mes que falten y quedan como "pendiente de pagar" hasta que los confirmes.

### 5.7 Detección de la tarjeta usada

Limitación real: la app no tiene acceso a tu banco. Por eso se hace en dos niveles:

- **Fase base (incluida), visual tipo Google Wallet:** al registrar un movimiento ves tus tarjetas como tarjetas físicas en un carrusel o pila, con la sugerida al frente (última usada o por defecto por categoría). Deslizas o tocas la que usaste, y el movimiento queda ligado a esa tarjeta. Cada tarjeta se distingue por su nombre, tipo (crédito/débito), últimos 4 dígitos y un color propio.
- **Fase opcional (al final):** leer las **notificaciones de Android**, tanto de tus apps bancarias como de Google Wallet cuando pagas con el celular, que suelen indicar monto, comercio y la tarjeta usada. Requiere un plugin nativo propio (Kotlin) y que actives el permiso de acceso a notificaciones. Las compras detectadas llegan a una bandeja **"Por confirmar"**, y tú las apruebas con un toque. Si una notificación no trae la tarjeta, se te pregunta con el mismo selector visual.

---

## 6. Diseño

Se genera con la skill **ui-ux-pro-max** en la fase 1. Dirección base:

- Fondo negro profundo (`#0A0A0A`), tarjetas en gris muy oscuro, bordes sutiles.
- Naranja como acento (`#FF7A1A` aproximado) con una escala de tonos para las categorías del donut.
- Rojo reservado para negativo/alertas y verde **no** se usa (todo en naranja y neutros) para mantener la identidad.
- Números con fuente tabular, montos grandes y legibles.
- Íconos SVG, transiciones de 150 a 300 ms, estados de foco visibles, `prefers-reduced-motion` respetado.
- Áreas táctiles de mínimo 44 px, pensado primero para móvil y luego adaptado a escritorio.
- Revisión final con el checklist de la skill (contraste 4.5:1, sin scroll horizontal, probado en 375 / 768 / 1024 / 1440 px).

---

## 7. Pasos de construcción

### Fase 0: Preparar el entorno
```bash
node --version        # 20 o superior
npm create vite@latest finanzas -- --template react
cd finanzas
npm install
npm install react-router-dom zustand dexie recharts lucide-react date-fns
npm install tailwindcss @tailwindcss/vite
npm install -D vitest
```
Instala Android Studio y habilita la depuración USB en tu celular.

### Fase 1: Sistema de diseño
- Instala la skill ui-ux-pro-max siguiendo el README de su repositorio.
- Genera y guarda el sistema:
  ```bash
  python3 skills/ui-ux-pro-max/scripts/search.py "fintech personal finance dashboard dark minimal orange" --design-system --persist -p "Finanzas"
  ```
- Ajusta los tokens (negro/naranja) en `index.css`.
- **Entregable:** `design-system/MASTER.md` y paleta lista.

### Fase 2: Base de la app
- Dexie con el esquema, `seed.js` con categorías y las cuentas iniciales (crédito: Nu, Revolut, Mercado Pago; débito: Nu, Revolut, Mercado Pago, BBVA; efectivo).
- Layout, `BottomNav` con 3 pestañas y rutas.
- **Entregable:** app que navega entre 3 pantallas vacías con el tema aplicado.

### Fase 3: Cuentas
- CRUD de cuentas: efectivo, débito/ahorro, crédito.
- Configuración de tramos de rendimiento.
- **Entregable:** pantalla Cuentas con saldos y patrimonio.

### Fase 4: Registrar movimientos
- Formulario con ingreso, gasto y transferencia.
- Sugerencia de cuenta, edición y deshacer.
- Actualización de saldos por cada movimiento.
- **Entregable:** puedes registrar tu día completo.

### Fase 5: Panorama
- `periods.js` y `summaries.js` (con pruebas).
- Filtro de periodo, tarjetas resumen, donut, tendencia, comparativa e historial.
- **Entregable:** panorama completo funcionando con datos reales.

### Fase 6: Rendimientos
- `yield.js` con pruebas de cada cuenta (Nu, Revolut, Mercado Pago).
- Panel de rendimiento y "te falta para el tope".
- **Entregable:** rendimiento estimado por cuenta.

### Fase 7: Crédito y MSI
- `creditCards.js` y `msi.js` con pruebas.
- Panel de tarjeta, formulario MSI y pago de tarjeta como transferencia.
- **Entregable:** control completo de tarjetas.

### Fase 8: Presupuestos y gastos fijos
- Presupuesto por categoría con alertas.
- Gastos fijos mensuales con generación automática.
- **Entregable:** presupuesto y fijos en el Panorama.

### Fase 9: Inversiones y tipo de cambio
- `prices.js` (CoinGecko y acciones), `fx.js`, caché de precios.
- Pantalla de inversiones y patrimonio total.
- **Entregable:** portafolio con precios en vivo.

### Fase 10: Respaldo y recordatorios
- Exportar e importar JSON y CSV (Filesystem + Share).
- Notificaciones locales para fecha de pago y corte de tarjetas.
- **Entregable:** no pierdes datos y no se te pasan los pagos.

### Fase 11: Empaquetar para Android
```bash
npm install @capacitor/core @capacitor/android
npm install -D @capacitor/cli
npx cap init
npm run build
npx cap add android
npx cap sync
npx cap open android      # Ejecutar desde Android Studio a tu celular
```
Para un APK instalable: en Android Studio, *Build → Generate Signed Bundle / APK*.
- **Entregable:** app instalada en tu celular.

### Fase 12 (opcional): Extras
- Detección por notificaciones bancarias (plugin nativo).
- Versión de escritorio con Tauri.
- Meta de ahorro.

---

## 8. Decisiones confirmadas y supuestos

**Confirmado contigo**
1. **Nu, Cajita Turbo:** capital con tasa alta hasta $25,000; los intereses se capitalizan y siguen al 13%.
2. **Acciones:** NFLX, INTC, AMD y NVDA (USD), precios por Finnhub.
3. **Criptos:** Bitcoin (BTC) y Ethereum (ETH), precios por CoinGecko.
4. **BBVA débito:** sin rendimiento (0%).
5. **Colores de tarjeta:** colores oficiales de cada banco (aproximados, editables), sin logos oficiales:

| Tarjeta | Color base aproximado |
|---|---|
| Nu | Morado `#820AD1` |
| Revolut | Negro / azul `#191C1F` con acento `#0666EB` |
| Mercado Pago | Azul claro `#009EE3` |
| BBVA | Azul oscuro `#072146` con acento `#1973B8` |
| Efectivo | Naranja de la app |

El resto de la interfaz sigue en negro y naranja; los colores de banco solo viven dentro de las tarjetas. Se revisa el contraste del texto sobre cada color (mínimo 4.5:1).

**Supuestos míos**
1. Capitalización diaria (tasa anual / 365) en todas las cuentas; es una estimación.
2. Revolut y Mercado Pago están en pesos mexicanos.
3. MSI sin intereses, mensualidades iguales.
4. Inversiones con captura manual de posiciones; la app solo actualiza precios.
5. Moneda base MXN, con USD como segunda moneda.
6. Capital en la Turbo arriba de $25,000: la app avisa y sugiere otra cajita al 7%.

## 9. Pendientes menores (se resuelven dentro de la app)

- Límite, fecha de corte y fecha de pago de cada tarjeta de crédito: los capturas al configurarlas.
- Lista final de categorías: se ajusta en Ajustes.
- Meta de ahorro: incluida como extra en la fase 12.
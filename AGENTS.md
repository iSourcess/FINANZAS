# AGENTS.md: reglas permanentes del proyecto Finanzas

App personal de finanzas para Android (después escritorio). React + JSX, datos solo en el dispositivo.

## Antes de cada tarea

1. Lee `docs/PLAN.md` (plan completo) y este archivo.
2. Lee `design-system/MASTER.md` antes de tocar cualquier UI.
3. Trabaja **solo la fase o tarea que se te pide**. No adelantes fases futuras ni refactorices código ajeno a la tarea.
4. Si algo del plan es ambiguo o contradictorio, **pregunta antes de inventar**.

## Stack (no cambiar sin preguntar)

- React + **JSX** (sin TypeScript), Vite
- Tailwind CSS
- React Router con **HashRouter** (la app corre dentro de Capacitor)
- Zustand para estado, Dexie (IndexedDB) para datos
- Recharts para gráficas, lucide-react para íconos, date-fns para fechas
- Capacitor para Android, Vitest para pruebas

## Estructura

```
src/db/          Esquema Dexie y seed
src/store/       Stores de Zustand
src/domain/      Lógica pura de dinero (SIN React, SIN acceso a la base de datos)
src/services/    Precios, tipo de cambio, respaldo, notificaciones
src/pages/       Register, Overview, Accounts, Settings
src/components/  layout, wallet, charts, forms, ui
src/lib/         format.js, constants.js
tests/           Pruebas de domain/
```

## Reglas de código

- **Toda la lógica de dinero va en `src/domain/`**: funciones puras, sin React, sin efectos secundarios. Cada función de `domain/` lleva pruebas en `tests/`.
- **Montos en centavos enteros** (por ejemplo, $125.50 se guarda como `12550`). Se convierte a pesos solo al mostrar, con `lib/format.js`. Los cálculos con decimales (rendimientos, conversión de moneda) se redondean al centavo al guardar el resultado.
- Las fechas se guardan como texto ISO (`YYYY-MM-DD`) para movimientos y como ISO completo para `createdAt`.
- Componentes funcionales con hooks. Un componente por archivo. Props claras.
- Los componentes de UI **no calculan dinero**: llaman a funciones de `domain/` o a selectores del store.
- Toda llamada a internet vive en `src/services/` y debe manejar: sin conexión, error y límite de uso. Nunca romper la app si falla.
- Envuelve en `try/catch` toda lectura o escritura a la base de datos y muestra un mensaje claro al usuario si falla.
- Textos de la interfaz en **español (México)**. Nombres de variables y funciones en inglés.
- Comentarios solo donde la lógica no sea obvia (fórmulas de rendimiento, cortes de tarjeta, MSI).

## Reglas de diseño

- Tema: **fondo negro y acento naranja**. Usa **solo tokens de color** definidos en `src/index.css` (variables CSS o tema de Tailwind). Prohibido poner colores hexadecimales sueltos en los componentes.
- Excepción: los colores oficiales de cada banco viven **solo dentro de las tarjetas de la billetera** (`components/wallet/`) y están definidos en `lib/constants.js`.
- Íconos: **SVG con lucide-react**. Nunca emojis como íconos.
- Móvil primero (375 px), luego adaptar a 768 / 1024 / 1440 px. Sin scroll horizontal.
- Áreas táctiles de mínimo 44 px. Estados de foco visibles. Respetar `prefers-reduced-motion`.
- Contraste de texto mínimo 4.5:1 (incluido el texto sobre las tarjetas de colores de banco).
- Ningún estado se comunica solo con color: añade ícono o texto (por ejemplo, balance negativo = rojo + ícono + signo).
- Transiciones de 150 a 300 ms.

## Reglas de dominio financiero

- **Transferencia** entre cuentas: mueve saldo, **no cuenta** como ingreso ni gasto. Pagar una tarjeta de crédito desde débito es una transferencia.
- **Gasto en tarjeta de crédito**: aumenta la deuda de esa tarjeta.
- **MSI**: sin intereses, mensualidades iguales. Solo la mensualidad del mes entra al pago del periodo, pero el **monto total** reduce el crédito disponible.
- **Corte de tarjeta**: compra con fecha anterior o igual al día de corte entra al estado de cuenta actual; posterior, al siguiente.
- **Disponible de crédito** = límite − deuda actual − mensualidades MSI pendientes.
- **Rendimientos**: por tramos, capitalización diaria (`tasa / 365`). Son estimaciones y la interfaz debe decirlo ("estimado").
- **Nu Cajita Turbo**: separar capital depositado (tope $25,000 a 13%) de intereses acumulados (siempre al 13%, compuesto). Capital arriba del tope: avisar y sugerir otra cajita al 7%.
- **Multi-moneda**: MXN base, USD secundaria. Cada movimiento guarda el tipo de cambio del día. El Panorama convierte todo a MXN.
- **Inversiones**: BTC y ETH (CoinGecko), NFLX, INTC, AMD y NVDA (Finnhub, en USD). Sin internet, usar el último precio guardado y marcarlo como desactualizado.
- La API key de Finnhub se guarda **solo en el dispositivo** (ajustes locales). Nunca en el código ni en el repositorio.

## Definición de terminado (al cierre de cada tarea)

1. `npm test` pasa.
2. `npm run build` pasa sin errores.
3. No hay colores sueltos, emojis como íconos ni `console.log` olvidados.
4. Reporta: archivos creados o modificados, decisiones tomadas, y qué quedó pendiente.
5. **No hagas commit**; el usuario revisa y lo hace.

## Prohibido

- Cambiar el stack, agregar librerías grandes o migrar a TypeScript sin preguntar.
- Subir o escribir datos personales, llaves o respaldos al repositorio.
- Borrar o reescribir archivos fuera del alcance de la tarea.
- Inventar tasas, datos de bancos o precios: usa los del plan o pregunta.
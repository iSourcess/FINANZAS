# Prompts por fase para OpenCode

## Cómo usar este archivo

1. Copia `PLAN_APP_FINANZAS.md` a `docs/PLAN.md` y `AGENTS.md` a la raíz del proyecto.
2. Haz **una fase a la vez**: pega el prompt, revisa lo que hizo, prueba la app y haz commit antes de pasar a la siguiente.
3. Para cada fase, empieza en **modo plan** (OpenCode suele alternarlo con la tecla Tab; confírmalo en su documentación): pide que proponga qué va a hacer, revisa y luego autoriza que lo ejecute.
4. Si una fase sale mal, revierte con git y repite el prompt con más detalle.
5. Si el agente se desvía, recuérdale: *"Solo la fase indicada, nada más. Lee AGENTS.md."*

Prefijo común (ya está incluido en cada prompt):
> Lee `docs/PLAN.md` y `AGENTS.md`.

---

## Fase 0: Entorno

Esta fase la haces tú, casi toda a mano (instalar Node, Android Studio, etc.). Si quieres que el agente te ayude:

```
Lee docs/PLAN.md y AGENTS.md. Ejecuta SOLO la Fase 0.
El proyecto Vite + React ya existe. Instala las dependencias del plan:
react-router-dom, zustand, dexie, recharts, lucide-react, date-fns, tailwindcss,
@tailwindcss/vite y vitest (como dependencia de desarrollo).
Configura el plugin de Tailwind en vite.config.js y agrega el script "test": "vitest run"
en package.json. Confirma que `npm run dev` y `npm run build` funcionan.
No crees nada más. Al terminar, dime qué cambiaste.
```

---

## Fase 1: Sistema de diseño

Genera el sistema de diseño tú mismo con la skill (o su script de Python) y deja `design-system/MASTER.md` en el proyecto. Después:

```
Lee docs/PLAN.md, AGENTS.md y design-system/MASTER.md. Ejecuta SOLO la Fase 1.
Convierte el sistema de diseño en tokens dentro de src/index.css (variables CSS y tema de Tailwind):
- Fondo negro profundo, superficies en gris muy oscuro, bordes sutiles.
- Naranja como único acento, con una escala de tonos para las categorías del donut.
- Rojo solo para negativo y alertas.
- Tipografía del design system, con números tabulares para montos.
Crea src/lib/constants.js con los colores oficiales de cada tarjeta (Nu #820AD1,
Revolut #191C1F con acento #0666EB, Mercado Pago #dfdb14ff, BBVA #072146 con acento #1973B8,
Efectivo en naranja de la app).
Crea una página temporal de muestra con los tokens (botones, tarjetas, texto) para que yo valide
la paleta, y marca claramente que es temporal. No construyas pantallas reales.
```

---

## Fase 2: Base de la app

```
Lee docs/PLAN.md y AGENTS.md. Ejecuta SOLO la Fase 2 (base de la app).
- src/db/database.js: esquema de Dexie con las tablas del modelo de datos del plan
  (accounts, movements, categories, budgets, fixedExpenses, holdings, priceCache, settings).
  Montos en centavos enteros.
- src/db/seed.js: categorías iniciales (gasto: Comida, Transporte, Casa, Servicios, Salud, Ocio,
  Compras, Educación, Otros; ingreso: Sueldo, Extras, Otros) y cuentas iniciales
  (crédito: Nu, Revolut, Mercado Pago; débito: Nu, Revolut, Mercado Pago, BBVA; efectivo).
  El seed solo corre si la base está vacía.
- Layout con BottomNav de 3 pestañas (Registrar, Panorama, Cuentas) y un ícono de engrane
  hacia Ajustes. HashRouter. Páginas vacías con título.
- Usa los tokens de color de src/index.css.
No implementes formularios, gráficas ni lógica de dominio. Al terminar, corre npm run build
y lista los archivos creados.
```

---

## Fase 3: Cuentas

```
Lee docs/PLAN.md, AGENTS.md y design-system/MASTER.md. Ejecuta SOLO la Fase 3 (cuentas).
- Store useAccounts con CRUD sobre Dexie.
- Billetera visual estilo Google Wallet en components/wallet/ (CardStack, WalletCard):
  tarjetas apiladas con color oficial de cada banco, nombre, tipo (crédito/débito),
  últimos 4 dígitos y saldo o deuda. Al tocar una se abre su detalle.
- AccountForm para crear y editar cuentas, con tramos de rendimiento editables (yieldTiers)
  y datos de crédito (límite, día de corte, día de pago).
- Pantalla Cuentas con la billetera arriba y el patrimonio total (efectivo + débito − deuda).
- Verifica el contraste del texto sobre cada color de banco.
Todavía NO calcules rendimientos ni MSI. Al terminar, corre npm run build.
```

---

## Fase 4: Registrar movimientos

```
Lee docs/PLAN.md y AGENTS.md. Ejecuta SOLO la Fase 4 (registrar movimientos).
- Store useMovements con CRUD sobre Dexie.
- MovementForm: selector Ingreso / Gasto / Transferencia, monto (AmountInput con teclado
  numérico), moneda MXN/USD, categoría con ícono, fecha (hoy por defecto) y nota.
- CardPicker: selector visual de tarjeta (carrusel de WalletCard), con la sugerida
  preseleccionada (última usada o por defecto de la categoría).
- Cada movimiento actualiza el saldo de la cuenta. Transferencias mueven saldo sin contar
  como ingreso ni gasto.
- Lista "movimientos de hoy" con editar, borrar y deshacer (Toast con botón Deshacer).
- Guarda el tipo de cambio al registrar en USD (por ahora un valor manual en Ajustes).
No hagas MSI ni gastos fijos todavía. Escribe pruebas para cualquier función nueva de domain/.
Al terminar corre npm test y npm run build.
```

---

## Fase 5: Panorama

```
Lee docs/PLAN.md, AGENTS.md y design-system/MASTER.md. Ejecuta SOLO la Fase 5 (Panorama).
Primero en src/domain/ con pruebas en tests/:
- periods.js: semana, mes, año, todo y rango personalizado (lunes como inicio de semana),
  y cálculo del periodo anterior equivalente.
- summaries.js: ingresos, gastos, balance, gasto por categoría, tendencia por semana o mes,
  y comparativa con el periodo anterior. Excluye transferencias. Convierte USD a MXN.
Después la UI:
- PeriodFilter arriba (Semana · Mes · Año · Todo · Rango).
- Tarjetas resumen (ingresos, gastos, balance con ícono y texto, no solo color).
- DonutChart de gastos por categoría en tonos naranja, TrendChart de ingresos vs. gastos.
- Historial de movimientos con búsqueda y filtros por categoría y tipo.
Deja los bloques de presupuesto y gastos fijos como secciones vacías con título.
Al terminar corre npm test y npm run build.
```

---

## Fase 6: Rendimientos

```
Lee docs/PLAN.md y AGENTS.md. Ejecuta SOLO la Fase 6 (rendimientos).
En src/domain/yield.js con pruebas completas en tests/yield.test.js:
- Rendimiento por tramos con capitalización diaria (tasa / 365).
- Nu Cajita Turbo: capital hasta $25,000 y intereses acumulados, ambos al 13% compuesto.
  Capital arriba del tope: devuelve una advertencia.
- Nu otras cajitas 7%; Revolut 15% hasta $25,000 y 7% hasta $1,000,000;
  Mercado Pago 12% hasta $25,000 y 6% el excedente; BBVA 0%.
- Funciones: interés diario, mensual estimado, anual estimado (nominal y efectivo),
  y cuánto falta para llegar al tope de cada tramo.
UI: panel de rendimiento en el detalle de cada cuenta de débito, con "estimado" visible,
y aviso de tope. Configura las tasas iniciales en el seed (editables en AccountForm).
Pruebas con casos conocidos calculados a mano. Al terminar corre npm test y npm run build.
```

---

## Fase 7: Crédito y MSI

```
Lee docs/PLAN.md y AGENTS.md. Ejecuta SOLO la Fase 7 (crédito y MSI).
En src/domain/ con pruebas:
- creditCards.js: estado de cuenta actual y siguiente según día de corte, próxima fecha
  de pago, deuda actual y disponible (límite − deuda − MSI pendientes).
- msi.js: dado un gasto, meses y fecha, genera el plan de mensualidades iguales
  (el último absorbe el redondeo), mensualidades pagadas, restantes y deuda MSI restante.
UI:
- En MovementForm, si la cuenta es de crédito, opción "A meses sin intereses"
  (3, 6, 9, 12, 18, 24).
- Panel de tarjeta con próximo corte, fecha límite de pago, MSI activos con barra
  "pago 3 de 12" y deuda MSI restante.
- Pagar una tarjeta desde débito se registra como transferencia.
Al terminar corre npm test y npm run build.
```

---

## Fase 8: Presupuestos y gastos fijos

```
Lee docs/PLAN.md y AGENTS.md. Ejecuta SOLO la Fase 8.
- Store useBudgets y domain con pruebas: gastado vs. límite por categoría y nivel de alerta
  (normal, 80% ámbar, 100% rojo).
- BudgetBar en el Panorama, con ícono y texto además del color.
- Gastos fijos mensuales (domain/recurring.js con pruebas): al abrir la app se generan los
  del mes que falten como "pendiente de pagar"; el usuario los confirma con un toque.
  No duplicar si ya se generaron.
- Pantallas en Ajustes para administrar presupuestos y gastos fijos.
- Completa las secciones de presupuesto y gastos fijos del Panorama.
Al terminar corre npm test y npm run build.
```

---

## Fase 9: Inversiones y tipo de cambio

```
Lee docs/PLAN.md y AGENTS.md. Ejecuta SOLO la Fase 9.
- services/prices.js: criptos (Bitcoin y Ethereum) con CoinGecko sin llave; acciones
  NFLX, INTC, AMD y NVDA con Finnhub usando una API key que el usuario pega en Ajustes
  (guardada solo en el dispositivo). Verifica en la documentación oficial los endpoints y
  límites vigentes antes de implementar; no los supongas.
- services/fx.js: tipo de cambio USD/MXN con valor manual de respaldo.
- Caché en priceCache: sin internet usa el último precio y lo marca "desactualizado".
  Maneja errores y límites de uso sin romper la app.
- Pantalla Inversiones en Cuentas: posiciones (símbolo, cantidad, costo promedio),
  valor actual, ganancia o pérdida en $ y %, y variación de 24 h.
- domain/netWorth.js con pruebas: patrimonio total = efectivo + débito + inversiones − deuda.
Al terminar corre npm test y npm run build.
```

---

## Fase 10: Respaldo y recordatorios

```
Lee docs/PLAN.md y AGENTS.md. Ejecuta SOLO la Fase 10.
- services/backup.js: exportar toda la base a JSON y los movimientos a CSV; importar JSON
  con validación y confirmación antes de reemplazar datos.
- En Android usar los plugins de Capacitor Filesystem y Share (instálalos).
- services/notifications.js con Local Notifications: recordatorio de fecha de pago y de corte
  de cada tarjeta de crédito, y de gastos fijos pendientes.
- Pantalla de Ajustes con botones de respaldo y la fecha del último respaldo.
Al terminar corre npm test y npm run build.
```

---

## Fase 11: Empaquetar para Android

```
Lee docs/PLAN.md y AGENTS.md. Ejecuta SOLO la Fase 11.
Instala y configura Capacitor (core, cli, android), crea capacitor.config.json con el nombre
de la app, agrega la plataforma android y sincroniza. Confirma que el build de Vite
y `npx cap sync` terminan sin errores. Configura el ícono, el splash en negro con acento naranja
y la barra de estado oscura. Dime los pasos exactos para correrla en mi emulador o celular
desde Android Studio. No modifiques la lógica de la app.
```

---

## Fase 12 (opcional): Extras

Pide cada extra por separado.

```
Lee docs/PLAN.md y AGENTS.md. Ejecuta SOLO: meta de ahorro.
Meta con nombre, monto objetivo y fecha opcional, aportes vinculados a una cuenta,
barra de progreso en el Panorama. Lógica en domain/ con pruebas.
```

```
Lee docs/PLAN.md y AGENTS.md. En modo plan, propón (sin implementar) cómo hacer la detección
de compras por notificaciones de Android (apps bancarias y Google Wallet): plugin nativo en Kotlin,
permiso de acceso a notificaciones, bandeja "Por confirmar" y parseo por app de origen.
Incluye riesgos, pasos y qué archivos tocarías.
```

---

## Prompts de rescate

**Se desvió del alcance:**
```
Detente. Solo debías hacer la fase indicada. Revierte los cambios que no pertenezcan
a esa fase y dime qué tocaste de más.
```

**Colores sueltos o emojis:**
```
Revisa todo src/ y reemplaza colores hexadecimales sueltos por tokens de src/index.css
(excepto los colores de banco en components/wallet/) y cualquier emoji usado como ícono
por íconos de lucide-react. Lista los cambios.
```

**Revisión de calidad antes de commit:**
```
Revisa los cambios de esta fase contra AGENTS.md y el checklist de design-system/MASTER.md.
Reporta incumplimientos (contraste, áreas táctiles, scroll horizontal, lógica de dinero fuera
de domain/, falta de pruebas). No arregles nada aún; solo lista.
```
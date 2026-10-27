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

```
Lee docs/PLAN.md, AGENTS.md y design-system/MASTER.md. Tarea: reordenar tarjetas de la billetera
con pulsación larga. No cambies lógica financiera. Antes de empezar, dime qué archivos tocarás.

1. Dependencias: @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/modifiers, @dnd-kit/utilities.

2. Base de datos (tengo datos reales, NO los pierdas):
   - Nueva versión de Dexie que agrega el campo indexado sortOrder a accounts.
   - Migración con upgrade(): asigna sortOrder siguiendo el orden de visualización actual
     (débito, crédito, efectivo).
   - Cuentas nuevas reciben sortOrder = máximo + 1. Actualiza seed.js y el store useAccounts
     para ordenar siempre por sortOrder.
   - Verifica que el respaldo JSON (si ya existe) incluya sortOrder.

3. Lógica pura en src/domain/accountOrder.js con pruebas en tests/accountOrder.test.js:
   reorderAccounts(allAccounts, activeId, overId, visibleIds) devuelve la lista completa
   con sortOrder reasignado de 0 a n−1. Si hay filtro (visibleIds es un subconjunto),
   solo se reordenan las visibles entre las posiciones que ya ocupaban; las ocultas no se mueven.
   Casos: mover primero al último, último al primero, vecinos, con filtro, id inexistente
   (devuelve la lista sin cambios).

4. UI en components/wallet/ (CardStack.jsx y WalletCard.jsx):
   - DndContext con sensores: PointerSensor y TouchSensor con activationConstraint
     { delay: 400, tolerance: 8 }, y KeyboardSensor. Modificador restrictToVerticalAxis
     y autoScroll activado.
   - SortableContext con verticalListSortingStrategy. Funciona en la vista apilada
     (tarjetas encimadas) y en la vista separada, con el MISMO orden.
   - Al activarse el arrastre: la tarjeta se levanta (escala 1.03, sombra más profunda, z-index
     superior), con un temblor suave de 1.5° de rotación en bucle mientras está levantada,
     y navigator.vibrate(10) si está disponible (con try/catch).
   - Respetar prefers-reduced-motion: sin temblor, solo elevación y sombra.
   - El toque corto sigue abriendo el detalle; un arrastre o pulsación larga NO debe abrir el
     detalle al soltar.
   - El scroll vertical de la pantalla debe seguir funcionando con un deslizamiento normal.
   - Al soltar: guardar el nuevo orden con una sola transacción de Dexie y un toast
     "Orden guardado" con opción Deshacer.
   - Alternativa sin gestos: botones "Subir" y "Bajar" en AccountDetailModal.

5. El carrusel de CardPicker en Registrar debe usar el mismo orden (sortOrder).

6. Colores solo desde tokens, íconos con lucide-react, áreas táctiles de 44 px.

Al terminar corre npm test, npm run build y npm run lint (0 warnings), y lista los archivos
modificados. NO hagas commit.

```

```
 Lee docs/PLAN.md, AGENTS.md y design-system/MASTER.md. Tarea: pulido de UI. No cambies lógica de dominio salvo lo indicado.

1. Panorama: cuando el periodo anterior no tiene datos (total 0), no muestres "+100%";
   muestra "Sin datos del periodo anterior". Ajusta domain/summaries.js y agrega pruebas.
2. Mostrar siempre el tipo de cuenta ("Revolut · Crédito") en: lista de gastos fijos,
   formularios, selectores e historial. Crea un helper en lib/format.js (accountLabel).
3. Gastos fijos: verifica que exista forma de confirmar un gasto "pendiente" del mes.
   Si no existe, agrégala. Íconos de editar y borrar con área táctil de 44 px; borrar con
   confirmación. Muestra los nombres como están guardados (sin forzar mayúsculas).
4. Registrar: deja un solo scroll en la pantalla (sin scroll anidado en categorías) y un botón
   Guardar fijo encima de la barra inferior. Confirma que fecha y nota sean accesibles.
5. Cuentas: deja un solo botón "Nueva cuenta". Ordena la pila: débito, crédito, efectivo.
   Diferencia visualmente las tarjetas de crédito de las de débito de la misma marca.
6. Tarjetas: evita que el nombre se corte ("MERCADO PAGO"). Las tarjetas no seleccionadas
   del carrusel no deben alterar el color de marca (atenúa sin cambiar el tono).
7. BottomNav: el anillo de foco solo con :focus-visible y con esquinas redondeadas.
8. Revisa el contraste de textos grises secundarios; súbelos a 4.5:1 mínimo usando tokens.
9. Gastos fijos: el botón "Pagar" debe crear el movimiento con fixedId. Un gasto fijo cuenta como
   pagado si existe un movimiento con ese fixedId en el mes. Para los ya registrados a mano,
   agrega la acción "Ya lo pagué" que lo marca como pagado sin crear movimiento ni modificar saldos.
10. DonutChart: dos categorías no pueden tener el mismo color. Define una paleta de 9 tonos
   distinguibles dentro de los tokens (naranjas, ámbar y neutros claros) o usa etiquetas directas.
11. WalletCard: los últimos 4 dígitos no deben partirse en otra línea; el nombre no debe cortarse
   (reduce la fuente o usa un nombre corto).
12. creditCards.js: calcular daysToCut y daysToPay con differenceInCalendarDays de date-fns
   (hoy da 1 día de más por comparar medianoche con mediodía). Pruebas con referencia a las
   00:01 y a las 23:59 del mismo día.
13. Fechas locales: ninguna función debe usar toISOString() para generar fechas de movimientos o
   de periodo (da la fecha UTC). Usa format(date, 'yyyy-MM-dd') en hora local. Prueba: con
   la hora local a las 21:00 en UTC-6, el formulario debe mostrar la fecha de hoy.
14. YieldPanel de la Cajita Turbo: reemplazar la lista "Tramos y tasas" por tres renglones
   (capital hasta el tope, intereses acumulados, capital excedente) y mostrar capital e intereses
   por separado.


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


Lee docs/PLAN.md, AGENTS.md y design-system/MASTER.md. Modo plan primero: dime qué archivos
tocarás y qué decisiones tomarás ANTES de escribir código.
Reglas:
- Si cambias el esquema de Dexie, crea una versión NUEVA con upgrade() y NO pierdas datos.
  Agrega una prueba de migración con datos de ejemplo (falsos).
- Toda lógica de dinero va en src/domain/ con pruebas. Montos en centavos enteros. Fechas en
  hora local (nada de toISOString).
- Tokens de color, íconos lucide-react, áreas táctiles de 44 px, textos en español (México),
  y estados vacío, cargando y error en toda pantalla nueva.
- Todo texto de monto debe pasar por lib/format.js para respetar el modo privado.
- Si ya existe un archivo con contenido, extiéndelo; no lo reescribas ni dupliques.
- Al terminar: npm test, npm run build y npm run lint (0 warnings). Lista los archivos
  modificados. NO hagas commit.
Tarea: plantillas de movimientos frecuentes.

1. Tabla templates { id, name, type, amountCents|null, currency, categoryId, accountId, note,
   sortOrder, useCount }.
2. domain/templates.js con pruebas: ordenar (por useCount descendente o manual), applyTemplate →
   borrador de movimiento con fecha de hoy, y detectar plantillas inválidas (cuenta o categoría
   eliminada).
3. En Registrar: fila horizontal de chips arriba del formulario (máximo 12 visibles, con
   desplazamiento). Comportamiento al tocar, configurable en Ajustes:
   - 'Rellenar' (por defecto): llena el formulario; si la plantilla no tiene monto, enfoca el
     campo monto.
   - 'Registrar al instante': crea el movimiento de hoy con toast Deshacer.
   Menú "⋯" por chip: editar y eliminar. Incrementa useCount al usarla.
4. "Guardar como plantilla": acción del toast tras registrar un movimiento y opción en el formulario.
5. Ajustes → Plantillas: lista, editar, eliminar, y subir o bajar (botones, sin arrastre).
   Plantillas inválidas con aviso para corregirlas.

```
Lee docs/PLAN.md, AGENTS.md y design-system/MASTER.md. Modo plan primero: dime qué archivos
tocarás y qué decisiones tomarás ANTES de escribir código.
Reglas:
- Si cambias el esquema de Dexie, crea una versión NUEVA con upgrade() y NO pierdas datos.
  Agrega una prueba de migración con datos de ejemplo (falsos).
- Toda lógica de dinero va en src/domain/ con pruebas. Montos en centavos enteros. Fechas en
  hora local (nada de toISOString).
- Tokens de color, íconos lucide-react, áreas táctiles de 44 px, textos en español (México),
  y estados vacío, cargando y error en toda pantalla nueva.
- Todo texto de monto debe pasar por lib/format.js para respetar el modo privado.
- Si ya existe un archivo con contenido, extiéndelo; no lo reescribas ni dupliques.
- Al terminar: npm test, npm run build y npm run lint (0 warnings). Lista los archivos
  modificados. NO hagas commit.
Tarea: ingresos recurrentes (sueldo, quincena, renta cobrada, etc.). Reutiliza el mecanismo de
ocurrencias pendientes de los gastos fijos; si el arreglo de "gasto fijo ya pagado" no existe,
impleméntalo igual para ambos.

1. Tabla recurringIncomes { id, name, amountCents, currency, categoryId, accountId,
   frequency ('monthly' | 'biweekly' | 'weekly'), schedule (monthly: día del mes; biweekly: dos
   días, por defecto 15 y 'último'; weekly: día de la semana), startDate, active } y ocurrencias
   con clave única recurringId + dueDate y estado 'pending' | 'received' | 'skipped'.
2. domain/recurringIncome.js con pruebas: generar ocurrencias pendientes al abrir la app solo
   desde max(startDate, hace 2 meses) hasta hoy, sin duplicar; recorte de día (31 en meses cortos,
   febrero, último día); quincena; semanal; inactivo; startDate futura.
3. Panorama: bloque "Ingresos esperados" con las pendientes. Acciones: "Ya me cayó" (crea el
   ingreso con recurringId, monto editable y fecha de la ocurrencia o de hoy), "Omitir" y "Ya lo
   registré" (marca recibido sin crear movimiento ni tocar saldos). Si existe un ingreso manual
   con misma cuenta y monto en ±3 días de la fecha esperada, sugiere vincularlo.
4. Ajustes: crear, editar, pausar y eliminar. Cada ocurrencia atrasada se marca con ícono y texto
   "Atrasado", no solo color.

```
Lee docs/PLAN.md, AGENTS.md y design-system/MASTER.md. Modo plan primero: dime qué archivos
tocarás y qué decisiones tomarás ANTES de escribir código.
Reglas:
- Si cambias el esquema de Dexie, crea una versión NUEVA con upgrade() y NO pierdas datos.
  Agrega una prueba de migración con datos de ejemplo (falsos).
- Toda lógica de dinero va en src/domain/ con pruebas. Montos en centavos enteros. Fechas en
  hora local (nada de toISOString).
- Tokens de color, íconos lucide-react, áreas táctiles de 44 px, textos en español (México),
  y estados vacío, cargando y error en toda pantalla nueva.
- Todo texto de monto debe pasar por lib/format.js para respetar el modo privado.
- Si ya existe un archivo con contenido, extiéndelo; no lo reescribas ni dupliques.
- Al terminar: npm test, npm run build y npm run lint (0 warnings). Lista los archivos
  modificados. NO hagas commit.
Tarea: deudas y préstamos ("me deben" y "debo").

1. Tablas debts { id, direction ('owed_to_me' | 'i_owe'), person, principalCents, currency,
   openedAt, dueDate|null, note, status ('open' | 'settled') } y debtPayments { id, debtId,
   amountCents, date, accountId|null, adjustmentId|null }.
2. domain/debts.js con pruebas: saldo restante, estado, total "me deben" y "debo" por moneda y
   convertido a MXN (useFx), vencidas, próximas a vencer. Un abono mayor al saldo se rechaza o
   exige confirmación.
3. Efecto en cuentas (opcional por operación): al prestar, pedir prestado o abonar, un interruptor
   "Afectar el saldo de una cuenta" crea un movimiento 'adjustment' (prompt 3) con reason
   loan_given, loan_received, repayment_received o repayment_made y debtId. Es neutro: no cuenta
   como gasto ni ingreso. Borrar un abono revierte su ajuste.
4. Cuentas: nueva pestaña "Deudas" junto a Billetera e Inversiones, con resumen "Me deben $X ·
   Debo $Y · Neto", lista agrupable por persona, barra de progreso por deuda, "Registrar abono",
   "Marcar como saldada", editar y eliminar. Vencidas con ícono y texto.
5. Ajustes: interruptor "Incluir deudas y préstamos en el patrimonio" (apagado por defecto).
   Cuando está activo, netWorth.js suma lo que me deben y resta lo que debo.
6. Expón en domain una función upcomingDebtDue(debts, hoy) que usará el prompt 7 para recordatorios.

```

Lee docs/PLAN.md, AGENTS.md y design-system/MASTER.md. Modo plan primero: dime qué archivos
tocarás y qué decisiones tomarás ANTES de escribir código.
Reglas:
- Si cambias el esquema de Dexie, crea una versión NUEVA con upgrade() y NO pierdas datos.
  Agrega una prueba de migración con datos de ejemplo (falsos).
- Toda lógica de dinero va en src/domain/ con pruebas. Montos en centavos enteros. Fechas en
  hora local (nada de toISOString).
- Tokens de color, íconos lucide-react, áreas táctiles de 44 px, textos en español (México),
  y estados vacío, cargando y error en toda pantalla nueva.
- Todo texto de monto debe pasar por lib/format.js para respetar el modo privado.
- Si ya existe un archivo con contenido, extiéndelo; no lo reescribas ni dupliques.
- Al terminar: npm test, npm run build y npm run lint (0 warnings). Lista los archivos
  modificados. NO hagas commit.
Tarea: sistema unificado de recordatorios (extiende notifications.js de la Fase 10).

1. domain/reminders.js (puro, con pruebas): computeSchedule(settings, estado, hoy) → lista de
   notificaciones { id, canal, fecha y hora, título, cuerpo, ruta } para los próximos 7 días.
   Tipos: registro diario, corte y pago de tarjetas, gastos fijos, ingresos esperados, deudas
   por vencer (upcomingDebtDue) y respaldo semanal.
2. services/notifications.js: función rescheduleAll() que cancela y reprograma todo con
   notificaciones únicas (no repetidas), llamada al abrir la app, al cambiar datos relevantes y al
   cambiar ajustes. Si ya registraste un movimiento hoy, cancela el recordatorio diario de hoy.
3. Android: canales separados (Registro diario, Pagos, Deudas, Respaldo) para silenciarlos por
   separado. Android 13+: pantalla explicativa ANTES de pedir el permiso POST_NOTIFICATIONS y
   manejo de rechazo (cómo activarlo en el sistema). Usa programación no exacta (no pidas
   permiso de alarmas exactas) y dime si los avisos pueden retrasarse unos minutos. Verifica
   que el plugin reprograma tras reiniciar el celular y repórtalo.
4. Privacidad: si el modo privado está activo, el cuerpo de la notificación no incluye montos.
5. Ajustes → Recordatorios: interruptores y hora para cada tipo, con valores por defecto
   sensatos (diario a las 21:00 apagado hasta que el usuario lo active), y botón "Enviar
   notificación de prueba".
6. Al tocar una notificación, navega a su ruta (registrar, detalle de tarjeta, pestaña
   Deudas, etc.) con un manejador reutilizable que el prompt 9 también usará; si la app está
   bloqueada, primero pide desbloqueo y después navega.

```VOY AQUI
Lee docs/PLAN.md, AGENTS.md y design-system/MASTER.md. Modo plan primero: dime qué archivos
tocarás y qué decisiones tomarás ANTES de escribir código.
Reglas:
- Si cambias el esquema de Dexie, crea una versión NUEVA con upgrade() y NO pierdas datos.
  Agrega una prueba de migración con datos de ejemplo (falsos).
- Toda lógica de dinero va en src/domain/ con pruebas. Montos en centavos enteros. Fechas en
  hora local (nada de toISOString).
- Tokens de color, íconos lucide-react, áreas táctiles de 44 px, textos en español (México),
  y estados vacío, cargando y error en toda pantalla nueva.
- Todo texto de monto debe pasar por lib/format.js para respetar el modo privado.
- Si ya existe un archivo con contenido, extiéndelo; no lo reescribas ni dupliques.
- Al terminar: npm test, npm run build y npm run lint (0 warnings). Lista los archivos
  modificados. NO hagas commit.
Tarea: importar movimientos desde CSV. NO supongas el formato de ningún banco: el usuario
mapea las columnas. No hay PDF ni conexión bancaria.

1. Selector de archivo (<input type="file">) y lectura como ArrayBuffer; decodifica UTF-8 y, si
   falla, windows-1252; ignora BOM. Verifica en la documentación qué librería usar (por ejemplo
   Papa Parse) y detecta delimitador (coma, punto y coma, tabulador).
2. Asistente de mapeo: cuenta destino, filas de encabezado a omitir, columna de fecha y su formato
   (dd/MM/yyyy, yyyy-MM-dd, MM/dd/yyyy, dd-MMM-yyyy), descripción, y monto como UNA columna con
   signo O columnas separadas cargo/abono; separador decimal y de miles; opción "invertir signo"
   (típico en tarjetas de crédito); manejo de negativos entre paréntesis.
3. Perfiles guardados por cuenta (tabla importProfiles) para no repetir el mapeo.
4. domain/importer.js con pruebas (y archivos de ejemplo FALSOS en tests/fixtures): parseo,
   normalización de montos como "1.234,56" y "(120.00)", fechas, y detección de duplicados
   (misma cuenta, fecha, monto y descripción normalizada, contra la base y dentro del archivo;
   los duplicados salen desmarcados).
5. Vista previa con tabla: casilla por fila, tipo (gasto / ingreso / ignorar), categoría editable
   por fila. Reglas de categoría (tabla categoryRules: palabra clave → categoría, con "recordar
   regla" y contador de aciertos) que sugieren la categoría. Totales de lo que se va a importar.
6. Importar crea movimientos con importBatchId. Ajustes → Importaciones: historial con
   "Deshacer importación" que borra todo el lote y revierte saldos.
7. Conciliación opcional: el usuario captura el saldo final del estado de cuenta; si difiere del
   saldo de la app, ofrece crear un ajuste (prompt 3).
8. Privacidad: añade imports/ y *.csv de estados de cuenta al .gitignore y avísame. Los archivos
   de prueba deben ser inventados.

```
Lee docs/PLAN.md, AGENTS.md y design-system/MASTER.md. Modo plan primero: dime qué archivos
tocarás y qué decisiones tomarás ANTES de escribir código.
Reglas:
- Si cambias el esquema de Dexie, crea una versión NUEVA con upgrade() y NO pierdas datos.
  Agrega una prueba de migración con datos de ejemplo (falsos).
- Toda lógica de dinero va en src/domain/ con pruebas. Montos en centavos enteros. Fechas en
  hora local (nada de toISOString).
- Tokens de color, íconos lucide-react, áreas táctiles de 44 px, textos en español (México),
  y estados vacío, cargando y error en toda pantalla nueva.
- Todo texto de monto debe pasar por lib/format.js para respetar el modo privado.
- Si ya existe un archivo con contenido, extiéndelo; no lo reescribas ni dupliques.
- Al terminar: npm test, npm run build y npm run lint (0 warnings). Lista los archivos
  modificados. NO hagas commit.
Requisito: Fase 11 terminada (existe android/). Tarea: atajos para registrar rápido.

1. Deep links: esquema finanzas:// (por ejemplo finanzas://register?type=expense). Declara el
   intent-filter en AndroidManifest.xml y maneja el evento appUrlOpen del plugin App de Capacitor,
   también al arrancar la app en frío. Como usamos HashRouter, traduce el enlace a
   #/register?type=expense. Si la app está bloqueada (prompt 1), guarda el destino, pide
   desbloqueo y navega después. Reutiliza el manejador de navegación de notificaciones.
2. Atajos al mantener pulsado el ícono (static shortcuts): res/xml/shortcuts.xml con "Registrar
   gasto", "Registrar ingreso" y "Ver Panorama", con íconos vectoriales y el meta-data en la
   actividad principal.
3. Mosaico del panel de ajustes rápidos (Quick Settings Tile): servicio nativo TileService
   "Registrar gasto" que abre la app con el deep link. Dos rutas según versión de Android
   (en Android 14 el método con Intent está obsoleto; usa la variante con PendingIntent). En
   Ajustes, botón "Agregar al panel" que usa la API de solicitud de mosaico en Android 13+ y,
   si no existe, explica los pasos manuales.
4. Capacitor genera el proyecto en Java: usa Java o Kotlin según lo que requiera menos cambios de
   Gradle, y dime cuál elegiste. Los archivos nativos deben sobrevivir a npx cap sync.
5. Entrega los pasos exactos para probar en emulador y celular, y una pequeña checklist.
Esto no se prueba en navegador. Pruebas unitarias solo del traductor de enlaces (puro).

```
Lee docs/PLAN.md, AGENTS.md y design-system/MASTER.md. Modo plan primero: dime qué archivos
tocarás y qué decisiones tomarás ANTES de escribir código.
Reglas:
- Si cambias el esquema de Dexie, crea una versión NUEVA con upgrade() y NO pierdas datos.
  Agrega una prueba de migración con datos de ejemplo (falsos).
- Toda lógica de dinero va en src/domain/ con pruebas. Montos en centavos enteros. Fechas en
  hora local (nada de toISOString).
- Tokens de color, íconos lucide-react, áreas táctiles de 44 px, textos en español (México),
  y estados vacío, cargando y error en toda pantalla nueva.
- Todo texto de monto debe pasar por lib/format.js para respetar el modo privado.
- Si ya existe un archivo con contenido, extiéndelo; no lo reescribas ni dupliques.
- Al terminar: npm test, npm run build y npm run lint (0 warnings). Lista los archivos
  modificados. NO hagas commit.
Requisito: prompt 9 terminado. Tarea: widget estilo "tarjeta" para la pantalla de inicio.

Contenido: título "Finanzas", dos botones grandes ("+ Gasto" y "+ Ingreso") y, si el usuario lo
permite, "Gastado hoy" y "Balance del mes". Fondo negro con acento naranja, esquinas redondeadas
(usa la dimensión de radio de widgets del sistema en Android 12+). Redimensionable (mínimo 2x1).

1. Nativo: AppWidgetProvider, layout XML con RemoteViews, widget-info XML (updatePeriodMillis al
   mínimo permitido), imagen de vista previa y descripción. Los botones usan PendingIntent
   inmutables que abren los deep links del prompt 9. Elige Java o Kotlin y dime por qué.
2. Puente de datos: la web escribe un snapshot pequeño (Capacitor Preferences, que usa
   SharedPreferences) con { todaySpentCents, monthBalanceCents, currency, updatedAt,
   showAmounts }, calculado con domain/widgetSnapshot.js (puro, con pruebas). El widget lo lee
   de ahí; no puede leer IndexedDB. Verifica el nombre real del archivo de preferencias y la
   forma de las claves en la documentación del plugin.
3. Actualización: un pequeño plugin de Capacitor (WidgetBridge.refresh) que la web llama tras
   cada cambio de movimientos, más la actualización periódica. Regístralo según la versión de
   Capacitor del proyecto.
4. PRIVACIDAD: un widget se ve sin desbloquear la app. Ajuste "Mostrar montos en el widget",
   APAGADO por defecto (muestra solo los botones y "Toca para registrar"). Si el modo privado
   está activo, el widget oculta montos igual.
5. Ajustes: botón "Agregar widget a la pantalla de inicio" con requestPinAppWidget (Android 8+)
   y, si no, instrucciones manuales.
6. Entrega el checklist de pruebas: agregar, redimensionar, tocar cada botón con la app cerrada
   y bloqueada, registrar un gasto y ver el widget actualizarse, modo oscuro, y reinicio del celular.
No se prueba en navegador.

```
Lee docs/PLAN.md, AGENTS.md y design-system/MASTER.md. Modo plan primero: dime qué archivos
tocarás y qué decisiones tomarás ANTES de escribir código.
Reglas:
- Si cambias el esquema de Dexie, crea una versión NUEVA con upgrade() y NO pierdas datos.
  Agrega una prueba de migración con datos de ejemplo (falsos).
- Toda lógica de dinero va en src/domain/ con pruebas. Montos en centavos enteros. Fechas en
  hora local (nada de toISOString).
- Tokens de color, íconos lucide-react, áreas táctiles de 44 px, textos en español (México),
  y estados vacío, cargando y error en toda pantalla nueva.
- Todo texto de monto debe pasar por lib/format.js para respetar el modo privado.
- Si ya existe un archivo con contenido, extiéndelo; no lo reescribas ni dupliques.
- Al terminar: npm test, npm run build y npm run lint (0 warnings). Lista los archivos
  modificados. NO hagas commit.
Tarea: bloqueo de la app y modo privado.

Ajustes (useSettings): lockEnabled, lockTimeout ('inmediato' | '30 s' | '1 min' | '5 min'),
biometricEnabled, hideAmounts, hideInRecents.

1. domain/security.js con pruebas: hash de PIN (4 a 6 dígitos) con PBKDF2 de WebCrypto, sal
   aleatoria y varias iteraciones; verificación; política de intentos fallidos (a partir del 5.º,
   espera creciente de 30 s, 1 min, 5 min), guardando contador y hora del próximo intento. El PIN
   NUNCA se guarda en texto plano.
2. Pantalla de bloqueo a pantalla completa, renderizada ANTES del router, de modo que no se vea
   ningún dato mientras esté bloqueada. Teclado numérico, puntos de avance, mensaje de espera por
   intentos fallidos, y botón de huella si está activada.
3. Huella: verifica en la documentación vigente qué plugin de biometría para Capacitor está
   mantenido (y su permiso en Android) y dime cuál elegiste. La huella es solo un atajo: el PIN
   siempre es el método base para no quedar fuera.
4. Bloqueo automático: al pasar a segundo plano guarda la hora; al volver, si superó
   lockTimeout, muestra el bloqueo. Configurar PIN: pedirlo dos veces. Cambiar o desactivar:
   pide el PIN actual.
5. "Olvidé mi PIN": como los datos son locales, la única salida es borrar los datos de la app y
   restaurar desde un respaldo. Dilo con claridad en la pantalla y en Ajustes, con
   confirmación doble.
6. "Ocultar contenido en apps recientes": verifica qué plugin o ajuste de Android (FLAG_SECURE)
   usar y aplícalo si activo.
7. Modo privado: ícono de ojo en el Header que alterna hideAmounts. Con el modo activo, formatMoney
   devuelve "•••••" en TODO: tarjetas, listas, gráficas (etiquetas y tooltips), centro de la
   dona, widget de divisas (no) y totales. aria-label "Monto oculto". Las inversiones muestran
   porcentajes pero no montos.
8. Texto honesto en Ajustes: "Protege contra acceso casual. Los datos del dispositivo no están
   cifrados."
Pruebas de domain/security.js. Prueba manual: bloqueo tras segundo plano y modo privado en cada
pantalla.

```
Lee docs/PLAN.md, AGENTS.md y design-system/MASTER.md. Modo plan primero: dime qué archivos
tocarás y qué decisiones tomarás ANTES de escribir código.
Reglas:
- Si cambias el esquema de Dexie, crea una versión NUEVA con upgrade() y NO pierdas datos.
  Agrega una prueba de migración con datos de ejemplo (falsos).
- Toda lógica de dinero va en src/domain/ con pruebas. Montos en centavos enteros. Fechas en
  hora local (nada de toISOString).
- Tokens de color, íconos lucide-react, áreas táctiles de 44 px, textos en español (México),
  y estados vacío, cargando y error en toda pantalla nueva.
- Todo texto de monto debe pasar por lib/format.js para respetar el modo privado.
- Si ya existe un archivo con contenido, extiéndelo; no lo reescribas ni dupliques.
- Al terminar: npm test, npm run build y npm run lint (0 warnings). Lista los archivos
  modificados. NO hagas commit.
Tarea: respaldo y restauración (extiende backup.js y la parte de respaldo de la Fase 10).

1. Exportación GENÉRICA: recorre db.tables de Dexie para que cualquier tabla futura entre sola.
   Formato JSON: { app: 'finanzas', formatVersion, schemaVersion: db.verno, exportedAt,
   tables: { nombre: [filas] }, settings }. Excluye por defecto datos secretos: hash y sal del PIN,
   configuración de bloqueo y API keys (opción "incluir mi API key de Finnhub", desactivada).
2. Cifrado opcional con contraseña: PBKDF2 + AES-GCM de WebCrypto; archivo con sal, iv y datos en
   base64. Aviso claro: sin la contraseña no se puede recuperar.
3. Compartir: escribe el archivo con Capacitor Filesystem y ábrelo con la hoja Share (Drive,
   correo, WhatsApp). En navegador, descarga por blob. Nombre: finanzas-AAAA-MM-DD.json
   (o .enc.json si va cifrado).
4. Restaurar: selector de archivo; valida estructura y versión (rechaza un esquema más nuevo que
   el de la app); pide contraseña si está cifrado; muestra vista previa con fecha del respaldo y
   conteo de filas por tabla; modo "Reemplazar todo" (por defecto). Antes de reemplazar guarda
   una copia de seguridad automática (la última) en el almacenamiento de la app, y reemplaza todo
   dentro de UNA transacción de Dexie que revierte si algo falla. Tras restaurar, vuelve a
   calcular lo derivado y avisa.
5. Seguimiento: settings.lastBackupAt, intervalo de recordatorio (7 / 14 / 30 días), banner en
   Panorama y Ajustes ("llevas N días sin respaldar") y llamada a notifications.js para el
   recordatorio semanal (el prompt 7 unificará los horarios).
6. Android: revisa android:allowBackup y las reglas de Auto Backup, y dime si IndexedDB del
   WebView queda incluido. NO lo des por hecho ni lo presentes al usuario como respaldo confiable.
   Investiga si una copia local automática semanal en Documentos funciona sin permisos
   especiales; si no, no la implementes y explícame por qué.
Pruebas: ida y vuelta (exportar e importar da lo mismo), cifrado ida y vuelta, rechazo de archivos
corruptos o de versión futura, y que los secretos no salgan. Usa datos de ejemplo falsos.

```
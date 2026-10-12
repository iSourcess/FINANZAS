# Finanzas

App personal de finanzas para **Android** (y después escritorio), hecha en **React (JSX)**. Los datos se guardan **solo en tu dispositivo**. Diseño limpio en negro y naranja.

## Qué hace

**Tres apartados principales**

- **Registrar**: ingresos, gastos y transferencias del día. Eliges la tarjeta con un selector visual tipo billetera.
- **Panorama**: ingresos, gastos y balance; donut de gastos por categoría; tendencia; presupuesto por categoría; gastos fijos del mes e historial. Filtra por semana, mes, año, todo o rango de fechas.
- **Cuentas**: efectivo, débito con rendimiento, tarjetas de crédito con MSI e inversiones, más el patrimonio total.

**Funciones clave**

- Rendimientos por tramos (Nu Cajita Turbo, Revolut, Mercado Pago) con interés compuesto estimado y aviso del tope.
- Tarjetas de crédito: límite, disponible, corte, fecha de pago y compras a meses sin intereses.
- Inversiones: Bitcoin, Ethereum, NFLX, INTC, AMD y NVDA con precio actualizado desde internet.
- Multi-moneda MXN / USD.
- Presupuestos con alertas al 80% y 100%, y gastos fijos mensuales.
- Comparativa contra el periodo anterior.
- Respaldo: exportar e importar JSON y CSV.

## Tecnologías

| Capa | Herramienta |
|---|---|
| UI | React + JSX (Vite) |
| Estilos | Tailwind CSS |
| Rutas | React Router (HashRouter) |
| Estado | Zustand |
| Datos locales | Dexie (IndexedDB) |
| Gráficas | Recharts |
| Íconos | lucide-react |
| Fechas | date-fns |
| Android | Capacitor |
| Pruebas | Vitest |
| Escritorio (opcional) | Tauri |
| Diseño | skill ui-ux-pro-max |

## Requisitos

- Node 20 o superior
- Git
- Android Studio (SDK y emulador)
- Celular Android con *Depuración USB* activada (opcional)

## Inicio rápido

```bash
npm install
npm run dev
```

Abre la URL que muestra Vite. Para verla en tu celular por Wi-Fi (misma red):

```bash
npm run dev -- --host
```

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compila para producción en `dist/` |
| `npm run preview` | Previsualiza el build |
| `npm test` | Corre las pruebas (Vitest) |

## Android

```bash
npm run build
npx cap sync
npx cap open android          # abre Android Studio
npx cap run android --livereload --external   # recarga en vivo en emulador o celular
```

Para generar un APK instalable: en Android Studio, *Build → Generate Signed Bundle / APK*.

## Estructura

```
finanzas/
├── design-system/     # Sistema de diseño generado con ui-ux-pro-max
├── android/           # Proyecto Android (Capacitor)
├── src/
│   ├── db/            # Esquema de Dexie y datos iniciales
│   ├── store/         # Estado (Zustand)
│   ├── domain/        # Lógica pura: periodos, rendimientos, MSI, crédito, patrimonio
│   ├── services/      # Precios, tipo de cambio, respaldo, notificaciones
│   ├── pages/         # Register, Overview, Accounts, Settings
│   ├── components/    # layout, wallet, charts, forms, ui
│   └── lib/           # Formatos y constantes
└── tests/             # Pruebas de la lógica de domain/
```

Regla: **toda la lógica de dinero vive en `src/domain/`**, sin React, para poder probarla fácil.

## Cuentas iniciales

| Tipo | Tarjetas |
|---|---|
| Crédito | Nu, Revolut, Mercado Pago |
| Débito | Nu, Revolut, Mercado Pago, BBVA |
| Efectivo | Efectivo |

## Rendimientos configurados

| Cuenta | Tasa |
|---|---|
| Nu, Cajita Turbo | 13% sobre depósito de hasta $25,000; los intereses se capitalizan y siguen al 13% |
| Nu, otras cajitas | 7% sin límite |
| Revolut | 15% hasta $25,000; 7% de $25,001 a $1,000,000 |
| Mercado Pago | 12% hasta $25,000; 6% el excedente |
| BBVA débito | Sin rendimiento |

Las tasas son editables en cada cuenta. Los rendimientos mostrados son **estimados** (capitalización diaria, tasa / 365), no los datos oficiales del banco.

## Precios de inversiones

- **Criptos**: CoinGecko (sin llave).
- **Acciones**: Finnhub. Necesitas una API key gratuita personal; se pega una vez en *Ajustes* y se guarda solo en tu dispositivo. Verifica los límites vigentes del plan gratuito en el sitio del proveedor.
- Sin internet se usa el último precio guardado, marcado como desactualizado.

## Hoja de ruta

- [ ] Fase 0: entorno
- [ ] Fase 1: sistema de diseño
- [ ] Fase 2: base de la app
- [ ] Fase 3: cuentas
- [ ] Fase 4: registrar movimientos
- [ ] Fase 5: panorama
- [ ] Fase 6: rendimientos
- [ ] Fase 7: crédito y MSI
- [ ] Fase 8: presupuestos y gastos fijos
- [ ] Fase 9: inversiones y tipo de cambio
- [ ] Fase 10: respaldo y recordatorios
- [ ] Fase 11: empaquetar para Android
- [ ] Fase 12 (opcional): detección por notificaciones, escritorio con Tauri, meta de ahorro

## Privacidad

Tus datos no salen de tu dispositivo. Los respaldos (`backups/`, `*.backup.json`) y las llaves (`.env`, keystores) están en `.gitignore`: **no los subas a ningún repositorio**.
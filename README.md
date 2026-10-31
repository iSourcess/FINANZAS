# Finanzas — App Personal de Control Financiero

App móvil de finanzas personales para **Android** construida con **React (JSX)** y **Capacitor**. 

> [!IMPORTANT]
> **Privacidad y Almacenamiento 100% Local:**
> Esta aplicación **NO utiliza ninguna base de datos remota, servidor, API externa ni servicio en la nube** para almacenar tu información financiera. Todo se guarda directamente en la **memoria interna de tu celular** (en el almacenamiento privado del dispositivo). Tus datos nunca salen de tu teléfono.

---

## 📱 Cómo Funciona la Aplicación

La aplicación te permite llevar el control total de tu dinero de manera manual o asistida:

1. **Registrar Movimientos:**
   - Captura rápida de gastos, ingresos y transferencias entre cuentas.
   - Selector visual de tarjetas estilo billetera digital.
   - Soporte para plantillas de gastos frecuentes.

2. **Detección Automática por Notificaciones Bancarias:**
   - Un servicio nativo en segundo plano escucha cuando llega una notificación de tus aplicaciones de banco permitidas.
   - **Regla de Privacidad Estricta:** Solo procesa las apps que tú marcas explícitamente como "banco". De cualquier otra app solo registra el nombre para que puedas identificarla, jamás su contenido.
   - **Pantalla "Por confirmar":** Una notificación detectada **NUNCA afecta tus saldos, presupuestos ni gráficas** hasta que tú la revises y confirmes.
   - Detecta posibles movimientos duplicados ($\pm 1$ día), empareja con gastos fijos e ingresos esperados, e identifica transferencias propias complementarias.

3. **Billetera y Cuentas:**
   - **Débito y Ahorro:** Cálculo de rendimientos estimados por tramos y capitalización diaria (Nu Cajita Turbo, Revolut, Mercado Pago).
   - **Tarjetas de Crédito:** Límite de crédito, saldo deudor actual, crédito disponible, fechas de corte, fechas de pago y compras a Meses Sin Intereses (MSI).
   - **Inversiones y Multi-moneda:** Seguimiento de saldo en MXN y USD.

4. **Panorama Financiero:**
   - Balance neto del periodo (superávit / déficit).
   - Gráficas de distribución por categoría y tendencias temporales.
   - Control de presupuestos con alertas visuales de consumo.
   - Modo privado: oculta los saldos y montos con máscara (`••••`) hasta que los tocas.

---

## 💾 ¿Dónde y Cómo se Guardan los Datos? (Memoria del Celular)

- **Cero servidores / Cero bases de datos externas:** No hay inicio de sesión con correo, no hay servidores en AWS/Firebase ni bases de datos SQL en internet.
- **En el celular:** Se utiliza el almacenamiento local estructurado del navegador interno del sistema (**IndexedDB** administrado por **Dexie** dentro del WebView de Capacitor) y **SharedPreferences** para la configuración del servicio nativo de Android.
- **Respaldos:** Como todo vive en la memoria de tu celular, la app incluye una función en *Ajustes* para exportar tu información en un archivo `.json` o `.csv` que puedes guardar en tu computadora, Google Drive o donde tú elijas.

---

## 🚀 Cómo Instalarla en tu Celular

### Opción A: Generar el archivo instalador (.apk) desde Android Studio (Más fácil)

Si ya tienes el proyecto abierto en Android Studio:

1. En la barra de menús superior de **Android Studio**, ve a:
   **`Build`** → **`Build Bundle(s) / APK(s)`** → **`Build APK(s)`**.
2. Espera unos segundos a que termine de compilar.
3. Te aparecerá una notificación abajo a la derecha diciendo *"APK(s) generated successfully"*. Haz clic en **`locate`**.
4. Se abrirá la carpeta de tu computadora con el archivo:
   ```text
   app-debug.apk
   ```
5. Pásate este archivo a tu celular (por WhatsApp Web, Telegram, Google Drive o cable USB).
6. En tu celular, abre el archivo `app-debug.apk` y selecciona **Instalar** (si te pide activar *"Permitir instalar aplicaciones de orígenes desconocidos"*, actívalo para continuar).

---

### Opción B: Desplegar directamente por cable USB con Android Studio

1. **Activa la depuración en tu celular (solo la primera vez):**
   - Ve a **Ajustes** → **Acerca del teléfono** → pulsa **7 veces** seguidas sobre **Número de compilación**.
   - Entra a **Ajustes** → **Opciones de desarrollador** y activa **Depuración por USB**.
2. **Conecta tu celular** a la computadora con un cable USB.
   - En la pantalla del teléfono saldrá un mensaje emergente: marca *"Permitir siempre"* y pulsa **Aceptar**.
3. **Compilar y sincronizar cambios:**
   En la terminal del proyecto ejecuta:
   ```bash
   npm run build
   npx cap sync android
   ```
4. **Abrir y ejecutar:**
   ```bash
   npx cap open android
   ```
   En Android Studio, en la barra superior al lado del botón verde de **Play ▶**, selecciona el modelo de tu teléfono y pulsa **Play ▶ (Run 'app')**. La aplicación se instalará y abrirá automáticamente en tu teléfono.

---

## 🛠️ Aspectos Técnicos y Arquitectura

### Stack Tecnológico

| Capa | Tecnología | Propósito |
|---|---|---|
| **Interfaz de Usuario** | React 18 + JSX | Interfaz reactiva, componentes modulares y hooks |
| **Empaquetador Web** | Vite 5 | Compilación ultrarrápida del bundle web |
| **Estilos** | Tailwind CSS | Sistema de diseño estricto en negro y naranja con variables CSS |
| **Contenedor Móvil** | Capacitor 6 | Puente nativo para Android (WebView, plugins y acceso a hardware) |
| **Lógica Nativa Android** | Java | `NotificationListenerService` para lectura de notificaciones bancarias |
| **Almacenamiento Local** | Dexie.js (IndexedDB) | Persistencia local en la memoria interna del teléfono |
| **Estado Global** | Zustand | Gestión de estado reactivo y desacoplado |
| **Rutas** | React Router (`HashRouter`) | Navegación local compatible con el esquema de archivos de Capacitor |
| **Gráficas** | Recharts | Gráficas de dona, tendencias y rendimientos |
| **Pruebas** | Vitest | Pruebas unitarias automatizadas sobre la lógica de dominio |

---

### Arquitectura de Código

El proyecto sigue una estricta separación de responsabilidades para garantizar confiabilidad financiera:

```text
finanzas/
├── android/                         # Proyecto nativo de Android (Gradle + Java)
│   └── app/src/main/java/com/finanzas/app/
│       ├── MainActivity.java
│       ├── BankNotificationListenerService.java  # Listener nativo de notificaciones bancarias
│       ├── DetectionParser.java                 # Espejo nativo del parser regex
│       └── NotificationDetectionPlugin.java     # Puente Capacitor <-> SharedPreferences
├── src/
│   ├── db/                          # Esquema y versiones de Dexie (v13 actual)
│   │   ├── database.js
│   │   └── seed.js                  # Cuentas y categorías iniciales
│   ├── domain/                      # LÓGICA PURA DE DINERO (Sin React, sin DB)
│   │   ├── detections.js            # Borradores, duplicados y emparejamiento
│   │   ├── detectionParser.js       # Extracción de montos y tipos con Regex
│   │   ├── reminders.js             # Agenda de recordatorios locales (7 días)
│   │   ├── creditCards.js           # Fechas de corte, pago y disponible de crédito
│   │   ├── yield.js                 # Rendimientos compuestos por tramos
│   │   └── movements.js             # Acreditación y reversión atómica de saldos
│   ├── store/                       # Stores de Zustand (Movements, Accounts, Settings, Detections)
│   ├── services/                    # Servicios de notificaciones, respaldo y sincronización
│   ├── pages/                       # Pantallas principales (Register, Overview, Accounts, Settings)
│   ├── components/                  # Componentes reutilizables (wallet, charts, notifications, ui)
│   └── lib/                         # Formateo (formatMoney en centavos, fechas locales ISO)
└── tests/                           # Pruebas unitarias de todas las funciones de domain/
```

### Reglas Financieras de Dominio

1. **Montos siempre en Centavos Enteros:**
   Todos los valores monetarios se almacenan como enteros (por ejemplo, `$125.50 MXN` se procesa y guarda como `12550`). Esto elimina por completo los errores de redondeo de punto flotante de JavaScript.
2. **Fechas en Hora Local:**
   Nunca se usa `toISOString()` para fechas de corte ni movimientos, previniendo desfases por diferencia de zona horaria (UTC-6 en México).
3. **Aislamiento de la Lógica:**
   Toda regla de cálculo financiero vive en funciones puras en `src/domain/` y cuenta con pruebas unitarias en `tests/`.

---

## 🧪 Pruebas y Verificación

Para ejecutar la suite de pruebas unitarias:

```bash
npm test
```

Para verificar que el código compila sin errores ni advertencias de estilo:

```bash
npm run build
npm run lint
```

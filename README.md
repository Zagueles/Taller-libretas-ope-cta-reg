# Taller IA · SIAF-RP

Arquetipo para clases demostrativas: muestra cómo se arman las pantallas del SIAF-RP con los componentes del diseño de
Figma y **datos simulados**, sin backend. Trae el login, el escritorio virtual y un proceso de ejemplo completo
(Documentos y registros, la solicitud con su formulario y Consultas y reportes), con usuarios de demostración para
alternar roles y perfiles.

> Es material de clase: corre solo en local y no se mantiene como producto. Nada de lo que se graba sale del navegador.

## Requisitos

- Node.js 20 (ver `.nvmrc`) y npm.

## Cómo correrlo

```bash
npm ci
npm start
```

Abrir <http://127.0.0.1:4200>. Otro puerto: `npm start -- --port 4300`.

## Usuarios de demostración

La contraseña de todos es **`Taller2026*`**. En el login, el panel «Usuarios de demostración» llena el DNI y la
contraseña con un clic.

Hay **un solo usuario** de demostración, que consulta:

| Usuario | DNI | Perfil | Qué puede hacer |
| --- | --- | --- | --- |
| Carla Mendoza Ríos | `33333333` | Visualizador de consultas | Solo consulta documentos, registros y reportes (sin «Crear» ni acciones) |

Los perfiles **Creador** y **Aprobador** (y el usuario Luis Quispe Salas, `44444444`) ya no entran a la demo. El backend
simulado conserva su flujo completo —crear, verificar, aprobar, observar, rechazar, modificar— y los tests lo prueban con
Carla (creadora) y Luis (aprobador) definidos aparte en `USUARIOS_PRUEBA` (`src/app/mock/usuarios-demo.ts`). Los documentos
de ejemplo siguen mostrando a Carla y a Luis en su historial.

«Olvidé mi contraseña» también funciona: con el correo de un usuario (`carla.mendoza@taller.pe`) el código de
verificación es `123456`.

## Recorrido sugerido para la clase

1. **Login** como Carla (Visualizador de consultas). El escritorio virtual muestra la bandeja y los contadores.
2. **Procesos → Gestión de tesorería → Gestión de liquidez → Conciliación bancaria**: los procesos todavía no habilitados van
   deshabilitados con el tooltip «No disponible».
3. **Registro de operaciones en las libretas de las cuentas de registro**: Documentos (con el historial de cada uno) y Registros.
4. **Consultas y reportes**: elegir el rango de fechas de apertura y consultar. Probar los filtros, la **vista de
   gráficas** (KPI, barras, dona y línea) y **Exportar** a Excel, CSV o PDF.
5. **Catálogo de componentes** en `/ui-kit` (enlace «Ver componentes» del login): cada componente con su ficha, sus
   entradas y su ejemplo.

Para empezar de cero: **Reiniciar datos** en el login (o borrar el almacenamiento del sitio).

## Pantallas

| Ruta | Pantalla | Plantilla o componente principal |
| --- | --- | --- |
| `/login` | Inicio de sesión y usuarios de demostración | `siaf-tabs`, `siaf-input`, `siaf-list` |
| `/login/recuperar-contrasena` | Recuperar contraseña con código | — |
| `/panel` | Escritorio virtual | `siaf-desk-card` |
| `/procesos/registro-cuentas-bancarias` | Documentos y registros | `siaf-documents-records-page` |
| `/procesos/registro-cuentas-bancarias/solicitud` y `/solicitud/:id` | Solicitud de Registro de Cuenta Bancaria | `siaf-solicitude-page-layout` |
| `/procesos/registro-cuentas-bancarias/consultas` | Consultas y reportes | `siaf-query-report-page` |
| `/procesos/conciliacion-diaria` | Documentos y registros de Conciliación diaria | `siaf-documents-records-page` |
| `/procesos/conciliacion-diaria/solicitud` y `/solicitud/:id` | Solicitud de Conciliación manual diaria (SCMD) | `siaf-solicitude-page-layout`, `siaf-selection-side-nav` |
| `/ui-kit` | Catálogo de componentes (sin sesión) | — |

## Cómo funcionan los datos simulados

- **`src/app/mock/mock-backend.interceptor.ts`** hace de backend: responde las llamadas a `/api/v1` con las mismas
  rutas y respuestas que el backend real del SIAF-RP, y aplica sus reglas (quién puede hacer cada cambio de estado,
  comentario obligatorio al observar o rechazar, sustento obligatorio para elaborar, número al elaborar, registro al
  aprobar, notificaciones para cada rol). Simula 250 ms de latencia. Si una pantalla llama a una ruta que no simula,
  lo avisa en la consola con `[mock] Endpoint no simulado`.
- **`src/app/mock/mock-db.ts`** guarda los datos en el `localStorage` del navegador (clave `taller-siaf-rp:datos`): lo
  que graba un usuario lo ve otro al entrar, en el mismo navegador. Trae 12 solicitudes en todos los estados, 8 cuentas
  registradas y notificaciones. Si cambian la forma de los datos, suban `VERSION` y se regeneran solos.
- **`src/app/mock/libretas-backend.ts`** y **`libretas-seed.ts`** son el backend de «Registro de operaciones en las libretas de
  las cuentas de registro»: el seed trae los movimientos y los documentos (rechazados incluidos), y las reglas
  (filtros de la consulta, documentos, detalle de documento y de registro) son funciones puras que el interceptor expone en
  `/api/v1/libretas/{movimientos,documentos,documentos/:numero,registros/:sec,cuentas-registro}`.
- **`src/app/mock/usuarios-demo.ts`** define los usuarios y sus perfiles. El token es un JWT sin firma: la app solo lee
  su vencimiento.
- **`src/app/mock/procesamiento-conciliacion.ts`** simula lo que ocurre tras **Aprobar** una Conciliación manual diaria
  (`POST /conciliaciones-manuales/:id/aprobar` y `GET /conciliaciones-manuales/:id/procesamiento`): el documento queda
  Aprobado y el procesamiento de los sistemas relacionados, «en proceso» durante `DEMO_PROCESAMIENTO.duracionMs` (8 s).
  Luego termina según `DEMO_PROCESAMIENTO.escenario`: `aplicado` (por defecto), `con-incidencias` (falla Contabilidad),
  `reintentos-agotados` (fallan Libretas y Contabilidad) o `procesando` (no termina). Cambiar el valor y recargar antes
  de aprobar. La pantalla consulta cada 5 s (`INTERVALO_PROCESAMIENTO_MS`) y, al terminar, el backend notifica al
  elaborador y al aprobador.
- **Modificación de registros conciliados** (Conciliación manual diaria): en **Crear documento → Conciliación manual
  diaria → Tipo de acción: Modificación** se elige el tipo de modificación (**Datos** o **Montos**), la cuenta y los
  registros ya conciliados, y se corrigen con el mismo formulario de edición (solo los campos del tipo elegido; sin
  agregar ni quitar registros). Al aprobar, el registro toma los valores nuevos y su «Historial del registro» suma el
  documento de modificación. Los registros de la pestaña Registros salen del backend simulado
  (`GET /conciliaciones-manuales/registros`): cada conciliación aprobada suma los suyos.
- Las notificaciones en tiempo real (socket) están apagadas: la campana se actualiza al iniciar sesión y al abrirla.

## Estructura

```text
src/app/
├── core/            API, sesión y permisos, interceptores, estado de las solicitudes y notificaciones
├── features/        login, recuperar contraseña y catálogo /ui-kit
├── layout/          armazón: barra superior, menú lateral, menú de procesos, bandeja y escritorio virtual
├── mock/            backend simulado, datos iniciales y usuarios de demostración
├── modules/
│   └── tesoreria/cuentas-bancarias/
│       ├── api/     llamadas del proceso
│       ├── config/  rutas, columnas y filtros de Documentos y registros
│       ├── models/  tipos y catálogos (bancos, monedas, tipos de cuenta)
│       ├── pages/   documents · solicitud · consultas
│       └── utils/   exportación a Excel, CSV y PDF
└── shared/
    ├── ui/          componentes del diseño de Figma (sin dependencias del dominio)
    ├── components/  componentes compuestos y plantillas de pantalla
    └── utils/       árbol de procesos del menú, migas de pan, fechas…
```

## Cómo sumar un proceso

Tomen como modelo `modules/tesoreria/cuentas-bancarias/`:

1. **Modelo y API** del proceso en `modules/<área>/<proceso>/`.
2. **Backend simulado**: sus rutas en `RUTAS` de `mock-backend.interceptor.ts` y sus datos iniciales en `mock-db.ts`.
3. **Pantallas** con las plantillas: `siaf-documents-records-page` (se arma con una configuración),
   `siaf-solicitude-page-layout` para la solicitud y `siaf-query-report-page` para las consultas.
4. **Rutas** en `modules/<área>/<área>.routes.ts`, cargadas desde `app.routes.ts`.
5. **Menú y migas de pan**: sus hojas en `shared/utils/process-tree.util.ts` (`DEFAULT_PROCESS_TREE`).
6. **Crear documento y notificaciones**: el tipo de documento en `/tipos-documento` del backend simulado, sus opciones
   en `layout/shell/app-shell.component.ts` (`ROUTE_BY_PROCESO`) y la ruta que abre cada aviso en
   `layout/notifications-panel` y `layout/tray-notifications-view` (`resolveRoute`).

Antes de escribir markup, busquen el componente en `/ui-kit`: casi todo ya existe.

## Comandos

| Comando | Para qué |
| --- | --- |
| `npm start` | Servidor de desarrollo |
| `npx ng build --configuration=development` | Compilar |
| `npx ng test --watch=false --browsers=ChromeHeadless` | Pruebas unitarias |
| `npm run ui-kit:manifest` | Regenerar las fichas del catálogo tras crear o cambiar un componente |
| `npm run ui-kit:check` | Verificar que el catálogo está al día |
| `npm run icons:check` | Verificar que los íconos existen en Material Icons |
| `npm run tokens:build` | Regenerar los tokens de color desde `src/tokens/` |
# Taller-libretas-ope-cta-reg

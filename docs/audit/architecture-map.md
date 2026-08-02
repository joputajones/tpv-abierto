# Mapa de arquitectura observada

## Contexto de reconciliación M0

| Campo | Valor |
| --- | --- |
| Fecha | 2026-07-30 |
| Sistema | Windows 10 `10.0.19045`, Node `v22.20.0`, npm `10.9.3` |
| Commit analizado | `d366538fe1a5d798d5f6c6249b365e306e38efbc` |
| Comandos de contraste | `npm.cmd run build`, `npm.cmd run build:frontend`, `node dev-server.js`, peticiones HTTP locales y revisión de código |
| Resultado | La topología descrita permanece vigente; Electron/lockfile están en `43.2.0` |
| Limitación | El arranque repetido usó el backend standalone; la auditoría inicial conserva la observación del proceso Electron completo |

Durante la repetición, el proceso standalone único abrió API/POS/WS en
`0.0.0.0:3001` y KDS/WS en `0.0.0.0:3002`. La salud, el HTML del POS y el HTML
KDS respondieron 200. La base de desarrollo se creó en la raíz del checkout y
la copia premigración en `backups/`; ambos eran sintéticos y se retiraron del
workspace. Este método no inicia mDNS, telemetría, actualización, Google Drive,
WhatsApp ni la ventana Electron, por lo que no sirve como prueba completa de
operación offline del producto empaquetado.

Este documento describe el código actual, no la arquitectura pretendida en
especificaciones externas.

## Vista de procesos

```text
Electron main (main/index.ts)
├── SQLite / better-sqlite3 (main/db.ts)
├── Express principal 0.0.0.0:3001 (main/server.ts)
│   ├── Next.js export estático
│   ├── API /api/*
│   └── WebSocket KDS /kds
├── Express KDS 0.0.0.0:3002 (main/kds-server.ts)
│   ├── KDS standalone estático
│   ├── API KDS reducida
│   └── WebSocket /kds
├── Bonjour/mDNS (flo.local)
├── Impresión ESC/POS
├── Sincronización cloud opcional
├── Telemetría
├── Google Drive opcional
├── WhatsApp opcional
└── electron-updater en builds directos macOS/Windows

Renderer Electron
└── http://localhost:3001
    └── Next.js 16 + React 19 + Zustand
```

Los dos servidores Express son independientes, pero comparten el mismo proceso
Electron y la misma conexión SQLite. No hay un servidor de base de datos ni un
servicio cloud obligatorio para cobrar o gestionar pedidos localmente.

## Arranque real

`npm run dev` ejecuta, en orden:

1. Limpieza de los puertos 3001/3002.
2. Build estático completo del frontend.
3. Compilación de `main/` a `dist/`.
4. Arranque de `electron .`.

Electron inicializa la base y sus migraciones, arranca API principal,
sincronización cloud, telemetría y scheduler de Google Drive, arranca KDS,
inicializa WhatsApp, mDNS e impresión, registra IPC y crea la ventana.

En desarrollo, la base está en la raíz del repositorio, no en el `userData`
pasado a Electron. Esto se debe a que `getDbPath()` usa `../flo.db` cuando
`app.isPackaged` es falso.

## Puertos y superficies de red

| Superficie | Bind/URL | Acceso y finalidad |
| --- | --- | --- |
| API + POS | `0.0.0.0:3001` por defecto | Estático, API REST y WS `/kds`; accesible desde la LAN. |
| KDS standalone | `0.0.0.0:3002` por defecto | Página KDS, API reducida y WS `/kds`; accesible desde la LAN. |
| mDNS | `flo.local` | Bonjour anuncia POS y puerto KDS; usa mDNS en la red local. |
| Google OAuth | `127.0.0.1:<efímero>` | Listener temporal durante la autorización de Google Drive. |
| Impresora de red | `<IP>:9100` por defecto | TCP raw ESC/POS saliente. |
| Cloud | HTTPS/WSS saliente | `https://blue.flopos.com/` y su relay `/api/pos/relay`. |
| Telemetría | HTTPS saliente | `https://telemetry.flopos.com/collect`. |
| Actualización | HTTPS saliente | Releases de `FreeOpenSourcePOS/FloCafe`. |
| Google Drive | HTTPS saliente | OAuth, Drive API y revocación de token. |
| WhatsApp | Internet saliente | Baileys/WhatsApp Web si se activa. |

Ambos servidores prueban hasta diez puertos consecutivos si el configurado está
ocupado. El KDS expone su puerto activo mediante `getKdsPort()`. El servidor
principal también mantiene `activePort`, pero la ventana, mDNS, menú y estado
siguen usando el `PORT` original. Por ello, el fallback 3001→3002/3003 puede
dejar la API escuchando en un puerto distinto del que abre/anuncia Electron.

No hay TLS local. CORS permite solicitudes sin `Origin`, localhost, hostnames
`.local` e IP privadas/Tailscale. El rate limit general excluye direcciones
locales; el de autenticación sí se aplica. La API usa JWT y consulta el rol/estado
actual del usuario en base de datos. La lista de tokens revocados es solo en
memoria y se pierde al reiniciar.

## API principal

`main/server.ts` sirve el frontend exportado y monta 27 módulos de rutas:
autenticación, categorías, productos, addons, pedidos e ítems, cocina, facturas,
mesas, estaciones, clientes, personal, ajustes, informes, KDS, información de
emparejado POS/KDS, impresoras, importación/exportación, herramientas de base,
CSV de menú, fiscalidad, pedidos retenidos y WhatsApp.

Son públicas la salud, las rutas de autenticación que implementan su propio
control y algunas lecturas explícitas como imágenes de producto. El resto pasa
por autenticación global y, en las operaciones sensibles, autorización por rol
y/o Master PIN.

El servidor aplica CSP. La ventana principal usa `contextIsolation: true` y
`nodeIntegration: false`, pero `sandbox: false`. En Windows se añade
`disable-gpu-sandbox` globalmente por compatibilidad.

## KDS y dispositivos secundarios

Existen dos formas de KDS:

- KDS embebido en el servidor principal, con WebSocket `/kds`.
- KDS standalone en el segundo servidor, también con REST y WebSocket propios.

El KDS standalone permite login y restringe el acceso a `chef`, `manager` y
`owner`. Revalida estado, rol y restricciones de estaciones/categorías contra
SQLite. Las actualizaciones se difunden mediante el servicio compartido
`main/services/kds.ts`.

Los ajustes `kds_enabled` y `kot_printing_enabled` son independientes. El código
rechaza endpoints/upgrade WS del KDS cuando está desactivado. Los dispositivos
secundarios acceden por IP LAN o `flo.local`; las pantallas de información
generan las URLs/QR correspondientes. No existe sincronización peer-to-peer:
todos los terminales hablan con el Electron que posee SQLite.

## Persistencia, logs y copias

| Dato | Desarrollo | Aplicación empaquetada |
| --- | --- | --- |
| SQLite | `<repo>\flo.db` | `<userData>\flo.db` |
| WAL/SHM | Junto a `flo.db` | Junto a `flo.db` |
| Copias administradas | `<userData>\backups` | `<userData>\backups` |
| Logs | Ruta de electron-log bajo `userData\logs` | Ruta de electron-log bajo `userData\logs` |
| Master PIN | `<userData>\master-pin.enc` | Igual |
| Google OAuth | `<userData>\google-drive-token.enc` | Igual |
| WhatsApp | `<userData>\whatsapp-auth` | Igual |

En Windows, el nombre real de datos de usuario deriva de `flo-desktop`, por lo
que la ubicación esperada es `%APPDATA%\flo-desktop`. El changelog confirma
esta diferencia respecto al nombre visible “Flo Cafe”. En macOS corresponde a
`~/Library/Application Support/flo-desktop`; en Linux el código/documentación
usa `~/.config/flo-desktop`.

SQLite trabaja en WAL, `synchronous=NORMAL`, `busy_timeout=5000` y claves
foráneas activadas después de migrar. Al arrancar ejecuta
`integrity_check` y `foreign_key_check`; registra problemas, pero no siempre
detiene el servicio.

### Ciclo de cierre y arnés de reinicio

`main/index.ts` abre la base antes de API/KDS. Su `runCleanup()` es idempotente
y detiene cloud, telemetría, Google Drive, WhatsApp, mDNS, KDS y API antes de
`closeDatabase()`; `will-quit`, `quit`, `SIGTERM` y `SIGINT` desembocan en ese
camino. `stopKdsServer()` termina clientes WebSocket y cierra su listener;
`stopServer()` cierra WebSocket/API; `closeDatabase()` invalida y cierra el
handle síncrono. Una conexión SQLite cerrada o terminada con una transacción
abierta no confirma esa transacción.

La matriz de [#30](https://github.com/joputajones/tpv-abierto/issues/30) usa un
padre y workers Electron-as-Node. Cada worker simula explícitamente
`app.isPackaged=true`, devuelve un `userData` temporal único e importa el
`initDatabase()`, API, KDS y cierres de producción sin importar `main/index.ts`.
WhatsApp es un no-op visible del arnés; cloud, telemetría, updater, mDNS,
impresión y ventana no arrancan. El padre elige puertos efímeros distintos de
3001/3002, espera IPC y health 200, y solo puede forzar PIDs registrados. PR #31
integró el arnés tras pasar R-01…R-12 en Windows y Linux; #30 está cerrado. Su
nivel máximo sigue siendo `SIM`.

Las copias manuales usan la API de backup de SQLite, pasan a journal DELETE y
añaden `_flo_meta` con versión de esquema, fecha y versión de aplicación. Puede
elegirse una ruta externa; solo las copias del directorio administrado aparecen
en el historial. No se observó una política automática de retención local. La
integración Google Drive sí aplica una retención configurable, 10 por defecto.

### Paquete portable y frontera de recuperación

El arnés de #33 usa las funciones de producción, no una reimplementación del
backup: un worker empaquetado inicializa v38 en un `userData` temporal, inserta
datos inequívocamente sintéticos y llama a `createBackup()` con un destino de
exportación exterior al perfil. El paquete contiene exactamente
`flo-backup.db`, `manifest.json`, `SHA256SUMS` y
`RESTORE-INSTRUCTIONS.md`; no contiene WAL/SHM, logs ni el checkout.

Un proceso consumidor distinto recibe solo esos cuatro archivos. Valida el
inventario, tamaño y los dos hashes antes de abrir SQLite o crear el destino;
después contrasta `integrity_check`, `user_version`, `_flo_meta`, claves
foráneas y dataset. Solo entonces inicializa otro `userData`, ejecuta
`restoreBackup(..., true)`, reabre, avanza secuencias y persiste una segunda
operación. El workflow dedicado transporta el paquete exclusivamente mediante
un artifact desde un productor Windows a consumidores Windows y Linux. PR #35
integró ese workflow: run 30671201413 ejecutó los tres jobs en máquinas
efímeras distintas y todos verificaron el mismo SHA-256 de base
`d2c4ee11c10544bcca43283266ab5e4d85dc0df467f91a21e296638845c1da95`.
La evidencia queda limitada a `CI_CROSS_RUNNER`; no equivale a un segundo
equipo físico ni a un operador independiente.

La base no es todo el perfil de FloCafe. Quedan fuera `master-pin.enc`,
`google-drive-token.enc`, la sesión/directorio de WhatsApp y los logs de
electron-log; los temporales de impresión pertenecen además al directorio
temporal del sistema. Las imágenes de producto, en cambio, se guardan como
Base64 dentro de SQLite y sí viajan con la base. Una restauración de `flo.db`
no recupera automáticamente credenciales ni sesiones externas y el arranque
limpio puede generar una identidad de dispositivo nueva.

## Migraciones SQLite

El esquema usa `PRAGMA user_version` y contiene 38 migraciones. Cada migración
pendiente se ejecuta dentro de su propia transacción y actualiza `user_version`.
Una base más nueva que el binario provoca un fallo explícito.

Históricamente, antes de un lote pendiente se hacía checkpoint WAL y se
intentaba copiar la base, pero el fallo solo se registraba y el bucle
continuaba. PR #28, integrada en `6d6f1d3`, clasifica la base antes de abrirla
y, para todo archivo existente con migraciones pendientes, exige checkpoint
completo, copia parcial exclusiva, sello de versión, integridad, reapertura en
solo lectura y publicación atómica antes de v1. #16 está cerrado y R-005
`DONE` para este alcance. Aunque la norma actual exige migraciones aditivas, el
historial contiene:

- v10: `DROP TABLE IF EXISTS sequences` y recreación.
- v14: borrado de settings y `DROP COLUMN customers.loyalty_points`.
- v30: backfill condicionado y `DROP COLUMN order_items.addons`.

No se han alterado estas migraciones durante la auditoría ni en la corrección
fail-closed.

## Impresión

La impresión backend está en `main/printers/thermal.ts`, perfiles en
`main/printers/profiles.ts`, API en `main/routes/printers.ts` y composición/audit
de recibos en módulos separados. El frontend también contiene encoder ESC/POS,
WebUSB y una ruta HTML/A4-A5.

Perfiles incluidos:

- Xprinter XP-V320M/XP-V330M.
- Epson TM ESC/POS.
- Genérico ESC/POS de 80 mm y 58 mm.

Transportes:

- TCP raw de red, puerto 9100 y timeout de 5 segundos.
- macOS/Linux mediante `lp -o raw`.
- Windows mediante `node-thermal-printer`, con fallback PowerShell `PrintTo`
  sobre un `.bin` temporal.
- WebUSB desde el navegador; el dispatcher Electron no lo procesa.

Los KOT se agrupan por estación y categorías. Lo no asignado cae en la
impresora predeterminada bajo “Kitchen”. El frontend intenta imprimir primero y
registra después el recibo/reimpresión en `print_logs`, pero la API física
`/api/printers/print-bill` y la API de auditoría `/api/bills/:id/print` son
operaciones separadas: no constituyen una transacción única.

## Telemetría, cloud y actualización

La telemetría usa un UUID aleatorio persistente y envía versión, plataforma,
tipo de evento y payload. Emite `app_launch`, un `daily_ping` como máximo cada
24 horas y comprueba la periodicidad cada hora. La función de envío consulta
`telemetry_enabled`.

PR #41 corrige una inconsistencia de primera instalación detectada por
O-01: `seedInstallDefaults()` sembraba `anonymous_data_consent=true` y
`telemetry_enabled=true`, por lo que `telemetry.start()` podía intentar enviar
antes de completar el wizard. Los defaults de base nueva son ahora `false`,
coinciden con la migración v28 y O-01/O-10 observan cero intentos antes o sin
consentimiento. El endpoint de setup sigue activando telemetría solo cuando
recibe el booleano explícito. El checkbox preseleccionado del frontend y el
contrato general cloud/privacidad requieren revisión separada bajo R-018.

La sincronización cloud está desactivada por defecto y requiere registro/clave.
Cuando se activa usa outbox local, HMAC, HTTPS/WSS, heartbeat y fallback de
polling. Admite comandos de solo lectura: salud, pedidos vivos, pedido por ID e
informe de ventas. La implementación carga flags separados para pedidos e
informes, pero `runCommand()` y `recordOrderChanged()` no los consultan.

La actualización automática:

- Se omite en Linux y builds de Microsoft/Mac App Store.
- En distribución directa macOS/Windows consulta GitHub cinco segundos después
  del arranque.
- No descarga automáticamente: pregunta, descarga si se acepta y puede instalar
  al salir.
- Está configurada contra `FreeOpenSourcePOS/FloCafe`, no contra el fork
  `joputajones/tpv-abierto`.
- El instalador Windows actual se publica sin firma; macOS directo se configura
  para firma y notarización.

## Arnés de operación offline (#40, integrado a nivel SIM/CI)

`tests/offline-network-guard.cjs` se instala antes de cargar los servicios en
un proceso Electron hijo ejecutado en modo Node. El coordinador se ejecuta con
Node y resuelve explícitamente el binario Electron para el worker y el renderer;
PR #42 eliminó un bloqueo reproducible del anterior Electron anidado en Windows.
El guard intercepta `fetch`, HTTP,
HTTPS, DNS, TCP, TLS y el constructor de `ws`; rechaza todo destino que no sea
loopback y registra solo protocolo, host saneado, puerto, servicio y resultado.
El API/KDS real puede conservar su bind `0.0.0.0` porque esa dirección no permite
una conexión saliente a Internet. No se modifica firewall, proxy ni configuración
global del equipo.

`tests/offline-operation-worker.cjs` usa `userData` temporal, puertos efímeros,
SQLite v38 real, API real, KDS REST/WebSocket real y el export estático real.
Impresión, mDNS, dispositivos y ventanas visibles no se arrancan en ese worker.
Un segundo proceso Electron real y oculto carga el frontend; CSP y
`session.webRequest` bloquean sus sondas HTTPS/WSS externas. O-13 inventaría
los recursos runtime de todos los HTML exportados y carga raíz, login, setup,
POS, KDS standalone y ajustes; los enlaces externos de activación manual se
clasifican aparte. Tras una redirección cliente, el probe espera hasta 10 s y
exige DOM completo, URL final loopback y contenido visible no vacío. PR #44
también ejecuta la suite completa Linux bajo Xvfb, manteniendo la ejecución
ordinaria en Windows y macOS. La reconexión O-15
no abre Internet: mapea un único hostname sintético a un servidor HTTP loopback
y hace que la outbox real reintente sin reiniciar el TPV.

Clasificación observada:

| Superficie | Activación | Tolerancia offline observada |
|---|---|---|
| API, frontend y KDS | Obligatorios; loopback/LAN | Flujo local completo y reinicios PASS; la campaña automatizada permite solo loopback |
| Cloud HTTPS/WSS | Opcional, con registro/clave | Bloqueo inmediato, outbox persistente y API/KDS disponibles; flags de datos siguen contradictorios bajo R-018 |
| Telemetría | Solo consentimiento | Cero intentos sin consentimiento; con consentimiento el fallo se captura sin afectar salud local |
| Google Drive | Opcional, con OAuth/token | `start()` sin configuración solo arma el scheduler y no intenta red |
| WhatsApp | Opcional, activación/sesión | Inicio desactivado no intenta red; conectividad real no se probó |
| Actualizador | Windows/macOS directo empaquetado | Sonda de endpoint bloqueada y no bloqueante; no se probó un feed/paquete real |
| Recursos frontend | Obligatorios | HTML/assets locales y renderer oculto PASS; enlaces externos por acción del usuario no se abrieron |

La ejecución local observó 9 intentos: 7 bloqueados y 2 redirigidos al simulador
loopback aprobado, 0 conexiones Internet exitosas y 0 ms de fallo registrado
frente al límite de 250 ms. Esto no acredita LAN entre dispositivos, impresoras,
teléfonos, corte físico de red o electricidad, larga duración, operación real ni
fiscalidad. PR #41, #42 y #44 están fusionadas. El run post-merge
`30711604415` pasa suite y empaquetado en Ubuntu, Windows, macOS x64 y macOS
arm64; CI y restore integrados también pasan desde `a6724c56`.
CORE-004 es `DONE` solo a nivel `SIM/CI`; R-011 y R-018 permanecen `PARTIAL`.

## Asistente gráfico de recuperación (PR #46 integrada)

`Herramientas → Comprobar copia de seguridad` abre la ruta estática
`/recovery-assistant/` mediante el preload existente. El renderer solo recibe
identificadores opacos y estados saneados; las rutas permanecen en el proceso
principal.

El padre crea `<temp>/flo-recovery-check/<uuid>/` con un marcador específico y
lanza `recovery-assistant-worker.js`. El worker reutiliza
`backup-package-validation.ts`, abre el origen en solo lectura, comprueba
integridad y versión, inicializa `db.ts` en una ruta desechable, llama a
`restoreBackup()`, reabre y persiste un valor sintético
`SYNTHETIC-RECOVERY-CHECK-*`. El padre elimina el sandbox y solo considera
obsoletos directorios que contienen el marcador.

`--recovery-assistant` asigna a Electron un perfil temporal separado y sirve
solo `frontend/out` en un puerto loopback efímero. No llama al inicializador
normal de base activa, API, KDS, cloud, telemetría, Google Drive, WhatsApp,
mDNS, actualización ni impresión.

La integración `28a3f8d` pasó A-01…A-16, la suite 71/71, CI normal y
empaquetado con apertura aislada en Windows, Ubuntu, macOS x64 y macOS arm64.
Esta evidencia es `CODE/SIM/BUILD/CI`; no sustituye la prueba pendiente con una
persona no técnica ni la validación con datos reales del restaurante.

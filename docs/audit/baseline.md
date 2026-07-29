# Auditoría técnica inicial

Fecha de observación: 2026-07-29 (Europe/Madrid)

Versión de la aplicación: 2.4.7

Commit base: `6879e7b3df9608f4d21b774d1fbbf979fed255d2`

Rama de trabajo: `audit/baseline`

## Alcance y criterio

Esta auditoría es una línea base de solo lectura sobre el comportamiento de
producción. Los únicos cambios realizados son estos documentos y la
actualización de `AGENTS.md`. No se han modificado código, configuración de
producción, esquema SQLite, marca ni licencia.

Se revisaron íntegramente:

- `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `package.json`,
  `package-lock.json`, `LICENSE`, `AGENTS.md`, `Printer.md`,
  `frontend/README.md` y `frontend/package.json`.
- Todo el contenido existente de `docs/`: `API.md`,
  `google-drive-setup.md`, `QA_CI_STRATEGY_REVIEW.md`,
  `RELEASE_ARTIFACTS.md` y `tax-engine-v2-spec.md`.
- Código de arranque, servidores, middleware, rutas, base de datos,
  migraciones, copias, KDS, impresión, telemetría, sincronización cloud,
  Google Drive, WhatsApp, actualización y workflows de GitHub Actions.

No existe un directorio `specs/` en este checkout. El `AGENTS.md` preexistente
indica que las especificaciones privadas son documentación externa y no deben
conectarse a este repositorio público. Varias referencias del código y del
README apuntan a archivos de ese repositorio externo; por tanto, esas
especificaciones no pudieron contrastarse localmente.

## Estado inicial de Git y GitHub

- El árbol estaba limpio en `develop`, siguiendo `origin/develop`.
- `main`, `develop`, `origin/main` y `origin/develop` apuntaban al mismo commit
  base `6879e7b`.
- `origin`: `https://github.com/joputajones/tpv-abierto.git`.
- `upstream`: `https://github.com/FreeOpenSourcePOS/FloCafe.git`.
- El repositorio conectado `joputajones/tpv-abierto` es público, tiene `main`
  como rama predeterminada y la conexión informa permisos de administración y
  escritura.
- GitHub mostró las mismas ramas y commits que el checkout. No se encontraron
  pull requests abiertos ni históricos en el fork en el momento de la
  consulta.
- `origin` también contiene ramas automáticas de Dependabot. No se modificaron.

Los diez commits más recientes del checkout, de más nuevo a más antiguo, eran:

| Commit | Fecha del autor | Asunto |
| --- | --- | --- |
| `6879e7b` | 2026-07-30 | `ci: add uncategorized tax invariant check` |
| `1524019` | 2026-07-30 | `fix: surface dashboard fetch errors, clear stuck products spinner, locale-format WhatsApp amounts, sanitize printer log, validate tax country` |
| `b351e22` | 2026-07-30 | `security: force patched brace-expansion, refresh frontend lockfile` |
| `9986425` | 2026-07-29 | `docs(ui): clarify Cloud Sync disclosure and RevFlo reporting wording` |
| `36cd853` | 2026-07-29 | `fix: null out closed db handle, preserve order error status codes, harden kill-ports` |
| `f96dd53` | 2026-07-28 | `fix(frontend): permit string index lookup on order type label keys (#172)` |
| `43f235a` | 2026-07-28 | `ci: enforce path filtering and strict native rebuild step` |
| `3432c34` | 2026-07-28 | `fix: harden telemetry timestamp parsing and timer lifecycle` |
| `42abd29` | 2026-07-28 | `fix: optimize server health metadata, statement reuse, and receipt atomicity` |
| `bb424e3` | 2026-07-28 | `fix: clean up UI components and error logging` |

La fecha 2026-07-30 de los tres primeros procede de la zona horaria del autor;
la auditoría se ejecutó aún el 2026-07-29 en Europe/Madrid.

La rama local `audit/baseline` se creó desde el commit base. No se ha publicado
ni se ha abierto pull request.

## Entorno observado

| Componente | Valor |
| --- | --- |
| Sistema | Windows, PowerShell |
| Node.js | `v22.20.0` |
| npm | `10.9.3` |
| Requisito del proyecto | Node `>=22.0.0`, `engine-strict=true` |
| Python detectado por node-gyp | 3.14 |
| Electron declarado/resuelto | `^43.2.0` / 43.2.x |
| Git Bash | Instalado en `C:\Program Files\Git\bin`, no incluido en `PATH` |
| Build Tools | Visual Studio Build Tools 2019 con toolset v142 |
| Windows SDK | No detectado |

El entorno cumple la versión de Node, pero no todos los prerrequisitos de
compilación nativa de `better-sqlite3`: `npm install` no puede completar
`electron-builder install-app-deps` sin un Windows SDK compatible. Además, el
script principal de pruebas presupone que `bash` está disponible en `PATH`.

## Resultado ejecutivo

El núcleo compila y la suite automatizada es amplia. La actualización de una
base desde esquema 0 hasta el esquema actual 38 pasa, conserva los datos de la
fixture, no deja diferencias de esquema y es idempotente. La aplicación
Electron también arranca, responde a salud y sirve tanto el POS como el KDS.

No obstante, esta línea base no debe considerarse todavía una validación para
un restaurante real. Los bloqueos principales son:

1. La instalación reproducible falla en el Windows auditado.
2. Las opciones `cloud_orders_enabled` y `cloud_reports_enabled` se cargan,
   pero no protegen los envíos ni los comandos correspondientes. Una
   instantánea de pedido incluye cliente, factura y detalles de pago, en
   contradicción con comentarios y changelog.
3. Una migración sigue adelante aunque falle la copia automática previa; el
   histórico contiene operaciones destructivas en v10, v14 y v30.
4. Los servidores escuchan en toda la red local mediante HTTP/WS sin TLS. En
   Windows se deshabilita el sandbox de GPU y la ventana principal usa
   `sandbox: false`.
5. La impresión solo se ha verificado con pruebas simuladas/de codificación;
   faltan ensayos con el hardware, drivers, red y papel que se usarán en sala y
   cocina.

El detalle y la priorización están en `production-risks.md`.

## Documentación frente a implementación

Se observaron varias divergencias que aumentan el coste de operación:

- El `AGENTS.md` indicaba Electron 31; `package.json` usa Electron 43. Se ha
  corregido únicamente esa documentación.
- `README.md` afirma que el actualizador descarga silenciosamente. El código
  usa `autoDownload = false` y pide confirmación antes de descargar.
- `CHANGELOG.md` afirma que pedidos, facturas y pagos no se envían al cloud. El
  código actual puede encolar una instantánea completa al activar la
  sincronización.
- `Printer.md` describe un esquema y un estado cloud antiguos. Debe tratarse
  como documento histórico, no como especificación vigente.
- El README promete copia previa a cualquier migración, pero no dice que un
  fallo de esa copia solo se registra y no aborta la migración.
- La ruta de logs se describe de forma inconsistente con el nombre real de
  `userData`, que deriva del paquete `flo-desktop`.

## Límites de esta auditoría

- No se construyeron instaladores NSIS, DMG, AppImage, deb, rpm, snap ni
  paquetes de tienda.
- No se ejecutó Playwright E2E ni se instaló Chromium para Playwright.
- No se probaron impresoras físicas, cajón portamonedas, tablets, móviles,
  pérdidas de red, cortes eléctricos ni una base de producción real.
- No se activaron ni se usaron cuentas reales de FloAdmin/Blue, Google Drive o
  WhatsApp.
- No se hizo una auditoría jurídica de licencias ni una revisión fiscal de
  cumplimiento por país.

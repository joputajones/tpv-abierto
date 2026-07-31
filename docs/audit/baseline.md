# Auditoría técnica inicial

## Reconciliación M0

La auditoría original se conserva a continuación como evidencia histórica. El
2026-07-30 se fusionó de forma normal `origin/main` en
`audit/m0-reconcile`, sin rebase ni descarte, y se contrastó el commit de
auditoría `c9110f449b70fbb4ccd39018725eb2c4ad522de3` con la documentación
canónica incorporada por el PR #13. El 2026-07-31 se incorporó de nuevo
`origin/main`, también mediante merge normal, después de fusionar PR #24.

| Campo | Valor |
| --- | --- |
| Fecha | 2026-07-30 |
| Sistema | Windows 10 `10.0.19045`, PowerShell |
| Node / npm | Node `v22.20.0`; npm `10.9.3` |
| Commit analizado | `d366538fe1a5d798d5f6c6249b365e306e38efbc` |
| Rama | `audit/m0-reconcile` |
| Main integrado inicialmente | `080e9c636663d8052567db3ab68d8d40ad483fff` |
| Main integrado tras PR #24 | `38abca3f0d149c6d245adc0a19705c828b1d70aa` |
| Main integrado tras PR #21 | `a51fa541604925762c759cd6ad1c98514cf61de6` |
| Fuente oficial de seguimiento | `docs/project/` |

### Estado de gobierno para revisión

La reconciliación de [PR #14](https://github.com/joputajones/tpv-abierto/pull/14)
está fusionada y #15 se cerró con la decisión explícita de mantener M0
`IN_PROGRESS`. PR #21 y PR #22 también están fusionadas; #18, #19 y #20 están
cerrados. #16 continúa abierto y las validaciones físicas/operativas siguen
pendientes.

La trazabilidad se distribuye así:

- [#15](https://github.com/joputajones/tpv-abierto/issues/15): gobierno y salida
  de M0;
- [#16](https://github.com/joputajones/tpv-abierto/issues/16): migración
  fail-closed, R-005;
- [#17](https://github.com/joputajones/tpv-abierto/issues/17): protección de
  datos públicos, R-006;
- [#18](https://github.com/joputajones/tpv-abierto/issues/18): instalación y
  recuperación Windows, R-022;
- [#19](https://github.com/joputajones/tpv-abierto/issues/19): señal de
  dependency review en CI, R-025, cerrado por la PR #24;
- [#20](https://github.com/joputajones/tpv-abierto/issues/20): fixture temporal
  no determinista de reports insights, cerrada por la PR #22.

El primer workflow observado en la PR quedó rojo por configuración antes de
evaluar dependencias. Después se habilitó Dependency Graph y la misma acción
pasó sin modificar el workflow. La acción v4.5.0 está fijada por SHA, conserva
permisos de solo lectura y umbral `high`, sin `continue-on-error` ni
`warn-only`. Se probó tanto una PR documental como un cambio controlado de
lockfile; la PR desechable se cerró sin merge. PR #24 incorporó la política a
`main` y cerró #19. No hay branch protection ni ruleset: un check rojo sigue
siendo un bloqueo manual, no una prohibición técnica de merge. Los detalles
están en [resultados de pruebas](test-results.md).

### Evolución de #18, #19 y #20

#### #18 — instalación y runner en Windows

- **Estado observado inicialmente:** Build Tools estaba incompleto y faltaba un
  Windows SDK utilizable; tras la reparación administrativa, la toolchain nativa
  pasó y apareció el fallo posterior por la dependencia implícita de Bash.
- **Causa raíz:** `postinstall`/`verify:electron` y el agregador raíz invocaban
  scripts Bash que no estaban en el `PATH` normal de PowerShell.
- **Corrección integrada:** PR #21 sustituye las rutas obligatorias por scripts
  Node multiplataforma y está fusionada en `a51fa54`.
- **Estado actual en `main`:** #18 está cerrado y R-022 `DONE` para portabilidad
  de desarrollo. Instalación, rebuild, verificación, builds, upgrade fixture y
  los 65 scripts se repitieron en PowerShell sin Bash desde `main`.
- **Limitación restante:** no demuestra restauración en otro equipo, copia
  externa, pérdida total, hardware, LAN hostil ni recuperación durante servicio.

#### #19 — dependency review

- **Estado observado inicialmente:** la acción fallaba como no soportada antes
  de analizar el cambio.
- **Causa raíz:** Dependency Graph no estaba habilitado para el repositorio.
- **Acción realizada:** se habilitó la función y se comprobó la acción fijada en
  v4.5.0 por SHA, con permisos de lectura, umbral `high` y sin modos permisivos.
- **Estado actual en `main`:** PR #24 está fusionada, #19 cerrado y R-025
  técnicamente mitigado (`DONE`).
- **Evidencia y límites:** una PR documental pasó y una PR desechable analizó un
  cambio real de lockfile antes de cerrarse sin merge. No hay enforcement de
  merge mediante branch protection o ruleset.

#### #20 — reports insights

- **Estado observado inicialmente:** `test:reports-insights` pasó 29/31; el
  promedio observado fue 20 frente a 15 y los ingresos de cajero 500 frente a
  550, deteniendo la suite.
- **Causa raíz:** el test dependía de `Date.now()`. El 2026-07-31 la ventana de
  90 días comenzaba el 2 de mayo de 2026 y excluía `ORD-PREP-1`, fechada el 1 de
  mayo; esto explica exactamente ambos valores y no demuestra una regresión del
  endpoint de producción.
- **Corrección disponible:** PR #22 fija el reloj durante la petición, lo restaura
  con `try/finally` y prueba el límite inclusivo, la orden inmediatamente anterior
  y la exclusión de cancelaciones sin cambiar semántica de producción.
- **Estado actual en `main`:** PR #22 está fusionada y #20 cerrado (`DONE`).
- **Evidencia y límites:** el test pasa 31/31 y la suite completa fue repetida
  desde `main` en Windows sin Bash y en Linux CI; no cambia producción.

#### #16 — decisión de migración aún pendiente

Una base existente no debe migrarse si no puede crearse y verificarse su copia
previa; el fallo debe detener el proceso antes de modificar datos. Puede
estudiarse una excepción para una base nueva y vacía, pero esa condición debe
ser explícita y determinista, nunca inferida por tamaño de archivo ni mediante
una heurística probabilística. Esta tarea no implementa la decisión.

No existe `specs/` en este checkout. Las referencias a especificaciones
privadas siguen siendo externas y no se han conectado al repositorio, al build
ni al runtime.

### Revisión crítica de hallazgos

| Hallazgo anterior | Clasificación | Evidencia actual | Limitación |
| --- | --- | --- | --- |
| La auditoría previa existía solo en una rama/commit local | Confirmado mediante prueba ejecutada | `git branch -vv`, `git log` y diff localizaron `audit/baseline` / `c9110f4`; no había PR remoto de auditoría | La publicación se realiza en este PR |
| Electron real es 43.2.0 | Confirmado mediante prueba ejecutada | `package.json` declara `^43.2.0`, ambos lockfiles se parsean y `electron.exe --version` devuelve `v43.2.0` | No se construyó un instalador |
| API y KDS escuchan en todas las interfaces en 3001/3002 | Confirmado mediante prueba ejecutada | `node dev-server.js`, listeners `0.0.0.0:3001` y `0.0.0.0:3002`, salud y HTML 200 | No se ensayó una LAN hostil ni TLS |
| Flags cloud de pedidos/informes no protegen todos los caminos de datos | Confirmado mediante código | `recordOrderChanged()`, `runCommand()` y `decorateOrder()` no aplican ambos flags; la instantánea incluye cliente/factura/pago | No se registró una cuenta cloud ni tráfico real |
| Una migración puede continuar si falla la copia previa | Confirmado mediante prueba ejecutada | La suite provoca `Auto-backup before migration failed` y continúa; v10/v14/v30 contienen operaciones destructivas históricas | La fixture feliz v0→v38 sí conserva los datos cubiertos |
| La instalación raíz es reproducible en el Windows auditado | Confirmado mediante prueba ejecutada | Tras reparar SDK/MSVC, PR #21 elimina Bash; `npm.cmd ci`, rebuild y verificador pasan desde `main` | Desarrollo reproducible en el entorno auditado; no prueba empaquetado ni recuperación externa |
| La suite se ejecuta con el comando literal documentado | Confirmado mediante prueba ejecutada | PR #21 y PR #22 están fusionadas; `npm.cmd test` ejecuta 65 scripts sin Bash y termina en 0 | Sin métrica de cobertura; errores negativos esperados generan salida ruidosa |
| Builds y suite automatizada son funcionales en el árbol disponible | Confirmado mediante prueba ejecutada | TypeScript, export de 22 rutas, v0→v38 y suite pasan tras instalación limpia; Linux y Playwright verdes | No hay build de instalador ni validación de hardware |
| Un pedido persiste tras reiniciar el backend | Confirmado parcialmente | Pedido sintético creado por API, proceso detenido, servidor reiniciado, login y lectura del mismo pedido correctos | El cierre no dejó evidencia de apagado graceful; no se probó corte eléctrico |
| Impresión está lista para hardware de restaurante | Bloqueado por hardware o información externa | Tests de bytes/perfiles/API simulada pasan | Sin impresora, spooler, cajón, papel, USB/TCP ni cola persistente |
| Copia y restauración están listas para desastre real | Confirmado parcialmente | Tests desechables y copia premigración feliz pasan | Sin copia fuera del equipo, retención local automática ni simulacro en otra máquina |
| Telemetría es siempre opt-in antes de arrancar | Contradicho por la evidencia | Defaults nuevos `true` y `telemetry.start()` anterior al wizard; migrados reciben defaults distintos | No se capturó una petición HTTPS real |
| El fallback de puerto principal es coherente | Confirmado mediante código | El servidor mantiene puerto activo, pero ventana/mDNS/menú siguen usando `PORT`; KDS sí expone el activo | No se ocupó 3001 durante esta repetición |
| El actualizador del fork usa releases del fork | Contradicho por la evidencia | Configuración de publicación/actualización apunta a `FreeOpenSourcePOS/FloCafe`; Windows directo no está firmado | No se construyó ni ejecutó el actualizador empaquetado |
| La operativa completa funciona sin Internet | No confirmado | El servidor standalone funciona localmente sin iniciar integraciones Electron | No se aisló el proceso Electron de Internet durante un turno simulado |
| Existe cumplimiento fiscal español | Bloqueado por hardware o información externa | Hay motor fiscal y tests propios, pero `docs/project/` lo mantiene `OUT_OF_SCOPE` | Requiere revisión normativa/especialista externa |
| El inventario de dependencias y avisos está cerrado jurídicamente | Bloqueado por hardware o información externa | Lockfiles, npm audit y licencias declaradas se inventariaron | Falta SBOM, avisos de terceros y revisión del binario distribuido |

Los estados reconciliados están en `docs/project/STATUS.md`,
`FEATURE_MATRIX.md`, `TEST_MATRIX.md` y `RISK_REGISTER.md`. Ninguna capacidad
se ha marcado `DONE` basándose solo en README, nombres de archivos o código no
ejecutado.

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

## Entorno observado en la auditoría inicial

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

Este bloque conserva el estado histórico. El 2026-07-31 el propietario reparó
Build Tools/SDK y el rebuild nativo pasó. PR #21 eliminó después el bloqueo Bash
de los caminos obligatorios; la evidencia integrada está en
[test-results.md](test-results.md).

## Resultado ejecutivo

El núcleo compila y la suite automatizada es amplia. La repetición histórica
tras reparar la toolchain encontró dos fallos en `test:reports-insights`; PR #22
demostró la causa temporal y la corrección está fusionada. PR #21 también está
fusionada y la instalación/suite pasan sin Bash desde `main`. La
actualización de una base desde esquema 0 hasta el esquema actual 38 pasa,
conserva los datos de la
fixture, no deja diferencias de esquema y es idempotente. La aplicación
Electron también arranca, responde a salud y sirve tanto el POS como el KDS.

No obstante, esta línea base no debe considerarse todavía una validación para
un restaurante real. Los bloqueos principales son:

1. Las opciones `cloud_orders_enabled` y `cloud_reports_enabled` se cargan,
   pero no protegen los envíos ni los comandos correspondientes. Una
   instantánea de pedido incluye cliente, factura y detalles de pago, en
   contradicción con comentarios y changelog.
2. Una migración sigue adelante aunque falle la copia automática previa; el
   histórico contiene operaciones destructivas en v10, v14 y v30.
3. Los servidores escuchan en toda la red local mediante HTTP/WS sin TLS. En
   Windows se deshabilita el sandbox de GPU y la ventana principal usa
   `sandbox: false`.
4. La impresión solo se ha verificado con pruebas simuladas/de codificación;
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

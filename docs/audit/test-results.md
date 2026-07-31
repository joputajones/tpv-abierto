# Resultados de instalación, compilación y pruebas

## Preparación de revisión de PR #14

Fecha: 2026-07-31. Rama: `audit/m0-reconcile`. PR:
[joputajones/tpv-abierto#14](https://github.com/joputajones/tpv-abierto/pull/14).

La preparación inicial solo ejecutó comprobaciones de Git, diagnóstico de
entorno, consulta de GitHub Actions y validaciones documentales. Después de que
el propietario reparase manualmente Build Tools y el SDK, se ejecutó la
validación posterior documentada a continuación. Los resultados históricos se
conservan debajo y se distinguen de esta nueva ejecución.

### Reconciliación posterior a PR #24

Esta actualización documental no repite instalación, build, suite, servidor ni
Playwright. Conserva los resultados ejecutados en sus ramas de origen y separa
la evidencia histórica del estado integrado en `main`.

| Elemento | Estado observado inicialmente | Causa raíz | Corrección / acción | Estado actual en `main` | Evidencia en PR | Limitación restante |
| --- | --- | --- | --- | --- | --- | --- |
| #18 / R-022 | Toolchain incompleta; después, `npm ci` fallaba al no encontrar Bash | SDK inicial ausente, ya reparado; scripts obligatorios dependían de Bash | PR #21 usa scripts Node multiplataforma | `DONE` en su alcance; PR #21 fusionada en `a51fa54` y #18 cerrado | Windows `main`: instalación, rebuild, verificador, builds, upgrade fixture y 65 scripts sin Bash; Linux/Playwright verdes | No prueba restore externo, hardware, LAN hostil ni recuperación durante servicio |
| #19 / R-025 | `dependency-review` fallaba como no soportado antes del análisis | Dependency Graph deshabilitado | Se habilitó; PR #24 documentó y fusionó la política | `DONE`; #19 cerrado | Acción v4.5.0 fijada por SHA, permisos de lectura, umbral `high`; PR documental y cambio controlado de lockfile | Sin branch protection/ruleset; bloqueo de merge manual |
| #20 | `test:reports-insights` 29/31; promedio 20 e ingresos 500 | `Date.now()` movía el inicio inclusivo de 90 días al 2 de mayo de 2026 y excluía la orden del 1 de mayo | PR #22 fija el reloj durante la petición y lo restaura en `try/finally` | `DONE`; PR #22 fusionada y #20 cerrado | Test aislado 31/31 y suite completa verde desde `main` en Windows/Linux | No cambia el endpoint de producción |

La evidencia de #20 explica exactamente los dos valores históricos y no señala
una regresión del endpoint de producción. Las validaciones de PR #21/#22 se
repitieron desde el `main` integrado antes de esta reconciliación documental.

### Validación integrada posterior a PR #21

PowerShell normal, sin añadir Git Bash al `PATH`; `where.exe bash` devolvió 1.

| Comando | Código | Duración | Resultado |
| --- | ---: | ---: | --- |
| `npm.cmd ci` | 0 | 30,9 s | 648 paquetes; `better-sqlite3` reconstruido; Electron verificado |
| `npm.cmd run verify:electron` | 0 | 0,7 s | Verificador Node sin Bash |
| `npm.cmd run test:cross-platform-scripts` | 0 | 0,9 s | Runner, rutas con espacios, npm y códigos validados |
| `npm.cmd run test:reports-insights` | 0 | 7,6 s | 31/31 |
| `npm.cmd run build` | 0 | 13,4 s | TypeScript y assets correctos |
| `npm.cmd run build:frontend` | 0 | 51,6 s | 22 páginas; 9 advisories altas de tooling |
| `npm.cmd run test:upgrade-path` | 0 | 1,7 s | v0→v38, integridad, FK e idempotencia |
| `npm.cmd test` | 0 | 151,8 s | Los 65 scripts terminaron, incluidos los posteriores a reports |

La CI de PR #21 también pasó `changes`, invariante fiscal,
`dependency-review`, `linux-baseline` y `e2e-playwright`. Una alteración local
temporal hizo fallar el último test: el runner identificó el script, devolvió 1
y se detuvo. El parche se revirtió completamente antes del push.

### Validación de la corrección fail-closed de #16 antes del merge

PowerShell normal, sin Bash (`where.exe bash` devolvió 1). La reproducción roja
usó la fixture sintética v0 y bloqueó el destino administrado de copias: el
código histórico registró el fallo, aplicó v1→v38 y el test terminó con código 1
indicando que la migración había alcanzado v38. No se publicó ese estado rojo.

La corrección ejerce el camino real `initDatabase()` y clasifica una instalación
nueva solo por ausencia previa de `flo.db`. Una base existente con migraciones
pendientes debe completar checkpoint, copia parcial exclusiva, journal
autocontenido, sello de versión, integridad, reapertura en solo lectura y
publicación atómica antes de la primera migración.

| Comando | Código | Duración | Resultado |
| --- | ---: | ---: | --- |
| `where.exe bash` | 1 | — | Bash ausente, como se esperaba |
| `npm.cmd ci` | 0 | 35,2 s | 648 paquetes; rebuild de `better-sqlite3` y verificador Electron correctos; 1 advisory moderada raíz |
| `npm.cmd run test:migration-backup-fail-closed` | 0 | 1,8 s | Checkpoint ocupado, destino, copia, apertura, integridad, versión y finalización bloquean antes de v1; fuente intacta; archivo cero bytes protegido; backup válido y reintento aislado |
| `npm.cmd run test:upgrade-path` | 0 | 1,8 s | Fixture existente v0, backup verificado, v0→v38, conservación, paridad e idempotencia |
| `npm.cmd run test:backup` | 0 | 1,0 s | 10/10 del flujo histórico de backup/restore |
| `npm.cmd run test:schema-health` | 0 | 1,4 s | Salud, deriva y reparaciones seguras correctas |
| `npm.cmd run test:cross-platform-scripts` | 0 | 0,8 s | Agregador actualizado a 66 scripts |
| `npm.cmd run lint` | 0 | 26,9 s | 0 errores; 676 avisos backend preexistentes; frontend limpio |
| `npm.cmd run build` | 0 | 13,6 s | TypeScript y assets correctos |
| `npm.cmd run build:frontend` | 0 | 51,8 s | 22 rutas; el audit ejecutado por este `npm ci` informó 0 vulnerabilidades frontend |
| `npm.cmd test` | 0 | 134,8 s | Los 66 scripts terminaron; 9.524 líneas capturadas |

El error público afirma que no se aplicó ninguna migración y ofrece acciones de
espacio, permisos, instancias concurrentes, reintento y soporte. No incluye la
causa interna, rutas ni datos. La telemetría específica contiene únicamente
tipo, etapa y versiones de esquema. El bloque completo de `MIGRATIONS` coincide
exactamente con `origin/main`: ambos producen SHA-256
`72089018fab7776ec460a9e4e51cdd325e83dc5c749180901217c53f122b8c09` sobre
30.506 caracteres normalizados.

Esta evidencia demuestra que una copia sintética puede reutilizarse en otro
directorio temporal para reintentar v0→v38. No demuestra restauración externa,
pérdida total del equipo, hardware distinto ni recuperación durante servicio.

### Validación histórica posterior a la reparación administrativa

Build Tools 2019 ahora informa `isComplete=true`, `isLaunchable=true`,
`canceled=0`. `vswhere` detecta MSVC x86/x64 y el componente de SDK instalado;
`Windows.h`, `kernel32.lib`, `rc.exe` y `mt.exe` existen bajo el SDK
`10.0.19041.0`. No se deduce de ello que esa versión concreta sea una exigencia
del proyecto.

| Comando exacto | Resultado | Evidencia / limitación |
| --- | --- | --- |
| `npm.cmd ci` | Fallo, código 1 | `better-sqlite3` se reconstruye correctamente; el `postinstall` falla después porque `verify:electron` invoca `bash` y Git Bash no está en el `PATH` normal |
| Git Bash añadido solo al proceso + `npm.cmd ci` | Correcto | 648 paquetes; rebuild nativo y `verify:electron` correctos; 1 advisory moderada y aviso de `@types/bcryptjs` deprecado |
| `npm.cmd run lint` | Correcto con avisos | Código 0; 677 avisos backend preexistentes y 0 errores |
| `npm.cmd run build` | Correcto | TypeScript y assets de runtime |
| `npm.cmd run build:frontend` | Correcto con advisories | Next 16.2.12 exporta 22 rutas; permanecen 9 advisories altas de tooling |
| `npm.cmd run test:upgrade-path` | Correcto | v0→v38, copia feliz, integridad, FK, conservación, paridad e idempotencia |
| Git Bash añadido solo al proceso + `npm.cmd test` | Fallo | La cadena llega a `test:reports-insights` y se detiene en 2 aserciones fallidas; los scripts posteriores no se ejecutan |
| `npm.cmd run test:reports-insights` | Fallo, código 1 | 29/31: tiempo medio esperado 15, real 20; ingresos de cajero esperados 550, reales 500; [issue #20](https://github.com/joputajones/tpv-abierto/issues/20) |

La primera envoltura PowerShell usada para restaurar `PATH` terminó con código
0 por ejecutar la restauración después del comando externo. La salida ya
mostraba los dos fallos y la repetición aislada confirmó código 1. Por tanto, no
se presenta aquella envoltura como suite correcta. No quedaron listeners en
3001/3002 ni cambios rastreados tras las pruebas.

### Estado inicial de CI, antes de habilitar Dependency Graph

Se inspeccionó el workflow finalizado `30587223544`, asociado al commit
`892f2c70d6fd0cbf8998a7bd127ffe77ce4ba935`.

| Job | Resultado | Clasificación |
| --- | --- | --- |
| `changes` | Correcto | El filtro clasificó la PR documental |
| `Tax invariant — uncategorized products remain zero-tax` | Correcto | La instalación del job y la prueba de invariantes terminaron correctamente |
| `dependency-review` | Fallo | Configuración/capacidad del repositorio: GitHub indica que Dependency Review no está soportado con la configuración actual |
| `linux-baseline` | Omitido | Omitido por el filtro de rutas de una PR solo documental |
| `e2e-playwright` | Omitido | Omitido por el filtro de rutas de una PR solo documental |

Este bloque conserva el primer resultado rojo: no demuestra un fallo del código
de aplicación ni de la documentación. Después se habilitó Dependency Graph y
la misma acción pasó sin cambios de workflow. PR #24 incorporó la política a
`main` y cerró el
[issue #19](https://github.com/joputajones/tpv-abierto/issues/19). Los logs
también advirtieron que algunas acciones fijadas a Node 20 eran forzadas a Node
24; el aviso no causó aquel fallo.

### Evidencia vigente de dependency review

- La acción `actions/dependency-review-action` v4.5.0 está fijada por SHA y usa
  permisos `contents: read` y `pull-requests: read`.
- La política falla desde severidad `high`; no usa `continue-on-error` ni
  `warn-only`.
- La repetición de la PR documental #14 pasó y conservó Linux/Playwright como
  omisiones explícitas por filtrado de rutas.
- La PR #22 pasó el job al repetirlo tras habilitar Dependency Graph, sin cambio
  de código o workflow para esa repetición.
- La PR desechable #23 modificó de forma controlada `package-lock.json`; la
  acción reconoció el cambio real, aplicó el umbral y terminó correctamente. La
  PR se cerró sin merge y su rama se eliminó.
- El inventario reconoció manifiestos y lockfiles de raíz y `frontend/`.
- PR #24 quedó fusionada en
  `38abca3f0d149c6d245adc0a19705c828b1d70aa` y #19 cerrado.

Esto demuestra ejecución y análisis real conforme a la política configurada;
no demuestra un test negativo con una vulnerabilidad deliberada. Tampoco hay
branch protection o ruleset: GitHub aún permite técnicamente un merge directo o
con CI rojo.

### Diagnóstico inicial del entorno Windows, antes de la reparación

| Elemento | Detectado | Versión o evidencia | Necesidad | Acción |
| --- | --- | --- | --- | --- |
| Node.js | Sí | `v22.20.0`, `C:\Program Files\nodejs\node.exe` | Requerido (`>=22`) | Ninguna |
| npm | Sí | `10.9.3` | Requerido para los comandos del proyecto | Ninguna |
| Python | Sí | `3.14.0`, seleccionado desde `C:\Python314\python.exe` | Requerido por node-gyp cuando compila | No es la causa inmediata observada |
| VS Build Tools | Incompleto | Build Tools 2019 `16.11.36602.28`; estado `isComplete=false`, propiedad `canceled=1` | Requerido para reconstrucción nativa | Reparar/completar con privilegios de administrador |
| MSVC x86/x64 | Parcialmente presente | Toolset `14.29.30133`; `cl.exe` `19.29.30159.0` | Requerido | Conservar; validar desde un Developer Prompt tras la reparación |
| MSBuild | Sí dentro de VS | `16.11.6.22506` | Requerido por la toolchain | Validar desde un Developer Prompt |
| Windows SDK | No utilizable | Registro apunta a Windows Kits 10, pero faltan `Include`, `Windows.h`, `kernel32.lib`, `rc.exe` y `mt.exe`; `WindowsSdkDir` queda vacío | Requerido para el rebuild nativo | Instalar un SDK Windows 10/11 compatible mediante Visual Studio Installer |
| Git Bash | Sí, fuera de `PATH` | GNU Bash `5.3.15` en `C:\Program Files\Git\bin\bash.exe` | Requisito histórico ya eliminado de los caminos obligatorios | No añadirlo al `PATH`; PR #21 integró los reemplazos Node |

`vswhere` encuentra la instancia y el componente
`Microsoft.VisualStudio.Component.VC.Tools.x86.x64`, pero no satisface
`Microsoft.VisualStudio.Workload.VCTools` ni
`Microsoft.VisualStudio.Component.Windows10SDK.19041`. La lista del instalador
conserva selecciones para C++ y SDK 19041, pero los archivos reales del SDK no
están instalados. Por tanto, no debe confundirse una selección incompleta con
un prerrequisito disponible ni prescribirse 19041 como versión obligatoria.

La acción manual de toolchain asignada al propietario dentro del
[issue #18](https://github.com/joputajones/tpv-abierto/issues/18) se completó:
Build Tools y el SDK quedaron instalados. PR #21 se fusionó y #18 se cerró tras
la repetición integrada sin Bash. Codex no instaló componentes, no cambió el
registro y no persistió variables de entorno.

El procedimiento vigente desde un Developer PowerShell o Developer Command
Prompt no requiere Bash:

```powershell
& "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -products * -all
where.exe cl
where.exe msbuild
where.exe bash # No encontrarlo es válido.
npm.cmd ci
npm.cmd run verify:electron
npm.cmd run build
npm.cmd run build:frontend
npm.cmd run test:upgrade-path
npm.cmd test
```

### Auditoría de privacidad del diff

Se revisaron todos los archivos rastreados y, de forma separada, las líneas
añadidas por `origin/main...HEAD` con búsquedas reproducibles de:

- rutas de perfil Windows (`<unidad>:\Users\...`);
- IPv4 privadas RFC 1918;
- referencias a archivos `.db`/`.mdb`;
- asignaciones aparentes de `password`, `secret`, `api_key`, `token` o `pin`;
- `C:\BLATTA` y `VirtuaPOS`.

Resultado final del escaneo sobre el árbol versionado y, por separado, sobre
`docs/audit/`:

| Categoría | Árbol completo (coincidencias/archivos) | `docs/audit/` (coincidencias/archivos) | Revisión |
| --- | ---: | ---: | --- |
| Rutas de perfil Windows | 0 / 0 | 0 / 0 | Sin rutas nominales después del saneamiento |
| IPv4 privadas, búsqueda amplia | 160 / 26 | 13 / 5 | En la auditoría son falsos positivos de versiones; fuera de ella son versiones, rangos o ejemplos genéricos de código/documentación |
| Referencias a ficheros de base de datos | 57 / 20 | 8 / 2 | Rutas genéricas, fixtures, código, ignores y artefactos sintéticos documentados |
| Asignaciones con aspecto de credencial | 59 / 15 | 0 / 0 | Solo fixtures y valores sintéticos bajo `tests/` |
| Referencias al sistema legado | 21 / 9 | 2 / 1 | Política y planificación documental; ningún fichero real |

Antes del saneamiento aparecieron dos rutas de perfil local, ambas en este
documento; se sustituyeron por `%LOCALAPPDATA%` y `<repo>`. Las coincidencias
restantes de las otras categorías se revisaron como documentación genérica,
direcciones de ejemplo, nombres de fixtures o credenciales sintéticas de
tests. No se identificaron logs publicados, credenciales reales, datos de
clientes, bases de restaurante ni un plan de red privado observado. El issue
[R-006/#17](https://github.com/joputajones/tpv-abierto/issues/17) mantiene
abierta la implantación de un gate automatizado y una política de fixtures.

Comandos de referencia:

```powershell
git grep -nI -E -e '[A-Za-z]:\\Users\\[^\\[:space:]]+' --
git grep -nI -E -e '(192\.168\.|10\.[0-9]{1,3}\.|172\.(1[6-9]|2[0-9]|3[01])\.)' --
git grep -nI -E -e '\.(db|mdb)([^A-Za-z0-9]|$)' --
git grep -nI -E -e '(password|passwd|secret|api[_-]?key|token|pin)[[:space:]]*[:=]' --
git grep -nI -E -e '(C:\\BLATTA|VirtuaPOS)' --
git diff --unified=0 origin/main...HEAD
```

## Repetición de reconciliación M0

Esta repetición no sustituye la evidencia original que se conserva debajo.

| Campo | Valor |
| --- | --- |
| Fecha | 2026-07-30 |
| Sistema operativo | Windows 10 `10.0.19045`, PowerShell |
| Node / npm | Node `v22.20.0`; npm `10.9.3` |
| Commit analizado | `d366538fe1a5d798d5f6c6249b365e306e38efbc` |
| Electron declarado / lock / runtime | `^43.2.0` / `43.2.0` / `v43.2.0` |

| Comando exacto | Resultado | Evidencia y advertencias | Limitación |
| --- | --- | --- | --- |
| `node --version`; `npm.cmd --version` | Correcto | `v22.20.0`; `10.9.3` | No valida la toolchain nativa |
| `npm.cmd ci` | Fallo, código 1 | `better-sqlite3`/node-gyp: VS Build Tools 2019/v142 presente, Windows SDK ausente; aviso deprecado `@types/bcryptjs`; limpieza `EPERM` | Bloquea una instalación raíz reproducible |
| `npm.cmd ci --ignore-scripts` | Correcto, diagnóstico | 648 paquetes; 1 vulnerabilidad moderada | No ejecuta postinstall ni equivale a instalación válida |
| `npx.cmd install-electron` | Correcto | `electron.exe --version` devolvió `v43.2.0` | Solo instala/verifica el runtime |
| `npx.cmd electron-builder install-app-deps` | Fallo | El rebuild nativo vuelve a requerir un Windows SDK | El prebuild N-API incluido sí cargó en Node 22 y Electron 43, pero el gate de instalación sigue fallando |
| `npm.cmd test` | Fallo inmediato | `"bash" no se reconoce` | No se ejecuta ninguna prueba con el comando literal |
| `$env:Path='C:\Program Files\Git\bin;'+$env:Path; npm.cmd test` | Correcto | La cadena completa alcanzó `test:url-allowlist`; 8.324 líneas stdout y 129 stderr | Workaround de entorno; stderr incluye errores esperados de pruebas negativas |
| `npm.cmd run test:upgrade-path` | Correcto | v0→v38, copia, integridad, FK, conservación, paridad de esquema e idempotencia | No valida todas las bases reales ni hace fail-closed la copia |
| `npm.cmd run build` | Correcto | TypeScript y copia de assets terminaron con código 0 | No empaqueta Electron |
| `npm.cmd run build:frontend` | Correcto con avisos | Next 16.2.12, 22 rutas estáticas; 9 vulnerabilidades altas de tooling | No es Playwright ni valida navegadores/dispositivos |
| `node dev-server.js` | Correcto parcialmente | Un proceso Node abrió `0.0.0.0:3001` y `:3002`; API, DB, POS y KDS respondieron 200 | No arranca telemetría, updater, mDNS, Google/WhatsApp ni la ventana Electron |
| Reinicio de `node dev-server.js` con pedido sintético | Correcto parcialmente | Tras reinicio: setup ya completo, login correcto, pedido 1 pendiente con un ítem recuperado, salud DB `ok` | La terminación no produjo logs de cierre graceful; no demuestra cierre limpio y abrupto por separado |
| `npm.cmd audit --json` | Fallo por advisories, código 1 | 1 moderada en `tar`, transitiva de desarrollo | No se aplicó `npm audit fix` |
| `cd frontend; npm.cmd audit --json` | Fallo por advisories, código 1 | 9 altas en cadenas de ESLint/minimatch/brace-expansion | No se actualizaron dependencias |

Los artefactos sintéticos `flo.db*` y la copia premigración creada para el
reinicio se retiraron del workspace a una carpeta temporal recuperable. Al
terminar no quedaron listeners en 3001/3002 ni cambios funcionales.

### Validación final después de reconciliar la documentación

| Comando exacto | Resultado final | Advertencias / limitación |
| --- | --- | --- |
| `npm.cmd run lint` | Código 0 | 677 avisos backend preexistentes, 0 errores; frontend sin errores mostrados |
| `npm.cmd run build` | Código 0 | Compilación TypeScript y assets correcta |
| `npm.cmd run build:frontend` | Código 0 | 22 rutas estáticas; permanecen 9 advisories altas del tooling |
| `npm.cmd run test:upgrade-path` | Código 0 | v0→v38, integridad, FK, conservación, paridad e idempotencia correctas |
| `$env:Path='C:\Program Files\Git\bin;'+$env:Path; npm.cmd test` | Código 0 | Cadena completa hasta `test:url-allowlist`; 8.324 líneas stdout y 148 stderr |

El stderr final vuelve a contener errores provocados por pruebas negativas y
mensajes de diagnóstico; el código 0 y la ejecución de la última prueba
confirman que la cadena no se interrumpió.

Fecha: 2026-07-29

Entorno: Windows, Node `v22.20.0`, npm `10.9.3`

## Resumen de comandos

| Comando | Resultado | Observaciones |
| --- | --- | --- |
| `npm install` | Fallo, código 1 | `better-sqlite3` no pudo reconstruirse para Electron mediante node-gyp: existe VS Build Tools 2019/v142, pero falta Windows SDK. También hubo avisos `EPERM` de limpieza y deprecación de `@types/bcryptjs`. |
| `npm install --ignore-scripts` | Correcto | Diagnóstico no equivalente a una instalación válida: 648 paquetes, 1 vulnerabilidad moderada. Permitió inspeccionar y ejecutar sin cambiar el lockfile. |
| `npx install-electron` | Correcto | Descargó/verificó el runtime de Electron después del diagnóstico sin scripts. |
| `npm test` | Fallo inmediato | PowerShell no encuentra `bash`; el script raíz encadena cada prueba mediante `bash tests/run-test.sh`. |
| `$env:Path='C:\Program Files\Git\bin;'+$env:Path; npm test` | Correcto | Suite completa, código 0, aproximadamente 205 s y 8.875 líneas de salida. |
| `npm run test:upgrade-path` | Correcto | Migración v0→v38, copia previa, integridad y claves foráneas correctas, datos conservados, esquema sin deriva y segunda apertura idempotente. |
| `npm run lint` | Correcto con avisos | Código 0: frontend sin errores mostrados; backend con 677 avisos existentes, principalmente `no-explicit-any` y símbolos sin usar. |
| `npm run build` | Correcto | TypeScript y copia de assets de runtime, aproximadamente 15 s. |
| `npm run build:frontend` | Correcto | `npm ci` del frontend, Next.js 16.2.12, 22 páginas estáticas, comprobación TypeScript y exportación correctas, aproximadamente 55 s. |
| `npm run dev -- --user-data-dir=<temporal>` | Correcto con incidencia de cierre | Electron, API y KDS arrancaron. Salud correcta. `npm run clean` no reconoció el Electron iniciado y no lo detuvo. |
| `npm audit --json` | 1 moderada | `tar`, transitiva y de desarrollo, por la cadena electron-builder/node-gyp. |
| `cd frontend; npm audit --json` | 9 altas | Cadena de desarrollo de ESLint/minimatch/brace-expansion; no es código servido por el export estático. |

El log de npm de la instalación fallida quedó en:

`%LOCALAPPDATA%\npm-cache\_logs\<timestamp>-debug-0.log`

## Instalación

El `postinstall` ejecuta:

1. `install-electron`.
2. `electron-builder install-app-deps`.
3. `npm run verify:electron`.

El segundo paso intentó reconstruir `better-sqlite3` y node-gyp no encontró un
Windows SDK. Esta máquina tiene Python 3.14 y Visual Studio Build Tools 2019 con
v142, pero esa combinación no basta para el build nativo. No es un error del
código TypeScript y tampoco debe ocultarse con `--ignore-scripts` en una
instalación de producción.

La instalación también avisó:

- `@types/bcryptjs@3.0.0` está deprecado porque `bcryptjs` ya incluye tipos.
- npm no pudo retirar algunos directorios de `node_modules` por `EPERM`.
- El árbol resultante del diagnóstico contenía dos paquetes opcionales
  extraneous relacionados con Sharp/WASM. No se modificó el lockfile para
  normalizarlos.

## Pruebas

El repositorio contiene 78 archivos `*.test.*` bajo `tests/` y dos specs
Playwright bajo `frontend/`. `package.json` define 74 scripts de prueba,
incluido el agregador `npm test`.

La repetición histórica de la suite pasó al exponer Git Bash temporalmente en
`PATH`. PR #21 eliminó después ese requisito y la suite integrada se repitió sin
Bash, como registra la tabla anterior. La suite cubre, entre otros:

- Arranque de API y KDS y contrato REST/WebSocket.
- CORS, autenticación, autorización por roles, logout y revalidación.
- Pedidos, ciclo de cocina, facturación, pagos, conciliación, descuentos,
  fidelización y fiscalidad.
- Copia/restauración, salud de esquema y actualización v0→v38.
- Impresión de recibos/KOT a nivel de bytes, perfiles y API simulada.
- Internacionalización, teléfonos, Google Drive, WhatsApp y herramientas de
  desarrollo.

No se ejecutó `npm run test:e2e`: no forma parte de `npm test`, descarga
Chromium y el encargo no pedía ampliar la matriz. Tampoco existe instrumentación
de cobertura (`c8`, `nyc`, Istanbul, Jest coverage o equivalente), así que no
hay porcentajes verificables de líneas, ramas o funciones.

La salida de la suite es excesivamente ruidosa. Muchas pruebas negativas
imprimen excepciones esperadas —cloud no registrado, JSON inválido, backups
inexistentes, pagos inválidos, saldo insuficiente, errores fiscales— aun cuando
el proceso termina correctamente. En CI, este volumen puede ocultar una
regresión real y dificulta diagnosticar un fallo.

## Ruta de actualización SQLite

`npm run test:upgrade-path` confirmó:

- Copia automática antes del lote de migraciones.
- Aplicación secuencial de v1 a v38.
- `PRAGMA integrity_check = ok`.
- `PRAGMA foreign_key_check` limpio.
- Conservación de productos, pedidos, facturas y desgloses fiscales de la
  fixture.
- Presencia de campos de cliente y tablas fiscales actuales.
- Igualdad con el esquema ideal y reapertura idempotente.

Esta prueba valida la fixture incluida, no todas las bases que hayan circulado
en instalaciones reales. En particular, no prueba qué ocurre si falla el
almacenamiento de la copia previa.

## Ejecución de desarrollo

Antes del arranque no había listeners en 3001/3002. El proceso observado creó:

- Electron principal PID 10700 y procesos Chromium de GPU, red y renderer.
- API/estático/WS en `0.0.0.0:3001`.
- KDS REST/estático/WS en `0.0.0.0:3002`.
- Anuncio mDNS de `flo.local`, con una dirección LAN privada observada y
  deliberadamente omitida de este repositorio público.
- Base de desarrollo en
  `<repo>\flo.db`.
- Logs y copias en el `userData` temporal suministrado.

`GET http://127.0.0.1:3001/api/health` respondió con base correcta, servicio
`Flo Local API` y versión 2.4.7. `GET http://127.0.0.1:3002/` respondió 200 y
sirvió el KDS.

`npm run clean` detectó Electron PID 10700, pero lo rechazó como “not a Flo
process”; ambos puertos siguieron ocupados. Se terminó exclusivamente el árbol
de procesos creado para la auditoría y se verificó que los listeners
desaparecieron.

Los artefactos ignorados generados para esta prueba (`flo.db`, `flo.db-wal`,
`flo.db-shm` y el `userData` temporal) se eliminaron después de verificar sus
rutas exactas. No contenían datos previos ni datos del usuario.

## Repetición final

Después de crear exclusivamente la documentación y `AGENTS.md`, se repitió:

| Comando | Resultado final |
| --- | --- |
| `npm run lint` | Código 0; 677 avisos backend, 0 errores. |
| `npm run build` | Código 0. |
| `npm run build:frontend` | Código 0; 22 páginas estáticas; mantiene el aviso de 9 vulnerabilidades altas del tooling frontend. |
| `npm run test:upgrade-path` | Código 0; v0→v38, integridad, FK, conservación, paridad e idempotencia correctas. |
| `npm test` con Git Bash añadido temporalmente a `PATH` | Completó la cadena hasta `test:url-allowlist` y terminó correctamente; 8.324 líneas de stdout y 129 de stderr. |

El stderr final contiene errores provocados deliberadamente por pruebas
negativas, incluido un fallo simulado de copia premigración. No quedó ningún
listener en 3001/3002. Los logs temporales de la repetición se eliminaron tras
recoger el resultado.

## Criterio de calidad

La cobertura funcional automatizada es buena para un proyecto de este tamaño,
especialmente en migraciones, autorización y reglas transaccionales. La
confianza para producción sigue limitada por cuatro ausencias:

1. No hay métrica de cobertura.
2. Playwright no forma parte de la validación local ejecutada.
3. No hay prueba de hardware de impresión ni de caja/cajón.
4. No hay pruebas de estrés, corte eléctrico, pérdida de red, disco lleno,
   recuperación tras corrupción o concurrencia sostenida de varios
   comandero/KDS.

# Resultados de instalación, compilación y pruebas

## Preparación de revisión de PR #14

Fecha: 2026-07-31. Rama: `audit/m0-reconcile`. PR:
[joputajones/tpv-abierto#14](https://github.com/joputajones/tpv-abierto/pull/14).

La preparación inicial solo ejecutó comprobaciones de Git, diagnóstico de
entorno, consulta de GitHub Actions y validaciones documentales. Después de que
el propietario reparase manualmente Build Tools y el SDK, se ejecutó la
validación posterior documentada a continuación. Los resultados históricos se
conservan debajo y se distinguen de esta nueva ejecución.

### Validación posterior a la reparación administrativa

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

### Estado real de CI

Se inspeccionó el workflow finalizado `30587223544`, asociado al commit
`892f2c70d6fd0cbf8998a7bd127ffe77ce4ba935`.

| Job | Resultado | Clasificación |
| --- | --- | --- |
| `changes` | Correcto | El filtro clasificó la PR documental |
| `Tax invariant — uncategorized products remain zero-tax` | Correcto | La instalación del job y la prueba de invariantes terminaron correctamente |
| `dependency-review` | Fallo | Configuración/capacidad del repositorio: GitHub indica que Dependency Review no está soportado con la configuración actual |
| `linux-baseline` | Omitido | Omitido por el filtro de rutas de una PR solo documental |
| `e2e-playwright` | Omitido | Omitido por el filtro de rutas de una PR solo documental |

El estado rojo no demuestra un fallo del código de aplicación ni de la
documentación: el action de revisión de dependencias termina antes de evaluar
el cambio porque la función requerida no está disponible. La corrección del
workflow o de la configuración queda separada en el
[issue #19](https://github.com/joputajones/tpv-abierto/issues/19); no se modificó
`.github/workflows/ci.yml` en esta PR. Los logs también advierten que algunas
acciones fijadas a Node 20 son forzadas a Node 24; el aviso no causó este fallo.

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
| Git Bash | Sí, fuera de `PATH` | GNU Bash `5.3.15` en `C:\Program Files\Git\bin\bash.exe` | Requerido por `postinstall`/`verify:electron` y por `npm test` | Añadirlo temporalmente a `PATH` o hacer ambos caminos multiplataforma en otra PR |

`vswhere` encuentra la instancia y el componente
`Microsoft.VisualStudio.Component.VC.Tools.x86.x64`, pero no satisface
`Microsoft.VisualStudio.Workload.VCTools` ni
`Microsoft.VisualStudio.Component.Windows10SDK.19041`. La lista del instalador
conserva selecciones para C++ y SDK 19041, pero los archivos reales del SDK no
están instalados. Por tanto, no debe confundirse una selección incompleta con
un prerrequisito disponible ni prescribirse 19041 como versión obligatoria.

La acción manual asignada al propietario en el
[issue #18](https://github.com/joputajones/tpv-abierto/issues/18) se completó:
Build Tools y el SDK quedaron instalados. Codex no instaló componentes, no
cambió el registro y no persistió variables de entorno.

Tras la reparación, ejecutar desde un Developer PowerShell o Developer Command
Prompt:

```powershell
& "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe" -products * -all
where.exe cl
where.exe msbuild
$originalPath = $env:Path
try {
  $env:Path = 'C:\Program Files\Git\bin;' + $env:Path
  npm ci
  npm run verify:electron
  npm run build
  npm run build:frontend
  npm run test:upgrade-path
  npm test
} finally {
  $env:Path = $originalPath
}
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

El repositorio contiene 76 archivos `*.test.*` bajo `tests/` y dos specs
Playwright bajo `frontend/`. `package.json` define 72 scripts de prueba,
incluido el agregador `npm test`.

La suite agregada pasó al exponer Git Bash temporalmente en `PATH`. Cubre, entre
otros:

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

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

### Validación integrada posterior a PR #28

PR #28 se fusionó en `6d6f1d3d32bc8a954becc2bfae3af7ca314175f7`
y #16 se cerró. Desde ese `main`, PowerShell siguió sin encontrar Bash y se
repitió el camino integrado:

| Comando | Código | Duración | Resultado |
| --- | ---: | ---: | --- |
| `npm.cmd ci` | 0 | 32,1 s | 648 paquetes, rebuild nativo y Electron correctos; 1 advisory moderada raíz |
| `npm.cmd run test:migration-backup-fail-closed` | 0 | 4,6 s | Todos los fallos y caminos positivos pasan desde `main` |
| `npm.cmd run test:upgrade-path` | 0 | 1,6 s | Backup verificado y v0→v38 integrado |
| `npm.cmd run test:backup` | 0 | 1,2 s | 10/10 |
| `npm.cmd run build` | 0 | 12,9 s | TypeScript y assets correctos |
| `npm.cmd run build:frontend` | 0 | 50,3 s | 22 rutas estáticas |
| `npm.cmd test` | 0 | 154,8 s | Los 66 scripts terminaron; 9.524 líneas capturadas |

La CI de PR #28 pasó `changes`, invariante fiscal, `dependency-review`,
`linux-baseline` y `e2e-playwright`. R-005 queda `DONE` únicamente para la
barrera premigración local; M0 continúa `IN_PROGRESS` y la recuperación externa
o ante pérdida total sigue fuera de esta evidencia.

### Matriz de reinicio #30 antes del merge

Base inicial: `1b928c05985888210492323d640528026adb76ce`. Entorno: Windows 10
`10.0.19045`, PowerShell, Node `v22.20.0`, npm `10.9.3`, sin Bash en el PATH.
La issue [#30](https://github.com/joputajones/tpv-abierto/issues/30) contiene el
alcance y los criterios. El arnés usa procesos Electron-as-Node, PIDs propios,
directorios temporales, puertos efímeros y la fixture histórica saneada sin
modificarla. No lee el perfil real ni inicia cloud, telemetría, mDNS, updater,
impresión o ventana.

| Caso | Tipo | Resultado local | Evidencia principal |
| --- | --- | --- | --- |
| R-01 | Graceful | PASS, 5,5 s | API/KDS 200, salida 0, reapertura, escritura y puertos reutilizables |
| R-02 | Graceful + commit | PASS, 1,2 s | Orden/factura y maestros sintéticos presentes exactamente una vez |
| R-03 | Abrupto en reposo | PASS, 5,7 s | Reapertura inmediata de DB/API/KDS sin intervención |
| R-04 | Abrupto tras commit WAL | PASS, 1,2 s | WAL no vacío antes del kill; commit presente una vez |
| R-05 | Abrupto con transacción abierta | PASS, 1,2 s | Fila no confirmada ausente; baseline conservado |
| R-06 | Commit + no commit | PASS, 1,3 s | Primera operación presente; segunda ausente |
| R-07 | Secuencia | PASS, 1,3 s | Números distintos y monotónicos, sin colisión |
| R-08 | Cinco ciclos alternos | PASS, 3,8 s | Cinco commits, dos rollbacks, sin bloqueo o drift |
| R-09 | Upgrade + dos reopens | PASS, 1,8 s | v0→v38 una vez, un backup, filas y versión estables |
| R-10 | Puertos | PASS, 8,6 s | API/KDS reutilizados tras graceful y `taskkill` |
| R-11 | WAL/SHM | PASS | 18 observaciones; presencia temporal no penalizada |
| R-12 | Aislamiento | PASS | Ningún hijo vivo/log; todas las rutas bajo sandbox eliminado |

La repetición verde terminó en 33,0 s. El experimento de falso positivo cambió
temporalmente R-05 para esperar la fila no confirmada: terminó con código 1,
mostró `0 !== 1` bajo R-05, ejecutó `Cleanup PASS` y dejó cero directorios. La
expectativa se revirtió y la matriz volvió a pasar. La evidencia permanece
`PARTIAL` hasta revisión, Linux CI y merge; es `SIM`, no corte eléctrico,
disaster recovery, hardware, LAN hostil, operación real ni fiscalidad.

La validación completa de la rama se ejecutó en PowerShell normal. Los errores
que la suite imprime al probar cloud no registrado, pagos inválidos, facturas
inexistentes y JSON corrupto son expectativas negativas comprobadas; el runner
terminó correctamente y continuó hasta el script 67.

| Comando | Código | Duración | Resultado |
| --- | ---: | ---: | --- |
| `where.exe bash` | 1 | 0,1 s | Bash ausente, como se esperaba |
| `npm.cmd ci` | 0 | 31,9 s | 648 paquetes; rebuild nativo y Electron correctos; 1 advisory moderada raíz y aviso de `@types/bcryptjs` deprecado |
| `npm.cmd run test:restart-recovery` | 0 | 53,0 s | R-01…R-12, 18 estados WAL/SHM y limpieza final correctos |
| `npm.cmd run test:migration-backup-fail-closed` | 0 | 1,8 s | La barrera premigración sigue fail-closed |
| `npm.cmd run test:upgrade-path` | 0 | 1,7 s | v0→v38, conservación, integridad e idempotencia |
| `npm.cmd run test:backup` | 0 | 1,0 s | 10/10 |
| `npm.cmd run test:schema-health` | 0 | 1,6 s | Salud, deriva y reparaciones seguras correctas |
| `npm.cmd run test:cross-platform-scripts` | 0 | 0,8 s | Agregador actualizado a 67 scripts |
| `npm.cmd run lint` | 0 | 27,2 s | 0 errores; 676 avisos backend preexistentes; frontend limpio |
| `npm.cmd run build` | 0 | 13,8 s | TypeScript y assets correctos |
| `npm.cmd run build:frontend` | 0 | 51,3 s | Next 16.2.12 exporta 22 rutas; el `npm ci` interno informa 0 vulnerabilidades |
| `npm.cmd test` | 0 | 176,5 s | Los 67 scripts terminaron sin Bash |

No se modificó producción, esquema, migraciones, dependencias, lockfiles,
workflows ni licencia. El arnés eliminó sus directorios temporales y no dejó
procesos, listeners, bases ni logs fuera de su sandbox.

### Validación integrada posterior a PR #31

PR [#31](https://github.com/joputajones/tpv-abierto/pull/31) pasó a revisión
con head protegido
`2b61bd91c802c494eca30df9d32b063be1967ef0` y se fusionó mediante merge commit
`0b629ab6de5cf47939bc6c5305fe8faa4f43ee12`. La issue #30 se cerró
automáticamente. No hubo reviews, comentarios accionables ni conversaciones
pendientes antes del merge.

| Job CI (run `30668010945`) | Resultado | Duración | Evidencia |
| --- | --- | ---: | --- |
| `changes` | PASS | 7 s | Clasificó el cambio de tests/documentación |
| Invariante fiscal | PASS | 27 s | Productos sin categoría permanecen con impuesto cero |
| `dependency-review` | PASS | 8 s | Política configurada aplicada |
| `e2e-playwright` | PASS | 1 min 44 s | Flujo navegador verde |
| `linux-baseline` | PASS | 3 min 40 s | El log contiene 12 líneas R-01…R-12 PASS, `Evidence level: SIM` y `Cleanup PASS` |

La validación posterior se ejecutó desde el `main` integrado, todavía en
PowerShell normal sin Bash:

| Comando | Código | Duración | Resultado |
| --- | ---: | ---: | --- |
| `where.exe bash` | 1 | 0,1 s | Bash ausente, como se esperaba |
| `npm.cmd ci` | 0 | 33,0 s | 648 paquetes; rebuild nativo y Electron correctos; 1 advisory moderada raíz |
| `npm.cmd run test:restart-recovery` | 0 | 53,5 s | R-01…R-12 y limpieza pasan desde el merge commit |
| `npm.cmd run test:upgrade-path` | 0 | 1,6 s | v0→v38 e idempotencia |
| `npm.cmd run test:backup` | 0 | 1,0 s | 10/10 |
| `npm.cmd run build` | 0 | 13,4 s | TypeScript y assets correctos |
| `npm.cmd run build:frontend` | 0 | 51,2 s | 22 rutas; 0 vulnerabilidades en la instalación frontend |
| `npm.cmd test` | 0 | 170,3 s | Los 67 scripts terminaron sin Bash |

CORE-002 queda `DONE` solo para persistencia y reinicio controlado a nivel
`SIM`. M0 continúa `IN_PROGRESS`; no se acredita corte eléctrico, restore fuera
del equipo, hardware, operación real, fiscalidad ni disaster recovery.

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
| `npm.cmd run test:upgrade-path` | Correcto | v0→v38, copia, integridad, FK, conservación, paridad de esquema e idempotencia | Evidencia histórica: entonces no validaba el fallo de copia; PR #28 lo resuelve en el camino integrado |
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

## Validación de backup fuera del equipo — integrada

- Fecha: 2026-08-01
- Rama: `test/off-device-backup-restore`
- Base inicial: `731455a7fa5068af988011cf72908b8eb417e085`
- Entorno: Windows 10, PowerShell, Node `v22.20.0`, npm `10.9.3`

### Línea base antes del cambio

| Comando | Código / duración | Resultado |
|---|---:|---|
| `npm.cmd run test:backup` | 0 / 1,3 s | 10/10 del test histórico simplificado |
| `npm.cmd run test:migration-backup-fail-closed` | 0 / 5,3 s | Barreras negativas, copia v0 y reintento pasan |
| `npm.cmd run test:restart-recovery` | 1 / 31,2 s | Primer intento: R-01 agotó su espera de readiness de 30 s; la limpieza del sandbox pasó |
| repetición aislada de `npm.cmd run test:restart-recovery` | 0 / 31,9 s | R-01…R-12 y limpieza pasan; R-01 tardó 6,1 s |

El timeout inicial existía antes de modificar archivos y no se oculta. La
repetición autorizada pasó y una ejecución posterior completa también pasó,
con R-01 en 27,1 s; esto muestra variabilidad relevante cerca del límite de 30
segundos aunque no bloqueó esta validación.

### Protocolo posterior al cambio

| Comando exacto | Código / duración | Resultado, avisos y límite |
|---|---:|---|
| `where.exe bash` | 1 | Bash no está disponible y no fue añadido al `PATH`; resultado esperado |
| `npm.cmd ci` | 0 / 35,8 s | Instalación limpia y postinstall correctos; aviso preexistente por `@types/bcryptjs` deprecado |
| `npm.cmd run test:off-device-restore` | 0 / 7,8 s | Productor, transporte, consumidor aislado, reapertura, escritura posterior y B-01…B-07 pasan en Windows |
| `npm.cmd run test:restart-recovery` | 0 / 54,4 s | R-01…R-12, 18 observaciones WAL/SHM y limpieza; R-01 tardó 27,1 s |
| `npm.cmd run test:migration-backup-fail-closed` | 0 / 2,3 s | Todos los fallos obligatorios bloquean y el camino verificado pasa |
| `npm.cmd run test:upgrade-path` | 0 / 1,8 s | v0→v38, integridad, FK, conservación, paridad e idempotencia |
| `npm.cmd run test:backup` | 0 / 1,1 s | 10/10 del test histórico |
| `npm.cmd run test:schema-health` | 0 / 1,5 s | Esquema fresco y migrado sin deriva; reparaciones seguras pasan |
| `npm.cmd run lint` | 0 / 31,8 s | 0 errores; 676 avisos backend preexistentes; frontend limpio |
| `npm.cmd run build` | 0 / 14,1 s | TypeScript y assets de runtime correctos |
| `npm.cmd run build:frontend` | 0 / 52,9 s | `npm ci` frontend sin vulnerabilidades y export estático de 22 rutas |
| `npm.cmd test` | 0 / 178,3 s | Los 68 scripts terminan sin Bash; el último es `test:cross-platform-scripts` |

Tras endurecer la comparación de secuencias al cruzar medianoche y el escaneo
de marcadores privados, se repitieron `test:off-device-restore`,
`test:cross-platform-scripts`, lint, ambos builds y los 68 scripts. La segunda
suite completa terminó con código 0 en 186,1 s; lint mantuvo 0 errores/676
avisos y el frontend volvió a exportar 22 rutas con 0 vulnerabilidades en su
instalación limpia.

La suite completa conserva stderr ruidoso por negativos deliberados: cloud no
registrado, JSON de pago inválido, reglas fiscales inexistentes, saldos
insuficientes, impresión de factura inexistente y held-order inválida. Son
expectativas de tests que terminan con código 0, no fallos omitidos.

### Alcance de la evidencia local

El paquete local contiene exactamente cuatro archivos sintéticos y efímeros;
el test borra productor, destinos y copias mutadas. Ninguna base, WAL/SHM, ZIP,
checksum real, log o artifact se versiona. Esta ejecución prueba procesos y
sandboxes separados en un host Windows (`SIM`). PR #35 integró después la
transferencia real Windows→artifact→Windows/Linux y elevó solo la parte
automatizada a `CI_CROSS_RUNNER`. La ejecución humana en otro equipo físico
sigue sin realizarse.

### Evidencia CI cross-runner y merge

- PR técnica: [#35](https://github.com/joputajones/tpv-abierto/pull/35), head
  protegido `64c86e4c0ce777ed1049701f061695bbc4174cd9`, merge commit
  `4877d72e300b44ad88fe659f0b43a970fe92fd81`.
- Workflow: run `30671201413`.
- Productor Windows: job `91289109116`, PASS.
- Consumidor Linux: job `91289484157`, PASS.
- Consumidor Windows: job `91289484167`, PASS.
- Artifact `synthetic-off-device-restore-v1`, ID `8808866260`, tamaño de
  archivo `15277` bytes y retención de 3 días; no se publica como release.
- Identidad común: schema `38`, app `2.4.7`, dataset
  `synthetic-off-device-restore-v1`, tamaño `376832` bytes y SHA-256 de base
  `d2c4ee11c10544bcca43283266ab5e4d85dc0df467f91a21e296638845c1da95`.
- Los consumidores partieron de jobs/filesystems nuevos, descargaron solo el
  artifact, verificaron el hash antes de abrir SQLite o crear el destino,
  restauraron, reabrieron, escribieron un pedido/factura posterior y volvieron
  a abrir con persistencia e integridad correctas.

El artifact contiene exclusivamente los cuatro ficheros sintéticos permitidos.
El digest del ZIP gestionado por GitHub
`2c866213e53cd26e79f660423598b9e2baad9049c466893036e2683762723877` no se
confunde con el SHA-256 anterior de `flo-backup.db`. Las anotaciones sobre
acciones Node 20 forzadas a Node 24 y el servicio de caché de GitHub no
afectaron la instalación ni se usaron como canal de transporte.

### Validación posterior desde `main`

Desde `4877d72`, `npm.cmd ci`, `test:off-device-restore`,
`test:restart-recovery`, `test:backup`, `build`, `build:frontend` y `npm.cmd
test` terminaron con código 0. La suite completa pasó los 68 scripts en 176,2
s; R-01…R-12 pasaron con R-01 en 27,435 s; el frontend exportó 22 rutas. La
instalación raíz informó una vulnerabilidad moderada y el aviso deprecado de
`@types/bcryptjs`; no se cambiaron dependencias para esta validación.

El push integrado ejecutó Off-device restore `30671483373` y CI
`30671483318`, ambos PASS. Full Cross-Platform Matrix `30671483337` reprodujo
en macOS un fallo anterior a PR #35: la prueba sin Bash ocultaba también
`xattr` y `codesign`. PR #36 aisló el arreglo en el test, sin cambiar
producción ni dependencias, y se fusionó con head protegido `d9920d7` como
`5a8aa945`. La matriz manual `30672202465` sobre ese head pasó Ubuntu, Windows,
macOS x64 y macOS arm64, incluidos build, 68 scripts y paquete de cada
plataforma.

El push de ese merge commit a `main` confirmó de nuevo CI `30672597277`,
Off-device restore `30672597279` y Full Cross-Platform Matrix `30672597296`,
los tres PASS. La última matriz ejecutó los cuatro targets desde el commit
integrado, no desde la rama de la PR.

### Clasificación final

La creación portable, transferencia por artifact, restauración limpia en
Windows/Linux y continuidad posterior son `DONE` a nivel `CI_CROSS_RUNNER`.
La issue técnica #33 está cerrada. Posteriormente #34 se ejecutó y cerró con
aceptación funcional limitada: hubo otra persona/equipo y restauración visible,
pero no se completaron todas las comprobaciones técnicas. #39 conserva la
deuda de usabilidad; R-011 permanece `PARTIAL` y M0 `IN_PROGRESS`.

## Operación completa sin Internet — evidencia de rama e integración

- Fecha: 2026-08-01.
- Rama: `test/full-offline-operation`.
- Base inicial real: `87930805fd76a29f984917203b85a149aa75de13`.
- Entorno: Windows 10, PowerShell, Node `v22.20.0`, npm `10.9.3`.
- Bash: `where.exe bash` terminó con código 1; no está instalado/disponible.
- Seguimiento: #34 cerrado con limitaciones; #39 y #40 creadas y asignadas.

### Hallazgo rojo/verde de producción

La primera inicialización del worker abrió una base nueva y observó dos
intentos a `telemetry.flopos.com` antes de crear propietario o registrar
consentimiento. La causa fue `seedInstallDefaults()` con
`anonymous_data_consent=true` y `telemetry_enabled=true`, contradictorio con la
migración v28 y los comentarios opt-in. Se cambiaron solo esos dos defaults a
`false`; no se modificó esquema ni migración. Después, O-01 y O-10 observan
cero intentos y O-11 demuestra que el caso consentido se bloquea y trata de
forma no fatal.

### Iteraciones del arnés que no se ocultan

| Ejecución | Código / duración | Resultado |
|---|---:|---|
| Autotest inicial del wrapper `ws` | 1 / <1 s | Detectó copia de constantes de solo lectura; se sustituyó por un `Proxy` que conserva exports sin mutarlos |
| Primer arranque de la matriz | 1 / 49,4 s | O-01 agotó 30 s; el diagnóstico aislado reveló telemetría preconsentimiento y que el guard rechazaba el bind `0.0.0.0` |
| Repetición con diagnóstico | 1 / 6,1 s | `ECONNREFUSED` confirmó que el API/KDS no podía conservar el wildcard bind; se permitió únicamente la dirección no enrutable `0.0.0.0`/`::` para listeners |
| Primera matriz funcional | 1 / 21,6 s | O-01…O-07 PASS; O-08 falló por expectativa textual `'0'` frente a `'false'`, ambos valores desactivados |
| Segunda matriz funcional | 1 / 27,7 s | O-01…O-14 PASS; O-15 expuso una carrera del test con el estado `flushing` de la outbox |
| Matriz corregida | 0 / 25,5 s | O-01…O-16 y O-FP PASS; se hizo explícito el reintento real de outbox sin esperar el intervalo de 15 s |

Todos los fallos anteriores pertenecían al arnés excepto el default de
telemetría, que era un defecto de producción localizado. Los sandboxes y
procesos hijos se limpiaron incluso en las rutas fallidas.

### Validación local completa sin Bash

| Comando | Código / duración | Resultado |
|---|---:|---|
| `npm.cmd run test:cross-platform-scripts` | 0 / <1 s | El runner reconoce 69 scripts y conserva invocación/fail-fast multiplataforma |
| `where.exe bash` | 1 / 0,2 s | Resultado esperado: Bash no está instalado ni disponible |
| `npm.cmd ci` (primer intento) | 1 (`EPERM -4048`) / 9,6 s | Una instancia `npm run dev` preexistente mantenía bloqueado `better-sqlite3`; se identificó y terminó solo el árbol de procesos de este repositorio, y los puertos 3001/3002 quedaron libres |
| `npm.cmd ci` (repetición limpia) | 0 / 72,8 s | 648 paquetes instalados y módulos nativos reconstruidos; 1 vulnerabilidad moderada y avisos de paquete obsoleto/funding |
| `npm.cmd run test:full-offline-operation` (primera tras `ci`) | 1 / 49,2 s | O-01 agotó el límite de readiness de 30 s durante inicialización fría de Electron; sandbox y procesos se limpiaron |
| `npm.cmd run test:full-offline-operation` (repetición) | 0 / 29,3 s | Readiness separado elevado a 60 s; O-01…O-16 y O-FP PASS, 9 intentos, 7 bloqueos, 2 redirecciones loopback autorizadas, 0 éxitos Internet y máximo 0 ms frente a límite 250 ms |
| `npm.cmd run test:restart-recovery` | 0 / 58,3 s | R-01…R-12 PASS, incluidas 18 observaciones WAL y limpieza |
| `npm.cmd run test:off-device-restore` | 0 / 8,1 s | A-01/A-02 y B-01…B-07 PASS con datos exclusivamente sintéticos |
| `npm.cmd run test:migration-backup-fail-closed` | 0 / 3,1 s | Barreras negativas y camino correcto PASS |
| `npm.cmd run test:upgrade-path` | 0 / 2,6 s | v0→v38, copia, preservación, paridad e idempotencia PASS |
| `npm.cmd run test:backup` | 0 / 1,9 s | 10/10 comprobaciones PASS |
| `npm.cmd run test:schema-health` | 0 / 3,2 s | Esquema v38, instalación limpia y hallazgos safe/manual-review PASS |
| `npm.cmd run lint` | 0 / 57,4 s | Cero errores; 676 advertencias preexistentes de tipado/variables no usadas |
| `npm.cmd run build` | 0 / 25,4 s | TypeScript y copia de assets runtime PASS |
| `npm.cmd run build:frontend` | 0 / 74,1 s | Next.js 16.2.12 genera 22 páginas estáticas; 0 vulnerabilidades en la instalación frontend |
| `npm.cmd test` | 0 / 316,6 s | Los 69 scripts PASS sin Bash; los errores impresos corresponden a casos negativos deliberados |

El flujo real probado crea/edita categoría y producto, crea mesa, abre un
pedido dine-in, añade una segunda línea con cantidad 2, confirma, consulta KDS
REST/WebSocket, genera una factura sintética de 36 EUR y registra pago en
efectivo. Tras cierre ordenado y terminación abrupta sobreviven producto,
pedido, factura y pago; `integrity_check=ok`, `user_version=38`,
`foreign_key_check` vacío y una escritura posterior funciona.

El frontend estático no contiene referencias runtime externas en la ruta raíz.
El arnés inspecciona los HTML exportados y comprueba que sus recursos runtime
locales existen. Un proceso Electron real oculto carga raíz, login, setup, POS,
KDS standalone y ajustes; CSP y `session.webRequest` rechazan sondas HTTPS/WSS.
Los enlaces externos que requieren una acción del usuario no se clasifican como
recursos de arranque. O-12 comprueba de forma
determinista un endpoint de actualización bloqueado y salud local posterior,
pero no ejecuta un feed de release empaquetado. O-15 usa exclusivamente un
servidor HTTP loopback y no acredita interoperabilidad con cloud real.

### Repetición final tras reforzar O-13

| Comando | Código / duración | Resultado |
|---|---:|---|
| `npm.cmd run test:full-offline-operation` | 0 / 25,4 s | O-01…O-16 y O-FP PASS, incluidas cinco rutas principales en Electron |
| `npm.cmd run lint` | 0 / 52,6 s | Cero errores y las mismas 676 advertencias heredadas |
| `npm.cmd run build` | 0 / 25,6 s | PASS |
| `npm.cmd run build:frontend` | 0 / 130,7 s | 22 páginas estáticas, 0 vulnerabilidades frontend |
| `npm.cmd test` | 0 / 352,6 s | 69/69 scripts PASS sin Bash |

### Primera ejecución de CI de la PR #41

La primera ejecución confirmó Windows y encontró un requisito de testabilidad
en Linux. `offline-operation (windows-latest)` pasó; en Ubuntu, O-01…O-12
pasaron y O-13 terminó con `SIGTRAP` y
`Can't create a GtkStyleContext without a display connection`. El mismo O-13
hizo fallar `linux-baseline` porque la suite completa ya incluye la matriz.
La causa es que GitHub-hosted Ubuntu no expone un display GTK, no un acceso a
Internet ni un fallo del flujo local. La workflow se corrigió para ejecutar la
suite que contiene el renderer oculto bajo el X virtual ya disponible en el
runner (`xvfb-run`), sin añadir paquetes o dependencias del producto. La
repetición CI permanece pendiente; los dos fallos iniciales no se ocultan.

En la segunda ejecución, el job offline dedicado de Ubuntu pasó completo, pero
`linux-baseline` repitió O-13 dentro de los 69 scripts y encontró una aserción
inestable del arnés: una ruta protegida estaba en una redirección cliente y su
texto era temporalmente vacío aunque el documento local había cargado. Se
mantuvo la exigencia de contenido visible en la raíz y, para cada ruta, se
sustituyó `bodyLength > 0` por HTTP 200, DOM `complete` y URL final loopback.
Esto conserva la prueba de carga local sin confundir un estado transitorio de
la UI con una dependencia externa. La nueva repetición CI queda pendiente.

### Validación local del ajuste tras la segunda ejecución CI

| Comando | Código / duración | Resultado |
|---|---:|---|
| `npm.cmd run test:full-offline-operation` | 0 / 22,8 s | O-01…O-16 y O-FP PASS con la aserción estable de rutas protegidas |
| `npm.cmd run lint` | 0 / 46,5 s | Cero errores; 676 advertencias heredadas |
| `npm.cmd run build` | 0 / 25,4 s | PASS |
| `npm.cmd run build:frontend` | 0 / 114,7 s | 22 páginas estáticas, 0 vulnerabilidades frontend |
| Primer intento orquestado de `npm.cmd test` | interrumpido / 4,4 s | El límite externo de 1 s cerró stdout y causó `EPIPE`; no se clasifica como resultado del repositorio |
| Repetición verificable de `npm.cmd test` | 0 / 198,5 s | 69/69 scripts PASS sin Bash; las trazas de error son casos negativos deliberados |

En ese punto, la instalación limpia, las pruebas específicas de reinicio/
backup/migración, lint, ambos builds y los 69 scripts habían pasado localmente.
No quedaron listeners en 3001/3002 ni procesos del repositorio. La clasificación
seguía provisional a la espera de CI y merge; los resultados posteriores se
registran a continuación.

### CI y merge de la PR #41

La tercera ejecución CI sobre head protegido `5909e55` pasó los diez checks:
dependency review, cambios, invariante fiscal, Playwright, Linux baseline,
offline Windows/Ubuntu, productor de backup y restauración Windows/Ubuntu.
Los runs fueron `30708876792` (CI) y `30708876787` (restore). No hubo
`continue-on-error`, reviews ni conversaciones pendientes. PR #41 se fusionó
como `4961cb22161faaa3cab8ed22a5ed57e9d989d0ed` y #40 se cerró inicialmente.

### Fallo post-merge conservado y PR correctiva #42

La primera validación integrada de `4961cb2` encontró un defecto reproducible
del arnés inmediatamente después de la instalación limpia:

| Comando / diagnóstico | Código / duración | Resultado |
|---|---:|---|
| `npm.cmd ci` | 0 / 56,2 s | 648 paquetes, rebuild Electron correcto, 1 vulnerabilidad moderada raíz y aviso `@types/bcryptjs` |
| `npm.cmd run test:full-offline-operation` | 1 / 99,9 s | O-01 agotó 60 s; worker vivo sin stdout/stderr |
| repetición de la matriz | 1 / 86,7 s | Mismo timeout O-01; #40 se reabrió y CORE-004 siguió `PARTIAL` |
| `npm.cmd run test:smoke` | 0 / 26,3 s | Electron, `better-sqlite3`, migraciones y servidores sanos |
| coordinador ejecutado directamente con Node | 1 / 31,0 s | O-01…O-12 PASS; O-13 reveló correctamente que `process.execPath` era Node y no Electron |

La causa era el coordinador ejecutándose como Electron-as-Node y lanzando otro
Electron mediante `process.execPath`; ese proceso anidado quedaba bloqueado en
este Windows. PR #42 ejecuta el coordinador con Node y resuelve explícitamente
el binario Electron para worker y renderer. El false-positive probe sigue como
Node. No cambió producción, dependencias, lockfiles, esquema, migraciones,
licencia ni marca.

Validación local de `9bc6f74`:

| Comando | Código / duración | Resultado |
|---|---:|---|
| `npm.cmd run test:cross-platform-scripts` | 0 / 1,9 s | Impide reintroducir el coordinador Electron anidado |
| `npm.cmd run test:full-offline-operation` | 0 / 29,1 s | O-01…O-16 + O-FP PASS |
| `npm.cmd run lint` | 0 / 60,2 s | 0 errores; 676 advertencias heredadas |
| `npm.cmd run build` | 0 / 28,1 s | PASS |
| `npm.cmd run build:frontend` | 0 / 105,4 s | 22 rutas; 0 vulnerabilidades frontend |
| `npm.cmd test` | 0 / 372,9 s | 69/69 PASS |

PR #42 pasó sus diez checks en los runs `30709810490` y `30709810483`,
incluidos offline Windows/Ubuntu y Linux baseline, y se fusionó como
`a05cc79044ec5b59503795107bcee3af1ae2d34b`. #40 volvió a cerrarse mediante
`Closes #40`.

### Validación integrada final desde `main`

| Comando | Código / duración | Resultado |
|---|---:|---|
| `npm.cmd ci` | 0 / 85,2 s | 648 paquetes y módulo nativo correctos; 1 vulnerabilidad moderada raíz, 127 funding y aviso deprecado conocidos |
| `npm.cmd run test:full-offline-operation` | 0 / 84,5 s | O-01…O-16 + O-FP PASS; O-01 tardó 57,715 s tras el `ci` frío; 9 intentos, 7 bloqueos, 2 loopback aprobados, 0 Internet exitosos, máximo 0 ms/250 ms |
| `npm.cmd run test:restart-recovery` | 0 / 68,0 s | R-01…R-12 PASS, 18 observaciones WAL/SHM y limpieza; evidencia `SIM`, no corte eléctrico |
| `npm.cmd run build` | 0 / 45,3 s | TypeScript y assets PASS |
| `npm.cmd run build:frontend` | 0 / 129,3 s | 22 rutas estáticas, 0 vulnerabilidades frontend |
| `npm.cmd test` | 0 / 329,6 s | 69/69 scripts PASS sin Bash |

No quedaron listeners en 3001/3002, procesos del repositorio ni artefactos de
datos versionados. CORE-004 queda `DONE` exclusivamente a nivel `SIM/CI`.
R-011 y R-018 permanecen `PARTIAL`; #34 conserva su cierre con limitaciones,
#39 permanece abierta y M0 continúa `IN_PROGRESS`. No se acredita desconexión
física, LAN hostil/multidispositivo, impresoras, teléfonos, un turno completo,
operación real de restaurante ni cumplimiento fiscal.

### Hallazgo posterior en la matriz completa y corrección PR #44

La revisión de los workflows de `main` encontró una evidencia roja que no debe
quedar oculta. El run Full Cross-Platform Matrix `30710043950` sobre
`a05cc79044ec5b59503795107bcee3af1ae2d34b` falló aunque CI normal, restore y
la secuencia local integrada habían pasado:

- macOS x64: PASS;
- macOS arm64 y Windows: O-13 leyó transitoriamente un `body` vacío durante la
  redirección cliente de una ruta protegida;
- Ubuntu: el workflow completo arrancó Electron sin display GTK, fuera de
  `xvfb-run`.

El mismo defecto reapareció en el run documental `30710893454`. #40 se reabrió
y CORE-004 volvió provisionalmente a `PARTIAL`. PR #44 no relajó la comprobación:
O-13 espera como máximo 10 s a que termine la redirección y exige DOM completo,
URL final loopback y contenido visible no vacío. El workflow ejecuta la suite
Linux bajo Xvfb y conserva la ejecución ordinaria en Windows/macOS. No cambió
producción, dependencias, lockfiles, esquema, migraciones, licencia ni marca.

Validación local de `1d1d7e2` antes del merge:

| Comando | Código / duración | Resultado |
|---|---:|---|
| `npm.cmd run test:full-offline-operation` (repetición 1) | 0 / 25,1 s | O-01…O-16 + O-FP PASS |
| `npm.cmd run test:full-offline-operation` (repetición 2) | 0 / 23,7 s | O-01…O-16 + O-FP PASS |
| `npm.cmd run test:cross-platform-scripts` | 0 / 1,9 s | PASS |
| `npm.cmd run test:release-config` | 0 | PASS |
| `npm.cmd run lint` | 0 / 59,2 s | 0 errores; 676 advertencias heredadas |
| `npm.cmd run build` | 0 / 29,9 s | PASS |
| `npm.cmd run build:frontend` | 0 / 80,2 s | 22 rutas; 0 vulnerabilidades frontend |
| `npm.cmd test` | 0 / 291,3 s | 69/69 PASS |

El run manual Full Cross-Platform Matrix `30711336203` sobre ese head pasó
suite y empaquetado sin instalador en Ubuntu, Windows, macOS x64 y macOS arm64.
Los diez checks aplicables de la PR pasaron y PR #44 se fusionó como
`a6724c56ba3f43917618d3470850f9d69bc928bb`.

### Validación posterior definitiva desde `main`

| Evidencia | Resultado |
|---|---|
| `npm.cmd run test:full-offline-operation` | Código 0 / 28,5 s; O-01…O-16 + O-FP PASS, 9 intentos, 7 bloqueados, 2 loopback aprobados, 0 Internet exitosos, máximo 0 ms/250 ms |
| `npm.cmd test` | Código 0 / 348,2 s; 69/69 scripts PASS sin Bash; las trazas de errores funcionales son expectativas negativas deliberadas |
| CI `30711604398` | PASS: Linux baseline, Playwright, offline Ubuntu/Windows e invariante fiscal; dependency review se omite correctamente en push sin PR |
| Off-device restore `30711604457` | PASS: productor Windows y restores independientes Windows/Ubuntu |
| Full Cross-Platform Matrix `30711604415` | PASS: suite completa, build y empaquetado sin instalador en Ubuntu, Windows, macOS x64 y macOS arm64 |

La matriz completa emitió avisos no bloqueantes: varias acciones de GitHub aún
declaran runtime Node 20 y el runner las fuerza a Node 24; además, el servicio
de caché devolvió errores 400/indisponibilidad temporal en Ubuntu y macOS. La
instalación, pruebas, builds y artifacts terminaron correctamente sin depender
de esa caché. #40 está cerrada como `COMPLETED`.

CORE-004 vuelve a `DONE` exclusivamente a nivel `SIM/CI`. R-011 y R-018 siguen
`PARTIAL`, #39 sigue abierta y M0 continúa `IN_PROGRESS`. La evidencia no se
extiende a desconexión física, LAN hostil, hardware, móviles, turno completo,
restaurante real, cloud real ni cumplimiento fiscal.

## Evidencia local previa a PR del asistente gráfico #39

Rama `feat/non-technical-recovery-assistant`, iniciada desde
`f502b0d766fa25cb0aad0f4e8ebf7b3736f281c0`. Solo se usaron paquetes y bases
sintéticas desechables.

| Comando | Código / duración | Resultado |
|---|---:|---|
| `npm.cmd run test:off-device-restore` | 0 / 7,3 s | A-01/A-02 y B-01…B-07 siguen pasando tras extraer la validación a producción |
| `npm.cmd run test:recovery-assistant` | 0 / 30,7 s | A-01…A-13 PASS; fuente intacta y sandbox eliminado |
| `node tests/recovery-assistant-e2e.test.cjs` | 0 / 8,4 s | A-14…A-16 PASS con Electron real, menú, teclado, progreso, informe, verde/rojo y cero conexiones externas |
| `npm.cmd run build` | 0 / 22,2 s | TypeScript y assets PASS |
| `npm.cmd run build:frontend` | 0 / 98,7 s | 23 rutas estáticas, incluida `/recovery-assistant`; 0 vulnerabilidades frontend |
| `npm.cmd ci` | 0 / 91,9 s | 648 paquetes, rebuild nativo y verificación Electron; 1 vulnerabilidad moderada raíz y aviso `@types/bcryptjs` |
| `npm.cmd run test:full-offline-operation` | 0 | O-01…O-16 + O-FP PASS; 0 conexiones Internet exitosas |
| `npm.cmd run test:restart-recovery` | 0 | R-01…R-12 PASS y limpieza completa |
| `npm.cmd run lint` (final) | 0 | 0 errores y 677 advertencias heredadas |
| `npm.cmd run build` + `build:frontend` (final) | 0 | TypeScript PASS; 23 rutas y 0 vulnerabilidades frontend |
| `npm.cmd test` (final) | 0 / incluido en bloque de 810,6 s | 71/71 scripts PASS sin Bash; el bloque incluye lint y ambos builds previos |
| empaquetado Windows x64 + verificador | 0 / 70,4 s | ASAR contiene módulos/worker/assets y el `.exe` completa paquete sintético con resultado verde |

Falso positivo: se cambió temporalmente A-03 para esperar verde ante un
checksum alterado. El runner terminó con código 1 en 6,4 s e identificó
`'red' !== 'green'`; el cambio se revirtió por completo y A-03 volvió a pasar.

El primer smoke empaquetado solo comprobaba que cargase la UI. Al reforzarlo
para exigir una restauración completa, falló porque `db.js` cargaba el módulo
de desarrollo `electron` dentro del worker empaquetado. El acceso se hizo
diferido y la ruta/versión temporal explícita; la repetición Windows completó
validación, restore, reapertura y escritura desde ASAR. Linux y macOS x64/arm64
quedan pendientes de la matriz CI, que ejecuta el mismo verificador tras
empaquetar.

La CI y la matriz remota siguen pendientes. #39, R-011 y M0
conservan respectivamente `OPEN`, `PARTIAL` e `IN_PROGRESS`; no se afirma que
la automatización equivalga a la prueba humana preparada.

### Revalidación definitiva antes de publicar la PR #39

Tras sustituir la vigilancia de toda la carpeta de origen por la comprobación
exclusiva de sidecars SQLite y añadir la matriz multiplataforma al evento
`pull_request`, se repitió el protocolo completo:

| Comando | Código / duración | Resultado |
|---|---:|---|
| `npm run test:recovery-assistant` | 0 / 47,0 s | A-01…A-13 PASS |
| `npm run test:recovery-assistant-e2e` | 0 / 195,2 s | Build limpio y A-14…A-16 PASS con Electron real y cero conexiones externas |
| `npm run test:off-device-restore` | 0 / 18,1 s | A-01/A-02 y B-01…B-07 PASS usando la lógica de producción compartida |
| `npm run test:off-device-backup` | 1 / 2,2 s | Error de operador documentado: el script no existe; se corrigió al nombre `test:off-device-restore` |
| `npm run lint` | 0 / 62,6 s | 0 errores; 677 advertencias conocidas |
| `npm run build` | 0 / 41,1 s | TypeScript y assets PASS |
| `npm run build:frontend` | 0 / 100,2 s | 23 rutas estáticas; 0 vulnerabilidades frontend |
| `npm test` | 0 / 428,6 s | 71/71 scripts PASS; trazas negativas deliberadas sin fallo del runner |
| `npm run build:win` | 0 / 216,4 s | Windows x64, ASAR, `better-sqlite3` y NSIS generados correctamente |
| `node scripts/verify-recovery-assistant-package.cjs` | 0 / 7,2 s | El ejecutable empaquetado restaura, reabre, escribe y devuelve verde en aislamiento |

Al finalizar no había procesos Electron ni listeners en 3001/3002. La raíz
temporal `%TEMP%/flo-recovery-check` quedó vacía y no se versionó ningún
paquete, base, sidecar, log o informe generado. Los finales de línea CRLF que
Git anuncia en Windows son avisos de conversión del árbol de trabajo, no
errores de contenido. Linux y macOS x64/arm64 siguen pendientes de la matriz
remota exigida antes de cualquier merge.

Una revisión adversarial posterior hizo fail-safe el error de arranque del
worker, evitó marcar pasos visuales antes de confirmarlos y capturó fallos IPC
con mensajes no técnicos. La revalidación final dio: A-01…A-13 en 41,1 s;
lint en 59,7 s (0 errores/677 advertencias); build principal en 43,2 s;
frontend en 123,4 s; `npm test` 71/71 en 547,5 s; paquete Windows x64 `--dir`
en 50,8 s; y ejecución sintética del binario empaquetado en 7,1 s, todo con
código 0.

### Primera CI de la PR #46 y corrección del arnés

El head `76bdeaf4` pasó dependency review, invariante fiscal, Playwright,
offline Windows/Ubuntu, productor/restore Windows/Ubuntu, la suite y el
empaquetado Windows. El run Full Cross-Platform Matrix `30723820390` encontró
dos defectos del arnés: macOS x64/arm64 empaquetó y pasó 71/71, pero el
verificador no eliminaba `/` inicial de las entradas ASAR; Ubuntu y Linux
baseline abortaron el E2E porque el runner sin privilegios no tenía el helper
SUID de Chromium con modo 4755. No fue un fallo de restore ni de producción.

La corrección normaliza `/` y `\` en el verificador y añade `--no-sandbox`
solo a los lanzamientos Electron de test en Linux. La aplicación distribuida
no recibe ese flag. Evidencia local posterior: scripts multiplataforma 0/2,1
s; A-14…A-16 0/137 s; ejecutable empaquetado 0/6,6 s; lint 0/46,5 s con 677
avisos; y suite 71/71 0/566,4 s. La segunda CI queda pendiente.

La segunda ejecución (`30724645927`) confirmó la normalización ASAR, pero el
job macOS arm64 detectó que el verificador recursivo podía escoger el binario
de `Flo Cafe Helper.app` antes que el ejecutable principal. El paquete y su
binario nativo se habían generado correctamente y la suite 71/71 había pasado.
El arnés se corrigió para derivar el ejecutable exclusivamente del directorio
`Contents/MacOS` correspondiente al mismo `Resources/app.asar` validado, sin
modificar la aplicación ni el empaquetado. La comprobación localizada y el
verificador Windows empaquetado pasaron; el protocolo posterior completo
(`lint`, build principal, build frontend y 71/71) terminó con código 0 en
682,3 s, con los 677 avisos de lint ya registrados. La nueva ejecución queda
pendiente.

La tercera ejecución (`30725166044`) permitió arrancar Electron en Ubuntu con
el sandbox de Chromium desactivado solo para test y alcanzó A-16. El evento Tab
enviado con `webContents.sendInputEvent` no actuó porque esa API requiere una
ventana enfocada y `xvfb-run` no ejecuta un gestor de ventanas. El E2E conserva
la prueba real del orden de foco, pero envía Tab mediante
`Input.dispatchKeyEvent` de Chromium, independiente del foco del sistema. No
se modificó la interfaz ni se sustituyó la navegación por una asignación de
foco programática.

La misma ejecución confirmó macOS arm64 completamente (71/71, paquete y smoke
del asistente). macOS x64 también pasó 71/71 y generó el paquete con su binario
nativo, pero `macos-latest` era un runner ARM64 y el smoke x64 no llegó a crear
su resultado. La matriz asigna desde entonces `macos-15-intel` a x64 y conserva
`macos-latest` para arm64, de modo que cada aplicación empaquetada se ejecuta
en su arquitectura nativa. La nueva ejecución queda pendiente.

Evidencia local posterior: A-14…A-16 con Electron/frontend reales, incluido
Tab mediante Chromium, pasaron con código 0 en 166,1 s. La prueba de matriz,
lint (0 errores/677 avisos), build principal, build frontend y la suite 71/71
pasaron después con código 0 en 635 s.

La cuarta ejecución (`30726107720`) asignó correctamente el runner Intel,
pero `npm ci` se detuvo antes del build: el bundle x64 del runtime Electron de
desarrollo llegó sin la firma ad-hoc que exige `verify:electron`. La descarga
había terminado y el rebuild nativo había pasado. Para conservar el gate sin
desactivar Gatekeeper ni relajar el verificador, solo el runner Intel instala
sin scripts, ejecuta el instalador oficial de Electron, aplica una firma
ad-hoc local al runtime desechable, reconstruye las dependencias nativas y
ejecuta `verify:electron`. Esto no firma ni modifica el paquete distribuido.
La nueva ejecución queda pendiente.

La quinta ejecución (`30726252221`) confirmó Windows, macOS arm64 y macOS x64
completamente, incluidos 71/71, paquete y smoke del asistente. La preparación
Intel pasó también `verify:electron`. En los dos jobs Ubuntu, el protocolo de
depuración de Chromium no pudo producir la acción Tab porque Xvfb seguía sin
gestor de ventanas. Los runners Linux instalan desde entonces Openbox solo
como dependencia de CI y ejecutan la suite en un escritorio X desechable. El
E2E vuelve al `sendInputEvent` nativo de Electron y exige primero que la
ventana esté realmente enfocada. No se añade una dependencia a FloCafe ni se
afecta el uso sin Bash en Windows. La nueva ejecución queda pendiente.

Evidencia local posterior: prueba de configuración y A-14…A-16 con foco/Tab
nativos pasaron con código 0 en 158,6 s, incluidos ambos builds. Lint terminó
sin errores, con los 677 avisos conocidos, y la suite 71/71 pasó con código 0
en 603,9 s.

La sexta ejecución (`30727074254`) confirmó que Openbox permitía a Electron
marcar la ventana como enfocada. A-16 seguía fallando porque asumía que un
único Tab siempre entraba en `Elegir copia`: Linux podía entregar inicialmente
ese único botón ya enfocado, por lo que el primer Tab salía de él. El E2E ahora
recorre el orden real con eventos Tab hasta alcanzar el botón y lo activa con
Espacio nativo; no usa `.focus()` ni `.click()` del DOM y falla mostrando el
elemento activo si la navegación no funciona. `ENTER` y `Return` no activaron
el botón mediante `sendInputEvent` en Electron 43 (código 1 en ambas pruebas
directas); `Space` completó A-14…A-16 con código 0 en 6,3 s. La nueva ejecución
queda pendiente.

El protocolo posterior completo —prueba de configuración, lint (0 errores y
677 avisos), build principal, build frontend y 71/71— pasó con código 0 en
673,1 s.

La séptima ejecución (`30727746729`) descartó la hipótesis anterior: aunque
Openbox hacía que `BrowserWindow.isFocused()` devolviera verdadero, seis
eventos Tab nativos dejaron el elemento activo en `BODY`. El log de Chromium
mostró además que el runner no podía conectarse al bus de sesión. Los jobs
Linux pasan por ello a crear una sesión de escritorio efímera completa con
Xvfb, `dbus-run-session` y Openbox. `dbus-x11` es una dependencia exclusiva
del runner; no se incorpora a FloCafe, sus paquetes ni su operación offline.
La nueva ejecución queda pendiente.

La octava ejecución (`30727921331` y `30727921345`) creó correctamente la
sesión D-Bus, pero reprodujo A-16 en los dos jobs Ubuntu: el foco permaneció en
`BODY` después de seis Tabs inyectados. Esto confirma una limitación de la
inyección `sendInputEvent` de Electron/Chromium en Linux headless, no un fallo
del orden de foco de la interfaz. Se retiró D-Bus por no aportar cobertura. El
E2E mantiene Tab nativo en Windows y macOS; en Linux comprueba de forma
determinista que `Elegir copia` es el primer control del orden de teclado, lo
enfoca y exige que Espacio nativo active tanto ese botón como `Comprobar`. No
se sustituye la activación por `.click()` y la prueba falla si los controles
dejan de ser botones nativos o salen del orden de teclado. La nueva ejecución
queda pendiente.

Validación local posterior: A-14…A-16 y ambos builds pasaron con código 0 en
116,3 s; la prueba de configuración multiplataforma y lint pasaron con código
0 en 56,8 s (0 errores, 677 avisos conocidos); la suite completa 71/71 pasó
con código 0 en 313,2 s.

La novena ejecución (`30728424149` y `30728424166`) hizo pasar la matriz
Ubuntu completa, incluidos 71/71, empaquetado y smoke aislado. El CI Linux
base verificó el orden de foco, pero perdió de forma intermitente la
activación de Espacio antes de seleccionar el paquete. Para eliminar la
diferencia entre dos runners equivalentes, la inyección Linux usa el protocolo
de entrada de Chromium después de `Page.bringToFront` y emulación explícita de
foco; Windows y macOS mantienen `sendInputEvent`. Ambos canales emiten Tab y
Espacio reales sobre botones nativos. La nueva ejecución queda pendiente.

Evidencia local directa: el canal de depuración forzado pasó A-14…A-16 con
código 0 en 4,8 s y el canal normal de Windows volvió a pasar con código 0 en
4,3 s.

El primer inicio del protocolo local completo terminó con código 1 en 0,9 s:
la prueba de configuración conservaba la expectativa del intento anterior que
prohibía `Input.dispatchKeyEvent`. Se actualizó para exigir el protocolo
completo —ventana al frente, emulación de foco e inyección de teclado— y
mantener la prohibición de activar controles mediante `.click()` del elemento
activo. El protocolo se reinicia desde el primer gate.

### CI, merge y validación posterior de la PR #46

El head protegido `9a6e1198fb7deedce86e6901014a93e1485cddbc` pasó todos los
checks aplicables: CI `30728647744`, restore fuera del equipo `30728647679` y
matriz completa `30728647708`. Linux baseline, Playwright, dependency review,
offline Windows/Ubuntu, restore Windows/Ubuntu y los paquetes Ubuntu, Windows,
macOS x64 y macOS arm64 terminaron en `SUCCESS`. Cada paquete incluyó el
worker/assets y abrió el modo aislado. La revisión GraphQL encontró 0
comentarios, 0 reviews, 0 hilos y 0 conversaciones pendientes.

El protocolo local definitivo previo al merge —configuración multiplataforma,
lint, build principal, build frontend y 71/71— terminó con código 0 en 395,5 s.
Lint conservó 0 errores y 677 avisos conocidos. PR #46 se fusionó mediante
merge commit protegido `28a3f8dbf140acddb4804e6fff5510110a30a886`.

Desde ese `main`, `npm.cmd ci`, A-01…A-13, A-14…A-16, restore fuera del equipo,
build principal, build frontend y `npm.cmd test` volvieron a pasar con código 0
en 526,5 s. La instalación raíz informó 1 vulnerabilidad moderada ya conocida;
la instalación frontend informó 0. No se generaron backups, bases, informes,
logs ni datos reales dentro del repositorio.

El asistente queda `DONE` a nivel `CODE/SIM/BUILD/CI`. #39 permanece abierta
porque la prueba preparada con una persona no técnica no se ha ejecutado.
R-011 continúa `PARTIAL` y M0 continúa `IN_PROGRESS`.

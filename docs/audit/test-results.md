# Resultados de instalación, compilación y pruebas

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

`C:\Users\dario\AppData\Local\npm-cache\_logs\2026-07-29T21_04_17_018Z-debug-0.log`

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
- Anuncio mDNS de `flo.local`, con IP observada `192.168.1.34`.
- Base de desarrollo en
  `C:\Users\dario\Documents\tpv-abierto\flo.db`.
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

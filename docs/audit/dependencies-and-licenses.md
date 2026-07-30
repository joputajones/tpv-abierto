# Dependencias, servicios y licencias

## Reconciliación M0

| Campo | Valor |
| --- | --- |
| Fecha | 2026-07-30 |
| Sistema | Windows 10 `10.0.19045`, Node `v22.20.0`, npm `10.9.3` |
| Commit analizado | `d366538fe1a5d798d5f6c6249b365e306e38efbc` |
| Comandos | Parseo completo de ambos lockfiles; `npm.cmd ci`; `npm.cmd audit --json` en raíz y frontend; carga de `better-sqlite3` en Node/Electron |
| Resultado | Lockfiles v3 válidos: 673 entradas raíz y 764 frontend; Electron `43.2.0`, better-sqlite3 `13.0.1`, Next `16.2.12` |
| Limitación | El inventario refleja metadatos declarados; no sustituye revisión jurídica ni análisis del binario empaquetado |

`npm.cmd ci` sigue fallando en el rebuild exigido por el postinstall al no
encontrar Windows SDK. Después de una instalación diagnóstica sin scripts, el
prebuild N-API incluido por `better-sqlite3@13.0.1` cargó correctamente tanto
en Node 22 (módulos 127) como en Electron 43 (módulos 148). Esto explica por qué
las pruebas pueden ejecutarse, pero no convierte el `npm ci` fallido en una
instalación reproducible.

La repetición de `npm audit` conserva 1 vulnerabilidad moderada raíz (`tar`,
transitiva de desarrollo) y 9 altas en tooling frontend. No se añadió,
actualizó ni sustituyó ninguna dependencia.

Fecha del inventario: 2026-07-29

## Dependencias directas principales

| Área | Paquetes declarados |
| --- | --- |
| Escritorio/build | Electron `^43.2.0`, electron-builder `^26.15.3`, electron-updater `^6.8.9` |
| API | Express `^5.2.1`, cors `^2.8.5`, ws `^8.21.1` |
| Datos | better-sqlite3 `^13.0.1` |
| Seguridad | bcryptjs `^3.0.3`, jsonwebtoken `^9.0.2` |
| Impresión | node-thermal-printer `^4.2.1` (resuelto 4.6.0) |
| Red local | bonjour-service `^1.4.3` |
| Integraciones | googleapis `^173.0.0`, `@whiskeysockets/baileys` `^7.0.0-rc13` |
| Utilidades | decimal.js, libphonenumber-js, pino, qrcode, uuid |
| Frontend | Next 16.2.12, React 19.2.8, Zustand 5.0.14, Tailwind 4, Radix/shadcn |

El módulo nativo crítico es `better-sqlite3`. Debe existir un prebuild compatible
o una toolchain C++/Windows SDK completa para instalar y empaquetar. El frontend
usa Sharp tanto directamente como a través de Next.

## Servicios externos

Ninguno de los servicios siguientes es necesario para la operativa local del
TPV. Aun así, algunos caminos salientes se inician automáticamente según el
canal de distribución y los defaults descritos en `architecture-map.md`:

| Servicio | Activación | Datos/función |
| --- | --- | --- |
| FloAdmin/Blue | Sync cloud y registro | Identidad del dispositivo, heartbeat, outbox, comandos y datos de pedidos/informes según implementación. |
| Telemetría Flo | Ajuste de telemetría; ver incidencia de defaults | UUID anónimo, versión, plataforma, evento y payload. |
| Google Drive | Credenciales de build + conexión del propietario | Copias completas de SQLite mediante scope `drive.file`. |
| WhatsApp/Baileys | Ajuste explícito | Autenticación WhatsApp Web y envío de facturas/mensajes. |
| GitHub Releases | Build directo macOS/Windows | Manifiestos y binarios de actualización de `FreeOpenSourcePOS/FloCafe`. |
| Tiendas Apple/Microsoft/Snap | Según canal de distribución | Entrega y actualización gestionadas por la tienda. |
| Impresora TCP | Configuración local | Bytes ESC/POS a la IP/puerto de la impresora. |

Google OAuth usa un callback efímero en `127.0.0.1`; los tokens se guardan
cifrados con `safeStorage`. WhatsApp conserva credenciales bajo `userData`.

## Auditoría npm

Raíz:

- 1 vulnerabilidad moderada.
- Afecta a `tar` 7.5.19–7.5.20 en una cadena de desarrollo relacionada con
  electron-builder/node-gyp.
- npm informa corrección disponible.

Frontend:

- 9 vulnerabilidades altas en la cadena de desarrollo
  ESLint/minimatch/brace-expansion.
- No forman parte del JavaScript de producción exportado, pero sí afectan a
  herramientas que procesan patrones/archivos no confiables.
- Las correcciones sugeridas por npm implican cambios mayores o resoluciones no
  directamente aplicables; deben probarse en una rama separada.

No se actualizó ninguna dependencia en esta auditoría.

## Licencia del repositorio

El repositorio declara MIT en `package.json` y mantiene el archivo `LICENSE`.
Antes de los cambios, el blob local y el del commit base coincidían:

`cc28d08465ec7b3fb97e6f0a33f75785d38c4176`

No se ha eliminado, sustituido ni modificado la atribución MIT. Tampoco se ha
realizado rebranding.

## Inventario de licencias transitivas

Conteo por entradas de `package-lock.json` raíz:

| Licencia declarada | Entradas |
| --- | ---: |
| MIT | 497 |
| ISC | 57 |
| Apache-2.0 | 45 |
| BSD-3-Clause | 27 |
| BSD-2-Clause | 12 |
| BlueOak-1.0.0 | 12 |
| LGPL-3.0-or-later | 10 |
| Combinaciones Apache/LGPL/MIT | 4 |
| GPL-3.0 | 1 |
| Python-2.0 | 1 |
| MIT o GPL-2.0 | 1 |
| Otras permisivas/duales | 7 |

Conteo principal del lockfile del frontend:

| Licencia declarada | Entradas |
| --- | ---: |
| MIT | 639 |
| Apache-2.0 | 39 |
| ISC | 32 |
| MPL-2.0 | 13 |
| BSD-2-Clause | 11 |
| LGPL-3.0-or-later | 10 |
| BSD-3-Clause | 8 |
| Otras/duales | 10 |
| Sin declarar | 1 |

Los recuentos son instancias del lockfile, no paquetes únicos ni una conclusión
legal.

## Puntos de cumplimiento a revisar

- `@whiskeysockets/baileys@7.0.0-rc13` incorpora
  `libsignal@6.0.0`, declarado GPL-3.0.
- Sharp distribuye/usa variantes de libvips con licencia
  LGPL-3.0-or-later según plataforma.
- `node-thermal-printer` incorpora `unorm`, con licencia dual MIT/GPL-2.0.
- El árbol contiene componentes MPL-2.0 en herramientas del frontend.
- No se encontró un `THIRD_PARTY_NOTICES` ni un informe SBOM/licencias
  generado como parte del release.

Antes de distribuir binarios comerciales o por tiendas debe revisarse la forma
real de enlace/empaquetado, conservar avisos requeridos y generar un inventario
reproducible (por ejemplo CycloneDX más un informe de licencias). Esta auditoría
no determina incompatibilidad jurídica; identifica dependencias que requieren
validación.

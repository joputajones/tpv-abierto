# Simulacro de restauración fuera del equipo

Este procedimiento está pensado para una persona que no haya participado en el desarrollo. Su objetivo es comprobar una copia en un equipo de recuperación desechable, nunca restaurar directamente sobre el TPV activo.

La automatización de CI usa un paquete sintético y aporta evidencia `CI_CROSS_RUNNER`. Este documento y una ejecución humana real son evidencias distintas. No marques el simulacro humano como superado hasta que otra persona complete la [plantilla de resultado](templates/OFF_DEVICE_RESTORE_RESULT.md).

## Prerrequisitos

- Un equipo distinto del TPV de origen, sin datos que deban conservarse.
- La misma versión de FloCafe indicada en `manifest.json`.
- Espacio libre suficiente y permisos para instalar/abrir la aplicación.
- Los cuatro archivos del paquete, sin renombrar:
  - `flo-backup.db`
  - `manifest.json`
  - `SHA256SUMS`
  - `RESTORE-INSTRUCTIONS.md`
- El PIN maestro local necesario para autorizar la restauración en el equipo de recuperación.
- Una lista privada, entregada fuera del repositorio, con dos o tres datos mínimos que se esperan encontrar. No incluyas datos personales en el formulario público.

El archivo SQLite puede contener configuración, pedidos, facturas, pagos y datos personales reales. Trata un paquete real como información confidencial: medio cifrado, acceso limitado y ninguna subida al repositorio, a una issue o a un servicio público.

## 1. Preparar y sacar la copia del equipo de origen

1. En FloCafe, inicia sesión como propietario y abre **Ajustes → Herramientas de base de datos**.
2. Selecciona **Crear backup**, introduce el PIN maestro y guarda el archivo en un medio externo cifrado o en una ubicación externa controlada.
3. Comprueba que el archivo guardado tiene extensión `.db` y tamaño mayor que cero.
4. El responsable del paquete debe generar `manifest.json`, `SHA256SUMS` y `RESTORE-INSTRUCTIONS.md` sin añadir logs, tokens ni otros archivos. Para el simulacro automatizado los genera `npm run test:off-device-producer`; no uses ese dataset sintético como copia del restaurante.
5. Expulsa correctamente el USB/disco o confirma que la transferencia a NAS terminó. Cierra FloCafe y desconecta el medio.

No borres la copia de origen y no uses una carpeta de backups del mismo disco como única evidencia fuera del equipo.

## 2. Copiar al equipo de recuperación

1. Conecta el medio externo al segundo equipo.
2. Crea una carpeta nueva y vacía para el simulacro.
3. Copia únicamente los cuatro archivos enumerados arriba.
4. No abras `flo-backup.db` todavía.
5. Conserva intacto el paquete del medio externo; trabaja sobre la copia del equipo de recuperación.

## 3. Verificar SHA-256 antes de abrir

Desde PowerShell, situado en la carpeta del paquete:

```powershell
$expected = ((Get-Content -LiteralPath .\SHA256SUMS -Raw) -split '\s+')[0].ToLowerInvariant()
$observed = (Get-FileHash -LiteralPath .\flo-backup.db -Algorithm SHA256).Hash.ToLowerInvariant()
if ($expected -ne $observed) { throw "CHECKSUM INCORRECTO: no abras ni restaures esta copia" }
"SHA-256 correcto: $observed"
```

En Linux o macOS, si `sha256sum` está disponible:

```bash
sha256sum --check SHA256SUMS
```

Compara también el valor con `sha256` de `manifest.json`. Los tres valores deben coincidir. Si falta un archivo, aparece un archivo adicional o cualquier hash difiere, detente: no abras SQLite, no inicies la restauración y registra `FAIL`.

## 4. Abrir una instalación limpia

1. Instala o abre en el segundo equipo la versión de FloCafe indicada en el manifiesto.
2. Usa un perfil de aplicación nuevo y desechable. No reutilices una instalación con datos.
3. Si el primer arranque exige configuración, completa solo el mínimo necesario y crea un PIN maestro local temporal. No introduzcas credenciales cloud, WhatsApp ni datos reales.
4. Cierra y vuelve a abrir FloCafe una vez para confirmar que la instalación limpia arranca.

El PIN maestro, el token de Google Drive, la sesión de WhatsApp y los logs viven fuera de `flo.db`; copiar solo la base no los recupera. El arranque puede generar una identidad local nueva. Esto es esperado y debe registrarse como límite, no como recuperación completa de la configuración externa.

## 5. Restaurar mediante la interfaz

1. Abre **Ajustes → Herramientas de base de datos**.
2. Selecciona **Restaurar**, introduce el PIN maestro local del equipo de recuperación y elige `flo-backup.db` de la carpeta verificada.
3. Si FloCafe avisa de una versión de esquema distinta, no continúes el simulacro ciego. Registra el mensaje y solicita revisión técnica; el modo de restauración parcial entre versiones tiene límites distintos.
4. Espera el mensaje de éxito y el reinicio de la aplicación. No desconectes el medio ni cierres el proceso durante la operación.
5. Cierra FloCafe de forma normal y vuelve a abrirlo.

## 6. Verificar el resultado

Sin modificar los datos originales, confirma al menos:

- que la aplicación abre sin error de base de datos;
- que aparecen la categoría y el producto acordados;
- que el pedido y la factura de control existen una sola vez;
- que el importe y el estado de pago coinciden;
- que no hay duplicados evidentes;
- que se puede crear un producto/pedido desechable posterior, cerrarlo y verlo de nuevo tras otro reinicio.

No pruebes impresión, cajón, KDS físico, cloud ni cumplimiento fiscal como parte de este simulacro: requieren aceptaciones separadas.

## 7. Registrar y devolver evidencia

1. Cronometra desde el inicio de la restauración hasta que los datos estén verificados.
2. Copia la plantilla a un archivo de trabajo privado y rellena todos los campos.
3. No escribas nombres reales, correos, teléfonos, direcciones, importes identificables ni rutas de usuario en el repositorio público.
4. Devuelve el formulario al mantenedor por el canal acordado junto con el SHA-256, versión, resultado y errores saneados. No adjuntes la base.

## Si algo falla

- **Checksum incorrecto o paquete incompleto:** no abras ni restaures. Vuelve a copiar desde el medio original y recalcula. Si vuelve a fallar, conserva ambas copias y solicita un paquete nuevo.
- **FloCafe no abre en limpio:** registra versión del sistema, versión de FloCafe y texto exacto del error sin datos privados. No intentes arreglar el paquete modificando SQLite.
- **La restauración falla:** cierra la aplicación, conserva el paquete original intacto y marca `FAIL`. No repitas sobre una instalación con datos parcialmente restaurados; elimina únicamente el perfil desechable y comienza de nuevo en otro perfil vacío cuando se haya diagnosticado la causa.
- **Versión distinta:** instala la versión exacta del manifiesto o detente. No fuerces una migración durante el simulacro.

## Vuelta atrás segura

Este procedimiento solo se ejecuta sobre un equipo/perfil desechable. Nunca sobrescribe el TPV de origen. El paquete externo original permanece desconectado e intacto. Para volver atrás, cierra FloCafe y abandona o elimina únicamente el perfil desechable después de que el responsable confirme que la evidencia necesaria ya está registrada.

## Criterio de aceptación humana

La issue operativa solo puede cerrarse cuando una segunda persona, en otro equipo físico, complete el procedimiento sin ayuda oral del autor, devuelva el formulario con hashes coincidentes, tiempos y errores, y confirme restauración, reapertura y escritura posterior. Un workflow verde no cumple este criterio.

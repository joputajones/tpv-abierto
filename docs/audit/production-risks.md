# Riesgos para un despliegue real

Escala usada:

- **P0**: impide autorizar un despliegue con datos reales.
- **P1**: riesgo alto que debe resolverse o mitigarse antes del piloto.
- **P2**: riesgo operativo relevante para el piloto.
- **P3**: deuda/documentación que no bloquea una prueba controlada.

## P0 — Gobierno de datos cloud contradictorio

**Hecho observado:** `cloud_orders_enabled` y `cloud_reports_enabled` se cargan
y pueden actualizarse desde el servidor, pero no condicionan
`recordOrderChanged()` ni los comandos `orders.live`, `orders.get` y
`report.sales`. `decorateOrder()` añade el pedido completo, ítems, mesa, fila
completa del cliente y factura con `payment_details`.

**Por qué importa:** comentarios y changelog afirman que PII, pedidos, facturas
y pagos no se envían. Esa promesa no coincide con el camino ejecutable cuando
el POS está registrado y la sincronización/comandos están activos. En un
restaurante supone riesgo de privacidad, contrato, seguridad y cumplimiento.

**Acción recomendada:** antes de activar cloud en cualquier instalación real,
definir el contrato de datos, añadir allowlists explícitas, aplicar cada feature
flag en servidor, redactar PII/pagos, probar que un flag desactivado bloquea
envío y lectura remota, y actualizar documentación/consentimiento.

## P0 — Migración continúa sin copia previa

**Hecho observado:** `syncBackupBeforeMigration()` captura cualquier error,
escribe un log y retorna; `runMigrations()` continúa. Las migraciones históricas
v10, v14 y v30 incluyen `DROP TABLE`, borrado de settings y `DROP COLUMN`.

**Por qué importa:** disco lleno, permisos, antivirus o fallo de checkpoint
pueden dejar al usuario sin copia justo antes de transformar datos. La suite
prueba la ruta feliz, no el fallo de copia. El comportamiento contradice la
expectativa de seguridad del README.

**Acción recomendada:** hacer que el backup previo sea fail-closed para una base
existente, verificar legibilidad/integridad de la copia, probar disco lleno y
permisos, y ensayar una base real anonimizada desde cada versión relevante. No
editar migraciones ya publicadas; añadir protección alrededor del lote.

## P1 — API LAN sin cifrado y sandbox reducido

**Hecho observado:** API y KDS escuchan en `0.0.0.0` mediante HTTP y WebSocket
sin TLS. CORS confía en orígenes `.local` e IP privadas. El rate limit general
omite clientes locales. En Windows se deshabilita el GPU sandbox y la ventana
principal usa `sandbox: false`.

**Mitigaciones existentes:** JWT aleatorio por instalación, contraseñas
hasheadas, roles revalidados contra SQLite, Master PIN en operaciones sensibles,
CSP, `contextIsolation: true`, `nodeIntegration: false` y allowlist de URLs.

**Riesgo residual:** una Wi-Fi compartida o comprometida permite observar o
manipular tráfico si se obtiene posición de red. Un XSS tendría mayor impacto
con sandbox reducido. Los tokens revocados solo viven en memoria y vuelven a
ser válidos tras reinicio hasta expirar (24 h o 10 días con “recordarme”).

**Acción recomendada:** piloto solo en VLAN/Wi-Fi privada aislada, firewall que
limite los puertos a subred/dispositivos necesarios, credenciales individuales,
sin red de invitados y con rotación de sesiones. Diseñar TLS local o un canal
de emparejado seguro antes de despliegues no controlados.

## P1 — Instalación no reproducible en Windows auditado

**Hecho observado:** `npm install` falla al reconstruir `better-sqlite3` porque
falta Windows SDK. `npm test` falla si Git Bash no está en `PATH`. El script
`npm run clean` no detiene el Electron que acaba de arrancar.

**Por qué importa:** onboarding de colaboradores, CI de Windows, recuperación
urgente y builds de release pueden depender de estado previo de `node_modules`
o de herramientas no documentadas. Un TPV necesita una recuperación
determinista.

**Acción recomendada:** documentar y automatizar prerrequisitos exactos
(Node 22, Git Bash o runner multiplataforma, VS Build Tools/Windows SDK),
verificar una instalación limpia con `npm ci` y corregir la identificación del
proceso de `kill-ports.js`.

## P1 — Impresión sin validación de hardware objetivo

**Hecho observado:** los tests validan formato, bytes y rutas simuladas. No se
probó ninguna Xprinter/Epson, USB, TCP 9100, CUPS, spooler Windows, corte de
papel ni cajón. El fallback Windows usa `PrintTo` sobre un archivo binario. La
impresión física y el registro de auditoría son dos llamadas API separadas.

**Por qué importa:** impresión y KOT son parte de la operación crítica; un falso
positivo, duplicado o retraso causa comandas perdidas y descuadres. Un fallo
entre “imprimir” y “registrar” deja la auditoría incompleta; un reintento
ambiguo puede duplicar tickets.

**Acción recomendada:** matriz física mínima con el modelo real de impresora,
USB y LAN, 58/80 mm, caracteres españoles/euro, corte, papel agotado,
desconexión, reconexión y duplicados. Registrar un ID idempotente de trabajo y
estado `queued/sent/failed/confirmed`.

## P1 — Backups insuficientes frente a desastre

**Hecho observado:** las copias locales comparten por defecto el mismo
`userData` y disco que la base. No hay retención local automática. Google Drive
es opcional y requiere configuración OAuth. El chequeo de claves foráneas solo
registra violaciones; la aplicación sigue operando.

**Por qué importa:** fallo de disco, ransomware, borrado del perfil o robo del
equipo elimina base y copias a la vez. Una copia no probada no garantiza
recuperación.

**Acción recomendada:** copia local programada más copia externa cifrada,
retención definida, monitor de antigüedad/éxito, prueba mensual de restauración
en otro equipo y procedimiento de recuperación documentado. Bloquear o degradar
de forma visible si integridad/FK no son correctas.

## P2 — Fallback del puerto principal inconsistente

**Hecho observado:** `main/server.ts` puede subir del 3001 a otro puerto, pero
Electron carga, anuncia y muestra siempre el `PORT` original. KDS sí comunica su
puerto activo.

**Impacto:** si 3001 está ocupado, la API puede arrancar “correctamente” en otro
puerto mientras la ventana queda en blanco o conecta al proceso equivocado.

**Acción recomendada:** usar el puerto activo devuelto por el servidor para
ventana, CSP, mDNS, menú y diagnóstico; o fallar de forma explícita en vez de
hacer fallback.

## P2 — Consentimiento de telemetría en primera instalación

**Hecho observado:** la base nueva siembra consentimiento/telemetría en `true`,
el checkbox del wizard empieza marcado y `telemetry.start()` ocurre antes de
completar setup. Las migraciones para instalaciones existentes usan `false`.

**Impacto:** una instalación nueva puede intentar enviar `app_launch` y
`daily_ping` antes de una acción afirmativa, en contradicción con los comentarios
“opt-in”.

**Acción recomendada:** default `false`, no iniciar telemetría hasta completar
setup y prueba automatizada que intercepte la red en el primer arranque.

## P2 — Riesgo operativo offline no ensayado

**Hecho observado:** pedidos y pagos son locales y las integraciones capturan
errores de red, pero no se ejecutó una campaña de desconexión prolongada.
Cloud/telemetría/Google/WhatsApp/actualizador comparten el proceso principal.

**Impacto:** DNS lento, timeouts, reconexiones WSS o colas pueden afectar
latencia/memoria aunque el diseño sea local-first.

**Acción recomendada:** prueba de turno completo sin Internet, con LAN
disponible; después pérdida/reconexión de LAN con varios dispositivos, medición
de latencia, memoria, outbox y recuperación sin duplicados.

## P2 — Fiscalidad no validada para España

**Hecho observado:** existe motor fiscal v2 con packs y snapshots, pero esta
auditoría solo verificó sus tests incluidos. El proyecto conserva defaults y
terminología histórica de India (`gstin`, INR) en varios caminos.

**Impacto:** una factura técnicamente consistente no equivale a cumplimiento
fiscal español ni a los requisitos vigentes de software de facturación.

**Acción recomendada:** revisión legal/fiscal separada, fixtures españolas,
series, rectificativas, redondeo, IVA, exportación e inmutabilidad/auditoría
según normativa aplicable antes de emitir facturas reales.

## P2 — Distribución y actualización

**Hecho observado:** Windows se publica sin firma y mostrará SmartScreen. El
actualizador de un build de este fork apunta al upstream
`FreeOpenSourcePOS/FloCafe`. Linux depende del canal de paquete. Los builds de
plataforma no se ejecutaron localmente.

**Impacto:** fricción de instalación, confianza del usuario y posibilidad de
actualizar un fork hacia binarios de otra procedencia.

**Acción recomendada:** decidir autoridad de releases del fork, integrar firma
Windows, conservar firma/notarización macOS y validar instalación/upgrade/
rollback por canal antes del piloto.

## P2 — Dependencias y avisos de licencia

**Hecho observado:** npm informa 1 vulnerabilidad moderada raíz y 9 altas del
tooling frontend. Baileys arrastra `libsignal` GPL-3.0; Sharp, libvips y otros
componentes tienen obligaciones adicionales. No hay SBOM/THIRD_PARTY_NOTICES.

**Acción recomendada:** actualización controlada de tooling, SBOM por release,
escaneo de licencias y vulnerabilidades en CI, y revisión jurídica del binario
distribuido. Mantener íntegra la licencia MIT del proyecto.

## P3 — Deriva documental y observabilidad

**Hecho observado:** versiones, actualización, impresión, cloud y rutas de
datos difieren entre documentación y código. Los logs de pruebas son muy
ruidosos y no se observó rotación/alerta de negocio sobre copias o base.

**Acción recomendada:** designar documentos canónicos, convertir promesas
críticas en tests y añadir estados visibles para backup, DB, impresora, KDS y
conectividad. Reducir logs esperados en tests sin ocultar errores inesperados.

## Criterio mínimo para un piloto controlado

1. Cerrar P0 cloud/migraciones.
2. Conseguir `npm ci`, lint, build, suite y empaquetado reproducibles en Windows.
3. Validar restauración con una base representativa y una copia fuera del
   equipo.
4. Validar la impresora real y el flujo KOT durante fallos.
5. Aislar la LAN y probar dos comanderos más un KDS durante un turno simulado.
6. Completar revisión fiscal española antes de emitir documentos reales.

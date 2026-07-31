# Riesgos para un despliegue real

## Reconciliación con el registro oficial

Fecha: 2026-07-30. Sistema: Windows 10 `10.0.19045`, Node `v22.20.0`, npm
`10.9.3`. Commit analizado:
`d366538fe1a5d798d5f6c6249b365e306e38efbc`.

Los riesgos de esta auditoría se reflejan ahora en
`docs/project/RISK_REGISTER.md`:

| Riesgo técnico | ID oficial | Estado de mitigación | Evidencia / limitación |
| --- | --- | --- | --- |
| Gobierno de datos cloud contradictorio | R-018 | `NOT_STARTED` | Confirmado por código; no se activó una cuenta real |
| Migración continúa sin copia previa | R-005 / [#16](https://github.com/joputajones/tpv-abierto/issues/16) | `DONE` | PR #28 integrada; el fallo histórico está reproducido y el camino actual bloquea antes de v1 hasta verificar la copia |
| Reinicio graceful/abrupto sin matriz | CORE-002 / [#30](https://github.com/joputajones/tpv-abierto/issues/30) | `DONE` | PR #31 integra R-01…R-12 en Windows/Linux con datos y procesos temporales; #30 está cerrado. El alcance es `SIM` |
| Datos privados en repositorio público | R-006 / [#17](https://github.com/joputajones/tpv-abierto/issues/17) | `PARTIAL` | El diff auditado fue saneado; falta un gate mantenido |
| API LAN sin TLS y sandbox reducido | R-019 | `PARTIAL` | Bind real confirmado; sin campaña LAN hostil |
| Instalación Windows no reproducible | R-022 / [#18](https://github.com/joputajones/tpv-abierto/issues/18) | `DONE` | SDK/MSVC reparados; PR #21 fusionada; instalación, rebuild, verificador, builds y 67 scripts repetidos desde `main` sin Bash. Restore externo y desastre siguen en R-011 |
| Dependency review de CI no ejecutable | R-025 / [#19](https://github.com/joputajones/tpv-abierto/issues/19) | `DONE` | Dependency Graph habilitado; acción real validada; PR #24 fusionada y #19 cerrado. El enforcement de merge sigue siendo manual |
| Impresión y duplicados | R-003 | `NOT_STARTED` | Automatización parcial; hardware bloqueado |
| Backups frente a desastre | R-011 | `PARTIAL` | Restore automatizado; sin copia externa ni simulacro. El cierre de R-005 no acredita desastre |
| Puerto principal inconsistente | R-021 | `NOT_STARTED` | Confirmado por código; fallback no provocado |
| Telemetría antes de consentimiento | R-020 | `NOT_STARTED` | Confirmado por defaults/orden de arranque; sin captura HTTPS |
| Operación offline | R-011 / CORE-004 | `UNVERIFIED` | Backend local funciona; Electron completo no fue aislado |
| Distribución/actualización | R-023 | `UNVERIFIED` | Configuración apunta upstream; no se empaquetó |
| Dependencias/licencias | R-024 | `PARTIAL` | Audit/lockfiles revisados; falta SBOM/revisión legal |
| Fiscalidad española | R-009 | `OUT_OF_SCOPE` | Requiere evaluación externa; no se afirma cumplimiento |

Los comandos y resultados exactos están en `test-results.md`. La repetición no
reduce ningún P0/P1 por sí sola: confirma los bloqueos y evita convertir
evidencia `CODE`/`SIM` en una afirmación de producción.

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

**Hecho observado:** el camino histórico capturaba cualquier error de copia,
escribía un log y continuaba; la reproducción real alcanzó v38 después de un
fallo de destino. PR #28 integra una barrera verificada y fail-closed
antes del lote. Las migraciones históricas v10, v14 y v30 incluyen `DROP TABLE`,
borrado de settings y `DROP COLUMN` y permanecen sin cambios.

**Por qué importa:** disco lleno, permisos, antivirus o fallo de checkpoint
pueden dejar al usuario sin copia justo antes de transformar datos. Antes de PR
#28, la suite probaba la ruta feliz, no el fallo de copia. Ese comportamiento
contradecía la expectativa de seguridad del README.

**Mitigación integrada:** PR #28 clasifica una base nueva solo si el archivo no
existía antes de abrirlo; todo archivo existente, incluido v0, requiere
checkpoint completo y copia verificada antes de la primera migración. Las
pruebas cubren destino, copia, apertura, integridad, versión, finalización,
fuente intacta y reintento v0→v38. #16 está cerrado y R-005 `DONE` dentro de
este alcance. Siguen pendientes fixtures saneadas de otras versiones y un
simulacro operativo externo bajo R-011; véase
[ADR-003](../project/decisions/ADR-003-pre-migration-backup-fail-closed.md).

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

## P1 — Reinicio local simulado; corte físico no demostrado

**Evidencia integrada:** PR #31 abre la base de producción bajo un
`userData` temporal, confirma operaciones en WAL, deja otras bajo
`BEGIN IMMEDIATE`, alterna cierres graceful y terminaciones forzadas, reinicia
API/KDS en puertos aislados y repite un upgrade saneado. R-01…R-12 pasan en
Windows y Linux, incluido `integrity_check=ok`, versión v38, FK limpias para las bases
sintéticas, secuencias sin colisión, rollback de filas no confirmadas y
reutilización de puertos. Una expectativa invertida en R-05 hace fallar el
arnés y aun así limpia procesos y sandbox. #30 está cerrado.

**Límite:** `taskkill`/`SIGKILL` simula la muerte del proceso, no un corte de
alimentación. No prueba cachés del disco, corrupción, antivirus, pérdida del
equipo, restore externo, hardware, LAN hostil ni operación real. CORE-002 está
`DONE` solo para su aceptación de persistencia/reinicio a nivel `SIM`; no es
evidencia `BENCH` o `PILOT` y R-011 permanece abierto.

## P1 — Portabilidad Windows mitigada; recuperación externa pendiente

**Hecho observado:** inicialmente `npm install` fallaba al reconstruir
`better-sqlite3` por una instalación incompleta de Build Tools/SDK. La reparación
administrativa ya está completada y la toolchain nativa pasa. Después apareció
la dependencia implícita de Bash en `postinstall`/`verify:electron` y
`npm test`. PR #21 sustituyó esas rutas por scripts Node multiplataforma y se
fusionó en `a51fa54`. La instalación limpia, rebuild, verificador, builds,
upgrade fixture y, tras PR #31, los 67 scripts se repitieron desde `main` sin Bash; Linux y
Playwright también pasaron. #18 está cerrado y R-022 `DONE` para ese alcance.

La ejecución histórica con Bash llegó a dos fallos de `test:reports-insights`
(#20). PR #22 demuestra que la fixture dependía de `Date.now()`: la ventana de
90 días comenzaba el 2 de mayo de 2026 y excluía la orden del 1 de mayo, causando
exactamente promedio 20 e ingresos 500. La corrección fija/restaura el reloj en
el test, no cambia la semántica de producción, está fusionada y #20 cerrado.
El script `npm run clean` tampoco detuvo el Electron observado en la auditoría
inicial.

**Riesgo residual:** la portabilidad de desarrollo ya no depende de Bash, pero
no se construyó un instalador Windows, no se restauró una copia en otro equipo
y no se simuló pérdida total o recuperación durante servicio. Esas capacidades
siguen abiertas en R-011 y no se infieren del cierre de #18 ni de R-005.

**Acción recomendada:** conservar documentados Node 22 y VS Build Tools/Windows
SDK, añadir una prueba de instalador/restore en otro equipo dentro del riesgo
correspondiente y corregir por separado la identificación de procesos de
`kill-ports.js`. La trazabilidad cerrada de portabilidad está en el
[issue #18](https://github.com/joputajones/tpv-abierto/issues/18).

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

## P2 — Dependency review operativo sin enforcement de merge

**Hecho observado:** Dependency Graph está habilitado y la acción v4.5.0 fijada
por SHA se ejecuta con permisos de solo lectura, umbral `high`, sin
`continue-on-error` ni `warn-only`. Una PR documental pasó y una PR desechable
analizó un cambio controlado de lockfile; esta última se cerró sin merge. PR #24
está fusionada y #19 cerrado, por lo que R-025 está técnicamente mitigado.

**Riesgo residual:** `main` no tiene branch protection ni ruleset. GitHub no
impide un merge directo o con CI rojo; el equipo debe tratar manualmente un
`dependency-review` rojo como bloqueo hasta que exista enforcement aprobado.

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

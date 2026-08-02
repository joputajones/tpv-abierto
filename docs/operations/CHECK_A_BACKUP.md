# Comprobar una copia de seguridad

Esta comprobación no toca los datos actuales y funciona igual en Windows,
Linux y macOS. No necesitas abrir una terminal ni instalar herramientas.

1. Abre FloCafe.
2. Pulsa **Herramientas**.
3. Pulsa **Comprobar copia de seguridad**.
4. Pulsa **Elegir copia** y selecciona la carpeta del paquete o el archivo
   `.db`.
5. Pulsa **Comenzar comprobación** y espera. Puedes cancelar sin modificar la
   copia.
6. Si el resultado es **verde**, pulsa **Guardar informe** y conserva el
   informe junto a la copia.
7. Si el resultado es **amarillo**, la copia se ha podido abrir, pero faltan
   garantías. Conserva otra copia y no dependas únicamente de esta.
8. Si el resultado es **rojo**, no utilices ese archivo. Conserva el original
   y prueba con otra copia.

El informe no contiene la ruta elegida, datos del restaurante, clientes,
empleados, productos, ventas ni credenciales. La herramienta realiza la
recuperación y el guardado de prueba en una carpeta temporal que elimina al
terminar.

## Si FloCafe no arranca normalmente

Soporte puede abrir FloCafe con el modo aislado `--recovery-assistant`. Este
modo solo abre el comprobador: no inicia la base activa, API, KDS, cloud,
WhatsApp, telemetría, impresión, actualización automática ni mDNS. La persona
que utiliza la interfaz no necesita ejecutar este comando.

## Detalles para soporte técnico

Los criterios deterministas, formato del paquete y procedimiento manual de
respaldo están en [Simulacro de restauración fuera del equipo](OFF_DEVICE_RESTORE_DRILL.md).
Los detalles internos permanecen cerrados por defecto en la interfaz.

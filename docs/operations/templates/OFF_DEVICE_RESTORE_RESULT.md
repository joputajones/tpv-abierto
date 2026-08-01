# Resultado del simulacro de restauración fuera del equipo

No adjuntes la base de datos ni incluyas datos personales, credenciales, rutas de usuario o información identificable del restaurante.

No calcules los campos de checksum y tiempo. Copia las cuatro líneas que imprime el primer bloque de PowerShell y las tres que imprime el bloque final de la guía. Déjalos vacíos hasta realizar el simulacro.

```text
Fecha:
Operador:
¿Participó en el desarrollo?:
Equipo origen:
Equipo destino:
Sistema destino:
Versión de FloCafe:
Medio de transferencia:
Nombre del backup:
SHA-256 esperado:
SHA-256 observado:
¿Checksum verificado antes de abrir?:
Tiempo de comprobación SHA-256:
Hora de inicio de restauración:
Hora de fin de restauración:
Tiempo de restauración:
Datos verificados:
Operación posterior creada:
¿Persistió tras reiniciar?:
Errores encontrados:
Ayuda adicional recibida:
Resultado PASS/FAIL:
Observaciones:
```

Un resultado `PASS` requiere hashes iguales, restauración en otro equipo físico y perfil limpio, datos mínimos presentes sin duplicados, una operación posterior persistente y ausencia de ayuda oral del autor. Si alguna condición no se cumple, registra `FAIL` o `PARTIAL`; no corrijas el formulario para ajustarlo al resultado esperado.

# Confirmar Atencion del Cinturon

## Problema corregido

Antes la web guardaba la atencion, pero no enviaba RESET al dispositivo.
El firmware permanecia en CAIDA_CONFIRMADA y la siguiente lectura abria de
nuevo la cortina. Ademas, la web ocultaba la alerta aunque fallara la peticion.

Ahora la atencion espera `RSP,RESET,OK` antes de registrarse cuando el cinturon
esta conectado. Una falsa alarma usa el mismo reinicio del detector; silenciar
solo envia MUTE y no significa resolver una atencion. No se cambia el firmware.

Si no llega confirmacion, se muestra el error y se conserva la cortina. No se
inventa un estado normal. Si el dispositivo esta desconectado, la atencion
local queda identificada sin confirmacion de hardware.

## Comprobaciones automatizadas

- Envio de RESET y MUTE segun la accion.
- Un ACK viejo no satisface una orden nueva.
- Un fallo o timeout no genera registro de atencion exitosa.
- El cache de la caida anterior no se reenvia al reconectar el navegador.
- Una caida nueva posterior al RESET no se descarta.
- Repetir la misma telemetria no abre otro episodio; un contador nuevo si.
- Pulsacion cancelable, errores visibles y bloqueo mientras se espera respuesta.

82 pruebas web y 101 Python aprobadas. Estos resultados usan dobles de dispositivo;
no equivalen a una validacion fisica de deteccion o de comunicacion serial.

## Prueba pendiente con hardware

1. En una mesa y sin ninguna persona usando el dispositivo, conecta el cinturon
   por el puerto habitual. Cierra el Monitor Serie para no bloquearlo.
2. En un entorno de pruebas, provoca la alerta mediante el procedimiento de
   simulacion del firmware. Puede generar avisos: no usar residentes reales ni
   destinatarios que no esperen esa prueba.
3. Mantiene pulsado el boton de atencion hasta que indique que esta confirmando.
4. Verifica que termina la alarma del cinturon, se cierra la cortina y no reaparece
   con las lecturas siguientes. La recepcion de una orden no prueba una caida real.
5. Genera un segundo evento de prueba: debe volver a alertar. Repite por USB y,
   cuando este disponible, por HC-06.
6. Prueba la perdida de conexion durante la confirmacion: no debe presentarse
   una orden no confirmada como si hubiera sido aceptada por el hardware.

No provocar caidas de personas para probar el sistema. Android y Supabase no
necesitan actualizaciones para esta correccion local.

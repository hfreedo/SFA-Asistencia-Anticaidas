# Prueba de avisos desde la PC al celular

Version: Windows rc8, Android 0.6.1 o posterior, migraciones 001 a 010.

1. En Android, iniciar sesion como cuidador o administrador y activar Cuidar >
   Alertas en este celular > Activar o actualizar avisos. Conceder permiso.
2. En la PC, abrir Acceso y sincronizacion, iniciar sesion con la misma cuenta
   y reanudar envios para el perfil local vinculado al residente autorizado.
3. Abrir Ajustes > Notificaciones > Avisos al celular - Firebase.
4. Comprobar Emisor configurado y seleccionar un celular registrado propio.
   Si no aparece, revisar la cuenta Android y actualizar el registro de avisos.
5. Marcar la confirmacion de PRUEBA y pulsar Enviar prueba al celular.
6. Verificar en Android el aviso identificado como prueba; no es una emergencia.
   Esperar un minuto antes de repetir. No se emite una alarma real de caida o SOS.

## Interpretacion

- En cola o en reintento: la entrega todavia no esta confirmada.
- Aceptada por FCM: Firebase acepto el mensaje; no confirma que Android lo
  mostrara, que la persona lo leyera ni que hubiera atencion.
- Vencida: termino la vigencia de la prueba.
- Registro no valido: actualizar la activacion de avisos en Android.

La prueba va solo al destino seleccionado de la cuenta conectada. No enumera
tokens FCM ni celulares de otros cuidadores. No se envia nada al abrir Ajustes,
actualizar la lista o cambiar de residente. La PC emisora y su sesion deben
permanecer activas; no hay todavia un emisor independiente de la PC.

## Navegacion y validacion

Los incidentes completos se ven solo en Panel principal. Desde otras vistas,
el contador o escudo naranja del menu permite volver a revisarlos. El monitor
sigue consultando en segundo plano; no se desactiva al abrir Ajustes o Ubicacion.

78 pruebas web, 90 Python y 66 comprobaciones SQL aisladas aprobadas. Navegador
con datos ficticios verifica menus y boton de prueba. No se enviaron mensajes
reales durante la activacion; la recepcion fisica se comprueba en el celular.

# GPS sin cinturon y pruebas de alarma

## Version necesaria

Windows **1.2.0-rc3** y APK **0.4.0-prototipo (versionCode 4)**, Android 12+.
Usar Windows **1.2.0-rc4** para ver tambien el GPS remoto en el panel local.
La APK de rc3 sirve y no necesita reinstalarse para esta correccion de PC.
La firma de pruebas se conserva para permitir actualizar sobre rc2 sin borrar
la app. No se realizo todavia la migracion a firma de distribucion.

## Ubicacion remota, sin QR ni certificado de la PC

1. En la app abre **Cuidar** e inicia sesion con una cuenta autorizada.
2. Abre **Compartir** y selecciona **Por internet**.
3. Autoriza compartir la ubicacion de este celular y elige su residente.
   Se necesita ser administrador o tener permiso de configuracion de ese perfil;
   tener acceso de lectura no permite convertirse en su emisor GPS.
4. Pulsa **Iniciar seguimiento** y concede ubicacion precisa. No conectes
   Bluetooth si solo vas a probar GPS. Aparecera la notificacion persistente.
5. Espera **Ubicacion recibida por Supabase** y una hora de envio confirmada.
6. Desde otra PC o red, abre el portal HTTPS, inicia sesion y selecciona ese
   residente. El portal consulta cada 10 segundos su ultima ubicacion real.
7. Prueba con datos moviles, pantalla bloqueada y luego con perdida y retorno
   de internet. Las muestras locales antiguas no se presentan como posicion nueva.

El modo GPS remoto no requiere que la PC local este encendida. El **emisor FCM**
actual si depende de una PC con credencial privada y sesion de envios activa.
En Windows rc4 el panel local incluye **Ubicacion > Por internet**: consulta
Supabase sin fusionar SQLite. Antes abrir **Acceso y vinculo de esta PC**, iniciar
sesion y reanudar los envios; debe estar vinculado al mismo residente cloud.
La opcion **Red local y geocerca** conserva el flujo HTTPS/QR anterior.

La sesion Android se renueva en memoria, sin guardar contrasenas ni JWT/refresh
en disco. Reiniciar el proceso requiere iniciar sesion y seleccionar de nuevo
el residente. No hay reinicio oculto al arrancar el telefono.

## Pruebas sin incidentes reales

En **Pruebas** hay tres acciones distintas:

| Opcion | Resultado | Requisitos |
| --- | --- | --- |
| Probar alarma local | Notificacion identificada como prueba; sonido/vibracion segun Android | Permiso de notificaciones, no internet ni cinturon |
| Escenarios simulados | Pantalla de practica de caida, SOS o salida; cronometro y confirmacion simulada | No valida deteccion fisica ni GPS; no avisa a otros |
| Enviar prueba por internet | Evento `PRUEBA_NOTIFICACION`, `simulated=true`, dirigido solo al celular solicitante | Cuenta, residente seleccionado, registro FCM y emisor Windows rc3 activo |

Para el ultimo caso, en la PC abre el acceso local, inicia sesion y pulsa
**Reanudar envios**. Maximo una solicitud de prueba por minuto. Cola aceptada no
significa FCM recibido; comprueba la notificacion en el Android. Los emisores
anteriores no recogen estos trabajos para evitar mostrarlos como emergencias.

La prueba remota lleva etiqueta explicita. Los demas eventos simulados siguen
excluidos de los avisos normales. No se provocan caidas de personas.

## Geocerca y limites

La app puede evaluar una geocerca cloud real cuando exista en `sfa_geofences`.
El editor local aun no sincroniza esa zona automaticamente. Esta entrega activa
GPS remoto, no afirma que la configuracion ni las salidas de geocerca remotas
ya esten integradas con el emisor. El circulo del mapa remoto indica precision,
no una geocerca. Una posicion de mas de 90 segundos se identifica como historica.

## Validacion pendiente en el telefono

Registrar modelo, Android, hora, precision GPS, cambio de red, pantalla bloqueada,
notificacion local, prueba push, permisos denegados y resultado. La compilacion,
lint y pruebas automatizadas no reemplazan esta verificacion ni una revision
visual en el dispositivo. No es un servicio de emergencia certificado.

# Probar la APK Android con FCM (1.2.0-rc2)

Para rc3 existe un boton de prueba remota etiquetada. Usar la guia actual:
[GPS sin cinturon y pruebas de alarma](PRUEBA_GPS_Y_ALARMAS.md). El procedimiento
de abajo se conserva como referencia de rc2.

## Antes de instalar

Android 12+ con Google Play services e internet. APK con firma debug: instalacion
manual de prototipo, no Play Store ni una entrega de produccion. Conservar los
datos existentes. Intentar actualizar sobre la app anterior; si Android rechaza
la firma, no desinstalar sin respaldar y revisar el caso primero.

Descargar del release `v1.2.0-rc2` el archivo
`SFA-Asistencia-1.2.0-rc2-Android-prototipo.apk` y el manifiesto SHA-256.
La app debe indicar version `0.3.0-prototipo` (versionCode 3).
La APK rc1 no contiene esta integracion. No reenviar claves privadas al telefono.

## Activar los avisos

1. Abrir la app y entrar en **Cuidar**.
2. Iniciar sesion con la cuenta Supabase ya autorizada para SFA.
3. Pulsar **Activar o actualizar avisos** y permitir notificaciones.
4. Verificar el mensaje de registro del celular. Si falla, revisar internet,
   cuenta, permisos y que la migracion push este aplicada.
5. Los residentes que aparecen dependen de RLS; no hay registro publico ni se
   agregan familiares automaticamente por instalar la APK.

## Preparar la PC emisora

En la PC de desarrollo, el iniciador general ya se actualizo y la credencial
local fue configurada. Reiniciar el servidor no conserva el JWT cloud: abrir
el acceso local, iniciar sesion y pulsar **Reanudar envios** en Sincronizacion
de esta PC. Confirmar que el perfil local este vinculado al espacio correcto.
El cinturon debe estar conectado y entregar datos reales para producir eventos.

El ZIP publico es limpio: en otra PC hace falta configurar su propio `.env` y
credencial aprobada, no copiar la clave del desarrollador ni publicar esa clave.
El archivo `google-services.json` de Android no sustituye esa credencial privada.

## Comprobar una alerta

1. Realizar una prueba fisica controlada con el dispositivo, nunca provocando
   una caida de una persona. Confirmar que se guarda un evento real reciente.
2. Comprobar que la PC sincroniza ese evento en el mismo espacio del cuidador.
3. Comprobar el aviso generico en el celular, primero con app visible y luego
   en segundo plano y con pantalla bloqueada.
4. Abrir la app, iniciar sesion si hace falta y consultar el evento.
5. Registrar modelo, Android, hora y resultado; repetir con permiso denegado,
   internet ausente y avisos desactivados.

Los eventos simulados y los de mas de cinco minutos no generan push.
No cambiar una simulacion a real solo para hacer pasar la prueba.
No hay aun un boton de prueba push sintetica end-to-end.
Los eventos cloud de geocerca no estan conectados al emisor GPS actual;
no usar salida de geocerca como prueba de FCM de esta entrega.

La PC debe permanecer encendida, con internet y sesion cloud activa.
FCM aceptado no significa visto ni atendido. Android puede impedir la entrega
por detencion forzada, permisos o bateria. Es un prototipo, no un servicio de
emergencia ni seguimiento garantizado.

## Privacidad y costos

Mensajes genericos sin nombre, ubicacion, telefono ni notas medicas. El acceso
al detalle exige Supabase Auth/RLS. Tokens privados, registro voluntario y
desactivacion desde la app. No incluir la clave privada en APK, Git o ZIP.
No desactivar la proteccion de Google contra claves publicadas.

No se activaron facturacion, pruebas promocionales, suscripciones ni funciones
de pago. La configuracion de este prototipo permanece en planes gratuitos;
no aceptar actualizaciones de plan para seguir esta guia.

# Roles en la demostracion

Versiones publicadas: Windows 1.2.0-rc13.1 y Android 0.7.1-release (11).
El limite de confianza se incorporo en rc12 y se conserva en rc13.1.
No se cambiaron tablas, roles, permisos o funciones en Supabase ni FCM.

## Limite de confianza

La PC es un puesto de operador de confianza. Abrir el Centro y luego el panel
en localhost no requiere otra contrasena. Quien use la PC desbloqueada puede
operar SFA; no se promete distinguir residentes y cuidadores en la misma PC.
Utilizar cuentas y bloqueo de Windows para el puesto de demostracion.

Desde otro equipo de la LAN se bloquean el panel completo, APIs de gestion,
lectura de perfiles/historias/configuraciones y el WebSocket de telemetria.
La IP de la PC no concede un rol. Un Host no local u origen ajeno tampoco
puede aprovechar localhost para operar el panel.

El emisor conserva /compartir-ubicacion, sus recursos, POST /api/location y
GET /api/location/context. Los comandos mantienen validacion HTTPS y Bearer
por dispositivo, alcance por residente y revocacion. Sin vinculo valido no
se aceptan posiciones. No se habilitan escrituras anonimas en Supabase.

Para cuidar desde otro equipo, usar el portal remoto con cuenta propia. Ya
no se puede usar el panel LAN completo como sustituto de un cuidador autorizado.
Se conserva el flujo GPS LAN/hotspot y GPS directo por internet.

## Android

- Sin cuenta: Compartir local con QR valido, Recuerdos y acceso a Cuenta.
- Cuenta residente: Compartir solo para su persona con permiso de emision,
  SOS, Recuerdos y Cuenta. No muestra controles FCM de cuidador ni Pruebas.
- Cuidador: Cuidar y Pruebas para sus personas asignadas; compartir GPS solo
  si tiene permiso de emision independiente.
- Administrador: cuidado en su espacio; equipo/permisos se gestionan en web.

Las capacidades proceden de membresias y asignaciones activas leidas con la
sesion del usuario. Se filtran por usuario, espacio y persona, no por un rol
global elegido en pantalla. Al iniciar sesion y al ejecutar acciones de cuenta
se vuelven a consultar. Actualizar permisos permite consultarlas expresamente.
No se agrega un sondeo periodico nuevo. Supabase sigue validando cada comando;
la presentacion de Android no reemplaza esa autorizacion.

Ante fallos al consultar capacidades, los controles de cuidado quedan ocultos.
Un vinculo GPS previo sigue sujeto al permiso y consentimiento existentes; el
servidor lo comprueba al recibir. No se fuerza GPS ni se impide detenerlo.

## Como probar

1. Detener/cerrar el Centro anterior, abrir rc13.1 y acceder por localhost.
2. Comprobar perfil, mapa, preparacion, configuraciones y avisos en esa PC.
3. En otro equipo LAN, el panel y las APIs administrativas deben responder 403.
4. Escanear QR emisor: sin token debe fallar; con token valido debe aceptar
   GPS solo para la persona vinculada, sin dar acceso al panel administrativo.
5. Actualizar Android con la misma firma, sin desinstalar para conservar Recuerdos.
6. Usar cuentas distintas: residente no ve Cuidar/Pruebas ni puede atender;
   cuidador asignado si puede atender; configuracion remota sigue requiriendo
   permiso explicito. Confirmar revocacion y aislamiento entre espacios.

La prueba con Android fisico, pantalla bloqueada y entrega FCM requiere los
dispositivos reales. Compilacion, pruebas de politicas y lint no la sustituyen.
No se enviaron posiciones ni alarmas reales durante el desarrollo.

## Validacion de software realizada

- 107 pruebas Python del servidor aprobadas, incluyendo solicitudes HTTP con
  cliente LAN simulado, origen/Host ajenos y GPS con/sin vinculo.
- 114 pruebas React aprobadas y compilacion de panel/portal correcta.
- 41 pruebas JVM, compilacion release Android y lint aprobados. Firma verificada
  igual a la entrega anterior; versionCode 11 y minSdk 31 (Android 12).
- Playwright: principal y preparacion con datos ficticios en tres tamanos,
  sin desbordamiento ni escrituras cloud. No sustituye prueba visual Android.

## Pendiente de validacion fisica y siguientes etapas

Transferencia administrativa auditada de incidentes tomados por otro cuidador.
Acceso local por persona si se deja de usar una PC supervisada de confianza.
Los releases actuales y el portal mantienen esta separacion de roles. La
publicacion no sustituye las pruebas fisicas pendientes de esta guia.

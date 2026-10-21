# Changelog

## 1.2.0-rc3 - GPS remoto y laboratorio de alarmas (pre-release)

- GPS Android directo a Supabase por internet, sin cinturon ni red compartida.
- Modo local HTTPS/QR conservado, separado del modo remoto.
- Registro de emisor restringido a administrador o permiso de configuracion;
  RPC autenticadas, vinculo por propietario, RLS y bloqueo de dispositivos revocados.
- Consentimiento explicito antes de enviar GPS; sesiones renovadas en memoria.
- Historial conservado y muestras recientes con identificador estable para reintentos.
- Ultima ubicacion consultable en Android y mapa del portal remoto; datos de mas
  de 90 s no se presentan como posicion actual. No se fusionan bases locales/cloud.
- Laboratorio Android: alarma local, escenarios de practica y push de prueba
  solo al celular solicitante. Un evento de prueba nunca se presenta como caida real.
- Emisor push v2 identifica pruebas; emisores anteriores no las recogen.
- UI Android: navegacion inferior, botones de 52 dp minimos y ancho consistente,
  seleccion de perfiles legible, jerarquia tipografica y feedback transitorio.
- Logo propio como icono adaptativo; simbolo monocromo de asistencia en avisos.
- APK 0.4.0-prototipo, versionCode 4; misma firma debug que rc2, sin migracion
  a firma de distribucion todavia y sin incluir claves privadas en los paquetes.
- BAT de soporte en herramientas/compatibilidad; guia ABRIR_AQUI y archivo
  recuperable de paquetes anteriores. El centro general sigue siendo el acceso normal.
- Sin facturacion, suscripciones ni pruebas promocionales. GPS y push reales
  con pantalla bloqueada siguen pendientes de validacion en Android fisico.
- No incluye editor cloud de geocercas ni envio de sus salidas al emisor FCM.

## 1.2.0-rc2 - integracion FCM (pre-release)

- Configuracion Android Firebase validada localmente; SDK Messaging sin Analytics.
- Registro voluntario del celular, permiso y canal de avisos genericos privados.
- Renovacion de token requiere actualizar registro desde sesion autenticada.
- SQL privado con registro propio, destinatarios autorizados, lease y reintentos.
- Emisor HTTP v1 opcional en PC con OAuth, sin credenciales elevadas en APK.
- No enviar push por eventos simulados ni historicos; deduplicacion por evento.
- Migracion aplicada con autorizacion en Supabase Pruebas; permisos comprobados.
- Pendientes de activacion: identidad de envio y
  prueba real Android. No se modifico el release 1.2.0-rc1 publicado.
- Guia completa: docs/FIREBASE_FCM.md. No se activo facturacion ni servicios de pago.

## 1.2.0-rc1 - ampliacion de software (pre-release)

### Geocerca y avisos
- Corregido el filtro que descartaba cualquier GPS peor que radio/2: se evalua
  el intervalo completo, margen, permanencia y antiguedad, con limite absoluto de 50 m.
- Caso de regresion: radio 5 m, distancia 15.44 m y precision 9.6 m.
- Aviso persistente de salida, sonido segun preferencias y silenciado por incidente.
- Motivo visible de incertidumbre, mala precision y confirmacion pendiente.
- Radios desde 5 m; un solo editor en el mapa y resumen en Ajustes.
- Historial completo de posiciones aceptadas; eliminada la purga automatica de eventos.

### Interfaz
- QR privado y actividad reciente con jerarquia compacta; historial debajo del mapa.
- Reemplazar QR requiere confirmacion explicita tambien en el endpoint.
- Un vinculo no vence por perder GPS o reiniciar el servidor con la misma base.
- Corregido el fallo Leaflet al consultar limites de un circulo sin mapa.
- Pruebas de montaje, StrictMode, cambio de radio y orden de los apartados.

### PC y nube
- Iniciador con logo, inicio/detencion, accesos local/remoto y ayuda Android.
- Instancia unica y control de detencion por capacidad local, no por nombre de proceso.
- Fuentes y EXE dentro del proyecto usan la misma base; portable externo usa data/.
- HTTPS asistido con CA conservada y alternativa cryptography sin OpenSSL externo.
- Portal Auth HTTPS y copia local; RLS y comandos PC restringidos.
- Cola PC persistente, UUID estable, reintentos, sin claves elevadas ni JWT en disco.

### Android
- Nuevo proyecto Kotlin/Compose Android 12+, Gradle Wrapper y versiones fijadas.
- Servicio foreground GPS hacia PC, historial/cola SQLite y geocerca local.
- QR con confirmacion, CA privada de la app, AES-GCM/Keystore y backups excluidos.
- HC-06 emparejado, parser TEL/EVT y avisos locales Android con permisos.
- Login Supabase y consulta manual de residentes/eventos autorizados.
- Construccion aislada y verificable para rutas Windows con caracteres no ASCII.

### Validacion y limites
- Pruebas Python, web, SQL y Android; lint obligatorio, sin desactivar errores.
- No es una entrega medica ni se declara aprobada la prueba fisica por compilar.
- Pendientes: GPS nativo con pantalla bloqueada en telefono real, HC-06 real,
  GPS cloud revocable, FCM y demostracion integral entre redes.
- Firebase, contrasenas, datos personales y certificados privados no se publican.

## Versiones anteriores

Consultar RELEASES.md y los releases previos. El pre-release no reescribe la
evidencia ni convierte los portables antiguos en versiones con estas funciones.

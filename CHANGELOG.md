# Changelog

## En preparacion - Presentacion y distribucion (2026-10-22)

- Portada orientada a arquitectura e impacto: diagrama Mermaid, aspectos de
  ingenieria por capa, capturas ficticias y accesos breves a las guias.
- Android: variante release no depurable con firma privada obligatoria por
  variables de proceso. Sin clave no se genera APK release; debug se conserva.
- Keystores y propiedades de firma excluidos de Git, copia publica y copia
  temporal del build. Script de compilacion con contrasenas de entrada oculta.
- Guia de firma propia, continuidad de actualizaciones y migracion desde debug;
  no se promete eliminar advertencias de Play Protect ni se contratan servicios.
- Entrega de revision separada por plataforma, con comprobacion de hashes de
  los paquetes vigentes y sin modificar las instalaciones activas.
- Evaluacion de modelos de publicacion y derechos, sin cambiar la licencia
  existente, borrar fuentes, privatizar el repositorio o alterar releases.
- Pendiente: crear la clave con su titular, validar la APK firmada en Android
  fisico y cerrar inventario de derechos y licencias de terceros.

## Windows rc8 - Navegacion de incidentes y prueba FCM

- El bloque completo de incidentes se ve solo en Panel principal. Continua
  consultando en segundo plano y muestra un indicador en el menu del panel
  cuando hay atenciones reales pendientes o una geocerca por revisar.
- Ajustes > Notificaciones incorpora Firebase/FCM: consulta los celulares
  propios, seleccion de destino, confirmacion y envio de prueba identificada.
- Muestra cola, aceptacion FCM o fallo sin confundir aceptacion con recepcion.
- Migracion 010: solo metadatos de los dispositivos del usuario conectado;
  tokens privados, sin acceso anonimo ni envios al consultar la lista.
- Peticiones PC restringidas a localhost, mismo origen y sesion vinculada.
  La prueba conserva el limite de una solicitud por minuto del servidor.
- 78 pruebas web, 90 Python y 66 comprobaciones SQL aisladas aprobadas.
- No requiere una APK nueva: Android permanece en 0.6.1-prototipo (8).

## Windows rc7 y Android 0.6.1 - Situacion de zona independiente

- Cerrar la atencion no oculta la situacion GPS: continua fuera, ultimo estado
  exterior sin reingreso confirmado, o interior confirmado.
- Migracion 009: la consulta autorizada de incidentes incluye un resumen del
  motor de zona, sin coordenadas adicionales ni nuevos destinatarios.
- Se descartan estados de una zona anterior o de emisores sin acceso vigente.
  GPS antiguo/impreciso nunca se interpreta como reingreso confirmado.
- Portal, Centro y Android mantienen el aviso aunque no haya atencion pendiente.
- No se crean incidentes duplicados ni recordatorios FCM por cada posicion.
- Android 0.6.1-prototipo (8), actualizable sobre 0.6.0 con la misma firma.
- 72 pruebas web, 87 Python y 63 comprobaciones SQL aisladas aprobadas.
- Compilacion/lint Android y prueba de empaquetado se verifican por separado;
  pruebas fisicas con la candidata actual pendientes.

## Ajuste web posterior a rc6 - Prioridad de geocerca

- Geocerca, SOS y caidas reales pendientes comparten jerarquia prioritaria:
  cabecera naranja, contadores por tipo, cronometro y acceso a la atencion.
- Los pendientes reales se muestran antes de pruebas e historial resuelto.
- Consulta de incidentes cada 3 s sin peticiones superpuestas; actualizacion
  inmediata al recuperar foco o visibilidad. Hora de ultima consulta visible.
- Se respeta el permiso de escritorio ya concedido. Los avisos nuevos de
  geocerca tienen titulo propio; la alerta interna no requiere ese permiso.
- 65 pruebas web aprobadas y compilaciones del panel/portal verificadas.
- No cambia Android ni el motor GPS: confirmar salida requiere precision,
  dos posiciones y 10 s de permanencia. No se garantiza latencia de entrega.
- Ajuste del Centro instalado y portal; los releases rc6/Android 0.6.0
  anteriores conservan sus archivos originales.

## Android 0.6.0 y alertas persistentes - 21 octubre 2026

- Migracion 008 activada con autorizacion: cada posicion nueva valida alimenta
  el motor cloud de geocerca. No se reproducen posiciones antiguas.
- Una salida confirmada crea un incidente pendiente y encola avisos para los
  cuidadores autorizados. Reingresar o perder GPS no cierra la atencion.
- Portal, panel local autenticado y Android muestran los pendientes dentro de
  la interfaz, sin depender del permiso de notificaciones del sistema.
- Toma exclusiva de atencion y confirmacion de resolucion; historial conservado.
- Android 0.6.0-prototipo (7) evita sustituir una lectura reciente precisa por
  otra mucho peor; muestra fuente, antiguedad, radio y limites de precision.
- Validacion: 86 pruebas Python, 62 web y 60 comprobaciones SQL aisladas;
  compilacion, pruebas unitarias y lint Android aprobados. Validacion fisica pendiente.
- FCM sigue necesitando el emisor PC con su sesion administrativa activa;
  no se ha desplegado un trabajador FCM independiente en la nube.

## Correccion - Vista del mapa remoto

- El mapa remoto ya no se destruye/recrea en cada consulta GPS ni al pasar
  una posicion de reciente a historica: conserva zoom y centro del operador.
- Actualiza marcador y precision sin mover la camara. Centrar en el celular
  permite volver a la ultima posicion deliberadamente, sin cambiar el zoom.
- Cambiar de residente o perder la posicion valida retira el mapa anterior.
- Editor de geocerca por internet preparado: centro por mapa o coordenadas,
  radios desde 5 m, guardado por residente, permisos y revision contra cambios
  simultaneos. Migracion 007 activada con autorizacion en el proyecto de pruebas;
  comandos y rechazo sin identidad comprobados en Supabase sin cambiar zonas.
- Android 0.5.0 ya consulta ese contexto cada 30 segundos con seguimiento activo;
  no necesita una APK nueva para leer la zona. Validacion fisica pendiente.
- No se generan todavia incidentes de salida cloud ni avisos a cuidadores;
  esa integracion queda para despues de validar la configuracion del celular.

## En desarrollo - Equipo, SOS y atencion compartida (21 octubre 2026)

- Equipo y permisos: invitaciones por administrador, acceso por residente,
  permiso GPS separado de configuracion y proteccion del ultimo administrador.
- Migracion 005 y funcion sfa-team-invite activadas en el proyecto de pruebas.
  La funcion verifica la sesion con Auth y el permiso administrador; no depende
  del filtro JWT heredado. Peticion ficticia rechazada en vivo con HTTP 401.
- Android 0.5.0-prototipo (6) preparado: SOS manual o prueba con confirmacion,
  cola SQLite persistente y reintento idempotente, sin exigir cinturon.
- Panel remoto de incidentes con consulta periodica, toma de atencion exclusiva,
  resolucion confirmada y control de concurrencia. Pruebas identificadas aparte.
- Migracion 006 aplicada con autorizacion en el proyecto de pruebas. Verificacion
  alojada de los cuatro comandos, consentimiento privado y rechazo sin identidad
  aprobada con ROLLBACK, sin generar eventos ni enviar avisos.
  La validacion fisica y la publicacion de binarios se registran por separado.
- 51 comprobaciones SQL aisladas y 47 pruebas web aprobadas. APK y lint
  aprobados; pruebas fisicas de envio, recepcion y atencion siguen pendientes.
- FCM todavia requiere el emisor PC autenticado. Geocerca cloud, emisor online
  y seleccion integrada de fuentes siguen pendientes. No se habilita facturacion.

## En desarrollo - Altura del mapa

- Mapa remoto mas alto en panel y portal: 64% de altura de ventana, entre 380
  y 700 px en escritorio; entre 320 y 480 px en movil con altura adaptable.
- No cambia el editor ni habilita la geocerca cloud. Ajuste incluido en fuentes
  y Centro de esta PC; el ZIP Windows rc5 anterior no se reemplaza.

## Android 0.4.1-prototipo (5) - Diagnostico de vinculacion

- Reemplazado el mensaje ambiguo de permisos/certificado/sesion/conexion por
  categorias de timeout, DNS, TLS, red, permiso Android y estado HTTP.
- Error persistente y legible hasta el siguiente intento. Nunca muestra cuerpos
  del servidor, tokens ni detalles internos de excepciones.
- Conexion limitada a 15 s y lectura a 30 s, en lugar de 10 s; sin reintentos
  automaticos de escrituras y sin desactivar validacion TLS o permisos.
- 15 pruebas unitarias Android, ensamblado y lint aprobados. Firma de prueba
  conservada. No se afirma solucion fisica hasta probar el caso del celular.
- Actualizacion Android independiente: Windows y portal permanecen en rc5.

## 1.2.0-rc5 - Mapa sin solicitud de clave (pre-release)

- El fondo del mapa remoto cambia de CARTO a OpenStreetMap estandar: se elimina
  la dependencia de una clave CARTO y su marca "API key required".
- La politica de imagenes del portal permite solo el dominio adicional de mapas.
  Las imagenes identifican el origen del sitio, sin enviar rutas, tokens ni
  parametros del acceso. Se conserva no-referrer para los demas recursos.
- Atribucion visible, cache normal del navegador, sin descarga masiva ni mapas
  offline. Servicio comunitario sin garantia de disponibilidad; no se activa
  facturacion, suscripcion ni prueba. Para gran escala revisar otro alojamiento.
- Sin cambios en la APK ni en las credenciales Supabase/FCM. Las limitaciones
  de geocerca remota de rc4 siguen vigentes.

## 1.2.0-rc4 - GPS remoto visible en el panel local (pre-release)

- Corregida la separacion de rc3: Ubicacion del panel local ahora ofrece
  Por internet y Red local y geocerca, como fuentes explicitas distintas.
- Lectura Supabase del residente vinculado al perfil local y propietario
  de la sesion; RLS comprobado en cada consulta. No se copian posiciones cloud
  a SQLite ni se exponen al panel LAN sin autenticacion.
- Mensajes diferenciados de sesion requerida, falta de vinculo, permisos y red.
- Consulta cada 10 segundos y reloj de antiguedad; lecturas de mas de 90 segundos
  se muestran como historicas. Ningun cambio de perfil conserva el mapa anterior.
- El modo de geocerca local y su QR se conservan en la opcion correspondiente.
  La geocerca cloud y sus avisos siguen pendientes; no se afirma seguridad de zona
  por recibir una posicion. La APK 0.4.0-prototipo no cambia.

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

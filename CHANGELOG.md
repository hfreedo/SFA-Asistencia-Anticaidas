# Changelog

## Windows 1.2.0-rc15 / Android 0.7.3 - Recorridos por rol y GPS de prueba

- Entrada segun rol: Mi seguimiento, Personas que cuido o Monitoreo del espacio.
- Administrador con confirmacion explicita de prueba para compartir su GPS en el
  mapa habitual de una ficha. Aviso permanente en app, panel y portal compatibles.
- Punto temporal separado del historial real; una lectura real posterior puede
  reemplazarlo. Detener/caducar la prueba devuelve la ultima posicion real.
- Migracion aditiva que conserva roles, historiales y permisos antiguos, sin
  alterar el puente PC/FCM ni los emisores reales de residentes y cuidadores.
- La prueba no escribe posiciones/eventos reales ni dispara geocercas o FCM.
- Migracion activada el 30/10/2026; hashes de roles, asignaciones y permiso GPS
  previo iguales antes/despues. No se enviaron pruebas GPS ni alertas reales.
- 143 tests web, 116 backend y 81 comprobaciones SQL aisladas. Validacion fisica
  Android pendiente, no sustituida por compilacion.

## Candidatas Windows 1.2.0-rc14 / Android 0.7.2 - Flujo multicuenta

- Monitoreo de fichas existentes por cuenta, separado de la creacion del emisor PC
  y con sesion de lectura independiente para no reemplazar la sesion de envio.
- Verificacion RLS de la ficha al vincular y en cada lectura; no copia GPS a SQLite
  ni crea residentes para encontrar a alguien ya registrado en otra computadora.
- Tabla de cuidadores, cuentas personales y permiso GPS por ficha; referencia
  remota visible y seleccion explicita cuando el portal tiene varias fichas.
- Android actualiza ubicacion/eventos en la vista del cuidador; comprueba el
  registro del receptor en el servidor y aclara los requisitos de SOS de prueba.
- Se conservan roles, asignaciones, claves y datos reales de Supabase sin cambios.
- Limites: FCM sigue necesitando una PC emisora privada activa. La prueba fisica
  de dos celulares y el control atomico de edicion de permisos siguen pendientes.

## Windows 1.2.0-rc13.3 - Confirmacion integrada de borradores

- Dialogo visual de SFA para salir de formularios de equipo, cambiar ficha o
  cerrar sesion; sustituye las confirmaciones nativas de esas acciones internas.
- Foco inicial en Seguir editando, Escape cancela, solicitudes duplicadas no
  acumulan navegaciones y desmontar el formulario cancela acciones pendientes.
- Aviso nativo conservado al cerrar/recargar la pestana por limitacion del navegador.
- Consulta preventiva antes de guardar permisos: cambios detectados o fallos de
  verificacion no envian el guardado y conservan el formulario.
- 132 pruebas de interfaz y revision visual en tres tamanos de panel y portal.
- Sin cambios en Supabase, FCM, cuentas o asignaciones reales. Android sigue 0.7.1.
- La consulta previa no elimina la carrera entre consulta y escritura; el control
  atomico y los permisos independientes por ficha siguen pendientes en backend.

## Windows 1.2.0-rc13.2 - Cuidadores y acceso claros

- Ficha reorganizada en cuidadores, cuenta personal y administradores con acceso.
- Selector accesible con opciones integradas; identidad y permisos diferenciados.
- Borradores protegidos al cambiar de vista, persona o cerrar sesion; la atencion
  de emergencia mantiene prioridad. Fallos de consulta no simulan estados vacios.
- Invitaciones pendientes indicadas por espacio, sin inferir su ficha por correo.
- Sin migraciones de Supabase, cambios FCM, reasignaciones ni APK nueva.
- Limitaciones: permisos compartidos por seleccion, sin control de concurrencia;
  asociacion de invitaciones a ficha pendiente en el contrato remoto.

## Windows 1.2.0-rc13.1 - Presentacion integrada de Personas (local)

- Pestanas, tipografia y botones de Personas alineados con los ajustes del panel.
- Selectores nativos con iconos Lucide, altura de 42 px y foco teal consistente;
  se conservan teclado, etiquetas accesibles y opciones del sistema en movil.
- Correo y rol alineados; fichas elegidas con radio/casilla y resaltado suave.
  Permisos separados de la identidad y acciones secundarias menos dominantes.
- Directorio compacto con mas espacio para los datos y relaciones de la ficha.
  El editor de cuidadores comparte el fondo blanco y borde de la ficha de datos.
- Sin cambios de permisos, Supabase, FCM ni APK. rc13 conservada sin reemplazar.
- Pruebas funcionales y capturas del panel y portal con datos ficticios.

## Windows 1.2.0-rc13 - Personas, fichas y equipo (local)

- Entrada Personas en el panel: Datos y Cuidadores y acceso desde la ficha.
  Las fichas dejan de estar escondidas entre los ajustes tecnicos.
- Portal: Personas y equipo permite consultar quien cuida a cada persona,
  su cuenta personal y los administradores del espacio, sin duplicar identidades.
- Cuidador: seleccion multiple de personas que puede cuidar. Persona cuidada:
  seleccion unica de la ficha que representa su cuenta, no personas a su cargo.
- Cuidador existente: conserva sus otras asignaciones al agregar una ficha.
  Cambiar la identidad de una cuenta residente requiere confirmacion explicita.
  Permisos heterogeneos no se uniforman sin consentimiento adicional.
- Referencia local/cloud por identificadores persistidos. Una ficha sin vinculo,
  no disponible o sin permiso no se sustituye por otra de nombre parecido.
- Sin migraciones Supabase, cambios FCM, APK nueva, reasignaciones automaticas
  ni publicacion remota. PC de confianza conservada para demostraciones.
- Guia: docs/PERSONAS_Y_EQUIPO.md.

## Windows 1.2.0-rc12 y Android 0.7.1 - Roles en demostracion (local)

- Servidor local: gestion, perfiles, configuraciones, consultas y WebSocket
  reservados a localhost con origen valido. Bloqueo de Host ajeno y solicitudes
  cross-site. CORS deja de aceptar cualquier origen.
- LAN conserva solo pagina/recursos emisores y GET/POST GPS con su vinculo
  existente. La consulta en otro equipo se realiza en el portal autenticado.
- Android: Cuenta para emisor residente, Cuidar/Pruebas solo para personas con
  capacidades de cuidado. Asignaciones y permisos de emision diferenciados por
  espacio y persona; rol admin de otro espacio no eleva al residente.
- Web integrada: identifica al residente sin describirlo como cuidador.
- Sin nuevas contrasenas locales: PC de operador de confianza, no identidad
  diferenciada de quienes comparten la misma sesion de Windows.
- Sin migraciones Supabase, cambios FCM, planes de pago ni publicacion remota.
  Relevo administrativo de incidentes queda pendiente de otra etapa.

## Windows 1.2.0-rc11.3 - Lenguaje visual del principal (release local)

- Titulos y estados con escala comun. Selector GPS compacto sin marco interior,
  actualizacion en cabeceras y mapa como accion principal teal.
- Sesion pausada confirmada por el servidor en un unico aviso contextual.
  Las zonas mantienen sus estados sin repetir el remedio. Un fallo independiente
  conserva su acceso correctivo, sin inferir una causa comun no verificada.
- Historial secundario y diagnostico en opciones. Sin contador cero cuando
  falta consulta ni mensajes duplicados de consulta sin verificar.
- Incidentes reales, seguimiento de geocerca, permisos y atencion persistente
  conservados. Sin cambios cloud, FCM, APK ni publicacion remota.

## Windows 1.2.0-rc11.2 - Preparacion visible y avisos claros (release local)

- Indicador en navegacion de escritorio y movil con acciones por perfil:
  vinculo habilitado, sesion pausada y errores del emisor FCM.
- Consulta no disponible diferenciada de un estado listo; cinturon y emisor
  sin configurar son opcionales para GPS y no inflan el contador.
- Preparacion muestra iconos y accesos contextuales a vinculo, sesion,
  dispositivo y avisos. Los avisos del principal enfocan el acceso integrado.
- Encabezados alineados, botones coherentes y diagnostico desplegable.
  No se muestra historial (0) si la consulta falla o aun no se verifico.
- Sin migraciones, cambios FCM, APK ni publicacion remota. rc11.1 conservada.

## Windows 1.2.0-rc11.1 - Claridad visual del principal (release local)

- Atencion y Ubicacion delimitadas sobre blanco, en dos columnas de escritorio
  y una en movil. Perfil compacto, sin franjas vacias ni doble separacion.
- Estado principal antes de acciones; consultar incidentes mediante icono con
  nombre accesible, y preparacion/avisos del navegador en opciones secundarias.
- GPS antiguo en ambar y tiempos legibles. Consulta al servidor y ultima
  posicion se identifican como datos distintos; precision historica rotulada.
- Estado vacio solo despues de consulta verificada. Un seguimiento de geocerca
  pendiente sigue visible y no compite con un mensaje de ausencia de incidentes.
- Sin cambios cloud ni APK; rc11 conservada. No publicada en GitHub.

## Windows 1.2.0-rc11 - Panel principal centrado en la persona (release local)

- Perfil antes de incidentes; alerta persistente con detalle de atencion
  desplegable. Se conservan confirmaciones, permisos e indicadores laterales.
- GPS por internet en el resumen, con fuente explicita compartida con el mapa,
  precision y antiguedad. Sin sustitucion silenciosa por coordenadas locales.
- Actividad de hoy local y remota reunida, con origen y pruebas identificados;
  fallos de consulta no equivalen a ausencia de incidentes.
- Movimiento estable del cinturon deja de anunciar Sin alertas activas generales.
  Primera actividad sin panel vacio fijo. Simulacion local trasladada a Notificaciones.
- Sin cambios cloud ni APK nueva. rc10 y rc10.1 conservadas, sin publicar en GitHub.
- Guia de alcance y verificacion: docs/PANEL_PRINCIPAL_PERSONA.md.

## Windows 1.2.0-rc10.1 - Vinculo guardado en Preparacion (release local)

- La vista consulta el vinculo persistido para el perfil y espacio seleccionados.
  Si esta habilitado muestra Vinculo de este perfil guardado, sin repetir casilla
  ni boton de alta. Reanudar y pausar siguen siendo acciones independientes.
- La autorizacion de un alta nueva no se reutiliza al cambiar de destino ni se
  infiere de un vinculo deshabilitado, de otro perfil o de otro espacio.
- Sin cambios de permisos Supabase, almacenamiento de sesiones ni FCM.
- rc10 original conservada. Paquete corregido local rc10.1, sin publicar en GitHub.

## Windows 1.2.0-rc10 - Preparacion unificada, etapa 1 (release local)

- Preparacion dentro del panel: acceso, vinculo de esta PC y equipo sin otra
  pestana; conserva el perfil seleccionado y exige consentimiento explicito.
- Accesos contextuales al dispositivo, mapa y notificaciones en el mismo panel.
  El Centro ofrece Abrir SFA y Preparar sistema; LAN es una opcion independiente.
- Estados separados de cinturon, vinculo, sesion y emisor FCM. No se interpreta
  configuracion como entrega ni la ausencia del cinturon como falta de GPS.
- Navegacion movil de cuatro opciones y disposicion responsive verificada.
- Configuracion publica compartida entre builds local y acceso. Recuperacion
  conserva el retorno existente; cerrar sesion pausa antes los envios locales.
- Sin migraciones Supabase, cambios FCM o nueva APK. Los releases publicados
  anteriormente no incluyen esta etapa. Guia: docs/PREPARACION_UNIFICADA.md.
- Paquete local en release/SFA-Asistencia-1.2.0-rc10-Windows.zip, con driver
  CH340/CH341 opcional, documentacion y sumas SHA-256. Sin publicar en GitHub.

## Android 0.7.0 release - Recuerdos

- Album local independiente de cuentas y de la telemetria: alta de fotos con
  selector Android, vista completa, titulo opcional, favoritas y borrado confirmado.
- Copias optimizadas y miniaturas en almacenamiento interno sin backup automatico;
  no se suben a Supabase/FCM ni se modifican los originales de la galeria.
- Sin permisos nuevos de lectura general de imagenes. Hasta 60 fotos y limite
  de tamano de importacion; catalogo atomico y rechazo de datos corruptos.
- SOS accesible en Recuerdos con sesion y residente vinculados, sin detener GPS.
- VersionCode 10 y misma firma release de 0.6.2; no desinstalar para actualizar.
- Firma local reutilizable sin restablecer permisos Windows ya restringidos.
- 37 pruebas unitarias Android aprobadas, 10 nuevas de persistencia del album;
  build release, lint, firma y manifiesto verificados sin permisos nuevos.
- Prueba fisica de interfaz, selector, GPS y SOS pendiente; ver docs/RECUERDOS_ANDROID.md.

## Windows rc9 - Confirmacion real de la alerta del cinturon

- Atender o registrar falsa alarma envia RESET al cinturon y espera RSP,RESET,OK.
  Silenciar usa MUTE y su confirmacion, sin confundirlo con una resolucion.
- No se registra exito si el dispositivo conectado rechaza la orden o no responde.
  El error permanece visible en la cortina para poder reintentar.
- Lecturas repetidas de una misma caida no reabren la cortina ya atendida.
  Un nuevo contador de caidas o una transicion nueva vuelve a activar la alerta.
- Se elimina la confirmacion ficticia ante errores HTTP y el estado NORMAL
  inventado en la web. Se conserva la telemetria real del dispositivo.
- Confirmacion protegida contra peticiones repetidas, con cancelacion de la
  pulsacion al salir del boton y limpieza del temporizador al cerrar la pantalla.
- 82 pruebas web y 101 Python aprobadas. Pendiente prueba fisica con el cinturon.
- No requiere firmware nuevo: utiliza los comandos existentes RESET y MUTE.
  Android permanece en 0.6.2-release; no requiere reinstalar la APK.

## Android 0.6.2 release - Identidad de distribucion (2026-10-22)

- VersionCode 9, build release no depurable y certificado propio de distribucion.
- La clave se conserva fuera de las fuentes y los paquetes. Contrasena local
  protegida mediante DPAPI del titular; no se sube a GitHub ni se incluye en APK.
- Script local para crear o reutilizar la firma sin contrasenas en comandos.
- Firma distinta a debug: no actualizar encima de 0.6.1 sin revisar la guia de
  migracion. Los futuros releases deben conservar esta identidad.
- No modifica los flujos GPS, SOS o FCM ni requiere nuevas migraciones cloud.
- No promete eliminar avisos de navegador o Play Protect. Instalacion y pruebas
  fisicas con la nueva firma quedan pendientes.

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

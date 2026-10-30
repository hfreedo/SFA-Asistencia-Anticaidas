# Panel principal centrado en la persona - Windows rc11

## Presentacion rc11.1

Atencion y Ubicacion se delimitan con superficies blancas y bordes suaves,
en dos columnas de escritorio y apiladas en pantallas estrechas. La primera
no muestra una ausencia de incidentes antes de verificar su consulta ni cuando
existe seguimiento de geocerca pendiente. La zona incierta sin seguimiento se
explica en Ubicacion sin repetir otra advertencia neutra en Atencion.

El menu de tres puntos de Atencion contiene los avisos opcionales del navegador
y el acceso a Preparacion. Consultar incidentes es un icono con tooltip y nombre
accesible. Historial y revisar pendientes permanecen visibles.

El tiempo de ultima posicion usa minutos, horas o dias, separado de la fecha
de consulta del servidor. Un GPS antiguo o impreciso tiene acento ambar; la
precision de una posicion antigua se identifica como ultima lectura, no actual.
No se modifican motores de riesgo, comandos, permisos ni fuentes de datos.

## Orden de lectura

1. Persona seleccionada, referencia y contacto.
2. Incidentes pendientes y situacion de geocerca que requiere seguimiento.
3. Ubicacion y zona, con origen, antiguedad y precision del GPS.
4. Estado independiente del cinturon y primera actividad recibida, cuando existe.
5. Actividad reciente de hoy, con etiquetas PC local, Por internet y Prueba.
6. Mediciones del cinturon, si se recibieron, en su apartado desplegable.

La alerta principal no se cierra ni se oculta al plegar el detalle. Revisar
pendientes abre los comandos de atencion. Resolver conserva el procedimiento
existente y sus permisos; el reingreso no resuelve automaticamente un incidente.
Los avisos simulados mantienen su identificacion de prueba.

## Ubicacion sin cambiar de contexto

El resumen permite elegir Por internet o Red local. Esa seleccion se mantiene
al pasar al mapa y volver durante la sesion de la interfaz, por perfil. Un perfil
nuevo usa Por internet como vista inicial. Recargar la pagina restaura ese valor
inicial: esta preferencia visual todavia no es una configuracion persistida.

Por internet consulta el mismo endpoint autenticado del mapa remoto. Si falla,
no se muestran coordenadas locales como sustituto. Red local consulta el
seguimiento local existente. El boton de una alerta de geocerca local abre
explicitamente el mapa local.

Las posiciones con mas de 90 segundos o mas de 30 segundos hacia el futuro no
se consideran recientes. La precision se muestra separada de la antiguedad.
La evaluacion de zona procede del motor existente: recibir una coordenada no
equivale a confirmar permanencia o reingreso. Las zonas no se fusionan ni se
copian entre fuentes. No se cambia el motor de geocerca ni sus umbrales.

## Actividad e incidentes

La actividad combina eventos atribuidos a la persona seleccionada recibidos
por el WebSocket local y los incidentes devueltos por la consulta remota. Usa
los mismos datos de incidentes ya consultados; no agrega otra consulta cloud
ni replica ubicaciones en SQLite. El informe se descarta visualmente al cambiar
de perfil hasta disponer de los datos correspondientes.

Se muestran hasta seis registros recientes de hoy disponibles en esas fuentes.
No es un historial exhaustivo: la fuente local corresponde a lo recibido por
esta interfaz y la remota al conjunto limitado devuelto por el servidor.
Los registros sin residente local atribuido no se adjudican automaticamente
a la persona seleccionada. Los duplicados de un mismo identificador y origen
se eliminan; no se deduplican por semejanza eventos de origen distinto.

Una consulta fallida se informa sin presentar un historial vacio como ausencia
de incidentes. La actividad no reemplaza las acciones del apartado de atencion.

## Cinturon y pruebas

Movimiento estable describe solo la lectura del cinturon; ya no se presenta
como Sin alertas activas del sistema completo. Desconectar el sensor no se
interpreta como desconexion del GPS del celular. La primera actividad ocupa
espacio cuando se recibio un registro del dia, no como un panel vacio fijo.
Al cambiar de persona se descartan la lectura y primera actividad en memoria
de la seleccion anterior, esperando datos nuevos.

Simular alerta de caida en esta PC esta en Ajustes > Notificaciones > Pruebas
de esta PC. Solo prueba la cortina local; no confirma entrega FCM ni genera por
si sola una emergencia real. Los comandos reales del sensor no se modifican.

## Alcance y comprobaciones

Sin cambios SQL, RLS, Supabase Auth, credenciales FCM o Android. El envio FCM
sigue dependiendo de la PC y la sesion autorizada. La APK sigue en 0.7.0-release.

Pruebas automatizadas: seleccion de fuente, GPS remoto sin posicion local,
rechazo de posiciones invalidas, antiguedad, respuestas tardias de otro perfil,
actividad atribuida y apertura explicita de atencion. Playwright verifica el
orden persona > alerta > ubicacion y la continuidad de fuente con datos ficticios
en 1920x1080, 1366x768 y 390x844. Capturas en build/preparation-qa/principal-*.png.
No son pruebas fisicas del GPS, sensor ni recepcion de notificaciones.
## Presentacion rc11.3

Atencion y Ubicacion comparten escala de titulos, estados neutros y controles
de consulta en cabecera. El selector GPS es compacto, mapa es accion principal
y el historial es secundario. El diagnostico de Atencion esta en opciones.

Cuando /api/cloud/status confirma session_active=false, el principal muestra
un solo aviso de sesion pausada con acceso a Preparacion. No inicia sesion
automaticamente. Las dos consultas conservan sus estados sin afirmar ausencia
de incidentes o ubicacion actual. Si la sesion no se pudo comprobar o esta
activa, cada consulta fallida conserva su propio acceso correctivo.

Las alertas persistentes reales no se ocultan, cierran ni resuelven con este
cambio visual. No cambia el motor de geocerca, Supabase, FCM ni Android.

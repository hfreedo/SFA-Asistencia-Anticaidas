# Candidata rc16: refinamiento de flujo y verificacion

Fecha: 31 de octubre de 2026. Version: **1.2.0-rc16**, candidata Windows.
Base de trabajo: auditoria privada de rc15.1 en `build/auditoria-rc15.1/INFORME.md`.

## Alcance y conservacion

- No se migran, fusionan, eliminan ni reasignan fichas remotas.
- No se cambian roles, RLS, funciones SQL ni el emisor FCM.
- No se reemplaza ni reinicia el Centro instalado que utiliza el usuario.
- Android no cambia en esta etapa. Las pruebas de entrega fisica siguen separadas.
- Los cambios del backend agregan metadatos de la ficha y cuenta de consulta,
  bajo las mismas comprobaciones de sesion y acceso existentes.
- La copia de prueba en `build/rc16-qa-server` contiene codigo y recursos publicos,
  sin copiar bases, .env, certificados o credenciales privadas de la instalacion.
  Su perfil QA es ficticio y su puerto 18787 escucha solo en loopback.

## Matriz de cambios

### Separacion de tareas por seccion

- Preparacion contiene el acceso, el vinculo de consulta, avisos del navegador y el emisor opcional de esta PC.
- El enlace "Gestionar personas y accesos" navega al directorio; no abre otra copia del formulario dentro de Preparacion.
- Personas y accesos concentra Personas cuidadas (fichas y relaciones) y Cuentas y Permisos (invitaciones y roles).
- Los perfiles exclusivamente locales siguen separados en "Perfiles de esta PC". No se convierten ni fusionan fichas.
- El portal remoto conserva su gestion propia. No se modifican permisos, datos, Supabase ni FCM.

| Informe | Implementacion | Limite de aceptacion |
| --- | --- | --- |
| F01 | Nombre, habitacion y referencia corta en selecciones y asignaciones de Equipo. | No fusiona nombres iguales; conserva los UUID. |
| F02 | Editar zona local transporta explicitamente la fuente local. Preparacion abre la remota. | La navegacion y el cambio de fuente comparten la confirmacion de borrador. |
| F03 | Constructor de direcciones conserva HTTP/HTTPS y contempla IPv6. | No instala certificados ni garantiza alcance por firewall. |
| F04 | Estado compartido de permiso y preferencia para avisos, persistencia de desactivacion y activacion en lectores montados. | No certifica entrega del sistema operativo; las alertas locales respetan la misma preferencia. |
| F05 | Personas por internet separado de Perfiles de esta PC. Contexto remoto procede de la consulta autorizada, no del emisor. | Mejora aplicada, no unificacion de bases. Mantiene configuracion local avanzada. |
| F06 | Guardas de borrador de geocerca remota/local, perfil y preferencias. | El cierre o recarga del navegador conserva su advertencia nativa de salida; navegacion interna usa dialogo integrado. |
| F07 | Estado pendiente/guardado y accion de guardar visible al inicio de Notificaciones. | Los switches son preferencias locales hasta guardar, no reglas cloud. |
| F08 | Errores de consulta y prueba dirigen a cuenta/ficha en Preparacion. | No se pide al cuidador reanudar el emisor administrativo. |
| F09 | Cuenta de navegador y sesion de consulta del puesto diferenciadas; discrepancias no se muestran verdes. | La PC sigue siendo puesto local de confianza, no autenticacion local multiusuario. |
| F10 | Version de interfaz, servidor y origen consultables; titulo del Centro con version. | Ubicacion de datos permanece en el Centro. Un servidor antiguo se identifica como no verificable. |
| F11 | Antiguedad legible y separacion de ultima lectura historica al desvincular. | No convierte una lectura antigua en seguimiento activo. |
| F12 | Alta local con nombre accesible, foco inicial/restauracion, Escape, ciclo de Tab y bloqueo de doble envio. | No equivale a una auditoria completa con lector de pantalla. |
| F13 | Importacion con confirmacion integrada, recuento de perfiles/fotos y nombres de muestra; limites del respaldo explicitos. | El servidor conserva la validacion final. No se importo una copia real. |
| F14 | Activacion/desactivacion concreta de avisos desde Preparacion. | El permiso se solicita solo por accion del usuario. |
| F15 | Monitoreo primero en portal local; emisor dentro de opcion avanzada. | No modifica capacidad administrativa ni el transporte. |
| F16 | Acceso movil rotulado como web por red local; instrucciones del Centro en lugar de BAT/Python. | Android por internet se distingue del QR LAN; no se reinstala ni cambia el launcher. |
| F17 | Icono de ayuda corregido al nombre disponible en la biblioteca. | Inspeccion visual y accesible del control. |

## Verificacion

- EXE rc16 probado desde una carpeta temporal limpia: panel y portal actuales,
  comandos de monitoreo rechazan solicitudes sin sesion y detencion autenticada
  completada. El ZIP exacto tambien paso ese ensayo, sin copiar datos personales.

- Compilacion TypeScript y generacion del panel y del portal de acceso.
- Regresion Python: 117 pruebas, incluidas limites loopback, sincronizacion,
  sesiones, geocerca, incidentes y pruebas de avisos con fixtures.
- Regresion web: **177 pruebas en 34 archivos**, todas aprobadas. Incluye identidades duplicadas, referencias, consentimiento,
  espacios distintos, estado compartido de avisos, rutas locales explicitas,
  directorio remoto por defecto y rechazo de contexto incompleto.
- Playwright aislado: Preparacion y portal en 1920 x 1080, 1366 x 768 y 390 x 844;
  sin desbordamiento en esos recorridos y sin escrituras cloud reales.
- Navegador interno: area CSS efectiva 1920 x 1080 y revision movil. Alta de un
  perfil ficticio en la base separada, cancelacion de borrador y consulta de
  relaciones reales con sesion administradora iniciada por el usuario.
- Las fichas reales con igual nombre se distinguen por habitacion y referencia.
  Solo se consultan; no se cambia ninguna relacion durante esa inspeccion.

## Hallazgo adicional durante la prueba

El autocompletado del navegador intento usar credenciales de acceso en los campos
de Telegram. Ahora esos campos solo se montan tras abrir la edicion del canal,
usan nombres/autocompletado especificos y se valida su formato antes de guardar.
Una prueba del canal queda deshabilitada mientras existen preferencias pendientes.
No se guardaron ni enviaron las credenciales autocompletadas.

## Riesgos y pendientes que no deben ocultarse

### Segunda pasada estetica a partir de las capturas del usuario

- Corregida la colision entre campos de Ajustes y el acceso integrado: solo el
  contenedor dibuja borde/foco; el input interior no agrega margen ni otro cuadro.
- Campos de acceso de 44 px, texto interior de 14 px y etiquetas de peso 500.
  Autocompletado con fondo uniforme, sin extraer ni copiar credenciales.
- Cerrar sesion pasa a accion compacta de 36 px, peso 500, dentro de la cuenta
  desplegada cuando se administra una ficha. No cambia el comportamiento de salida.
- Cuenta, relaciones, administradores y opciones del emisor comparten indicadores,
  espaciado, foco y apertura; se eliminan triangulos nativos y pesos contradictorios.
- Informacion tecnica fuera del contenido principal: boton de informacion en
  cabecera, con datos ordenados en un panel consultable y cierre por Escape/clic fuera.
- Evitada la repeticion del nombre de la persona en el encabezado y en la ficha.
- Pruebas visuales aisladas con `--aesthetic`, con y sin sesion, en 1920 x 1080,
  1366 x 768 y 390 x 844. Comprueban geometria de campos, borde unico,
  control de visibilidad de clave, accion de salida y panel tecnico sin desbordar.
  No basta con que TypeScript compile para dar por aprobado este criterio.

### Pendientes de validacion general

1. Esta candidata no certifica el recorrido fisico completo cuidador/residente en
   dos telefonos o computadoras, ni FCM/GPS con pantalla bloqueada.
2. No se prueba el reemplazo destructivo de una instalacion real ni la importacion
   de una copia con perfiles de terceros. Eso exige respaldo y ensayo de restauracion.
3. La compilacion conserva una advertencia de bundle grande. No es un error de
   compilacion, pero queda pendiente separar cargas para mejorar arranque.
4. Python informa deprecaciones del adaptador WebSocket y avisos de conexiones
   SQLite sin cerrar en pruebas. No deben confundirse con una entrega fallida,
   pero requieren una tarea acotada posterior, sin actualizar dependencias a ciegas.
5. El arranque portable aislado no certifica por si solo el recorrido fisico con
   dos cuentas y dos dispositivos. El codigo y los fixtures no sustituyen esa prueba.

## Recorrido esperado

1. El administrador mantiene fichas y asignaciones en Personas por internet.
2. La persona cuidada inicia GPS/SOS desde su Android autorizado.
3. El cuidador entra en Preparacion con su cuenta y vincula la ficha existente.
4. Consulta Principal y Ubicacion por internet, sin reanudar envios del cinturon.
5. Activa avisos del navegador si los desea; los incidentes siguen en el panel.
6. Solo si se usa cinturon local se prepara ademas el perfil/emisor de esa PC.

No se considera que "todo esta probado" por tener una compilacion correcta.
Los limites anteriores deben mantenerse visibles en la validacion de release.

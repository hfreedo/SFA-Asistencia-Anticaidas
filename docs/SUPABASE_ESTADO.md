# Supabase de SFA: registro de preparacion

## Corte vigente: 21 de octubre de 2026

- Migraciones 001 a 009 aplicadas desde el Dashboard en el proyecto de pruebas.
- 009 separa situacion de zona y atencion. Consulta bajo los permisos ya
  existentes, sin nuevos avisos ni reproduccion de ubicaciones. Funcion privada
  no ejecutable directamente por clientes. Ver verify_zone_situation_live.sql.
- 008 activa el motor persistente de geocerca para posiciones nuevas, sin
  reproducir historiales. Estado privado con RLS y disparador verificados;
  anon no puede leer incidentes. Consulta sin datos personales ni escrituras:
  supabase/validation/verify_persistent_geofence_live.sql.
- 005 habilita equipo, invitaciones y permiso explicito de emisor GPS.
- sfa-team-invite desplegada; filtro JWT legado desactivado solo para esta
  funcion. La funcion verifica identidad con Auth y rol con RPC antes de invitar.
- Prueba alojada sin correo: sesion ficticia rechazada con HTTP 401 y codigo
  session_invalid. No se enviaron invitaciones durante el despliegue.
- Migracion 006 (SOS/atencion/consentimiento de pruebas) aplicada con autorizacion.
  Verificacion alojada: cuatro comandos disponibles, sin EXECUTE anonimo,
  consentimiento privado y rechazo de llamadas sin identidad. Transaccion con
  ROLLBACK, sin crear incidentes, destinatarios ni trabajos FCM. Consulta reproducible:
  supabase/validation/verify_incidents_live.sql.
- Migracion 007 (editor remoto de geocerca desde 5 m) aplicada con autorizacion.
  Comandos disponibles y rechazo sin identidad comprobados en transaccion con
  ROLLBACK, sin guardar zonas ni enviar alertas. Verificacion reproducible:
  supabase/validation/verify_geofence_live.sql. Prueba fisica Android pendiente.
- Las pruebas aisladas no validan correo entregado, recepcion FCM en Android
  ni GPS fisico. No hay facturacion, suscripciones ni pruebas de pago activadas.

El registro siguiente conserva etapas anteriores. Su estado inicial no describe
por si solo las funciones disponibles en este corte.

Fecha: 20 de octubre de 2026. Entorno de pruebas, no servicio de emergencias.

Estado actual: login administrador y vinculacion PC comprobados; RPC PC con
RLS activos y portal publicado. GPS cloud, FCM y Storage privado pendientes.
Las secciones iniciales son bitacora de etapas anteriores, no una negacion
de los avances registrados al final. Para el alcance vigente ver PLAN_AMPLIACION.md.

## Proyecto intervenido

- Nombre: SFA Asistencia - Pruebas.
- Referencia: lxymfaoraayccmxwiubw.
- URL publica del servicio: https://lxymfaoraayccmxwiubw.supabase.co
- Region: South America (Sao Paulo), sa-east-1.
- Proyecto nuevo creado por el titular. No se modificaron los otros proyectos.
- No se recopilaron contrasenas, claves secretas ni claves de servicio.

La URL y la referencia identifican el proyecto, pero no conceden acceso a datos.

## Cambios aplicados desde el Dashboard

1. Se comprobo que public y sfa_private no tenian tablas de aplicacion.
2. Se ejecuto el esquema de etapa 1 en una transaccion, equivalente a
   `supabase/migrations/202610200001_base_sfa.sql`.
3. Se crearon 10 tablas publicas sfa_* y la tabla privada legacy_residents.
4. Se habilito RLS en las 11 tablas; clientes autenticados solo tienen SELECT
   filtrado por sus vinculos. No hay comandos de escritura para clientes aun.
5. Se configuraron funciones privadas con search_path cerrado para los permisos.
6. Se desactivo Allow new users to sign up y se mantuvieron desactivados
   Allow anonymous sign-ins y Allow manual linking. Confirm email sigue activo.
7. Se recargo la pagina de proveedores para comprobar persistencia.

El SQL se aplico manualmente mediante SQL Editor. Esto no equivale a haber
ejecutado `supabase db push` ni a registrar la version en el historial del CLI.
Antes de introducir un flujo CLI hay que reconciliar su historial con el
esquema existente; NO volver a ejecutar esta migracion sobre las mismas tablas.

## Prueba ejecutada en PostgreSQL alojado

Se insertaron dentro de una transaccion dos espacios ficticios, cuatro IDs
Auth sin contrasena/correo, tres residentes, un vinculo, un dispositivo y muestras
simuladas. Se uso SET LOCAL ROLE authenticated y claims de prueba del editor SQL.
Se comprobaron mediante excepciones ante cualquier fallo:

- 11 tablas con RLS.
- Ausencia de SELECT anonimo sobre residentes.
- Ausencia de privilegios de borrado de posiciones o cambio de membresias para clientes.
- Administrador con acceso solo a su espacio.
- Cuidador con acceso solo al residente vinculado, posiciones y atencion.
- Otro espacio sin acceso a las posiciones/eventos/atencion ajenos.
- Cuenta sin invitacion sin acceso a residentes o espacios.
- Revocacion del vinculo, de la membresia y del administrador.

La consulta termino con ROLLBACK y mostro:

`PASS: RLS, privileges, admin/caregiver isolation and revocations`

El resultado mostro 0 residentes tras el rollback. No se crearon cuentas
permanentes ni se importaron perfiles, fotos, contactos o ubicaciones reales.
La prueba no valida login, correo, JWT firmado o recuperacion de contrasena:
esas comprobaciones requieren cuentas reales de prueba en la siguiente etapa.

## Pendiente

- El titular debe aceptar la invitacion y definir personalmente su contrasena.
- Implementar comandos autorizados antes de habilitar escrituras.
- Probar login real, expiracion de sesion, permisos y revocacion de extremo a extremo.
- Preparar Storage privado y sus politicas para fotos.
- Integrar web/puente local, sincronizacion, migracion con copia previa y APK.

El panel local NO esta protegido por el login nuevo ni sincroniza con Supabase.
El portal de acceso separado si incluye el SDK de autenticacion y consulta de
vinculos, pendiente de la prueba con cuenta real. El usuario no necesita
cambiar sus BAT ni certificados a causa de este paso.

## Activacion inicial autorizada

El titular autorizo los destinos concretos de retorno. Se guardo como Site URL:

`https://hfreedo.github.io/SFA-Asistencia-Anticaidas/acceso.html`

La lista Redirect URLs contiene seis entradas exactas, sin comodines:

```text
https://hfreedo.github.io/SFA-Asistencia-Anticaidas/acceso.html
https://hfreedo.github.io/SFA-Asistencia-Anticaidas/acceso.html?flow=recovery
http://localhost:8780/acceso/acceso.html
http://localhost:8780/acceso/acceso.html?flow=recovery
https://localhost:8780/acceso/acceso.html
https://localhost:8780/acceso/acceso.html?flow=recovery
```

Supabase confirmo `Successfully added 6 URLs`. Se envio una invitacion al correo
elegido por el titular; el Dashboard mostro la confirmacion de envio y la cuenta
Auth creada. Esto demuestra aceptacion del envio, no recepcion en la bandeja ni
lectura del mensaje. No se guarda aqui el correo o UUID personal de la cuenta.

Una transaccion controlada verifico el ID y correo de esa cuenta, creo el
espacio `SFA Asistencia - Pruebas` y su membresia admin. La consulta final mostro
una fila: espacio SFA, role=admin, active=true. Se registro la operacion de
bootstrap en sfa_audit sin atribuirla a una sesion de usuario aun no probada.
No se importaron residentes ni se concedio acceso a otros proyectos.

El agente no establecio ni conoce la contrasena. Falta que el titular acepte
el correo y pruebe su acceso; no se declara aun validado el login real.

## Comprobacion posterior del titular

El titular acepto la invitacion y establecio personalmente su contrasena.
La consulta de Auth confirmo role=authenticated, email_confirmed=true y
signed_in=true. La interfaz mostro un error posterior al verificar identidad
y permisos, por lo que NO se declara completo el acceso extremo a extremo.

Se verificaron como verdaderos USAGE del esquema public, SELECT de membresias,
USAGE de sfa_private y EXECUTE de is_admin para authenticated. La API anonima
devuelve 401/42501 al consultar membresias, lo esperado para el acceso cerrado.
No se desactivo RLS ni se ampliaron privilegios para ocultar el fallo.

Se agregaron referencias de soporte limitadas a etapa/codigo, sin mensajes
privados del proveedor ni tokens. Compilacion y 12 pruebas frontend aprobadas.
Tras recargar el portal no se recupero una sesion activa. Pendiente reproducir
el login con el titular para leer el codigo preciso y corregir la causa.

El portal posteriormente mostro MEMBERSHIP:42501. Se reprodujo en SQL la
lectura de la membresia y espacio de la cuenta con SET LOCAL ROLE authenticated:
ambas consultas pasaron, sin ampliar grants ni desactivar RLS. El cliente de
lectura ahora fija Authorization al mismo token verificado por getUser, evitando
depender de una recuperacion implicita de sesion para consultar los vinculos.
Registro historico: despues de esta correccion el titular mostro login real
con identidad y rol administrador verificados en el portal.
El mensaje sobre monitoreo remoto pendiente era informativo, no un error;
la etapa 3A lo reemplaza por el monitor remoto.

## Etapa 3A: comandos PC

Se aplico 202610200002_pc_sync.sql en el proyecto de pruebas, con autorizacion
expresa. sfa_link_pc y sfa_ingest_pc requieren administrador del espacio;
no permiten escrituras anonimas ni de cuidadores. Las muestras tienen RLS.
Una transaccion alojada comprobo vinculacion idempotente, ingreso, reintento
sin duplicacion y rechazo de otro espacio; sus fixtures se revirtieron.

El portal compilado se publico en codex/portal-acceso, commit
ff4444de15c8dc8f91ff87f1310c6f6679deb4e5, con build de Pages confirmado.
No se publicaron bases, fotos, perfiles locales ni claves secretas.
La PC ya tiene una vinculacion real persistida y el titular ve el perfil en
el portal remoto. Falta registrar la transmision y alerta con cinturon fisico.
Consultar SINCRONIZACION.md para consentimiento, sesion y prueba pendiente.

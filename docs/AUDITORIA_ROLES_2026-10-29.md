# Evaluacion de roles y flujo de SFA

Seguimiento: la etapa local rc12 / Android 0.7.1 cierra el limite LAN y separa
funciones Android por capacidades. La PC sigue siendo un puesto de confianza
por decision del usuario; no incorpora autenticacion local por persona.
Consultar ROLES_DEMOSTRACION.md. El relevo de incidentes sigue pendiente.

Fecha: 2026-10-29. Alcance: fuente local actual, funciones y permisos de
Supabase consultados en modo lectura, pruebas aisladas con datos ficticios.
No se modificaron permisos, cuentas, esquema, APK ni ejecutables.

## Dictamen

La jerarquia cloud tiene controles efectivos para separar administrador,
cuidador y residente. No se encontro en los comandos revisados un camino por
el que el residente pueda autoasignarse privilegios de cuidador o administrador.
Esto no equivale a una certificacion integral de seguridad: el flujo local
y la presentacion de roles siguen incompletos.

## Hallazgos

### P1: el panel local no aplica la jerarquia cloud

En servidor_pc/main.py las rutas create_resident (796), delete_resident (823),
update_profile (846) y export_configuration (972) no exigen una identidad ni
un rol. El middleware private_responses (1041) agrega cabeceras, no autoriza.
Las operaciones cloud sensibles si exigen require_cloud_operator, pero este
comprueba procedencia/origen de la PC, no la identidad de quien maneja el panel.

En modo LAN, sfa_portable.py:201 publica el mismo servidor en las direcciones
locales. Por tanto, un cliente que alcance esas rutas no queda limitado por el
rol resident de Supabase; incluso sin LAN, alguien con acceso a la PC comparte
la confianza del operador. La sesion administrativa guardada en memoria no
identifica al humano que pulsa cada accion local.

Recomendacion: separar la superficie emisora GPS de la superficie de gestion,
autorizar cada operacion en el servidor y definir acceso local/offline de
operador sin convertir la direccion IP en un rol. No exponer el panel completo
a un residente mientras esa separacion no exista.

### P2: Android muestra modos operativos, no pantallas segun rol

MainActivity.kt:179-182 muestra Compartir, Recuerdos, Cuidar y Pruebas sin
filtrar por membresia. La lista de personas viene de remoteResidents, sujeta
a RLS, pero el cliente no consulta un contexto de capacidades que diferencie
que puede leer, emitir o administrar esa cuenta por espacio/residente.

La base de datos bloquea al residente al intentar registrar un receptor FCM
de cuidador o atender incidentes; IncidentFeed.kt:99 tambien usa can_attend.
La consecuencia actual es confusion y botones que terminan en errores, no
una elevacion de privilegios demostrada en la nube.

AccessApp.tsx:170-179 ya reserva Equipo a administradores, pero comparte
Monitoreo con residentes y usa un mensaje generico de cuidador en el acceso
integrado de cualquier no administrador. Conviene distinguir ambos roles.

### P2: no existe relevo administrativo de una atencion tomada

public.sfa_attend_incident exige que actor_id coincida con auth.uid() una vez
tomada la atencion (202610210006_incidents.sql:117, confirmado en la funcion
desplegada). Esto evita cierres ajenos, pero tambien bloquea al administrador
si otro cuidador tomo el incidente y no puede continuar.

Recomendacion: transferencia o recuperacion administrativa explicita y
auditada. Nunca resolucion automatica ni privilegio de cierre para residentes.

## Controles cloud comprobados

- is_admin depende de membresia activa en el espacio, no de un selector UI.
- validate_team_access impide can_configure para resident y exige una sola
  persona asignada. is_admin protege invitaciones, asignaciones y revocacion.
- can_attend admite admin o caregiver asignado, excluye resident.
- can_configure_geofence admite admin o caregiver asignado con can_configure.
- Compartir GPS/SOS exige permiso de emision y dispositivo propiedad de la
  cuenta; no equivale a poder editar geocerca ni resolver incidentes.
- Sin permisos directos INSERT/UPDATE/DELETE para authenticated en las tablas
  de roles, asignaciones, residentes, geocercas y atencion verificadas.
- Las politicas de lectura aplican asignacion/espacio y revocacion.
- Consulta agregada actual: cero asignaciones resident con can_configure.
- Se protege al ultimo administrador frente a revocacion.

## Matriz objetivo

| Accion | Administrador | Cuidador | Residente |
|---|---|---|---|
| Gestionar cuentas y asignaciones | Su espacio | No | No |
| Consultar monitoreo | Su espacio | Personas asignadas | Informacion propia pertinente |
| Configurar geocerca | Si | Solo con permiso explicito | No |
| Atender/cerrar incidentes | Si; falta implementar relevo | Personas asignadas | No |
| GPS/SOS desde el celular | Si autoriza emision | Si autoriza emision | Solo persona vinculada y consentimiento |
| Recibir alertas de cuidado | Si | Personas asignadas | No como cuidador |
| Recuerdos | Segun uso del dispositivo | Segun uso del dispositivo | Album propio local |

Administrador es el rol superior dentro de su espacio; no administra otros
espacios. El cuidador tiene autoridad operativa delegada. Un perfil de residente
no es una cuenta, y seleccionar Compartir/Cuidar no debe cambiar privilegios.

La persona cuidada conserva control sobre el permiso GPS y puede detener el
seguimiento; esto no la convierte en cuidador. La interrupcion debe indicarse
como perdida de seguimiento, sin resolver incidentes ni afirmar que esta segura.
No se propone forzar rastreo o impedir permisos del sistema operativo.

## Flujo recomendado

1. Administrador crea/invita la cuenta con rol y asignacion explicitos.
2. Tras autenticar, el sistema obtiene capacidades por espacio/residente.
3. Residente accede a Compartir, SOS, Recuerdos y estado de su seguimiento.
4. Cuidador accede a monitoreo, mapa e incidentes de sus personas asignadas.
5. Administrador accede ademas a Equipo y configuracion del espacio.
6. Cada comando se valida nuevamente en backend, aunque el boton este oculto.
7. Revocacion retira acceso y emision; un cambio de pantalla nunca cambia rol.

## Validacion y limites

Ejecutado: npm test en supabase/validation. Resultado: 34 comprobaciones de
esquema y 32 de equipo/incidentes aprobadas, en PGlite aislado. Incluyen roles,
revocacion, aislamiento entre espacios, GPS/SOS, geocerca e incidentes.

En Supabase real solo se consultaron definiciones, politicas, privilegios y
un agregado de asignaciones, sin exportar datos personales. No se crearon
cuentas ni se emitieron alertas reales. No es una prueba integral con los tres
roles en dispositivos reales.

El intento adicional de reproduccion HTTP local aislada no concluyo y fue
detenido; el hallazgo local se basa en inspeccion de rutas, middleware y modo
LAN. Debe incorporarse una prueba HTTP negativa por rol al implementar el cierre.

No crear indices ni modificar funciones solo para reducir advertencias en
esta etapa. Primero resolver el limite de confianza local y las capacidades
visibles por rol, conservando el funcionamiento probado de GPS y alertas.

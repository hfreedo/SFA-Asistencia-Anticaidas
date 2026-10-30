# Recorridos Android por rol

| Rol en el espacio | Pantalla de entrada | Lo que envia este celular |
| --- | --- | --- |
| Persona cuidada con GPS autorizado | Mi seguimiento | Su ubicacion real y SOS para su ficha |
| Cuidador | Personas que cuido | Nada por entrar a monitorear. Puede emitir solo con permiso GPS especifico |
| Administrador | Monitoreo del espacio | GPS de demostracion tras confirmar que es una prueba |

Los roles pertenecen a un espacio. Tener rol administrador en otro espacio no
amplia ni elimina los permisos de una cuenta residente en un espacio distinto.
En cuentas con varios roles, el permiso se comprueba para la ficha elegida.

## Prueba GPS del administrador

En Pruebas, elegir una ficha de referencia, autorizar el GPS de este celular y
confirmar **Aceptar: es una prueba**. El dialogo advierte que el punto aparecera
en el mapa habitual y podra sustituir temporalmente la ultima ubicacion mostrada.
La prueba necesita ubicacion precisa y pantalla abierta. Al pasar a segundo
plano o salir se intenta detener y descartar.

Las muestras se guardan aparte, una sesion actual por administrador. La app,
el panel y el portal compatibles muestran PRUEBA - GPS del celular administrador.
El punto es visible para quienes ya pueden consultar esa ficha; no confirma la
ubicacion del residente. No se insertan posiciones, dispositivos o eventos reales,
no se evaluan geocercas y no se crean trabajos FCM. Otro administrador autorizado
puede ver el punto, pero no gestionar esa sesion. El servidor comprueba identidad,
rol, ficha, vigencia y muestra en cada llamada.

El mapa muestra la muestra mas reciente entre GPS real y prueba activa. Una
lectura real posterior puede sustituir la prueba. Al detenerla o vencer vuelve
la ultima posicion real, si existe. No se borra ni sobrescribe el historial real
ni se resuelven incidentes pendientes. El boton de usar la posicion recibida como
centro no permite tomar una muestra de prueba para una geocerca real.

Detener y descartar elimina la ultima coordenada temporal al confirmarse el
cierre remoto. Si falla la conexion, se indica que el cierre no fue confirmado;
la sesion caduca a los 30 minutos y deja de admitir consultas y envios. Caducar
no equivale a borrar fisicamente esa ultima muestra: se elimina al cerrar con
exito o al comenzar otra prueba del mismo administrador. No hay cola offline.

Las pruebas de sonido y aviso a mi propio celular siguen en Pruebas. No se
convierten en SOS reales ni se envian a otros receptores por iniciar la prueba
GPS. La entrega push sigue dependiendo del emisor FCM y de Android.

## Transicion y conservacion

La migracion 202610300001_role_flows conserva cuentas, asignaciones, posiciones,
dispositivos, incidentes y permisos existentes. Por decision del proyecto no
bloquea los emisores administradores de clientes anteriores. La nueva app orienta
al administrador al recorrido de prueba con confirmacion; no es una prohibicion
retroactiva de GPS/SOS reales en versiones antiguas.
Los residentes/cuidadores con permiso GPS y el emisor PC/FCM no se modifican.

El aviso y el punto de prueba requieren Android 0.7.3, Windows rc15 o portal
actualizado. Un cliente anterior sigue leyendo posiciones reales. Un cliente
nuevo puede leer GPS real sin esta migracion, pero no iniciar una prueba.

Existe una reversion manual en supabase/rollback/202610300001_role_flows.sql.
Deshabilita nuevas pruebas y deja el lector de mapas en modo real. Conserva los
registros posteriores y no elimina cambios de otros administradores.

Las rutas LAN/QR del prototipo usan su propia credencial local, no la identidad
de Supabase. La nueva app exige permiso de emision para su seguimiento normal;
esta migracion no convierte el emparejamiento LAN antiguo en autenticacion por
roles. No se debe presentar esa modalidad como aislamiento entre cuentas.

## Control de calidad

- Comparacion exacta de roles, asignaciones e historiales antes/despues de migrar.
- Compatibilidad del dispositivo administrador antiguo, sin modificar sus permisos.
- Rechazo a prueba GPS para anonimato, cuidador, residente y otro espacio.
- Mapa autorizado con aviso de prueba, sin cambios en datos reales, geocerca ni cola FCM.
- Caducidad, revocacion de rol, repeticion, descarte y separacion entre administradores.
- Compilacion, tests de politica y lint Android; validacion fisica de permisos,
  primer/segundo plano, GPS y conectividad es una comprobacion separada.

La comprobacion aislada no certifica el funcionamiento fisico del telefono.

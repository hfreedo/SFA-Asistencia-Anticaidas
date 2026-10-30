# GPS, SOS y cuidado entre cuentas

## La ficha es el punto de encuentro

| Elemento | Que representa | Accion necesaria |
| --- | --- | --- |
| Ficha remota | La persona que se monitorea, con un identificador unico | Elegir la misma referencia en ambos equipos |
| Cuenta de persona cuidada | Quien puede emitir GPS/SOS para esa ficha | Compartir, autorizar, seleccionar ficha, iniciar seguimiento |
| Cuenta de cuidador | Quien puede consultar y atender esa ficha | Estar asignado a ella y seleccionarla en Cuidar o Monitoreo |
| Administrador | Gestiona el espacio y accede a sus fichas | No sustituye el registro del celular receptor |
| Celular receptor FCM | Una instalacion concreta de la app del cuidador | Activar avisos; aceptar pruebas para recibir SOS simulados |
| PC emisora FCM | El proceso que entrega la cola a Firebase | Configuracion privada y sesion administradora activas |

Ejemplo ficticio: la cuenta de Elena cuida la ficha de Tomas. La cuenta personal
de Tomas emite para esa misma ficha. El nombre o correo de la cuenta no enlaza
las lecturas por si solo: debe coincidir el identificador de ficha.

## Preparar y comprobar

1. El administrador abre Personas y revisa Relaciones de cuidado y envio GPS.
2. Confirma que la cuenta cuidadora y la cuenta personal estan en la misma fila.
3. En el celular de la persona cuidada: Compartir > Por internet, autorizar,
   elegir la ficha y pulsar Iniciar seguimiento. Registrar un telefono no inicia GPS.
4. En el cuidador: Cuidar, seleccionar la misma ficha por nombre y referencia.
   El mapa solo aparece cuando esa ficha tiene posiciones recibidas. Una ficha
   sin envios no significa que otra ficha haya dejado de funcionar.
5. En Cuidar > Alertas, activar avisos del celular receptor. Tener el rol de
   cuidador no registra automaticamente una instalacion de Firebase.
6. Para una prueba SOS, el receptor debe aceptar pruebas. La persona cuidada
   usa Probar SOS con mis cuidadores. Verificar el evento web y luego el push:
   guardar un SOS no confirma entrega al telefono ni atencion humana.

## Usar otra PC sin duplicar fichas

Preparacion > Acceso por internet > Monitorear una ficha existente. Elegir la
ficha autorizada, confirmar y vincular monitoreo. Despues abrir Ubicacion > Por
internet. Esta accion no crea residentes ni transmite datos del cinturon.
La consulta conserva RLS y se realiza con la cuenta actual, no con la del
administrador que creo el emisor PC. Su sesion de consulta es distinta de la de
envio para no reemplazar el emisor FCM al iniciar monitoreo como cuidador.

Crear y sincronizar una ficha nueva queda en el apartado Emisor PC reservado al
administrador. No debe usarse para encontrar a una persona ya registrada desde
otra computadora: crearia una ficha diferente, aunque el nombre coincidiese.

## Limites que siguen vigentes

- El portal lee GPS e incidentes sin requerir la PC emisora. El push FCM actual
  si depende del proceso emisor configurado. No es un servicio cloud autonomo.
- Las claves privadas FCM no se distribuyen con el portable ni con la APK.
- Los avisos anteriores al registro del receptor no se reenvian automaticamente.
- La PC desbloqueada sigue siendo un puesto de operador de confianza. Estas
  sesiones no son aislamiento entre distintas personas de Windows.
- La concurrencia de edicion de permisos entre administradores sigue teniendo
  los limites documentados; esta correccion no cambia roles ni asignaciones.
- Las pruebas de codigo y base aislada no sustituyen la prueba con dos celulares,
  permisos Android, red real y recepcion efectiva de la notificacion.

## Criterio de aceptacion con dos cuentas

Anotar la misma referencia de ficha en emisor, cuidador y mapa. Confirmar una
hora GPS reciente; generar un SOS de prueba con consentimiento; comprobar su
evento en web y su notificacion en el celular autorizado. Una cuenta no asignada
no debe poder leerlos. Cerrar la consulta del cuidador no debe apagar el emisor.
Nunca usar una emergencia real como prueba de conectividad.

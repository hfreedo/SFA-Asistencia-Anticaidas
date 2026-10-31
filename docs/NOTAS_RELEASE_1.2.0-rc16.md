# Windows 1.2.0-rc16: estetica y jerarquia de opciones

Esta candidata mejora la presentacion y separa la preparacion del puesto de la
gestion de personas. No requiere reinstalar Android ni modificar roles cloud.

## Cambios visibles

- **Preparacion:** acceso, ficha a monitorear, avisos del navegador y emision opcional de esta PC.
- **Personas y accesos:** Personas cuidadas y Cuentas y Permisos; asignaciones,
  invitaciones, cuidadores, cuenta personal y relaciones GPS reunidas en un lugar.
- El selector de persona permanece disponible. La ficha monitoreada se propone
  para gestion solo si aparece entre las autorizadas; no reasigna ni cambia el mapa.
- Ficha guardada y edicion con resalte consistente; enlaces y estados mas visibles.
- Desplegables de cuenta, administradores y emisor con borde, hover y foco coherentes.
- Cierre de sesion rojo, etiquetas equilibradas, campos sin doble borde y tablas refinadas.
- Descartar cambios cierra el dialogo y continua la navegacion sin confirmaciones
  repetidas. Cancelar conserva el borrador; las acciones posteriores siguen protegidas.

## Descargar y actualizar

Descargar `SFA-Asistencia-1.2.0-rc16-Windows.zip`, verificar su SHA-256 y extraer
todo el contenido. Abrir `SFA_Asistencia.exe`. Windows 10/11 x64; no requiere
Python ni Node.js instalados.

Para actualizar una instalacion existente: detener y cerrar su Centro, respaldar
`data/`, y reemplazar solo el ejecutable. Conservar `data/`, `.env` y certificados
propios. No ejecutar ambas copias simultaneamente.

Android compatible: **0.7.3 release**, sin cambios en esta entrega. No se incluye
una APK renombrada como si fuera nueva.

## Validacion y limites

- 177 pruebas web aprobadas; panel y portal compilados.
- Recorridos visuales aislados en 1920 x 1080, 1366 x 768 y 390 x 844.
- Pruebas de cancelacion/descarte, conservacion de acceso y seleccion autorizada.
- Las pruebas de sensor, GPS en movimiento, pantalla bloqueada y entrega FCM en
  dispositivos reales no se sustituyen por estas verificaciones.
- Sin cambios de esquema Supabase ni infraestructura FCM. El emisor push actual
  sigue necesitando una PC configurada y una sesion activa.

Prototipo experimental de investigacion y desarrollo educativo.

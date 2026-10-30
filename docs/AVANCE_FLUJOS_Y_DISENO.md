# Seguimiento de mejoras de flujo y diseno

Fecha: 2026-10-30. Complementa PLAN_FLUJOS_Y_DISENO.md.

## Primera entrega local: consulta e identidad

| Comprobacion | Estado | Evidencia |
| --- | --- | --- |
| Recuperar el vinculo guardado al volver a Preparacion | Implementado | Consulta iniciada con la cuenta actual; coincidencia por ID con sus fichas autorizadas, no por nombre |
| Evitar una nueva confirmacion para un vinculo existente | Implementado | Resumen de identidad y accion Cambiar ficha; cambiar exige confirmacion explicita |
| No atribuir foto, telefono o notas locales a la ficha remota | Implementado | Cabecera remota independiente en Principal; no reutiliza los datos de contacto locales |
| Mostrar la identidad remota en el mapa | Implementado | Titulo obtenido de la respuesta autorizada; en errores se muestra Ficha por verificar |
| Mantener perfiles, asignaciones e historiales | Sin cambios intencionados | No se modifican esquemas, roles ni registros por estas mejoras de interfaz |
| Consulta real de cuidadora en navegador interno | Verificado | Preparacion recupera la ficha; Principal muestra GPS e incidentes; no se emitieron SOS ni pruebas push |
| Vista 16:9 | Verificado | DOM del navegador interno: 1920 x 1080 CSS; sin desbordamiento horizontal en Preparacion |

## Segunda entrega local: separar consulta de emision

- El resumen principal de Preparacion muestra vinculo, sesion de consulta y permiso del navegador.
- El cinturon y el emisor FCM pasan a una seccion opcional plegada. No se eliminan sus controles ni se alteran sus permisos.
- Las rutas principales llevan al mapa y a los incidentes. Se aclara que consultar no comparte el GPS del cuidador ni requiere reanudar envios.
- El permiso de navegador no se presenta como recepcion confirmada. Sin ese permiso, los incidentes siguen visibles en el panel.
- El rol y los permisos efectivos siguen controlados por los servicios existentes. Esta entrega no reemplaza esa autorizacion por reglas visuales.
- Compilacion del panel y portal correcta; persiste advertencia de paquetes JavaScript mayores de 500 kB.
- Validacion final: 28 archivos y 153 pruebas aprobadas. Ejecucion explicita adicional de LocalCareLink, CareOverview y Preparacion: 19 pruebas aprobadas. Estos recuentos corresponden a ejecuciones distintas, no se suman.
- Evidencia visual local: build/flujo-etapas/preparacion-16-9.jpg (no publicar: contiene la cuenta de prueba).

## Pendiente antes de cerrar el plan

- Afinar Preparacion por capacidades efectivas de cada ficha y comprobar las otras cuentas; la separacion visual inicial ya esta aplicada.
- Invalidacion integral de lectores al cambiar de cuenta, incluida concurrencia entre pestanas del mismo servidor local.
- Cierre de sesion Android sin dependencia de red y prueba de detencion GPS.
- Guia inicial y recuperacion de configuracion sin repetir consentimientos.
- Diferenciar permisos de notificaciones, registro, solicitud de prueba y recepcion comprobada.
- Revision visual de todos los estados, teclado y movil.
- Prueba fisica entre dos cuentas, GPS con pantalla bloqueada, SOS y FCM.
- Nueva distribucion versionada y publicacion, despues de completar la validacion.

No confundir esta entrega local con una nueva APK o un release publicado. Tampoco demuestra la entrega fisica de avisos ni sustituye la prueba completa entre dispositivos.

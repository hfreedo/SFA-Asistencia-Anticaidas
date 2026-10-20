# Notificaciones sin Depender de Telegram

## Canales de Esta Ampliación

| Canal | Qué necesita la familia | Alcance real |
| --- | --- | --- |
| Panel y sonido local | Navegador abierto y servidor activo | Eventos en pantalla; sirena de caída según ajuste |
| Aviso del navegador | Permiso, contexto seguro y navegador compatible | Mientras el panel siga activo; no es Web Push ni entrega con la app cerrada |
| Correo electrónico SMTP | Una dirección de correo; no requiere Telegram | El servidor envía por Internet al buzón configurado |
| Telegram opcional | Telegram, bot y chat configurados | Canal existente, independiente del correo |

Correo es la alternativa implementada ahora. No exige desarrollar una APK para
que la familia reciba mensajes, pero no garantiza una notificación inmediata:
depende del proveedor, spam y ajustes del cliente de correo.

## Configurar el Emisor

Copiar `.env.example` a `.env` solo si no existe y completar localmente:

```dotenv
SFA_SMTP_HOST=servidor.smtp.del.proveedor
SFA_SMTP_PORT=587
SFA_SMTP_USER=cuenta.emisora
SFA_SMTP_PASSWORD=credencial_autorizada
SFA_SMTP_FROM=remitente@dominio.example
SFA_SMTP_TO=cuidador@dominio.example
```

Los valores son marcadores, no una configuración real. Obtener host, puerto y
método de autenticación del proveedor. Utilizar credenciales o contraseña de
aplicación autorizadas cuando el proveedor lo requiera; OAuth no está implementado.
No enviar contraseñas por el chat ni guardarlas en GitHub.

Puerto 587 utiliza STARTTLS; 465, TLS implícito. No hay un modo SMTP sin cifrado.
Se permiten varios destinatarios separados por comas. La lista es global para este
prototipo: todos reciben los incidentes habilitados, no hay autorización por familia.
No usar una lista común de destinatarios para residentes ajenos entre sí.

Reiniciar el servidor tras editar `.env`. En Ajustes > Notificaciones:

1. Comprobar `SMTP configurado`.
2. Pulsar `Probar correo`.
3. Revisar buzón y spam del destinatario.
4. Habilitar y guardar avisos de caída/SOS/geocerca según lo que se quiere recibir.
5. Realizar un ensayo con datos ficticios y registrar recepción en el teléfono.

La prueba de correo es directa; los avisos automáticos respetan las preferencias.
No activar pruebas de alerta con destinatarios reales sin advertirles.

## Qué Significa el Registro

`Aceptado por SMTP` indica que el servidor de correo aceptó los destinatarios,
no que el mensaje llegó a la bandeja, se mostró como notificación o fue leído.
El estado `failed` indica envío no confirmado. Se reintenta hasta tres veces y
se conserva un registro acotado, sin contraseñas ni respuestas privadas del proveedor.
Los reintentos de una entrega incierta pueden producir duplicados.

Los envíos se ejecutan fuera del canal de telemetría y separados de Telegram.
Si se cierra el servidor durante un envío, no existe aún una cola durable de
reentrega tras reinicio. No es una infraestructura de entrega garantizada.

La telemetría repetida en estado de caída no se trata como una alerta nueva en
cada muestra: el aviso automático se genera a partir de eventos.

## Próxima Etapa: Notificaciones de la App Propia

Si se necesita recibir avisos con la interfaz cerrada y sin depender de correo,
la siguiente integración es push para la APK propia, por ejemplo FCM. Todavía
requiere construir la APK y su registro seguro de dispositivos, permisos y backend.
Web Push tampoco está implementado en esta ampliación. SMS y WhatsApp no están
integrados; requieren sus respectivos servicios y configuración.

La elección final debe probarse con los celulares reales. Ningún aviso externo
debe presentarse como garantía de atención de una emergencia.

Referencia: [SMTP de Python](https://docs.python.org/3/library/smtplib.html) y
[Notifications API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API).

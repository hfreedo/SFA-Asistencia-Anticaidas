# Versiones

## v1.2.0-rc4 - GPS remoto en el panel local

Windows integra Ubicacion > Por internet con Supabase, permisos RLS, vinculo
del perfil local y sesion de esta PC. Consulta cada 10 segundos; distingue
datos antiguos, sesion requerida y falta de vinculo. La APK es identica a rc3.

[Release y descargas](https://github.com/hfreedo/SFA-Asistencia-Anticaidas/releases/tag/v1.2.0-rc4)
| [Guia de GPS y alarmas](docs/PRUEBA_GPS_Y_ALARMAS.md)

## v1.2.0-rc3 - GPS remoto y laboratorio de pruebas

APK 0.4.0-prototipo (4), Android 12+, misma firma de pruebas que rc2.
GPS directo a Supabase sin cinturon ni red compartida. Laboratorio con alarma
local, escenarios de practica y prueba FCM etiquetada solo al celular solicitante.
UI reorganizada, icono adaptativo propio y mapa del portal remoto.
Windows portable con emisor v2 y driver CH340 opcional. Sin claves privadas.

[Release](https://github.com/hfreedo/SFA-Asistencia-Anticaidas/releases/tag/v1.2.0-rc3)
| [Guia actual](docs/PRUEBA_GPS_Y_ALARMAS.md)
| [Organizacion](ABRIR_AQUI.md)

Pruebas de software no reemplazan GPS/push y revision visual en el telefono.
Geocerca cloud y portabilidad multiadministrador completa son etapas posteriores.

## v1.2.0-rc2 - FCM para pruebas

Nueva APK version 0.3.0-prototipo (3) con **Alertas en este celular**, permiso,
registro voluntario y recepcion FCM. Emisor Windows actualizado, driver CH340
opcional, fuentes y guias. No contiene claves privadas ni datos personales.

71 pruebas Python, 26 comprobaciones SQL aisladas y 12 pruebas Android; lint
sin errores. La entrega real de una notificacion en Android sigue pendiente.
Firma debug; no desinstalar una version con datos si hay conflicto de firma.

[Release y descargas](https://github.com/hfreedo/SFA-Asistencia-Anticaidas/releases/tag/v1.2.0-rc2)
| [Guia de prueba](docs/PRUEBA_APK_FCM.md)
| [Configuracion FCM](docs/FIREBASE_FCM.md)

## v1.2.0-rc1 - Candidata de pruebas

Windows portable con centro de inicio, geocerca desde 5 m, historial conservado,
HTTPS sin OpenSSL externo y controlador CH340/CH341 opcional. APK Android 12+
con GPS foreground hacia la PC, QR, CA privada de la app y consulta Supabase.

Archivos: `SFA-Asistencia-1.2.0-rc1-Windows.zip`,
`SFA-Asistencia-1.2.0-rc1-Android-prototipo.apk` y manifiesto `.sha256`.

La APK tiene firma debug. No es una version de produccion: faltan las pruebas
fisicas, GPS hacia Supabase y push FCM. No reemplaza la version estable anterior.

[Descarga candidata](https://github.com/hfreedo/SFA-Asistencia-Anticaidas/releases/tag/v1.2.0-rc1)
| [Changelog](CHANGELOG.md)
| [Pruebas y limites](docs/VALIDACION_AMPLIACION.md)
| [Guia Android](docs/ANDROID.md)

## v1.1.0 — Preparada en borrador

Actualización del borrador: acceso LAN en Ethernet y hotspot, selección de red para el QR y reintento de generación. El QR sigue siendo la forma principal de abrir el panel en el celular.

Interfaz renovada y compacta, marca, fotos de perfil, edición sincronizada, toasts, selector actualizado, QR local y ayuda de Wi-Fi/hotspot. Añade exportación/importación de perfiles y preferencias.

Portable x64 con fuentes, iconos y QR incluidos; modo LAN dentro del ejecutable, iniciadores relativos y controlador CH340/CH341 opcional. Distribución sin perfiles, credenciales ni historial personal.

[Galería](docs/GALERIA.md) · [Validación y límites](docs/VALIDACION.md)

Archivo: `SFA-Asistencia-Anticaidas-v1.1.0-Windows.zip`

SHA-256:

```text
E563A02914B601107A413640FC902957D91B2AD8B706F80B351F6CEFC3522C0E
```

## v1.0.0

Primera distribución portable de SFA Asistencia para Windows 10/11 de 64 bits.

Incluye:

- Aplicación portable de monitoreo local.
- Comunicación USB y Bluetooth serial.
- Interfaz para el cuidador y protocolo visual de caída.
- Controlador CH340/CH341 opcional para placas compatibles.
- Guía de inicio rápido.

Archivo: `SFA-Asistencia-Anticaidas-v1.0.0-Windows.zip`

SHA-256:

```text
6079E7EA4B7E2EBC4AF45CB72308D4848191FB112D34C85CB2630E3939F0FC85
```

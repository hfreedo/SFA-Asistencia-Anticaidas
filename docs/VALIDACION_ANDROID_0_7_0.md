# Android 0.7.0 - Validacion de Recuerdos

Fecha: 2026-10-22. Application ID: `org.sfa.asistencia`.

| Comprobacion | Resultado |
| --- | --- |
| Version / codigo | 0.7.0-release / 10 |
| SDK minimo / objetivo | 31 / 35 |
| Unitarias Android | 37 aprobadas, incluidas 10 del catalogo local |
| Compilacion y lintRelease | Aprobados en copia aislada |
| Firma | APK v2 valida, RSA 3072; misma identidad que 0.6.2 |
| Manifiesto | No depurable; sin permisos nuevos respecto a 0.6.2 |
| SHA-256 APK | `fe5a4b46f1c8d8f86803e477346e2813531ccc87d642fdb2b092d6b34e53bd26` |
| SHA-256 certificado | `95861c673905f86678173f05b397b589bbb4bb0d44d9b733fec999b282887dd2` |

Las pruebas del catalogo cubren reapertura, titulos Unicode, favoritas,
eliminacion de ambas copias, limites, rutas invalidas, rechazo de catalogos
corruptos y escrituras concurrentes. Usan marcadores JPEG de prueba, no un
decodificador Android ni fotos personales.

Las imagenes se copian a almacenamiento interno del dispositivo, fuera de
las colas de ubicacion y de la sesion. No se agregaron llamadas cloud para
el album, migraciones Supabase o servicios de pago. Las claves de firma siguen
fuera del repositorio y del paquete.

No hay un Android conectado ni un emulador configurado. Quedan pendientes:
instalacion/actualizacion real, selector de fotos, orientacion y visualizacion,
tamano de letra aumentado, persistencia tras reiniciar y coexistencia con GPS,
SOS y FCM. No se han generado capturas que pretendan sustituir esa prueba.

Ver [guia de Recuerdos](RECUERDOS_ANDROID.md) y [firma y actualizacion](ANDROID_RELEASE.md).

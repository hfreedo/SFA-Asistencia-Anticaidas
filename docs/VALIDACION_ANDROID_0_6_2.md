# Android 0.6.2 - Validacion de la APK Firmada

Fecha: 2026-10-22. Application ID: `org.sfa.asistencia`.

| Comprobacion | Resultado |
| --- | --- |
| Version | 0.6.2-release, versionCode 9 |
| SDK minimo / objetivo | 31 / 35 (Android 12+) |
| Variante | release, no depurable segun manifiesto y aapt |
| Build, unit tests, lintRelease | Aprobados en copia aislada |
| apksigner | Verificacion correcta, un firmante, esquema v2 |
| Clave publica | RSA 3072, certificado propio diferente de debug |
| SHA-256 de la APK | `8f6a4753a6a6b353d7d331c3d66527c49a187e3d783a1afdda639b5c4c07930b` |
| SHA-256 del certificado | `95861c673905f86678173f05b397b589bbb4bb0d44d9b733fec999b282887dd2` |

La clave privada queda fuera del proyecto, con acceso limitado al titular Windows
y SYSTEM. Su contrasena local esta protegida con DPAPI, no incluida en el APK ni
en GitHub. Esta proteccion depende de la cuenta/equipo actual: aun se necesita
un respaldo recuperable del keystore y de la contrasena antes de migrar Windows.

El certificado de distribucion es autofirmado: no acredita verificacion de
identidad por una tienda ni certificacion medica o de seguridad de la app.
No se han activado servicios de pago o pruebas renovables.

Pendiente en Android fisico: instalacion desde descarga, permisos, inicio de
sesion, seguimiento con pantalla bloqueada y registro/recepcion FCM. No se afirma
que hayan desaparecido los avisos del navegador o de Play Protect.

La primera instalacion desde debug requiere revisar [Firma y distribucion](ANDROID_RELEASE.md).
Las actualizaciones futuras del canal release deben mantener el mismo certificado.

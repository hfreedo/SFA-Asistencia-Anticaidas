# Firma y Distribución Android

## Estado de esta preparación

La APK 0.6.1 publicada es debug. Se ha preparado un build `release` no depurable,
con firma propia obligatoria y sin fallback a la clave debug. No se ha creado
una clave privada ni se ha publicado una APK con una firma nueva.

Release es un tipo de compilación, no una certificación de seguridad ni una
garantía de ausencia de avisos. El navegador puede advertir por descargar APK;
Play Protect puede recomendar analizar una aplicación desconocida. No se deben
desactivar esas protecciones para instalar SFA.

## 1. Crear la identidad de firma

1. Abre `android_app/` en Android Studio.
2. Usa **Build > Generate Signed App Bundle or APK > APK > Create new**.
3. Guarda el keystore fuera del proyecto y de cualquier repositorio. Elige una
   contraseña fuerte y un alias propio, distinto de `androiddebugkey`.
4. Conserva la clave y contraseñas en respaldos privados separados. Esa identidad
   debe mantenerse para las actualizaciones futuras del mismo canal.
5. Puedes cancelar el asistente después de crear la clave y compilar mediante
   el script siguiente. No guardes las contraseñas en Gradle ni en el README.

Crear y usar esta firma local no activa facturación ni suscripciones. Esta guía
no registra cuentas de tiendas ni contrata certificados o servicios.

## 2. Compilar con pruebas

Con Python, Java y SDK configurados según [Desarrollo](DESARROLLO.md), ejecuta:

```powershell
.\scripts\compilar_android_release.ps1
```

El script pide ruta, alias y contraseñas con entrada oculta; las transmite solo
al proceso de compilación y restaura el entorno al terminar. No las escribe en
archivos. No es un almacén de secretos: evita ejecutar builds en equipos ajenos.
Si PowerShell bloquea scripts, revisa la política de tu equipo; no es necesario
desactivar globalmente sus controles de seguridad.

La compilación se realiza sobre una copia de las fuentes en una ruta temporal
ASCII. Los keystores nunca se copian allí. La configuración Android de Firebase
`app/google-services.json` debe estar presente para esta variante con FCM; no es
la clave privada de la cuenta de servicio y nunca la reemplaza.

Salida: `android_app/artifacts/release/SFA-Asistencia-Android-release.apk`, pruebas,
lint y SHA-256. No sobrescribe la APK debug ni un release publicado.

Para automatización privada, Gradle admite estas variables del proceso:

| Variable | Contenido |
| --- | --- |
| `SFA_ANDROID_KEYSTORE` | Ruta absoluta al archivo privado |
| `SFA_ANDROID_KEY_ALIAS` | Alias de la clave |
| `SFA_ANDROID_STORE_PASSWORD` | Contraseña del almacén |
| `SFA_ANDROID_KEY_PASSWORD` | Contraseña de la clave |

No introducir contraseñas como comandos que queden en el historial. El build
release falla si faltan los valores, el keystore o la configuración Firebase.
No se activa ofuscación en esta etapa: no sustituye la protección de secretos
ni una licencia y necesita validación independiente.

## 3. Verificar antes de publicar

1. Incrementa `versionCode` y define `versionName` para la nueva entrega; no
   modifiques silenciosamente la APK ya publicada bajo otro hash.
2. Ejecuta `apksigner verify --verbose --print-certs` del SDK sobre la APK.
   Conserva la huella SHA-256 del certificado de distribución y compárala en
   cada actualización. Rechaza una firma debug aunque se haya elegido a mano.
3. Verifica con APK Analyzer que el manifiesto fusionado no sea depurable y que
   permisos, nombre e icono correspondan a las funciones de SFA.
4. Instala en Android físico: sesión, GPS, pantalla bloqueada, SOS, registro FCM
   y recepción/atención de avisos. Build, lint y pruebas unitarias no prueban esos flujos físicos.
5. Publica con número de versión, SHA-256, requisitos y notas. No incluyas el
   keystore, contraseñas o credencial privada FCM en APK, GitHub o ZIP.

El script genera un candidato. La firma final y estas verificaciones todavía
requieren la clave elegida por el titular y un dispositivo físico.

## Migración desde la APK debug

La primera APK release tendrá otra firma. Android normalmente no permite
actualizar sobre la debug existente con el mismo identificador. Antes de
desinstalar, revisa qué ajustes o vínculos son locales; no se ha implementado
una exportación universal del estado de la app Android. Tras reinstalar puede
ser necesario iniciar sesión, vincular seguimiento y registrar alertas otra vez.
Los incidentes ya persistidos en Supabase no se borran por reinstalar la app.
No desinstales automáticamente ni solicites omitir avisos de seguridad.

## Qué mejora y qué no

- Firma estable: identifica la continuidad del editor entre actualizaciones.
- Variante release: elimina la depuración del APK distribuible.
- Canal de entrega claro, hashes y permisos justificados: facilitan verificar
  procedencia e integridad, pero no sustituyen la revisión de la aplicación.
- Firma Android no firma el ejecutable Windows. Authenticode y la reputación
  de SmartScreen son asuntos separados; no se ha contratado ningún certificado.
- Una tienda o programa de verificación se evaluará por separado. No se ha
  activado ninguna prueba renovable, pago o inscripción de desarrollador.

## Referencias oficiales

- [Firma de aplicaciones Android](https://developer.android.com/studio/publish/app-signing).
- [Preparación para distribución](https://developer.android.com/studio/publish/preparing/).
- [Avisos de Google Play Protect](https://developers.google.com/android/play-protect/warning-dev-guidance).

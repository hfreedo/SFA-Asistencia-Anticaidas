# Android: prototipo nativo y limites

## Candidata actual: rc3

APK 0.4.0-prototipo (4). GPS directo a Supabase, sin cinturon ni red compartida,
con cuenta autorizada, consentimiento y servicio foreground. Modo local preservado.
Navegacion Compartir / Cuidar / Pruebas, controles uniformes y logo adaptativo propio.
Ver [pasos y limites actuales](PRUEBA_GPS_Y_ALARMAS.md). La seccion siguiente
describe el alcance historico de rc2, no el alcance nuevo de rc3.

## Entrega

Proyecto `android_app/` para Android Studio: Kotlin, Jetpack Compose y Android
12 o superior (minSdk 31, target/compile 35). No es una WebView del panel.
El artefacto de pruebas se construye en `android_app/artifacts/` y no incluye
credenciales, bases del desarrollador ni certificados privados de la PC.
La revision rc2 paso compilacion, 12 pruebas unitarias y lint sin errores. Persisten
6 advertencias de versiones de dependencias: se fijaron para reproducibilidad;
antes de una entrega productiva deben revisarse sus actualizaciones y seguridad.

| Funcion | Estado de esta entrega |
| --- | --- |
| Escanear QR del residente | Implementado con ZXing, confirmacion de PC visible |
| Guardar autorizacion del QR | Cifrado AES-GCM con Android Keystore; backups excluidos |
| GPS hacia PC con pagina cerrada | Servicio foreground de ubicacion, iniciado por el usuario |
| Geocerca local sin internet | Usa la ultima zona consultada de esa vinculacion y lecturas GPS nuevas |
| Cola e historial | SQLite; pendientes no se reasignan al cambiar el vinculo |
| Avisos locales | Canal Android de prioridad alta; requiere permiso en Android 13+ |
| HC-06 | Equipos ya emparejados, permiso BLUETOOTH_CONNECT y lector del protocolo TEL/EVT |
| Consulta de eventos remotos | Login Supabase, consultas manuales con RLS, JWT solo en memoria |
| GPS hacia Supabase desde otra red | No implementado en esta APK |
| Push al cuidador con app cerrada | Codigo FCM preparado; requiere migracion, emisor y prueba real; ver FIREBASE_FCM.md |
| Roles completos e invitaciones desde app | Gestion desde Supabase/portal, no desde esta APK |

Para probar la APK rc2 con FCM seguir [Prueba APK FCM](PRUEBA_APK_FCM.md).

## Prueba en el Android

1. Instalar la APK de prototipo. La firma debug no es una firma de produccion
   ni una publicacion de Play Store. No desinstalar una version con datos sin
   preparar su respaldo; reinstalar puede perder el vinculo local cifrado.
2. En PC, abrir SFA Asistencia y activar Celular y ubicacion (HTTPS).
3. Transferir solo `SFA_Asistencia_CA.cer`, nunca archivos .key o CA privada.
4. En Compartir > Certificado, elegir esa CA de confianza. Se guarda solo para
   esta app; no es necesario instalarla en el almacen global del telefono.
5. En el panel PC generar/reemplazar el QR del residente y escanearlo en la app.
   Confirmar la direccion de la PC. Escanear no inicia el GPS automaticamente.
6. Iniciar seguimiento desde la app visible y conceder ubicacion precisa y
   notificaciones. Debe aparecer una notificacion persistente con Detener.
7. Probar con pantalla bloqueada, retorno, Wi-Fi desconectado y reconectado.
   Verificar posiciones reales, no solo el contador de solicitudes.
8. Para HC-06, emparejar primero desde Android y luego elegirlo en la app.
   Se envia STREAM ON; no se cambia el cableado ni firmware. Confirmar datos
   reales y desconexion. Los registros Bluetooth quedan locales al telefono;
   no se anuncia todavia su entrega a la PC o Supabase.

El servicio no se reinicia silenciosamente al arrancar el telefono. Forzar
detencion o restricciones del fabricante puede detenerlo; no hay garantia de
seguimiento continuo. La app no solicita ACCESS_BACKGROUND_LOCATION: inicia
un servicio foreground desde una accion visible del usuario, no desde boot.

Las posiciones locales de mas de 90 s quedan como historial y no se fuerzan
al endpoint de posicion actual. Un 409/422 no se presenta como entrega nueva.
Un 401/403 detiene los envios; no se recrean credenciales automaticamente.

## Construir y comprobar

Instalar Android Studio, SDK 35, JDK 17+ y aceptar licencias SDK. No hay rutas
del desarrollador en `local.properties`. El wrapper fija Gradle 8.9; AGP 8.7.3
y Kotlin/Compose Compiler 2.0.21 son versiones fijadas, no dependencias dinamicas.

```powershell
cd android_app
.\gradlew.bat testDebugUnitTest assembleDebug lintDebug
```

En Windows con ruta acentuada se proporciona un validador reproducible:

```powershell
.\.venv313\Scripts\python.exe scripts/validar_android.py
```

Copia las mismas fuentes a una carpeta temporal ASCII, comprueba hashes,
ejecuta tests/build/lint y conserva APK, informes y manifiesto de fuentes.
JAVA_HOME y ANDROID_HOME son configurables. No cambia Java ni permisos de red
globales. El ajuste temporal de sockets Java se limita al proceso de build.

## Base tecnica

- [Servicios foreground y tipo location](https://developer.android.com/develop/background-work/services/fgs/service-types).
- [Configuracion de Compose Compiler](https://developer.android.com/develop/ui/compose/setup-compose-dependencies-and-compiler).
- [Android Keystore](https://developer.android.com/privacy-and-security/keystore).

La compilacion y el lint no prueban GPS, bateria, pantalla bloqueada ni HC-06.
Completar REGISTRO_REPRODUCCION.md con el modelo de telefono y resultados reales.

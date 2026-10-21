# Evidencia de la ampliacion

## rc4: lectura cloud desde el panel local

80 pruebas Python y 33 web aprobadas. Nuevo endpoint solo loopback, protegido
por origen, propietario del vinculo y RLS de Supabase. Pruebas de sesion ausente,
cambio de cuenta, revocacion, respuesta invalida y cambio de perfil sin datos
anteriores visibles. Compilacion React y EXE Windows aprobadas; APK sin cambios.
Revision visual del panel real confirma el selector Por internet / Red local y
el diagnostico de sesion requerida. No se afirma que el mapa haya mostrado ya
un GPS real: falta reanudar la sesion de esta PC y comprobarlo con el usuario.

## rc3: 21 de octubre de 2026

- Android: copia de fuentes con hashes, compilacion, 12 pruebas unitarias y
  lint sin errores. APK 0.4.0-prototipo (4), misma firma de pruebas que rc2.
- Python: 73 pruebas; web: 30; SQL aislado PGlite: 34 comprobaciones.
- Migracion 202610210004 aplicada con autorizacion en SFA Asistencia - Pruebas.
  GPS exige cuenta, permiso de configuracion y propiedad del dispositivo;
  posiciones consultadas mediante RLS. No hay ingesta anonima.
- Prueba push dirigida al solicitante, simulada y limitada a una por minuto.
  Emisores anteriores no recogen ese tipo de trabajo; emisor v2 lleva etiqueta.
- UI revisada a nivel de componentes: botones de 52 dp minimos, seleccion
  con filas completas, navegacion inferior, ancho acotado en pantallas grandes,
  textos adaptables y logo adaptativo. No hay pruebas visuales en Android fisico
  ni emulador: no afirmar que la apariencia final ya fue validada en pantalla.
- No hay validacion fisica de GPS, cambio de red, pantalla bloqueada ni FCM.
  La aceptacion de cola y las pruebas de servidor no equivalen a entrega Android.
- El mapa remoto no presenta muestras antiguas como actuales. No hay sincronizacion
  automatica de geocerca local hacia cloud ni push por sus salidas remotas.

Los resultados de rc2 a continuacion son historicos.

## Niveles separados

Resultado local rc2: 71 pruebas Python, 26 comprobaciones SQL aisladas y
12 pruebas unitarias Android. Se conservan las 27 pruebas web de rc1; esta
ampliacion no modifica la interfaz web. La APK se
compilo en copia ASCII con hashes de fuente; lint: 0 errores y 6 advertencias
por versiones fijadas de dependencias. Son advertencias registradas, no
controles de seguridad desactivados. Las Actions publicadas repetiran las pruebas.

| Capa | Evidencia automatizada | Falta de validacion |
| --- | --- | --- |
| Python/API | Pruebas con bases temporales: permisos locales, token por residente, TLS, historial, cola y geocerca | Cinturon real y recorrido del celular |
| Web | Vitest, TypeScript y Vite; Leaflet real bajo DOM de pruebas, montaje estricto y orden del historial | Inspeccion visual de esta revision en navegador y prueba tactil |
| Supabase | 19 comprobaciones SQL aisladas; migraciones base/PC previamente aplicadas y prueba alojada revertida | GPS cloud y permisos de nuevos emisores no implementados |
| Launcher | Inicio, detencion, reinicio, control de otra instancia propia, mutex y copia portable aislada | Antivirus/controladores de otra PC |
| Android | Unit tests de geocerca, protocolo y vinculo; compilacion APK y lint obligatorios | Instalacion, GPS bloqueado, HC-06 y notificacion real |

## Caso que origino la correccion

Con radio de 5 m, distancia estimada 15.44 m y precision 9.6 m, el limite
inferior es 5.84 m. Supera radio mas margen (5.5 m). Dos lecturas separadas
por 10 s pueden confirmar salida; no se descarta por imponer precision <=2.5 m.
Si el intervalo cruza la frontera se informa incertidumbre, no seguridad.
Una precision peor de 50 m o posiciones antiguas no confirman la salida.

Es una decision del algoritmo sobre mediciones GNSS, no una certeza fisica ni
una validacion medica. Conservar la evidencia y repetir el recorrido real.

## Condiciones para continuar a produccion

1. Android fisico conectado y autorizado; registrar modelo, Android y bateria.
2. Confirmar salida, sonido/aviso, reingreso, permisos denegados y perdida de red.
3. FCM ya tiene codigo y configuracion en la PC de desarrollo; instalar la APK
   rc2, registrar destinatarios y validar envios reales. La clave no se distribuye.
4. Implementar el emisor GPS cloud revocable y su consentimiento; no reutilizar
   la clave del QR local como credencial de Supabase ni usar una service_role en APK.
5. Validar datos entre redes, renovacion de credenciales y atencion del cuidador.

No dar estas condiciones por satisfechas porque una APK o un EXE se generen.

# Changelog

## 1.2.0-rc1 - ampliacion de software (pre-release)

### Geocerca y avisos
- Corregido el filtro que descartaba cualquier GPS peor que radio/2: se evalua
  el intervalo completo, margen, permanencia y antiguedad, con limite absoluto de 50 m.
- Caso de regresion: radio 5 m, distancia 15.44 m y precision 9.6 m.
- Aviso persistente de salida, sonido segun preferencias y silenciado por incidente.
- Motivo visible de incertidumbre, mala precision y confirmacion pendiente.
- Radios desde 5 m; un solo editor en el mapa y resumen en Ajustes.
- Historial completo de posiciones aceptadas; eliminada la purga automatica de eventos.

### Interfaz
- QR privado y actividad reciente con jerarquia compacta; historial debajo del mapa.
- Reemplazar QR requiere confirmacion explicita tambien en el endpoint.
- Un vinculo no vence por perder GPS o reiniciar el servidor con la misma base.
- Corregido el fallo Leaflet al consultar limites de un circulo sin mapa.
- Pruebas de montaje, StrictMode, cambio de radio y orden de los apartados.

### PC y nube
- Iniciador con logo, inicio/detencion, accesos local/remoto y ayuda Android.
- Instancia unica y control de detencion por capacidad local, no por nombre de proceso.
- Fuentes y EXE dentro del proyecto usan la misma base; portable externo usa data/.
- HTTPS asistido con CA conservada y alternativa cryptography sin OpenSSL externo.
- Portal Auth HTTPS y copia local; RLS y comandos PC restringidos.
- Cola PC persistente, UUID estable, reintentos, sin claves elevadas ni JWT en disco.

### Android
- Nuevo proyecto Kotlin/Compose Android 12+, Gradle Wrapper y versiones fijadas.
- Servicio foreground GPS hacia PC, historial/cola SQLite y geocerca local.
- QR con confirmacion, CA privada de la app, AES-GCM/Keystore y backups excluidos.
- HC-06 emparejado, parser TEL/EVT y avisos locales Android con permisos.
- Login Supabase y consulta manual de residentes/eventos autorizados.
- Construccion aislada y verificable para rutas Windows con caracteres no ASCII.

### Validacion y limites
- Pruebas Python, web, SQL y Android; lint obligatorio, sin desactivar errores.
- No es una entrega medica ni se declara aprobada la prueba fisica por compilar.
- Pendientes: GPS nativo con pantalla bloqueada en telefono real, HC-06 real,
  GPS cloud revocable, FCM y demostracion integral entre redes.
- Firebase, contrasenas, datos personales y certificados privados no se publican.

## Versiones anteriores

Consultar RELEASES.md y los releases previos. El pre-release no reescribe la
evidencia ni convierte los portables antiguos en versiones con estas funciones.

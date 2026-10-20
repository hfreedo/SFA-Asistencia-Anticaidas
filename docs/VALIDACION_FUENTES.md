# Comprobación de las Fuentes Publicadas

## Ampliación de Ubicación y Correo — 20 de Octubre de 2026

Corrección de preparación TLS: el BAT comprueba/genera certificados usando
OpenSSL local antes de iniciar. Se ejecutaron 28 pruebas correctas, incluidas
cinco de preparación: reutilización de CA/certificado, cambio de IP, preservación
de archivos personalizados, rechazo de CA incompleta y cancelación sin instalar
confianza. Se generaron archivos locales y se verificó HTTPS con confianza
aislada del cliente; no se agregó la CA al almacén de Windows ni se configuró un
Android real. Los certificados y las claves no se publican. Ver [HTTPS Android](HTTPS_ANDROID.md).

Las fuentes incorporan `ubicacion.py`, `correo.py`, emisor web del celular y
arranque HTTPS. Se comprobaron tanto la copia de desarrollo como la copia para
GitHub: build web correcto y 23 pruebas correctas de geocerca, autenticación,
separación de residentes, caducidad, revocación, HTTP, SMTP simulado y HTTPS/WSS.
La prueba TLS utiliza certificados temporales con confianza solo dentro del
proceso de prueba; no instala certificados en el equipo ni demuestra confianza
del navegador de un teléfono. El aviso de bundle grande persiste.

No se verificó visualmente la nueva UI, no se recibió una posición real de un
teléfono y no se envió correo real. Se necesitan certificado confiable, cuenta
SMTP y ensayo consentido. La APK Kotlin y push en segundo plano siguen pendientes.
No se reconstruyeron los portables anteriores: esta ampliación está en fuentes.
Consultar [Geolocalización](GEOLOCALIZACION.md) y [Notificaciones](NOTIFICACIONES.md).

## Referencia de la Publicación Inicial

Publicación preparada el 16 de octubre de 2026. Estas pruebas corresponden a las
fuentes, no reemplazan la validación del portable documentada por separado.

## Comprobaciones

- Instalación frontend desde la copia pública con `npm ci`: correcta, auditoría
  de npm sin vulnerabilidades informadas en esa ejecución.
- `npm run build`: correcto. Vite advierte que el bundle JavaScript supera 500 kB;
  queda como mejora de rendimiento, no impide compilar.
- Firmware principal compilado para `arduino:avr:uno`: 17.322 bytes de programa
  y 1.111 bytes de RAM global.
- Diagnóstico MPU6050 compilado para la misma placa: 7.666 bytes de programa
  y 421 bytes de RAM global.
- Entorno Arduino: core AVR 1.8.8 y LiquidCrystal I2C 1.1.2.
- Entorno virtual Python 3.13 nuevo dentro de la copia pública: dependencias
  instaladas desde `servidor_pc/requirements.txt` y dos pruebas unitarias correctas.
- Servidor de esa copia iniciado temporalmente en 8897: HTTP 200 en `/`,
  `/api/ports`, `/api/status`, `/api/residents` y `/api/network-info`.
- Base nueva sin residentes: respuesta vacía comprobada, sin usar la base privada.
- WebSocket `/ws`: conexión y mensaje inicial de estado comprobados.
- El servidor de prueba se detuvo al finalizar. Estas pruebas no son inspección
  visual de navegador ni prueba de cámara/QR en un teléfono real.

## Verificación Adicional del Manual

El 16 de octubre de 2026 se contrastó el flujo de reproducción con el backend
de las fuentes, usando una base temporal independiente y un puerto libre:

- Base inicial sin residentes; creación y edición de un perfil ficticio.
- Perfil editado conservado tras detener e iniciar el proceso del servidor.
- Simulación `CAIDA_CONFIRMADA` y atención `ALERTA_ATENDIDA` recibidas por
  WebSocket y consultadas en el historial.
- Exportación `sfa-configuration` sin token/chat de Telegram ni historial.
- `pip check` sin dependencias incompatibles y enlaces locales de las guías correctos.

Se verificó el flujo de datos, no la apariencia ni el cronómetro en navegador.
No se ejecutó la ficha en una segunda PC ni se verificaron cámara, Telegram o
hardware físico. La [ficha de reproducción](REGISTRO_REPRODUCCION.md) es una
plantilla vacía para registrar esas pruebas, no evidencia de que estén aprobadas.

## Límites de la Publicación

No se modifica ni publica automáticamente el release 1.1.0 por publicar estas
fuentes. No se recompila el portable como parte de esta actualización documental.
No se afirma prueba en una segunda PC, validación médica, detección física de
caídas, instalación del driver ni entrega de alertas a un teléfono real.
Los diagramas describen el sistema; no son evidencia de funcionamiento físico.

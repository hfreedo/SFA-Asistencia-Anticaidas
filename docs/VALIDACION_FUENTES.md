# Comprobación de las Fuentes Publicadas

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

## Límites

No se modifica ni publica automáticamente el release 1.1.0 por publicar estas
fuentes. No se recompila el portable como parte de esta actualización documental.
No se afirma prueba en una segunda PC, validación médica, detección física de
caídas, instalación del driver ni entrega de alertas a un teléfono real.
Los diagramas describen el sistema; no son evidencia de funcionamiento físico.

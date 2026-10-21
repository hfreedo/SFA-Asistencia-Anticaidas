# SFA - Directrices UI/UX

## Contexto

SFA es una aplicación de monitoreo para cuidadores y familiares de adultos
mayores. Recibe telemetría de un wearable, detecta caídas y prepara las futuras
funciones de batería, primer movimiento y ubicación GPS.

El usuario puede operar bajo presión o en movimiento. La interfaz debe priorizar
claridad, controles táctiles, lenguaje directo y estados inequívocos.

## Identidad visual

- Fondo: `#F8FAFC`.
- Superficies: `#FFFFFF` con borde `#E2E8F0`.
- Acento: `#0D9488`.
- Estado seguro: `#10B981`.
- Emergencia: `#EA580C`.
- Fuente: Inter desde Google Fonts.
- Iconografía: Lucide Icons desde CDN, sin emojis.
- No usar fondos oscuros, gradientes decorativos, vidrio oscuro ni sombras de color.

## Veracidad de datos

- No inventar batería, ubicación, nombres, sesiones ni históricos.
- Mostrar `No reportado`, `Sin ubicación` o `Sin telemetría` cuando corresponda.
- Las simulaciones internas no aparecen como telemetría real en Home.
- El prototipo no se presenta como dispositivo médico certificado.

## Pantallas

- Home: perfil del residente, primer movimiento, gráfico semanal, batería, SOS y telemetría.
- Emergencia: pantalla completa `#EA580C`, caída detectada, cronómetro vivo y confirmación.
- Mapa: Leaflet, CartoDB Positron, marcador pulsante y geocerca verde cuando exista GPS.
- Ajustes: toggles para SOS, caída, batería, apagado y primer movimiento, más conexión serial.

## Emergencia

- No usar signos de exclamación.
- El cronómetro se actualiza mediante `setInterval`.
- Confirmar atención debe ser la acción dominante y accesible con una mano.

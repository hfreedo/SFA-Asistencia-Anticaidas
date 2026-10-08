# SFA Asistencia - Sistema de Alerta Anticaídas

Prototipo educativo de asistencia para personas adultas mayores susceptibles a
caídas. El sistema combina un cinturón basado en Arduino, detección inercial y
un centro de monitoreo local orientado a cuidadores y familiares.

## Funciones demostrativas

- Recepción de telemetría del MPU6050 por USB o Bluetooth HC-06.
- Detección y registro de posibles caídas.
- Alarma autónoma mediante buzzer, indicadores LED y pantalla LCD.
- Panel local para visualizar estado, movimiento y eventos.
- Protocolo de atención con cronómetro ante una caída confirmada.
- Preparación conceptual para batería, GPS, geocercas y aplicación móvil.

## Descargar

La versión portable para Windows está disponible exclusivamente en la sección
**Releases**. No requiere instalar Python ni Node.js.

El paquete incluye soporte opcional para el controlador CH340/CH341. El driver
solo debe instalarse manualmente cuando Windows no reconozca una placa Arduino
compatible.

## Alcance

SFA Asistencia es un prototipo educativo y experimental. No constituye un
dispositivo médico certificado y no sustituye supervisión humana, evaluación
clínica ni servicios de emergencia.

## Código fuente

Este repositorio público es una presentación y canal de distribución. El código
fuente, firmware, archivos de construcción y materiales internos no forman parte
de esta publicación.

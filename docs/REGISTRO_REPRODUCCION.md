# Ficha de Reproducción y Verificación

Plantilla para completar, no informe de resultados ya obtenidos. Conservar la
copia completada de forma privada si contiene datos del entorno o personas.
Usar junto al [manual](MANUAL_REPRODUCCION.md).

## Identificación

| Campo | Dato a completar |
| --- | --- |
| Responsable/equipo | |
| Fecha y zona horaria | |
| Repositorio y commit completo | |
| Método de descarga; SHA-256 si es ZIP | |
| Sistema operativo y arquitectura | |
| CPU/RAM, si interesa para rendimiento | |
| Ruta de trabajo independiente | |
| Python / pip | |
| Node.js / npm | |
| Navegador y versión | |
| Arduino IDE o CLI / core AVR / biblioteca LCD | |
| Placa, módulos, alimentación y cambios de cableado | |
| Conexión y baudrate | |
| Dependencias realmente instaladas (`pip freeze`, lockfile) | |

## Matriz de Ejecución

Estados: `No ejecutada`, `Aprobada`, `Fallida` o `Bloqueada`. Las filas se dejan
sin resultado para no presentar una plantilla como evidencia experimental.

| ID | Comprobación | Resultado esperado resumido | Estado | Evidencia/observación |
| --- | --- | --- | --- | --- |
| R01 | Entorno y revisión | Versiones y commit registrados | | |
| R02 | Backend | Dependencias locales y `pip check` correcto | | |
| R03 | Frontend | Build correcto e `index.html` generado | | |
| R04 | Inicio/API | Página y endpoints responden | | |
| R05 | Perfil | Guardado sincronizado y persistencia al reiniciar | | |
| R06 | Simulación | Emergencia, cronómetro y acción registrados | | |
| R07 | Exportación | Configuración descargada sin credenciales/historial | | |
| R08 | Pruebas unitarias | Pruebas de red correctas | | |
| R09 | Diagnóstico MPU | Sensor reconocido y lecturas reales | | |
| R10 | Firmware principal | Carga y protocolo legible | | |
| R11 | USB | Telemetría reciente y desconexión reconocible | | |
| R12 | Canal de alerta | Evento y salidas físicas observadas por separado | | |
| R13 | HC-06 opcional | Telemetría real a 9600 | | |
| R14 | QR opcional | Acceso efectivo desde teléfono en red local | | |
| R15 | Geocerca opcional | Configuración conservada al recargar | | |
| R16 | Telegram opcional | Mensaje efectivamente recibido | | |
| R17 | Portable opcional | Ejecución y datos desde otra ubicación | | |
| R18 | Geocerca operativa | Salida/reingreso confirmados sin duplicar por cada muestra | | |
| R19 | Calidad de ubicación | Lectura imprecisa/antigua no se presenta como seguridad confirmada | | |
| R20 | Revocación | Un QR nuevo o desvinculación invalida el token previo | | |
| R21 | HTTPS del teléfono | Certificado confiable y posición realmente recibida con consentimiento | | |
| R22 | Correo real | Mensaje en el buzón, distinguiendo aceptación SMTP de recepción | | |

## Detalle de Cada Prueba

Repetir este bloque para cada ID ejecutado:

| Campo | Registro |
| --- | --- |
| ID y objetivo | |
| Condiciones previas y datos ficticios | |
| Procedimiento efectivamente seguido | |
| Fecha/hora de inicio y fin, si se mide | |
| Resultado esperado | |
| Resultado observado | |
| Estado y motivo | |
| Evidencia: captura, log o medición identificada | |
| Incidencia y corrección aplicada | |
| Repetición tras la corrección | |

## Conclusión de la Reproducción

- Aplicación sin hardware reproducida: completar y justificar.
- Integración con cinturón reproducida: completar y justificar.
- Pruebas no ejecutadas y motivo: completar.
- Diferencias frente al entorno de referencia: completar.
- Limitaciones y próximos ensayos: completar.

La simulación y `TEST FALL` no se contabilizan como caídas físicas detectadas.
No calcular sensibilidad, precisión ni tiempos de respuesta sin procedimiento,
mediciones y datos suficientes. No realizar pruebas haciendo caer a personas.

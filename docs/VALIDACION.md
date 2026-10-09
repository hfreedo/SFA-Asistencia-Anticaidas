# Validación y Compatibilidad

Preparación de SFA Asistencia 1.1.0, 9 de octubre de 2026.

## Evidencia Local

| Comprobación | Resultado |
| --- | --- |
| Frontend TypeScript/Vite | Compilación correcta |
| Dependencias npm | Auditoría sin vulnerabilidades al preparar esta versión |
| Fuentes e iconos | Incluidos; sin scripts externos ni Google Fonts en la página |
| Ejecutable onefile x64 | Compilación PyInstaller correcta |
| Extracción limpia | HTTP 200 desde una carpeta distinta a la de construcción |
| PATH de la prueba | Sólo Windows/System32; sin Python/Node; PYTHONHOME/PYTHONPATH vacíos |
| Datos nuevos | Base creada junto al ejecutable, sin perfiles preinstalados |
| Persistencia | Perfil y foto conservados después de reiniciar |
| Exportar/importar | Perfiles, fotos, geocerca y preferencias restaurados |
| Credenciales en exportación | Token y Chat ID de Telegram omitidos |
| Importación inválida | Rechazada sin alterar los datos |
| Modo LAN del ejecutable | HTTP correcto en IP local calculada y puerto de prueba |
| QR y selector | Renderizados en el portable |
| Vista móvil | Sin desbordamiento horizontal a 390 px |
| Emergencia | Pantalla y cronómetro verificados por simulación de interfaz |
| Catálogo del driver | Firma Authenticode válida; no instalado durante esta prueba |
| ZIP | 22 entradas, sin archivos fuente editables ni bases de datos |

Los puertos de prueba fueron 8878 y 8879 para no interrumpir el panel del usuario. El puerto normal es 8780. El modo LAN fue comprobado desde la propia PC; un teléfono físico sigue pendiente.

## Límites

- Verificado en Windows 11 x64, no en una segunda PC física.
- Windows 10 x64 es el destino previsto, pero no fue probado en este equipo.
- Sin validación para Windows de 32 bits, ARM nativo, Linux o macOS.
- Sin prueba física nueva de Arduino, MPU6050, Bluetooth o driver con placa conectada.
- Sin prueba de entrega real de Telegram ni de GPS/batería en hardware.
- Ejecutable sin firma comercial: Windows o el antivirus pueden advertir según su política.

## Portabilidad

El ejecutable contiene el runtime y los recursos. No usa rutas del usuario del equipo de construcción como requisitos. La base se guarda en `data/sfa_eventos.sqlite3` junto al ejecutable y necesita permiso de escritura.

El puerto COM se enumera en cada PC; la IP se calcula al iniciar LAN. No se abre el router ni se modifica el firewall. Mapa y Telegram requieren Internet; fuentes, iconos y QR no.

Para migrar una instalación, cerrar ambas versiones y copiar `data`. Para importar sólo perfiles y ajustes, usar Ajustes > Copias. El JSON no incluye historial ni credenciales de Telegram.

## Integridad

Archivo: `SFA-Asistencia-Anticaidas-v1.1.0-Windows.zip`

SHA-256:

```text
2EBD6467A342843B31C9DC6B4D99B1D9757A1A5F2DAEF4AA190AEF9EE7D9E37C
```

Las capturas son de una instalación aislada con datos ficticios. La carpeta de pruebas no se incluye en el release.

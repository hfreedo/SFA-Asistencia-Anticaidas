# Organización y Entrega

## Tres recorridos, sin mezclar datos con distribución

| Uso | Entrada | Contenido |
| --- | --- | --- |
| Operar en esta PC | `SFA Asistencia.lnk` | Centro activo en `dist/SFA_Centro.exe`. No iniciar copias para pruebas a la vez. |
| Revisar la entrega | `distribucion/actual/LEEME.md` | Paquetes vigentes, hashes y documentación, sin entornos de desarrollo ni datos personales. |
| Desarrollar | `README.md` y `docs/DESARROLLO.md` | Firmware, backend, web, Android, SQL y pruebas. |

## Mapa de carpetas

```text
SFA/
  README.md                 Portada y arquitectura
  ABRIR_AQUI.md             Entrada operativa de esta PC
  arduino/                 Firmware
  servidor_pc/             Backend y persistencia local
  interfaz_web/            React y portal
  android_app/             Kotlin y Compose
  supabase/                Esquema, permisos y funciones
  tests/                   Pruebas backend
  docs/                    Manuales y evidencias
  scripts/                 Herramientas para mantenimiento
  distribucion/
    actual/                Entrega de revision, generada y no versionada
    recursos/              Driver y avisos de terceros para empaquetado
  release/                 Paquetes originales de cada version
  _archivo/                Historial archivado
```

La entrega de revisión se genera con:

```powershell
.\.venv313\Scripts\python.exe scripts/preparar_entrega_actual.py
```

El script verifica hashes conocidos y la integridad del ZIP Windows antes de
copiar. Se niega a sobrescribir una entrega existente. Sus versiones de entrada
son explícitas: no escoge el EXE más reciente por fecha. Android 0.6.2 se
identifica como **release firmada**, candidata pendiente de prueba fisica.

No abre servidores, no modifica el acceso directo y no importa la base personal.
La carpeta contiene los paquetes existentes sin alterarlos y una copia de las
guías actuales. Es una entrega para revisar: no significa que se haya completado
la prueba fisica Android ni la revisión jurídica y de licencias de terceros.

## Qué no se mueve en esta etapa

El Centro activo, `servidor_pc/`, `.env`, `certs/`, `secrets/`, bases de datos y
entornos permanecen en sus rutas. `release/` conserva paquetes originales que
todavía usan algunos scripts de reproducción histórica. Renombrarlos sin adaptar
esos scripts rompería su trazabilidad.

`build/`, `.venv*`, `node_modules` y los checkouts de publicación son herramientas
de trabajo, no parte del paquete del usuario. No se debe comprimir toda la raíz.
La separación de una copia de trabajo limpia se hará después de verificar el
paquete en otra PC y cerrar la decisión sobre fuentes públicas o privadas.

## Puerta de salida para una distribución portable

1. Windows: extracción limpia, inicio/parada, persistencia y recursos sin Python
   ni Node en el PATH; repetir en una segunda PC física antes de afirmar compatibilidad general.
2. Android: clave propia, versión nueva, pruebas del candidato firmado e instalación real.
3. Inventario de dependencias, avisos y licencias de todos los componentes incluidos.
4. Datos, credenciales, certificados privados y sesiones ausentes del paquete.
5. Cuenta y espacio propios para cada administrador. El acceso a Supabase/FCM
   no se obtiene solo por descargar un ejecutable.
6. Publicación de archivos exactos con hashes y changelog; nunca reemplazar una
   versión publicada por otro binario con el mismo nombre sin informar el cambio.

La portabilidad de rutas no convierte la infraestructura remota en un servicio
compartido ya listo para alumnos. La credencial privada FCM no debe repartirse
entre sus equipos; esa administración necesita un emisor central protegido.

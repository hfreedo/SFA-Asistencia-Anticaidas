# Empieza aqui

**Para revisar lo que se puede entregar:** `distribucion/actual/LEEME.md`.
**Para conocer la arquitectura:** `README.md`.
**Para desarrollar:** `docs/DESARROLLO.md`.
La preparacion de firma Android esta en `docs/ANDROID_RELEASE.md`; la APK
0.6.2 ya tiene firma propia; requiere revisar la migracion desde debug.
No se ha reemplazado el Centro de esta PC.

Version actual: **Centro Windows 1.2.0-rc8** y **Android 0.6.2-release (9)**.
Incluyen incidentes persistentes y geocerca por internet. Los paquetes anteriores
se conservan como historial y no fueron reemplazados retroactivamente.

## Usar el proyecto en esta PC

Abre **SFA Asistencia.lnk**, el acceso directo con el logo del proyecto.
Inicia el centro general: `dist/SFA_Centro.exe`. Desde alli puedes iniciar o
detener el servidor y abrir el panel local o el portal remoto. No abras otros
ejecutables ni necesitas usar BAT para el funcionamiento normal.

La candidata actual requiere sesion de esta PC reanudada y perfil local
vinculado al mismo residente cloud del celular. Ubicacion > Por internet no
necesita hotspot ni red compartida. El mapa permite geocerca desde 5 m; ese
radio no garantiza que el GPS tenga esa precision. Android muestra la calidad.
Una salida confirmada queda pendiente hasta que un cuidador la atienda.
Cerrar la atencion no confirma el regreso: si continua fuera o no hay GPS
fiable para confirmar reingreso, el aviso de situacion permanece visible.
Los incidentes completos se revisan solo en Panel principal; el menu indica
cuando hay algo por revisar. Para probar avisos al celular: Ajustes >
Notificaciones > Avisos al celular - Firebase. Ver docs/PRUEBA_FCM_DESDE_PC.md.
Los ZIP/APK para compartir estan en `release/`; consulta sus sumas SHA-256.
Las versiones rc1/rc2 no incluyen GPS directo a Supabase ni el nuevo laboratorio.

## Que es cada carpeta

| Carpeta | Contenido | Para quien |
| --- | --- | --- |
| `dist/` | Centro Windows vigente | Operador |
| `release/` | ZIP, APK y verificaciones de la entrega actual | Distribucion |
| `android_app/` | App nativa Kotlin y sus pruebas | Desarrollo Android |
| `interfaz_web/` | Panel React y portal de acceso | Desarrollo web |
| `servidor_pc/` | FastAPI, serie, datos locales, GPS y emisor FCM | Backend |
| `arduino/` | Firmware y pruebas del sensor | Electronica |
| `supabase/` | Migraciones y pruebas de permisos SQL | Base de datos |
| `docs/` | Guias, stack, validacion y recorrido pedagogico | Alumnos y docentes |
| `scripts/` | Compilacion, verificacion y publicacion | Mantenimiento |
| `herramientas/compatibilidad/` | BAT avanzados anteriores, adaptados a su ubicacion | Soporte, no uso normal |
| `distribucion/recursos/` | Driver CH340 y licencias para crear paquetes | Empaquetado |
| `_archivo/` | Entregas y compilaciones anteriores, sin borrar | Consulta historica |
| `repositorio_publico_sfa/` | Copia Git publica preparada para publicar fuentes | GitHub |

## Privado: no compartir estas carpetas o archivos

`secrets/`, `.env`, `certs/`, `copias_privadas/`, las bases SQLite y las fotos de
residentes contienen informacion o credenciales locales. `.venv*`, `node_modules`
y `build/` son entornos o resultados de desarrollo, no el programa para alumnos.
No comprimir toda la raiz: compartir el ZIP limpio del release.

## Prueba actual

Seguir [Geocerca y atencion persistente](docs/PRUEBA_GEOCERCA_INTERNET.md).
El modo remoto usa internet, no una red compartida. El modo local se conserva.

La proxima etapa sera preparar administraciones propias para alumnos, con
aislamiento de espacios y emisor central. Nunca se repartira la clave privada
FCM del docente entre las computadoras de los alumnos.

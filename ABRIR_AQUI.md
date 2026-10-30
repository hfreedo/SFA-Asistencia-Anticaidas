# Empieza aqui

**Ultima candidata local Windows:** `release/SFA_Asistencia_v1.2.0-rc13.2/LEEME.txt`.
**Entrega de revision anterior (rc9):** `distribucion/actual/LEEME.md`.
**Para conocer la arquitectura:** `README.md`.
**Para desarrollar:** `docs/DESARROLLO.md`.
**Descargas publicadas:** Windows rc13.2 y Android 0.7.1 en
[Releases de GitHub](https://github.com/hfreedo/SFA-Asistencia-Anticaidas/releases).
La firma Android esta en `docs/ANDROID_RELEASE.md`. Android 0.7.0 conserva
la firma release de 0.6.2; no desinstalar para actualizar entre ambas.
Si todavia usas debug, revisa primero la migracion de firma.

Version local actual: **Centro Windows 1.2.0-rc13.2** y **Android 0.7.1-release (11)**.
APK local: `release/SFA-Asistencia-Android-0.7.1-release.apk`.
Roles y limites de demostracion: `docs/ROLES_DEMOSTRACION.md`.
Recuerdos esta en la navegacion inferior de Android. Es un album de este celular,
sin copia en la nube. Guia y limites: `docs/RECUERDOS_ANDROID.md`.
La rc9 corrige el cierre de alerta del cinturon. No exige nuevo firmware ni APK.
Prueba fisica pendiente: `docs/PRUEBA_ATENCION_CINTURON.md`.
Incluyen incidentes persistentes y geocerca por internet. Los paquetes anteriores
se conservan como historial y no fueron reemplazados retroactivamente.

## Manuales de lectura progresiva

Empieza por el [índice de manuales](docs/README.md): uso con capturas, portal y Android, stack con diagramas, lectura de código y exposición. Para el recorrido habitual de Windows consulta el [manual actualizado](docs/MANUAL_USO_PC.md).

## Usar el proyecto en esta PC

La copia de trabajo incorpora **Preparacion unificada (etapa 1)**. Desde el
Centro actualizado usa **Preparar sistema**: el acceso y el vinculo de esta PC
estan dentro del panel, junto a los accesos a mapa, dispositivo y pruebas.
Recorrido: [Preparacion unificada](docs/PREPARACION_UNIFICADA.md).
Paquete local: `release/SFA-Asistencia-1.2.0-rc13.2-Windows.zip`.
rc13.1 integra los controles, opciones y formulario de Personas con la estetica del panel.
rc13 unifica el recorrido Personas > ficha > Datos / Cuidadores y acceso.
Ver [Personas y equipo](docs/PERSONAS_Y_EQUIPO.md).
rc11 reorganiza el principal y muestra GPS remoto y actividad con su origen;
ver [Panel principal centrado en la persona](docs/PANEL_PRINCIPAL_PERSONA.md).
rc10.1 reconoce el vinculo guardado sin repetir la casilla al volver a Preparacion.
rc11.1 diferencia Atencion y Ubicacion y compacta las acciones secundarias.
rc11.2 agrega indicadores de Preparacion por perfil y diagnostico compacto.
rc11.3 unifica el estilo y reduce avisos/acciones repetidos en el principal.
rc12 reserva la gestion a localhost y Android 0.7.1 diferencia cuidado/emision.
Las candidatas anteriores se conservan; GitHub destaca rc13.2 y Android 0.7.1
con enlaces directos en el README.

Para probar rc13.2, cierra el Centro anterior y abre
`release/SFA_Asistencia_v1.2.0-rc13.2/SFA_Asistencia.exe`.
El acceso directo habitual y `dist/SFA_Centro.exe` pueden apuntar a una copia
anterior. No se reemplazan automaticamente ni se migran datos personales.
Para actualizar una instalacion con tus fichas, respalda y conserva su carpeta
`data/`, `.env` y certificados; reemplaza solo el EXE con el Centro detenido.
No necesitas BAT para el funcionamiento normal.

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

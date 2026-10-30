"""Package a versioned local Windows candidate without changing user data."""
from pathlib import Path
import argparse
import shutil
import zipfile

from preparar_entrega_actual import digest, validate_archive

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--version', choices=('1.2.0-rc10', '1.2.0-rc10.1', '1.2.0-rc11', '1.2.0-rc11.1', '1.2.0-rc11.2', '1.2.0-rc11.3', '1.2.0-rc12', '1.2.0-rc13', '1.2.0-rc13.1', '1.2.0-rc13.2', '1.2.0-rc13.3', '1.2.0-rc14'), default='1.2.0-rc14')
version = parser.parse_args().version
folder = root / 'release' / ('SFA_Asistencia_v' + version)
archive = root / 'release' / f'SFA-Asistencia-{version}-Windows.zip'
checksum = root / 'release' / f'SFA-Asistencia-{version}.sha256'
source_exe = root / 'dist/preparacion/SFA_Asistencia.exe'
if any(path.exists() for path in (folder, archive, checksum)):
    raise SystemExit(version + ' already exists; do not overwrite a staged release')
if not source_exe.is_file():
    raise SystemExit('Build dist/preparacion/SFA_Asistencia.exe first')
for name in ('Driver_CH340_CH341', 'Licencias'):
    if not (root / 'distribucion/recursos' / name).is_dir():
        raise SystemExit('Missing distribution resource: ' + name)

folder.mkdir()
shutil.copy2(source_exe, folder / 'SFA_Asistencia.exe')
for name in ('.env.example', 'CHANGELOG.md', 'LICENCIA_DE_USO_RESTRINGIDO.md', 'AUTORIA.md'):
    shutil.copy2(root / name, folder / name)
for name in ('Driver_CH340_CH341', 'Licencias'):
    shutil.copytree(root / 'distribucion/recursos' / name, folder / name)
docs = folder / 'Documentacion'
docs.mkdir()
for source in (root / 'docs').glob('*.md'):
    shutil.copy2(source, docs / source.name)
captures = root / 'docs/capturas'
if captures.is_dir():
    shutil.copytree(captures, docs / 'capturas')
(folder / 'VERSION.txt').write_text(
    f'SFA Asistencia Windows {version}\n'
    f'EXE SHA-256: {digest(source_exe)}\n'
    'Android compatible: 0.7.1-release (APK no incluida en este ZIP)\n', encoding='utf-8')
(folder / 'LEEME.txt').write_text(f'''SFA Asistencia {version} - Candidata local Windows x64

Extraer TODO el ZIP en una carpeta con permiso de escritura.
Abrir SFA_Asistencia.exe. No requiere Python ni Node.js instalados.
No abrir esta copia junto al Centro habitual: cada copia aislada tiene sus datos.

Novedad rc14: monitoreo por cuenta de una ficha existente, separado del emisor PC.
Tabla de relaciones de cuidado y referencia de ficha visible en el mapa.
Guia: docs/FLUJO_MULTICUENTA.md. Android complementario: 0.7.2-release.
El push requiere receptor registrado y PC emisora FCM activa; no es cloud autonomo.

Novedad rc13.3: confirmacion integrada para salir de formularios, con cancelacion
por Escape y foco en seguir editando. Comprobacion preventiva de permisos antes
de guardar; no sustituye el control atomico pendiente en el backend.

Novedad rc13.2: ficha con cuidadores, cuenta personal y administradores claros.
Selector accesible, aviso antes de abandonar formularios y consulta fallida
distinguida de un estado vacio. Invitaciones pendientes se muestran por espacio,
sin atribuirlas a una ficha cuando faltan datos. Sin cambios cloud ni Android.

Presentacion rc13.1: Personas integrada con el estilo del panel. Selectores con
iconos, altura comun y foco teal; opciones de ficha con seleccion visible.
Pestanas, botones y formulario alineados con el resto de la pagina. Vista de
datos y permisos con la misma superficie blanca; directorio mas compacto.
No cambia roles, asignaciones, sincronizacion ni infraestructura remota.

Novedad rc13: Personas como entrada a fichas, cuidadores y acceso personal.
Abrir Personas > ficha > Cuidadores y acceso. Una cuenta cuidadora puede cuidar
varias fichas; una cuenta de persona cuidada representa solo una ficha.
Agregar un cuidador existente conserva sus otras asignaciones. No se cambian
asignaciones ni se crean invitaciones hasta guardar o confirmar expresamente.
La referencia local/remota se consulta por identificador, nunca por nombre.
Guia: Documentacion/PERSONAS_Y_EQUIPO.md. Android sigue en 0.7.1-release.

Novedad: Preparacion unificada, etapa 1.
En el Centro, elegir Preparar sistema. Dentro del panel se encuentran el acceso
por internet, el vinculo de esta PC y el equipo autorizado. El perfil seleccionado
se conserva al pasar al mapa, dispositivo o pruebas de notificaciones.
Consultar Documentacion/PREPARACION_UNIFICADA.md.

Correccion rc10.1: el vinculo habilitado del perfil y espacio seleccionados
se muestra como guardado. La casilla solo aparece para nuevas vinculaciones;
no se guarda una autorizacion generica ni se repite el vinculo al abrir la vista.

Abrir SFA lleva al Panel principal. Los incidentes siguen visibles alli y se
indican en el menu. La conexion del cinturon es opcional para usar GPS remoto.
GPS por internet no requiere hotspot ni compartir la red de la PC.
Android debe iniciar seguimiento para el mismo residente remoto autorizado.
No necesita nuevo firmware. Para las pantallas por rol, actualizar a Android
0.7.1-release sin desinstalar una version con la misma firma release.

Novedad rc11: Panel principal centrado en la persona, con incidentes pendientes
antes de la ubicacion y actividad reciente local/por internet en una misma lista.
La fuente GPS elegida en el resumen se mantiene al abrir el mapa. No hay cambio
automatico a red local cuando falla internet. La ausencia del cinturon se muestra
por separado; su estado NORMAL no anuncia ausencia general de incidentes.
El detalle de atencion se abre con Revisar pendientes. La simulacion de caida
esta en Ajustes > Notificaciones > Pruebas de esta PC.
Consultar Documentacion/PANEL_PRINCIPAL_PERSONA.md.

Presentacion rc11.1: Atencion y Ubicacion en dos superficies blancas diferenciadas
en escritorio, apiladas en movil. Estados por encima de acciones secundarias;
opciones de avisos y preparacion en el menu de tres puntos de Atencion.
Tiempos legibles y advertencia ambar para GPS antiguo o impreciso.
No cambia las fuentes, la evaluacion de geocerca ni la resolucion de incidentes.

Sin cambios de esquema Supabase, permisos cloud ni infraestructura FCM.
rc12: modo demostracion con PC de confianza. Gestion local y WebSocket solo
desde localhost. El celular LAN conserva la pagina emisora y comandos GPS
con vinculo propio; para monitoreo en otros equipos usar portal con cuenta.
No agrega contrasenas locales. Cualquier persona que use la PC desbloqueada
sigue siendo operador de confianza. Guia: Documentacion/ROLES_DEMOSTRACION.md.
rc11.3: lenguaje visual unificado del principal. Sesion pausada confirmada
se indica una sola vez; estados locales de consulta siguen visibles sin
repetir la misma accion. Selector GPS compacto, actualizacion en cabeceras,
historial y diagnostico secundarios. Incidentes reales mantienen prioridad.
rc11.2: indicador de Preparacion compartido con el menu; distingue vinculo,
sesion pausada y errores del emisor. Cinturon opcional y FCM sin configurar
no bloquean GPS. Consulta fallida no muestra contador de historial cero.
Acciones contextuales llevan al acceso dentro de Preparacion.
FCM sigue requiriendo el emisor configurado en la PC y una sesion activa.
Configurado no confirma entrega: comprobar con Avisos y pruebas y el celular.

No incluye residentes personales, sesiones, certificados privados ni claves FCM.
La primera ejecucion crea data/ junto al ejecutable. Los servicios remotos
requieren internet, cuentas autorizadas y configuracion privada propia.
No compartir la raiz de desarrollo ni copiar secretos a una distribucion.

Para actualizar: detener y cerrar el Centro, respaldar data/ y reemplazar solo
el EXE de la instalacion anterior. Conservar data/, .env y certificados propios.
No copiar los datos vacios de una instalacion nueva sobre los anteriores.
El driver CH340/CH341 incluido es opcional y no se instala automaticamente.

Validacion de software y arranque aislado; pruebas fisicas de GPS, sensor y
entrega de avisos deben realizarse con los dispositivos reales.
Prototipo experimental de investigacion y desarrollo educativo.
''', encoding='utf-8')
(folder / 'SHA256SUMS.txt').write_text(''.join(
    digest(source) + '  ' + source.relative_to(folder).as_posix() + '\n'
    for source in sorted(folder.rglob('*')) if source.is_file()), encoding='utf-8')
with zipfile.ZipFile(archive, 'x', zipfile.ZIP_DEFLATED) as output:
    for source in sorted(folder.rglob('*')):
        if source.is_file():
            output.write(source, Path(folder.name) / source.relative_to(folder))
validate_archive(archive)
with zipfile.ZipFile(archive) as package:
    if package.read(folder.name + '/SFA_Asistencia.exe') != source_exe.read_bytes():
        raise SystemExit('Packaged executable differs from the validated candidate')
checksum.write_text(digest(archive) + '  ' + archive.name + '\n', encoding='ascii')
print('Validated local release:', archive)
print('SHA-256:', digest(archive))

"""Build the rc8 candidate without developer data or private credentials."""
from pathlib import Path
import hashlib
import shutil
import zipfile

root = Path(__file__).resolve().parents[1]
version = '1.2.0-rc8'
folder = root / 'release' / ('SFA_Asistencia_v' + version)
if folder.exists():
    raise SystemExit('Candidate folder already exists; inspect it before rebuilding')
folder.mkdir()
shutil.copy2(root / 'dist/navigation-push-tests/SFA_Asistencia.exe', folder / 'SFA_Asistencia.exe')
for name in ('.env.example', 'CHANGELOG.md'):
    shutil.copy2(root / name, folder / name)
for name in ('Driver_CH340_CH341', 'Licencias'):
    shutil.copytree(root / 'distribucion/recursos' / name, folder / name)
docs = folder / 'Documentacion'
docs.mkdir()
for source in (root / 'docs').glob('*.md'):
    shutil.copy2(source, docs / source.name)
(folder / 'LEEME.txt').write_text('''SFA Asistencia 1.2.0-rc8 - CANDIDATA EDUCATIVA

Extraer toda la carpeta y abrir SFA_Asistencia.exe. Windows x64.
No requiere Python ni Node instalados. CH340/CH341 solo si su placa lo necesita.
No incluye perfiles personales, bases, claves privadas ni sesiones.
Los datos nuevos se guardan en data/ junto al ejecutable.

GPS POR INTERNET: usar Android 0.6.1-prototipo, cuenta autorizada y seguimiento.
No requiere misma red, hotspot ni certificados locales. Para consultar desde
esta PC abrir Acceso y sincronizacion, iniciar sesion y vincular/reanudar envios.
La geocerca remota, incidentes y lista de destinos requieren Supabase 001 a 010.
El portal HTTPS tambien permite consultar y atender sin servidor local.
Los avisos FCM aun requieren emisor PC, credencial privada propia y sesion activa.
Este paquete no incluye la credencial FCM del desarrollador.

LAN: alternativa para compartir directamente a esta PC con HTTPS, QR y CA local.
No es requisito para GPS por internet. No compartir claves .pem ni .key.

Salir de la geocerca crea atencion pendiente. Reingresar no la resuelve.
Tomar atencion y confirmar resolucion desde una cuenta cuidadora autorizada.
Resolver no confirma reingreso: la situacion exterior sigue visible. GPS incierto
o antiguo conserva la advertencia de ultimo exterior, no afirma que regreso.
La banda visual no requiere permiso de notificacion del navegador.
El bloque completo de incidentes aparece solo en Panel principal. Su indicador
en el menu sigue activo desde Ubicacion y Ajustes. Para probar FCM abrir
Ajustes > Notificaciones, elegir un celular propio y confirmar el envio de prueba.
No se puede elegir un celular de otra cuenta ni se envia nada al abrir Ajustes.
Un radio de 5 m no garantiza GPS de 5 m; revisar precision y probar al aire libre.

Pruebas automatizadas y empaquetado no equivalen a validacion fisica Android,
pantalla bloqueada, recepcion FCM o deteccion de caidas. No es un dispositivo
medico ni sustituye servicios de emergencia.
''', encoding='utf-8')
archive = root / 'release' / f'SFA-Asistencia-{version}-Windows.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
    for source in sorted(folder.rglob('*')):
        if not source.is_file():
            continue
        if source.suffix in {'.sqlite3', '.db', '.pem', '.key'} or source.name == '.env' or 'service-account' in source.name:
            raise SystemExit('Private artifact rejected: ' + source.name)
        output.write(source, Path(folder.name) / source.relative_to(folder))
with zipfile.ZipFile(archive) as check:
    assert check.testzip() is None
manifest = root / 'release' / f'SFA-Asistencia-{version}.sha256'
manifest.write_text(hashlib.sha256(archive.read_bytes()).hexdigest() + '  ' + archive.name + '\n', encoding='ascii')
print('Candidate Windows archive and checksum ready; no personal data included')

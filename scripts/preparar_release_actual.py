"""Package only verified distributable artifacts; never the developer's data."""
from pathlib import Path
import hashlib
import shutil
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
version = '1.2.0-rc4'
if not (root / 'distribucion/recursos/Driver_CH340_CH341').is_dir():
    raise SystemExit('Extraer Driver_CH340_CH341 y Licencias de un release verificado en distribucion/recursos antes de empaquetar')
folder = root / 'release' / ('SFA_Asistencia_v' + version)
if folder.exists() and '--resume' not in sys.argv:
    raise SystemExit('Package folder already exists; inspect it rather than overwrite')
folder.mkdir(parents=True, exist_ok=True)
shutil.copy2(root / 'dist/rc4/SFA_Asistencia.exe', folder / 'SFA_Asistencia.exe')
shutil.copy2(root / '.env.example', folder / '.env.example')
shutil.copy2(root / 'CHANGELOG.md', folder / 'CHANGELOG.md')
shutil.copytree(root / 'distribucion/recursos/Driver_CH340_CH341', folder / 'Driver_CH340_CH341', dirs_exist_ok=True)
shutil.copytree(root / 'distribucion/recursos/Licencias', folder / 'Licencias', dirs_exist_ok=True)
for license_dir in (root / '.venv313/Lib/site-packages').glob('cryptography-*.dist-info/licenses'):
    shutil.copytree(license_dir, folder / 'Licencias/cryptography', dirs_exist_ok=True)
docs = folder / 'Documentacion'
docs.mkdir(exist_ok=True)
for name in ('INICIADOR.md', 'ANDROID.md', 'GEOLOCALIZACION.md', 'STACK_TECNOLOGICO.md', 'VALIDACION_AMPLIACION.md', 'PLAN_AMPLIACION.md', 'FIREBASE_FCM.md', 'PRUEBA_APK_FCM.md', 'PRUEBA_GPS_Y_ALARMAS.md'):
    shutil.copy2(root / 'docs' / name, docs / name)
(folder / 'LEEME.txt').write_text('''SFA Asistencia 1.2.0-rc4 - PROTOTIPO

WINDOWS: extraer toda la carpeta y abrir SFA_Asistencia.exe.
No requiere Python, Node, Git ni OpenSSL instalados. CH340/CH341 es opcional
y solo se instala si el adaptador USB de su placa lo necesita.

Para usar el celular activar Celular y ubicacion en el centro de inicio.
El HTTPS genera una CA propia de esta PC: no se distribuyen claves privadas.
Browser: confiar la CA en los equipos de prueba. APK: importar la CA dentro
de la app. No compartir archivos .key ni rootCA-key.pem.

Los datos nuevos se guardan en data/ junto al ejecutable. Este paquete NO
incluye perfiles, fotos, ubicaciones, tokens ni configuracion del desarrollador.
Para migrar configuraciones usar exportacion/importacion deliberada.

ANDROID: APK de prueba separada, Android 12+. Firma debug, no produccion.
GPS remoto hacia Supabase con Wi-Fi o datos moviles; no requiere cinturon.
El modo local directo a la PC se conserva como alternativa, con HTTPS y QR.
La APK indica 0.4.0-prototipo (4); navegacion Compartir, Cuidar y Pruebas.
No cambia respecto de rc3. La correccion rc4 afecta al panel Windows:
Ubicacion > Por internet consulta Supabase para el perfil local vinculado.
En acceso de esta PC iniciar sesion y reanudar envios antes de consultar.
FCM incluido: activar avisos en Cuidar con cuenta Supabase autorizada.
El emisor PC necesita una credencial privada propia y sesion cloud activa.
Esta distribucion NO contiene esa credencial ni configuracion personal.
Pruebas locales y push dirigido solo al celular solicitante, etiquetado.
Ver Documentacion/PRUEBA_GPS_Y_ALARMAS.md. GPS remoto no depende de la PC;
el emisor push actual SI necesita PC, internet, credencial y sesion activa.
El editor de geocerca local aun no sincroniza su zona con Supabase.

La validacion automatizada no prueba pantalla bloqueada, HC-06 ni deteccion
fisica de caidas. No es un dispositivo medico o servicio de emergencia.
''', encoding='utf-8')
archive = root / 'release' / f'SFA-Asistencia-{version}-Windows.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as zip_file:
    for file in sorted(folder.rglob('*')):
        if file.is_file():
            if file.suffix in {'.sqlite3', '.db', '.pem', '.key'} or file.name == '.env' or 'service-account' in file.name:
                raise SystemExit('Private artifact rejected')
            zip_file.write(file, Path(folder.name) / file.relative_to(folder))
with zipfile.ZipFile(archive) as check:
    assert check.testzip() is None
apk = root / 'release' / f'SFA-Asistencia-{version}-Android-prototipo.apk'
shutil.copy2(root / 'android_app/artifacts/SFA-Asistencia-Android-prototipo.apk', apk)
checksums = root / 'release' / f'SFA-Asistencia-{version}.sha256'
checksums.write_text(''.join(hashlib.sha256(file.read_bytes()).hexdigest() + '  ' + file.name + '\n' for file in (archive, apk)), encoding='ascii')
print('Packaged Windows, Android and SHA-256 manifest')
print('No resident database or TLS keys included')

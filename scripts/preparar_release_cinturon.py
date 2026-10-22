"""Package the rc9 belt-attention fix without changing previous releases."""
from pathlib import Path
import shutil
import zipfile

from preparar_entrega_actual import digest, validate_archive

root = Path(__file__).resolve().parents[1]
version = '1.2.0-rc9'
folder = root / 'release' / ('SFA_Asistencia_v' + version)
archive = root / 'release' / f'SFA-Asistencia-{version}-Windows.zip'
if folder.exists() or archive.exists():
    raise SystemExit('Release already exists; do not overwrite published binaries')
folder.mkdir()
shutil.copy2(root / 'dist/belt-attention/SFA_Asistencia.exe', folder / 'SFA_Asistencia.exe')
for name in ('.env.example', 'CHANGELOG.md', 'LICENCIA_DE_USO_RESTRINGIDO.md', 'AUTORIA.md'):
    shutil.copy2(root / name, folder / name)
for name in ('Driver_CH340_CH341', 'Licencias'):
    shutil.copytree(root / 'distribucion/recursos' / name, folder / name)
docs = folder / 'Documentacion'
docs.mkdir()
for source in (root / 'docs').glob('*.md'):
    shutil.copy2(source, docs / source.name)
(folder / 'LEEME.txt').write_text('''SFA Asistencia 1.2.0-rc9 - Candidata Windows x64

Extraer todo y abrir SFA_Asistencia.exe. No requiere Python ni Node instalados.
No incluye perfiles personales, sesiones, certificados privados ni claves FCM.
La primera ejecucion crea los datos propios junto al ejecutable.

Correccion: confirmar atencion envia RESET y espera respuesta del cinturon.
No oculta errores ni reabre la cortina por cada muestra de la misma caida.
Consultar Documentacion/PRUEBA_ATENCION_CINTURON.md. Hardware fisico pendiente.
No necesita firmware nuevo ni reinstalar Android 0.6.2-release.

GPS por internet: cuenta autorizada, seguimiento Android y vinculo al mismo
residente. No requiere hotspot. FCM todavia requiere emisor PC y sesion activa,
con credencial privada propia no incluida en este paquete.

Para actualizar una instalacion, detener el Centro y respaldar data/ antes
de reemplazar solo el EXE. No reemplazar datos, .env o certificados propios.
El driver CH340/CH341 es opcional. No se instala automaticamente.

Prototipo experimental educativo; no sustituye supervision o emergencias.
''', encoding='utf-8')
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
    for source in sorted(folder.rglob('*')):
        if source.is_file():
            output.write(source, Path(folder.name) / source.relative_to(folder))
validate_archive(archive)
(root / 'release' / f'SFA-Asistencia-{version}.sha256').write_text(
    digest(archive) + '  ' + archive.name + '\n', encoding='ascii')
print('Validated Windows rc9 package:', archive.name)

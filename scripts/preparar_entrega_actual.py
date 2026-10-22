"""Stage verified current binaries without touching active installs or old releases."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import shutil
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PACKAGES = (
    ('SFA-Asistencia-1.2.0-rc8-Windows.zip',
     '1fcb6a0e03f1ad3f7d8c3a222f1f608dfcb904e11635837fda54ca7860ebb051', 'Windows'),
    ('SFA-Asistencia-Android-0.6.1-prototipo.apk',
     'ef7c291d6229d696e6115f7330737a4baf4f9844915d1e1f594f95ecee949697', 'Android-debug'),
)


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def validate_archive(path):
    with zipfile.ZipFile(path) as archive:
        if archive.testzip() is not None:
            raise ValueError('Damaged archive: ' + path.name)
        for item in archive.infolist():
            relative = PurePosixPath(item.filename.replace('\\', '/'))
            if relative.is_absolute() or '..' in relative.parts or ':' in str(relative):
                raise ValueError('Unsafe archive entry')
            name = relative.name.lower()
            parts = {part.lower() for part in relative.parts}
            if (name == '.env' or name.endswith(('.sqlite3', '.db', '.pem', '.key', '.jks', '.keystore'))
                    or 'service-account' in name or parts & {'secrets', 'certs', '.venv', '.venv313'}):
                raise ValueError('Private artifact in archive: ' + name)


def prepare(root, packages=PACKAGES):
    root = root.resolve()
    target = root / 'distribucion/actual'
    if not target.resolve().is_relative_to(root):
        raise ValueError('Delivery path escapes project')
    if target.exists():
        raise FileExistsError('Delivery already exists; inspect it instead of overwriting')
    inputs = []
    for name, expected, platform in packages:
        source = (root / 'release' / name).resolve()
        destination = target / platform / name
        if not source.is_relative_to(root / 'release') or not destination.resolve().is_relative_to(target):
            raise ValueError('Delivery path escapes intended directory')
        if digest(source) != expected:
            raise ValueError('Checksum mismatch: ' + name)
        if source.suffix == '.zip':
            validate_archive(source)
        inputs.append((source, destination, expected))
    target.mkdir(parents=True)
    for source, destination, expected in inputs:
        destination.parent.mkdir(exist_ok=True)
        shutil.copy2(source, destination)
        if digest(destination) != expected:
            raise ValueError('Copy failed verification: ' + source.name)
    docs = target / 'Documentacion'
    docs.mkdir()
    for source in (root / 'docs').glob('*.md'):
        shutil.copy2(source, docs / source.name)
    if (root / 'docs/capturas').is_dir():
        (docs / 'capturas').mkdir()
        for source in (root / 'docs/capturas').glob('*.png'):
            shutil.copy2(source, docs / 'capturas' / source.name)
    for name in ('LICENCIA_DE_USO_RESTRINGIDO.md', 'AUTORIA.md'):
        shutil.copy2(root / name, target / name)
    (target / 'LEEME.md').write_text('''# SFA Asistencia - Entrega para revision

## Windows

Extrae el ZIP de Windows/ fuera de la carpeta de desarrollo y abre
SFA_Asistencia.exe. No abras esa copia junto al Centro habitual de esta PC.
El ZIP es la candidata 1.2.0-rc8 ya publicada, conservada sin modificar.

## Android

Android-debug/ contiene la APK 0.6.1 vigente con firma debug, NO la futura
APK release con firma propia. Conserva su identidad hasta terminar la migracion.
Consulta Documentacion/ANDROID_RELEASE.md para preparar la nueva firma.

## Antes de compartir

Esta es una entrega de revision, no una nueva version publicada. Las guias
actuales se agregan separadas, sin alterar los paquetes originales.
No contiene bases personales, claves privadas, sesiones ni entornos instalados.
No concede accesos a Supabase ni incluye la credencial del emisor FCM.
La revision de licencias de terceros y de recursos visuales sigue pendiente.
Consulta las condiciones existentes en LICENCIA_DE_USO_RESTRINGIDO.md.

SHA256SUMS.txt permite comprobar los archivos de esta entrega.
''', encoding='utf-8')
    manifest = {file.relative_to(target).as_posix(): digest(file)
                for file in sorted(target.rglob('*')) if file.is_file()}
    (target / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    (target / 'SHA256SUMS.txt').write_text(
        ''.join(value + '  ' + name + '\n' for name, value in manifest.items()), encoding='utf-8')
    return target


if __name__ == '__main__':
    print('Verified review delivery:', prepare(ROOT))

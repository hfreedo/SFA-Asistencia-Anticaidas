"""Copy only publishable source trees into the existing public Git checkout."""
from pathlib import Path
import shutil
import re
import subprocess

root = Path(__file__).resolve().parents[1]
target = root / 'repositorio_publico_sfa'
if not (target / '.git').exists():
    raise SystemExit('Public checkout not found; no files copied')
protected = set()
for arguments in (['diff', '--name-only'], ['diff', '--cached', '--name-only'], ['ls-files', '--others', '--exclude-standard']):
    protected.update(subprocess.check_output(['git', '-c', 'core.quotepath=false', '-C', str(target), *arguments], text=True, encoding='utf-8').splitlines())
excluded = {'.git', '.venv', '.venv313', '__pycache__', 'node_modules', 'build', '.gradle', '.jvm-tmp', 'artifacts', 'static', 'dist-acceso', 'certs', 'data', 'copias_privadas', 'secrets'}
source_suffixes = {'.py', '.ts', '.tsx', '.json', '.css', '.html', '.md', '.sql', '.mjs', '.cjs', '.kts', '.kt', '.xml', '.properties', '.bat', '.ps1', '.jar', '.png', '.jpg', '.svg', '.ico', '.woff', '.woff2', '.txt', '.yml', '.yaml', '.ino', '.h', '.cpp', '.toml'}
copied = []
for tree in ('servidor_pc', 'interfaz_web', 'tests', 'supabase', 'android_app', 'scripts', 'docs', 'herramientas', '.github'):
    for source in (root / tree).rglob('*'):
        if not source.is_file():
            continue
        relative = source.relative_to(root)
        if relative.as_posix() in protected:
            continue
        if any(part in excluded for part in relative.parts) or source.name in {'.env', 'local.properties', 'google-services.json', 'keystore.properties', 'signing.properties'}:
            continue
        if source.suffix.lower() in {'.jks', '.keystore', '.p12', '.pfx'} or source.name.endswith('.dpapi.xml'):
            continue
        if source.suffix == '.json' and 'service-account' in source.name:
            continue
        if source.name.startswith('.env') and source.name != '.env.example':
            continue
        if source.suffix not in source_suffixes and source.name not in {'.gitignore', 'gradlew', '.env.example'}:
            continue
        destination = target / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, destination)
        copied.append(relative.as_posix())
for name in ('sfa_portable.py', 'SFA_Asistencia.spec', '.env.example', 'CHANGELOG.md', 'UX_GUIDELINES.md', 'ABRIR_AQUI.md', 'distribucion/LEEME.md'):
    if name in protected:
        continue
    (target / name).parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(root / name, target / name)
    copied.append(name)
for relative in copied:
    file = target / relative
    if file.suffix not in {'.py', '.ts', '.tsx', '.md', '.json', '.xml', '.kts', '.kt', '.properties', '.yml', '.yaml', '.sql', '.ps1', '.cjs', '.mjs', '.html', '.css', '.toml', '.bat'}:
        continue
    data = file.read_text(encoding='utf-8', errors='replace')
    if re.search(r'sb_secret_[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC )?PRIVATE KEY-----|bajalatencia9@gmail\.com', data):
        raise SystemExit('Review private material in ' + relative)
print('Source files synchronized:', len(copied))
print('Preserved pre-existing local changes:', len(protected))
print('Excluded: environments, databases, private certificates, built bundles and personal profiles')

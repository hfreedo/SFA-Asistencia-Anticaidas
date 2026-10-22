"""Build an identical Android source copy in an ASCII path on Windows."""
from pathlib import Path
import argparse
import hashlib
import json
import os
import shutil
import subprocess
import tempfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--variant', choices=('debug', 'release'), default='debug')
parser.add_argument('--check-release-config', action='store_true')
args = parser.parse_args()

root = Path(__file__).resolve().parents[1]
source = root / 'android_app'
environment = dict(os.environ)
if os.name == 'nt':
    parent = Path(os.getenv('PUBLIC', r'C:\Users\Public'))
    java = Path(environment.get('JAVA_HOME', r'C:\Program Files\Android\Android Studio\jbr'))
    sdk = Path(environment.get('ANDROID_HOME', str(Path(os.environ['LOCALAPPDATA']) / 'Android/Sdk')))
else:
    parent = Path(tempfile.gettempdir())
    java = Path(environment['JAVA_HOME'])
    sdk = Path(environment['ANDROID_HOME'])
if not java.is_dir() or not sdk.is_dir():
    raise SystemExit('Set JAVA_HOME and ANDROID_HOME before building')
work = Path(tempfile.mkdtemp(prefix='sfa-android-', dir=parent))
project = work / 'project'
shutil.copytree(source, project, ignore=shutil.ignore_patterns(
    'build', '.gradle', '.jvm-tmp', 'local.properties', 'artifacts',
    '*.jks', '*.keystore', '*.p12', '*.pfx', '*.dpapi.xml', 'keystore.properties', 'signing.properties'))
manifest = {}
for file in project.rglob('*'):
    if file.is_file():
        relative = file.relative_to(project).as_posix()
        digest = hashlib.sha256(file.read_bytes()).hexdigest()
        assert digest == hashlib.sha256((source / relative).read_bytes()).hexdigest()
        manifest[relative] = digest
(work / '.jvm-tmp').mkdir()
environment.update(JAVA_HOME=str(java), ANDROID_HOME=str(sdk), JAVA_TOOL_OPTIONS=f'-Djdk.net.unixdomain.tmpdir={work / ".jvm-tmp"}')
wrapper = project / ('gradlew.bat' if os.name == 'nt' else 'gradlew')
output = source / 'artifacts'
if args.variant == 'release' or args.check_release_config:
    output = output / 'release'
output.mkdir(parents=True, exist_ok=True)
variant = args.variant.capitalize()
tasks = [f':app:test{variant}UnitTest', f':app:assemble{variant}', f':app:lint{variant}']
if args.check_release_config:
    tasks = [':app:validateReleaseSigning']
command = [str(wrapper), '--no-daemon', *tasks]
print('Android isolated build:', work, flush=True)
with (output / 'build.log').open('w', encoding='utf-8') as log:
    process = subprocess.Popen(command, cwd=project, env=environment, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, errors='replace')
    for line in process.stdout:
        log.write(line)
        log.flush()
        if any(word in line for word in ('> Task', 'FAIL', 'SUCCESS', 'error:', 'Error', 'Warning:')):
            print(line.rstrip(), flush=True)
    result = process.wait()
reports = project / 'app/build/reports'
if reports.exists():
    shutil.copytree(reports, output / 'reports', dirs_exist_ok=True)
if result:
    raise SystemExit(result)
if args.check_release_config:
    print('PASS: release configuration available; no APK built', flush=True)
    raise SystemExit(0)
apk = project / f'app/build/outputs/apk/{args.variant}/app-{args.variant}.apk'
name = 'SFA-Asistencia-Android-release.apk' if args.variant == 'release' else 'SFA-Asistencia-Android-prototipo.apk'
shutil.copy2(apk, output / name)
(output / 'source-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
(output / 'apk.sha256').write_text(hashlib.sha256(apk.read_bytes()).hexdigest() + '  ' + name + '\n', encoding='ascii')
print('PASS: APK, unit tests and Android lint; physical device validation remains separate', flush=True)

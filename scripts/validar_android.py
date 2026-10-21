"""Build an identical Android source copy in an ASCII path on Windows."""
from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess
import tempfile

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
shutil.copytree(source, project, ignore=shutil.ignore_patterns('build', '.gradle', '.jvm-tmp', 'local.properties', 'artifacts'))
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
output.mkdir(exist_ok=True)
command = [str(wrapper), '--no-daemon', ':app:testDebugUnitTest', ':app:assembleDebug', ':app:lintDebug']
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
apk = project / 'app/build/outputs/apk/debug/app-debug.apk'
shutil.copy2(apk, output / 'SFA-Asistencia-Android-prototipo.apk')
(output / 'source-manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
(output / 'apk.sha256').write_text(hashlib.sha256(apk.read_bytes()).hexdigest() + '  SFA-Asistencia-Android-prototipo.apk\n', encoding='ascii')
print('PASS: APK, unit tests and Android lint; physical device validation remains separate', flush=True)

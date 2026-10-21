"""Smoke-test the packaged server in a new folder, never the resident database."""
import json
from pathlib import Path
import shutil
import ssl
from datetime import datetime, timezone
import subprocess
import sys
import tempfile
import time
import urllib.request
import zipfile

root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(root))
from servidor_pc.control_local import read_control
folder = Path(tempfile.mkdtemp(prefix='sfa-launcher-check-'))
exe = folder / 'SFA_Asistencia.exe'
source = 'dist/corregido/SFA_Asistencia.exe' if '--candidate' in sys.argv else 'dist/SFA_Centro.exe'
if '--exe' in sys.argv:
    source = Path(sys.argv[sys.argv.index('--exe') + 1]).resolve()
    assert source.is_file() and source.suffix.lower() == '.exe'
if '--archive' in sys.argv:
    archive = Path(sys.argv[sys.argv.index('--archive') + 1]).resolve()
    with zipfile.ZipFile(archive) as package:
        assert package.testzip() is None
        for member in package.namelist():
            destination = (folder / member).resolve()
            assert destination.is_relative_to(folder.resolve())
            assert not destination.name.endswith(('.sqlite3', '.pem', '.key'))
        package.extractall(folder)
    executables = list(folder.glob('*/SFA_Asistencia.exe'))
    assert len(executables) == 1
    exe = executables[0]
else:
    shutil.copy2(root / source, exe)
mobile = '--mobile' in sys.argv
base = ('https' if mobile else 'http') + '://localhost:18786'
process = subprocess.Popen([str(exe), '--port', '18786', '--no-browser', *(['--lan'] if mobile else [])], cwd=folder)
passed = False
try:
    for _ in range(90):
        try:
            ca = exe.parent / 'certs/ca/rootCA.pem'
            context = ssl.create_default_context(cafile=str(ca)) if mobile and ca.is_file() else ssl.create_default_context()
            with urllib.request.urlopen(base + '/api/status', timeout=1, context=context) as response:
                status = json.load(response)
            with urllib.request.urlopen(base + '/acceso/acceso.html', timeout=2, context=context) as response:
                assert response.status == 200
            assert status['connected'] is False
            if mobile:
                def request(path, body=None, token=None, method=None):
                    req = urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None,
                        headers={'Content-Type': 'application/json', **({'Authorization': 'Bearer ' + token} if token else {})}, method=method)
                    with urllib.request.urlopen(req, timeout=5, context=context) as response:
                        return json.load(response)
                assert request('/api/network-info')['lan_available']
                resident = request('/api/residents', {'full_name': 'Fixture TLS', 'room': 'Test', 'phone': ''})
                location_token = request(f"/api/residents/{resident['id']}/location-device", {})['token']
                try:
                    request(f"/api/residents/{resident['id']}/location-device", {})
                    raise AssertionError('Implicit rotation was accepted')
                except urllib.error.HTTPError as error:
                    assert error.code == 409
                fence = request(f"/api/residents/{resident['id']}/geofence", {'home_lat': 0, 'home_lng': 0, 'radius_m': 5, 'address_name': 'Fixture'}, method='PUT')
                assert fence['radius_m'] == 5
                position = request('/api/location', {'latitude': 0, 'longitude': 0, 'accuracy_m': 5,
                    'observed_at': datetime.now(timezone.utc).isoformat()}, location_token)
                assert position['resident_id'] == resident['id']
                print('PASS: HTTPS LAN, pairing and synthetic location reception (not physical GPS)')
            token = read_control(18786, base)
            assert token
            request = urllib.request.Request(base + '/api/launcher/stop', data=b'{}', headers={'Authorization': 'Bearer ' + token})
            with urllib.request.urlopen(request, timeout=3, context=context) as response:
                assert response.status == 200
            for _ in range(100):
                try:
                    urllib.request.urlopen(base + '/api/status', timeout=0.3, context=context).close()
                    time.sleep(0.1)
                except OSError:
                    break
            else:
                raise AssertionError('Packaged server did not stop')
            passed = True
            print('PASS: packaged server, portal and authenticated graceful shutdown')
            break
        except OSError:
            time.sleep(1)
finally:
    subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True)
    process.wait(timeout=10)
print('Test artifacts:', folder)
raise SystemExit(0 if passed else 1)

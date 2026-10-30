import json
import os
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path


class LocationApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        root = Path(__file__).resolve().parents[1]
        if not (root / "interfaz_web/static/index.html").is_file():
            raise unittest.SkipTest("Compilar interfaz_web antes de las pruebas HTTP")
        cls.tmp = tempfile.TemporaryDirectory()
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        cls.base = f"http://127.0.0.1:{port}"
        code = "import sys; from pathlib import Path; from servidor_pc import main; import uvicorn; main.DB_PATH=Path(sys.argv[1]); uvicorn.run(main.app,host='127.0.0.1',port=int(sys.argv[2]),log_level='error')"
        env = dict(os.environ, SFA_SMTP_HOST="")
        cls.process = subprocess.Popen([sys.executable, "-c", code, str(Path(cls.tmp.name) / "api.sqlite3"), str(port)], cwd=root, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        try:
            for _ in range(100):
                if cls.process.poll() is not None:
                    raise RuntimeError("El servidor de prueba terminó al iniciar")
                try:
                    urllib.request.urlopen(cls.base + "/api/status", timeout=1).close()
                    break
                except OSError:
                    time.sleep(.1)
            else:
                raise RuntimeError("Tiempo de inicio agotado")
        except BaseException:
            cls.tearDownClass()
            raise

    @classmethod
    def tearDownClass(cls):
        if os.name == "nt" and cls.process.poll() is None:
            # The Windows venv launcher may own a second Python process.
            subprocess.run(["taskkill", "/PID", str(cls.process.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
        else:
            cls.process.terminate()
        try:
            cls.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            cls.process.kill()
            cls.process.wait()
        cls.tmp.cleanup()

    def request(self, path, method="GET", body=None, headers=None):
        headers = {"Content-Type": "application/json", **(headers or {})}
        request = urllib.request.Request(self.base + path, method=method, headers=headers,
                                         data=None if body is None else json.dumps(body).encode())
        try:
            with urllib.request.urlopen(request, timeout=5) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            with error:
                return error.code, json.load(error)

    def test_launcher_stop_requires_instance_capability(self):
        status, _ = self.request('/api/launcher/stop', 'POST', {}, {'Authorization': 'Bearer invalid'})
        self.assertEqual(status, 403)
        self.assertEqual(self.request('/api/status')[0], 200)

    def setUp(self):
        _, created = self.request("/api/residents", "POST", dict(full_name="Prueba API", room="Prueba", phone=""))
        self.id = created["id"]
        status, _ = self.request(f"/api/residents/{self.id}/geofence", "PUT", dict(home_lat=0, home_lng=0, radius_m=200, address_name="Prueba"))
        self.assertEqual(status, 200)
        _, paired = self.request(f"/api/residents/{self.id}/location-device", "POST")
        self.token = paired["token"]

    def position(self, offset=0, latitude=0, **extra):
        return dict(latitude=latitude, longitude=0, accuracy_m=5,
                    observed_at=(datetime.now(timezone.utc) + timedelta(seconds=offset)).isoformat(), **extra)

    def test_cloud_management_requires_local_origin_and_explicit_consent(self):
        status, data = self.request('/api/cloud/status')
        self.assertEqual(status, 200)
        self.assertFalse(data['session_active'])
        self.assertEqual(self.request('/api/cloud/status', headers={'Origin':'https://example.invalid'})[0],403)
        body = dict(resident_id=self.id, space_id='11111111-1111-4111-8111-111111111111',consent=False)
        self.assertEqual(self.request('/api/cloud/connect','POST',body)[0],422)
        body['consent'] = True
        self.assertEqual(self.request('/api/cloud/connect','POST',body)[0],401)

    def test_lan_boundary_preserves_scoped_phone_but_blocks_operator_routes(self):
        # Uvicorn trusts the test loopback proxy; production LAN clients cannot set their own identity this way.
        lan = {'X-Forwarded-For': '192.0.2.10', 'X-Forwarded-Proto': 'https'}
        for path, method, body in [('/api/residents', 'GET', None), ('/api/residents', 'POST', {'full_name':'Forbidden','room':'Test','phone':''}),
                                    ('/api/profile', 'PUT', {'full_name':'Forbidden','room':'Test','phone':''}),
                                    ('/api/configuration/export', 'GET', None), ('/api/simulate/fall', 'POST', {})]:
            with self.subTest(path=path):
                self.assertEqual(self.request(path, method, body, lan)[0], 403)
        self.assertEqual(self.request('/api/location/context', headers=lan)[0], 401)
        phone = {**lan, 'Authorization': 'Bearer ' + self.token}
        self.assertEqual(self.request('/api/location/context', headers=phone)[0], 200)
        self.assertEqual(self.request('/api/location', 'POST', self.position(), phone)[0], 200)
        self.assertEqual(self.request('/api/residents', headers={'Host': 'evil.invalid'})[0], 403)
        self.assertEqual(self.request('/api/residents', headers={'Origin': 'https://evil.invalid'})[0], 403)

    def test_cloud_pause_preserves_queue(self):
        self.assertEqual(self.request('/api/cloud/pause','POST',{})[0],200)
        self.assertEqual(self.request('/api/cloud/status')[1]['pending'],0)

    def test_simulations_are_explicitly_labeled(self):
        status, event = self.request('/api/simulate/fall','POST',{})
        self.assertEqual(status,200)
        self.assertTrue(event['simulated'])
        status, reading = self.request('/api/simulate/state','POST',{'state':'CAIDA_CONFIRMADA'})
        self.assertEqual(status,200)
        self.assertTrue(reading['simulated'])

    def test_authentication_revocation_and_scope(self):
        self.assertEqual(self.request("/api/location", "POST", self.position())[0], 401)
        status, snapshot = self.request("/api/location", "POST", self.position(resident_id=99999), {"Authorization": "Bearer " + self.token})
        self.assertEqual(status, 200)
        self.assertEqual(snapshot["resident_id"], self.id)
        self.request(f"/api/residents/{self.id}/location-device", "DELETE")
        self.assertEqual(self.request("/api/location", "POST", self.position(), {"Authorization": "Bearer " + self.token})[0], 401)

    def test_replacing_phone_link_requires_explicit_confirmation(self):
        path = f'/api/residents/{self.id}/location-device'
        self.assertEqual(self.request(path, 'POST', {})[0], 409)
        self.assertEqual(self.request('/api/location', 'POST', self.position(), {'Authorization': 'Bearer ' + self.token})[0], 200)
        status, new = self.request(path, 'POST', {'replace_existing': True})
        self.assertEqual(status, 200)
        self.assertNotEqual(new['token'], self.token)
        self.assertEqual(self.request('/api/location', 'POST', self.position(offset=1), {'Authorization': 'Bearer ' + self.token})[0], 401)

    def test_five_meter_fence_round_trips(self):
        body = dict(home_lat=0, home_lng=0, radius_m=5, address_name='Demostracion')
        path = f'/api/residents/{self.id}/geofence'
        self.assertEqual(self.request(path, 'PUT', body)[0], 200)
        self.assertEqual(self.request(path)[1]['radius_m'], 5)
        self.assertEqual(self.request(path, 'PUT', {**body, 'radius_m': 4})[0], 422)

    def test_native_device_context_is_scoped_by_the_phone_token(self):
        self.assertEqual(self.request('/api/location/context')[0], 401)
        status, data = self.request('/api/location/context', headers={'Authorization': 'Bearer ' + self.token})
        self.assertEqual(status, 200)
        self.assertEqual(set(data), {'resident_id', 'geofence'})
        self.assertEqual(data['resident_id'], self.id)

    def test_position_history_is_retained_and_scoped(self):
        self.request('/api/location', 'POST', self.position(), {'Authorization': 'Bearer ' + self.token})
        status, history = self.request(f'/api/residents/{self.id}/location-history')
        self.assertEqual(status, 200)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]['resident_id'], self.id)

    def test_bad_origin_cannot_create_pairing(self):
        self.assertEqual(self.request(f"/api/residents/{self.id}/location-device", "POST", headers={"Origin": "https://example.invalid"})[0], 403)

    def test_invalid_payload(self):
        self.assertEqual(self.request("/api/location", "POST", self.position(latitude=99), {"Authorization": "Bearer " + self.token})[0], 422)

    def test_exit_is_persisted_once(self):
        for offset, latitude in [(-40, 0), (-29, 0), (-18, .01), (-7, .01), (0, .01)]:
            status, result = self.request("/api/location", "POST", self.position(offset, latitude), {"Authorization": "Bearer " + self.token})
            self.assertEqual(status, 200)
        self.assertEqual(result["status"], "outside")
        self.assertEqual(sum(e["event_type"] == "GEOCERCA_SALIDA" for e in result["events"]), 1)

    def test_export_and_restore_preserves_fence_not_tokens(self):
        _, backup = self.request("/api/configuration/export")
        self.assertNotIn(self.token, json.dumps(backup))
        self.assertTrue(any(row["geofence"]["home_lat"] == 0 for row in backup["residents"]))
        self.assertEqual(self.request("/api/configuration/import", "POST", backup)[0], 200)
        self.assertEqual(self.request("/api/location", "POST", self.position(), {"Authorization": "Bearer " + self.token})[0], 401)

    def test_email_not_configured_and_phone_route(self):
        _, state = self.request("/api/notifications/email")
        self.assertFalse(state["configured"])
        _, result = self.request("/api/notifications/test-email", "POST")
        self.assertEqual(result["status"], "not_configured")
        with urllib.request.urlopen(self.base + "/compartir-ubicacion", timeout=3) as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(response.headers["Cache-Control"], "no-store")

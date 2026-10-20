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

    def test_authentication_revocation_and_scope(self):
        self.assertEqual(self.request("/api/location", "POST", self.position())[0], 401)
        status, snapshot = self.request("/api/location", "POST", self.position(resident_id=99999), {"Authorization": "Bearer " + self.token})
        self.assertEqual(status, 200)
        self.assertEqual(snapshot["resident_id"], self.id)
        self.request(f"/api/residents/{self.id}/location-device", "DELETE")
        self.assertEqual(self.request("/api/location", "POST", self.position(), {"Authorization": "Bearer " + self.token})[0], 401)

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

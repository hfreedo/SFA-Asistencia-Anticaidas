import json
import os
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

from websockets.sync.client import connect


class HttpsTests(unittest.TestCase):
    def test_https_location_and_wss_with_isolated_trust(self):
        openssl = shutil.which("openssl")
        candidate = Path("C:/Program Files/Git/usr/bin/openssl.exe")
        if not openssl and candidate.is_file():
            openssl = str(candidate)
        if not openssl:
            self.skipTest("OpenSSL opcional no está disponible para la prueba TLS")
        root = Path(__file__).resolve().parents[1]
        if not (root / "interfaz_web/static/index.html").is_file():
            self.skipTest("Compilar interfaz_web antes de la prueba TLS")
        with tempfile.TemporaryDirectory() as tmp:
            cert, key = Path(tmp) / "cert.pem", Path(tmp) / "key.pem"
            subprocess.run([openssl, "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", str(key), "-out", str(cert), "-days", "1", "-subj", "/CN=localhost", "-addext", "subjectAltName=IP:127.0.0.1"], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            context = ssl.create_default_context(cafile=str(cert))
            with socket.socket() as sock:
                sock.bind(("127.0.0.1", 0))
                port = sock.getsockname()[1]
            code = "import sys; from pathlib import Path; from servidor_pc import main; import uvicorn; main.DB_PATH=Path(sys.argv[1]); uvicorn.run(main.app,host='127.0.0.1',port=int(sys.argv[2]),ssl_certfile=sys.argv[3],ssl_keyfile=sys.argv[4],log_level='error')"
            process = subprocess.Popen([sys.executable, "-c", code, str(Path(tmp) / "tls.sqlite3"), str(port), str(cert), str(key)], cwd=root, env=dict(os.environ, SFA_SMTP_HOST=""), stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            base = f"https://127.0.0.1:{port}"

            def request(path, body=None, headers=None):
                req = urllib.request.Request(base + path, data=None if body is None else json.dumps(body).encode(), headers={"Content-Type": "application/json", **(headers or {})})
                with urllib.request.urlopen(req, context=context, timeout=3) as response:
                    return json.load(response)

            try:
                for _ in range(100):
                    if process.poll() is not None:
                        self.fail("El servidor TLS no pudo iniciar")
                    try:
                        request("/api/status")
                        break
                    except OSError:
                        time.sleep(.1)
                else:
                    self.fail("Tiempo de inicio TLS agotado")
                resident = request("/api/residents", dict(full_name="Prueba TLS", room="Prueba", phone=""))
                token = request(f"/api/residents/{resident['id']}/location-device", {})["token"]
                self.assertTrue(request("/api/network-info")["url"].startswith("https://"))
                with connect(f"wss://127.0.0.1:{port}/ws", ssl=context, open_timeout=3) as websocket:
                    self.assertEqual(json.loads(websocket.recv(timeout=3))["type"], "status")
                    result = request("/api/location", dict(latitude=0, longitude=0, accuracy_m=5, observed_at=datetime.now(timezone.utc).isoformat()), {"Authorization": "Bearer " + token})
                    self.assertEqual(result["resident_id"], resident["id"])
                    self.assertEqual(json.loads(websocket.recv(timeout=3))["type"], "location")
            finally:
                if os.name == "nt" and process.poll() is None:
                    subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
                else:
                    process.terminate()
                try:
                    process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()

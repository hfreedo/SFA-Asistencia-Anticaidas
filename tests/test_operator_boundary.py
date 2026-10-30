import unittest
from servidor_pc.operator_boundary import OperatorBoundary


class OperatorBoundaryTests(unittest.IsolatedAsyncioTestCase):
    async def request(self, path, method="GET", client="192.0.2.10", host="192.0.2.1:8780", origin=None, websocket=False, cross_site=False):
        called, messages = [], []
        async def app(scope, receive, send):
            called.append(True)
        async def receive():
            return {"type": "http.request", "body": b""}
        async def send(message):
            messages.append(message)
        headers = [(b"host", host.encode())]
        if origin: headers.append((b"origin", origin.encode()))
        if cross_site: headers.append((b"sec-fetch-site", b"cross-site"))
        scope = {"type": "websocket" if websocket else "http", "scheme": "wss" if websocket else "https",
                 "path": path, "method": method, "headers": headers, "client": (client, 1234), "server": ("localhost", 8780)}
        await OperatorBoundary(app)(scope, receive, send)
        return bool(called), messages

    async def test_lan_cannot_manage_read_export_simulate_or_use_cloud(self):
        for path, method in [("/", "GET"), ("/api/residents", "GET"), ("/api/residents", "POST"),
                             ("/api/residents/1", "DELETE"), ("/api/profile", "PUT"),
                             ("/api/configuration/export", "GET"), ("/api/configuration/import", "POST"),
                             ("/api/simulate/fall", "POST"), ("/api/alert-action", "POST"),
                             ("/api/cloud/status", "GET"), ("/docs", "GET"), ("/acceso/acceso.html", "GET")]:
            with self.subTest(path=path, method=method):
                called, messages = await self.request(path, method)
                self.assertFalse(called)
                self.assertEqual(messages[0]["status"], 403)

    async def test_phone_routes_reach_their_own_bearer_validation(self):
        for path, method in [("/api/location", "POST"), ("/api/location/context", "GET"),
                             ("/compartir-ubicacion", "GET"), ("/static/index.js", "GET")]:
            self.assertTrue((await self.request(path, method))[0])
        self.assertFalse((await self.request("/api/location", "DELETE"))[0])

    async def test_loopback_remains_an_offline_operator(self):
        self.assertTrue((await self.request("/api/profile", "PUT", client="127.0.0.1", host="localhost:8780"))[0])
        self.assertTrue((await self.request("/api/status", client="::1", host="[::1]:8780"))[0])

    async def test_cross_origin_and_dns_rebinding_cannot_use_loopback(self):
        self.assertFalse((await self.request("/api/profile", "PUT", client="127.0.0.1", host="evil.invalid"))[0])
        self.assertFalse((await self.request("/api/profile", "PUT", client="127.0.0.1", host="localhost:8780", origin="https://evil.invalid"))[0])
        self.assertFalse((await self.request("/api/profile", "PUT", client="127.0.0.1", host="localhost:8780", cross_site=True))[0])

    async def test_websocket_never_leaks_operator_telemetry_to_lan(self):
        called, messages = await self.request("/ws", websocket=True)
        self.assertFalse(called)
        self.assertEqual(messages[0]["code"], 1008)
        self.assertTrue((await self.request("/ws", client="127.0.0.1", host="localhost:8780", websocket=True, origin="https://localhost:8780"))[0])

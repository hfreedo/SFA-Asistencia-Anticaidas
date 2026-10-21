import re
import unittest
import urllib.request
from pathlib import Path

import test_location_api as location_api


class AccessPortalTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not (Path(__file__).resolve().parents[1] / 'interfaz_web/dist-acceso/acceso.html').is_file():
            raise unittest.SkipTest('Compilar build:access para probar la copia local')
        # Reuse only the isolated server fixture, never the personal database.
        location_api.LocationApiTests.setUpClass()

    @classmethod
    def tearDownClass(cls):
        location_api.LocationApiTests.tearDownClass()

    def test_local_access_page_and_relative_assets(self):
        base = location_api.LocationApiTests.base + '/acceso/'
        with urllib.request.urlopen(base + 'acceso.html') as response:
            html = response.read().decode()
        self.assertIn('Acceso | SFA Asistencia', html)
        self.assertIn('no-referrer', html)
        self.assertIn("img-src 'self' data: https://tile.openstreetmap.org;", html)
        self.assertNotIn('sb_secret_', html)
        for resource in re.findall(r'(?:src|href)="\./([^"]+)"', html):
            with urllib.request.urlopen(base + resource) as response:
                self.assertEqual(response.status, 200)

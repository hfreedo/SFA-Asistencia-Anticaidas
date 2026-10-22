from pathlib import Path
import importlib.util
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('entrega', ROOT / 'scripts/preparar_entrega_actual.py')
entrega = importlib.util.module_from_spec(spec)
spec.loader.exec_module(entrega)


class DistributionTests(unittest.TestCase):
    def test_clean_archive(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'good.zip'
            with zipfile.ZipFile(path, 'w') as archive:
                archive.writestr('SFA/.env.example', 'SFA_SMTP_PASSWORD=')
                archive.writestr('SFA/SFA_Asistencia.exe', b'test fixture')
            entrega.validate_archive(path)

    def test_rejects_private_and_escaping_entries(self):
        names = ['../file.txt', '/file.txt', 'C:/secret.txt', 'SFA/.env',
                 'SFA/secrets/private.json', 'SFA/data/sfa.sqlite3',
                 'SFA/release.jks', 'SFA/firebase-service-account.json']
        with tempfile.TemporaryDirectory() as folder:
            for name in names:
                with self.subTest(name=name):
                    path = Path(folder) / 'bad.zip'
                    with zipfile.ZipFile(path, 'w') as archive:
                        archive.writestr(name, 'fixture')
                    with self.assertRaises(ValueError):
                        entrega.validate_archive(path)

    def test_bad_hash_does_not_create_delivery(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'release').mkdir()
            (root / 'release/test.apk').write_bytes(b'fixture')
            with self.assertRaises(ValueError):
                entrega.prepare(root, [('test.apk', '0' * 64, 'Android-debug')])
            self.assertFalse((root / 'distribucion/actual').exists())

    def test_does_not_overwrite_delivery(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / 'distribucion/actual').mkdir(parents=True)
            with self.assertRaises(FileExistsError):
                entrega.prepare(root, [])

    def test_signing_files_excluded_from_copy(self):
        for script in ('validar_android.py', 'sincronizar_fuentes_publicas.py'):
            content = (ROOT / 'scripts' / script).read_text(encoding='utf-8')
            for name in ('keystore.properties', 'signing.properties', '.jks', '.keystore'):
                self.assertIn(name, content)


if __name__ == '__main__':
    unittest.main()

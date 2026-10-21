import hashlib
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from servidor_pc.diagnostico_migracion import inspect_database


class MigrationDiagnosticTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'perfil prueba.sqlite3'
        with sqlite3.connect(self.path) as conn:
            conn.executescript('''
                CREATE TABLE residents (id INTEGER PRIMARY KEY, full_name TEXT,
                  room TEXT, phone TEXT, emergency_phone TEXT, medical_notes TEXT, photo BLOB);
                INSERT INTO residents VALUES (1,'PERSONA_PRIVADA','HABITACION_PRIVADA',
                  'TELEFONO_PRIVADO','112','NOTA_PRIVADA',x'010203');
                CREATE TABLE records (id INTEGER PRIMARY KEY);
                INSERT INTO records VALUES (1);
                CREATE TABLE resident_locations (resident_id INTEGER);
                INSERT INTO resident_locations VALUES (1);
                CREATE TABLE notification_config (telegram_token TEXT);
                INSERT INTO notification_config VALUES ('SECRETO_PRIVADO');
            ''')
        conn.close()

    def test_inventory_has_no_personal_data_or_secrets(self):
        report = inspect_database(self.path)
        self.assertTrue(report['ready_for_mapping'])
        self.assertEqual(report['counts']['residents'], 1)
        self.assertEqual(report['photos_to_preserve'], 1)
        self.assertNotIn('PRIVAD', json.dumps(report))
        self.assertEqual(len(report['warnings']), 2)

    def test_does_not_modify_database(self):
        before = hashlib.sha256(self.path.read_bytes()).digest()
        inspect_database(self.path)
        self.assertEqual(before, hashlib.sha256(self.path.read_bytes()).digest())

    def test_missing_database_is_not_created(self):
        missing = self.path.parent / 'missing.sqlite3'
        with self.assertRaises(FileNotFoundError):
            inspect_database(missing)
        self.assertFalse(missing.exists())

    def test_incomplete_schema_blocks_mapping(self):
        with sqlite3.connect(self.path) as conn:
            conn.execute('DROP TABLE residents')
        conn.close()
        self.assertFalse(inspect_database(self.path)['ready_for_mapping'])


if __name__ == '__main__':
    unittest.main()

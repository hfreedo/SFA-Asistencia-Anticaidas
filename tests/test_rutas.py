from pathlib import Path
import tempfile
import unittest
from servidor_pc.rutas import application_home, database_path


class StoragePathTests(unittest.TestCase):
    def test_project_sources_and_packaged_exe_share_database(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder).resolve()
            (root / 'servidor_pc').mkdir()
            (root / 'servidor_pc/main.py').touch()
            (root / 'sfa_portable.py').touch()
            for exe in (root / 'dist/SFA_Centro.exe', root / 'dist/actualizado/SFA_Asistencia.exe'):
                home = application_home(exe, '/unused', True)
                self.assertEqual(home, root.resolve())
                self.assertEqual(database_path(home), root / 'servidor_pc/sfa_eventos.sqlite3')

    def test_standalone_portable_keeps_data_next_to_exe(self):
        with tempfile.TemporaryDirectory() as folder:
            home = application_home(Path(folder) / 'SFA_Centro.exe', '/unused', True)
            self.assertEqual(database_path(home), Path(folder).resolve() / 'data/sfa_eventos.sqlite3')

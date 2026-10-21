"""Create consistent private snapshots; never overwrite or merge databases."""
from datetime import datetime
from pathlib import Path
import sqlite3
import uuid

root = Path(__file__).resolve().parents[1]
folder = root / 'copias_privadas' / ('unificacion-' + datetime.now().strftime('%Y%m%d-%H%M%S') + '-' + uuid.uuid4().hex[:6])
folder.mkdir(parents=True)
for relative in ('servidor_pc/sfa_eventos.sqlite3', 'dist/data/sfa_eventos.sqlite3'):
    path = root / relative
    if path.is_file():
        source = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)
        destination = sqlite3.connect(folder / (relative.replace('/', '-') ))
        try:
            source.backup(destination)
            print(relative, 'profiles:', source.execute('select count(*) from residents').fetchone()[0])
        finally:
            destination.close()
            source.close()
print('Private backups:', folder)

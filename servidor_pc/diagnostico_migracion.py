"""Read-only inventory; never exports resident values, photos or credentials."""
from __future__ import annotations

import argparse
import json
import sqlite3
from pathlib import Path


TABLES = (
    'residents', 'geofence_config', 'resident_geofences',
    'notification_config', 'records', 'resident_locations', 'location_events',
)
REQUIRED = {'id', 'full_name', 'room', 'phone', 'emergency_phone', 'medical_notes'}


def inspect_database(path: Path) -> dict:
    path = path.resolve(strict=True)
    conn = sqlite3.connect(path.as_uri() + '?mode=ro', uri=True)
    try:
        conn.execute('PRAGMA query_only=ON')
        conn.execute('BEGIN')
        existing = {r[0] for r in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        counts = {}
        for table in TABLES:
            if table in existing:
                counts[table] = conn.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]
        columns = {r[1] for r in conn.execute('PRAGMA table_info(residents)')}
        warnings = []
        missing = sorted(REQUIRED - columns)
        if missing:
            warnings.append('El esquema de residentes requiere revision antes de migrar.')
        photos = 0
        if 'photo' in columns:
            photos = conn.execute('SELECT count(*) FROM residents WHERE photo IS NOT NULL AND length(photo)>0').fetchone()[0]
        if counts.get('records', 0):
            warnings.append('Los registros antiguos no tienen residente asociado: no asignarlos automaticamente.')
        if counts.get('resident_locations', 0):
            warnings.append('Solo existe la ultima posicion; no es posible reconstruir recorridos anteriores.')
        return {
            'format': 'sfa-migration-diagnostic', 'version': 1,
            'read_only': True, 'cloud_connected': False,
            'counts': counts, 'photos_to_preserve': photos,
            'missing_resident_columns': missing,
            'ready_for_mapping': not missing,
            'warnings': warnings,
            'next_step': 'Crear copia privada y validar mapeo; este diagnostico no importa datos.',
        }
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--database', type=Path,
                        default=Path(__file__).resolve().parent / 'sfa_eventos.sqlite3')
    args = parser.parse_args()
    try:
        result = inspect_database(args.database)
    except (OSError, sqlite3.Error):
        parser.exit(1, 'No se pudo leer la base. Comprueba que exista y sea una base SQLite valida.\n')
    print(json.dumps(result, indent=2, ensure_ascii=True))


if __name__ == '__main__':
    main()

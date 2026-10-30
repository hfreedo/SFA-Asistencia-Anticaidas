"""Compare a private SQLite backup against the upgraded local database, read-only."""
import argparse
import sqlite3
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('backup', type=Path)
parser.add_argument('current', type=Path)
args = parser.parse_args()

def quoted(name):
    return '"' + name.replace('"', '""') + '"'

with sqlite3.connect(args.backup.resolve().as_uri() + '?mode=ro', uri=True) as old, sqlite3.connect(args.current.resolve().as_uri() + '?mode=ro', uri=True) as current:
    assert current.execute('pragma integrity_check').fetchone()[0] == 'ok'
    tables = [row[0] for row in old.execute("select name from sqlite_master where type='table' and name not like 'sqlite_%'")]
    for table in tables:
        name = quoted(table)
        before = old.execute(f'select count(*) from {name}').fetchone()[0]
        after = current.execute(f'select count(*) from {name}').fetchone()[0]
        assert after >= before, f'Record count decreased: {table}'
        columns = [row[1] for row in old.execute(f'pragma table_info({name})')]
        if 'id' in columns:
            ids = {row[0] for row in old.execute(f'select id from {name}')}
            assert ids <= {row[0] for row in current.execute(f'select id from {name}')}, f'Missing records: {table}'
        if table == 'residents':
            fields = ','.join(map(quoted, columns))
            assert set(old.execute(f'select {fields} from {name}')) <= set(current.execute(f'select {fields} from {name}')), 'Resident details changed'
    print(f'PASS: SQLite integrity, {len(tables)} existing tables and record IDs preserved; resident details unchanged. No personal data printed.')

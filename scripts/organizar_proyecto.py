"""Archive named old artifacts without deleting data or moving current sources."""
from pathlib import Path
import argparse
import json
import shutil

ROOT = Path(__file__).resolve().parents[1]


def plan(root):
    root = root.resolve()
    archive = root / '_archivo' / '2026-10-21'
    items = []
    for name in ('actualizado', 'corregido', 'fcm'):
        items.append((root / 'dist' / name, archive / 'compilaciones' / name))
    items.append((root / 'dist/SFA_Asistencia.exe', archive / 'compilaciones/SFA_Asistencia-rc2.exe'))
    for name in ('SFA_Asistencia', 'fcm'):
        items.append((root / 'build' / name, archive / 'build' / name))
    for pattern in ('*rc1*', '*rc2*', '*v1.1.0*', 'validation-*', 'verificacion-remota-1.2.0-rc*'):
        for source in (root / 'release').glob(pattern):
            if 'rc3' not in source.name:
                items.append((source, archive / 'entregas' / source.name))
    for pattern in ('firebase-*.png', 'google-cloud-*.png'):
        for source in root.glob(pattern):
            items.append((source, root / 'copias_privadas/evidencias_servicios' / source.name))
    result = []
    seen = set()
    for source, target in items:
        source, target = source.resolve(), target.resolve()
        if not source.is_relative_to(root) or not target.is_relative_to(root) or source == root:
            raise ValueError('Archive path escapes project')
        if source.exists() and source not in seen:
            if source.is_symlink() or target.exists():
                raise ValueError('Symlink or existing destination: ' + str(source))
            seen.add(source)
            result.append((source, target))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    moves = plan(ROOT)
    for source, target in moves:
        print(f'{source} -> {target}')
    if not args.apply:
        print('Dry run. No files moved.')
        return
    records = []
    for source, target in moves:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(source), str(target))
        records.append({'from': str(source.relative_to(ROOT)), 'to': str(target.relative_to(ROOT))})
    manifest = ROOT / '_archivo/2026-10-21/movimientos.json'
    manifest.parent.mkdir(parents=True, exist_ok=True)
    old = json.loads(manifest.read_text(encoding='utf-8')) if manifest.exists() else []
    manifest.write_text(json.dumps(old + records, indent=2), encoding='utf-8')
    print(f'Archived {len(records)} named artifacts. No files deleted.')


if __name__ == '__main__':
    main()

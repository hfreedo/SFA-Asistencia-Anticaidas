"""Publish only the static access build; never push the working checkout."""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = 'hfreedo/SFA-Asistencia-Anticaidas'
BRANCH = 'codex/portal-acceso'
ALLOWED = {'.html', '.js', '.css', '.woff', '.woff2', '.png', '.svg'}


def run(args, data=None):
    result = subprocess.run(args, input=data, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, check=True)
    return result.stdout.decode().strip()


def api(path):
    return json.loads(run(['gh', 'api', path]))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--publish', action='store_true')
    args = parser.parse_args()
    build = ROOT / 'interfaz_web' / 'dist-acceso'
    files = {p.relative_to(build).as_posix(): p.read_bytes()
             for p in build.rglob('*') if p.is_file()}
    if 'acceso.html' not in files:
        parser.error('Compilar primero con npm run build:access')
    for name, content in files.items():
        if Path(name).suffix not in ALLOWED or any(part.startswith('.') for part in Path(name).parts):
            parser.error('Archivo no permitido en el portal: ' + name)
        if re.search(rb'sb_secret_[A-Za-z0-9_-]{12,}', content) or b'BEGIN PRIVATE KEY' in content:
            parser.error('El paquete contiene un posible secreto; publicacion cancelada')
    files['index.html'] = files['acceso.html']
    files['.nojekyll'] = b''
    print(json.dumps({'files': len(files), 'bytes': sum(map(len, files.values())),
                      'branch': BRANCH, 'published': False}))
    if not args.publish:
        return
    try:
        parent = api(f'repos/{REPOSITORY}/git/ref/heads/{BRANCH}')['object']['sha']
    except subprocess.CalledProcessError:
        # Only a confirmed 404 means this branch is new.
        error = subprocess.run(['gh', 'api', f'repos/{REPOSITORY}/git/ref/heads/{BRANCH}'],
                               capture_output=True, text=True)
        if 'HTTP 404' not in error.stderr:
            raise RuntimeError('No se pudo verificar la rama remota')
        parent = None
    with tempfile.TemporaryDirectory(prefix='sfa-portal-git-') as folder:
        run(['git', 'init', '--bare', folder])
        git = ['git', '--git-dir', folder]
        if parent:
            run(git + ['fetch', f'https://github.com/{REPOSITORY}.git', f'refs/heads/{BRANCH}'])
        tree = {}
        for name, content in files.items():
            node = tree
            parts = name.split('/')
            for part in parts[:-1]:
                node = node.setdefault(part, {})
            node[parts[-1]] = run(git + ['hash-object', '-w', '--stdin'], content)

        def write_tree(node):
            records = []
            for name, value in sorted(node.items()):
                if isinstance(value, dict):
                    records.append(f'040000 tree {write_tree(value)}\t{name}\n')
                else:
                    records.append(f'100644 blob {value}\t{name}\n')
            return run(git + ['mktree'], ''.join(records).encode())

        login = api('user')['login']
        command = git + ['-c', f'user.name={login}', '-c',
                         f'user.email={login}@users.noreply.github.com',
                         'commit-tree', write_tree(tree)]
        if parent:
            command.extend(['-p', parent])
        commit = run(command + ['-m', 'Publica portal de acceso SFA sin datos personales'])
        run(git + ['push', f'https://github.com/{REPOSITORY}.git', f'{commit}:refs/heads/{BRANCH}'])
    print(json.dumps({'published': True, 'branch': BRANCH, 'commit': commit}))


if __name__ == '__main__':
    main()

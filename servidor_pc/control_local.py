"""Per-instance shutdown capability shared only through the local user profile."""
import json
import os
from pathlib import Path
import secrets
import tempfile
from contextlib import contextmanager


def control_path(port):
    base = Path(os.getenv('LOCALAPPDATA', tempfile.gettempdir())) / 'SFAAsistencia' / 'runtime'
    return base / f'server-{port}.json'


@contextmanager
def server_control(app, server, port, url):
    path = control_path(port)
    path.parent.mkdir(parents=True, exist_ok=True)
    token = secrets.token_urlsafe(32)
    app.state.local_shutdown = (token, server)
    temporary = path.with_suffix(f'.{os.getpid()}.tmp')
    temporary.write_text(json.dumps({'url': url, 'token': token}), encoding='utf-8')
    temporary.replace(path)
    try:
        yield
    finally:
        app.state.local_shutdown = None
        try:
            if json.loads(path.read_text(encoding='utf-8')).get('token') == token:
                path.unlink()
        except (OSError, ValueError):
            pass


def read_control(port, url):
    try:
        data = json.loads(control_path(port).read_text(encoding='utf-8'))
        token = data.get('token')
        if data.get('url') == url and isinstance(token, str) and 32 <= len(token) <= 128:
            return token
    except (OSError, ValueError, AttributeError):
        pass
    return None

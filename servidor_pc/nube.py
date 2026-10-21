"""Durable outbox. User JWTs live in memory only; no privileged cloud key."""
from __future__ import annotations

import json
import math
import os
import sqlite3
import threading
import time
import urllib.error
import urllib.request
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

DEFAULT_URL = 'https://lxymfaoraayccmxwiubw.supabase.co'
DEFAULT_KEY = 'sb_publishable_tlHmnEy5vrZghpCDtuehjg_IpGtEn4S'


class CloudError(Exception):
    def __init__(self, status=503, code='unavailable'):
        self.status = status
        self.code = code
        super().__init__('cloud_' + str(status))


class CloudSync:
    def __init__(self, db_path, transport=None):
        self.db_path = db_path
        self.transport = transport or self._http
        self.session = None
        self.session_lock = threading.Lock()
        self.send_lock = threading.Lock()

    @contextmanager
    def connection(self):
        conn = sqlite3.connect(self.db_path(), timeout=10)
        conn.row_factory = sqlite3.Row
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def init_db(self):
        with self.connection() as conn:
            conn.executescript('''
              CREATE TABLE IF NOT EXISTS cloud_installation (id INTEGER PRIMARY KEY CHECK(id=1), uuid TEXT NOT NULL);
              CREATE TABLE IF NOT EXISTS cloud_bindings (
                local_resident_id INTEGER PRIMARY KEY, resident_id TEXT NOT NULL,
                device_id TEXT NOT NULL, space_id TEXT NOT NULL, owner_id TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1, last_sample_at REAL NOT NULL DEFAULT 0);
              CREATE TABLE IF NOT EXISTS cloud_outbox (
                id TEXT PRIMARY KEY, local_resident_id INTEGER NOT NULL, device_id TEXT NOT NULL,
                owner_id TEXT NOT NULL, kind TEXT NOT NULL, observed_at TEXT NOT NULL,
                payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
                attempts INTEGER NOT NULL DEFAULT 0, next_attempt REAL NOT NULL DEFAULT 0,
                last_error TEXT, sent_at TEXT);
              CREATE INDEX IF NOT EXISTS cloud_outbox_pending ON cloud_outbox(status,next_attempt);
            ''')
            conn.execute('INSERT OR IGNORE INTO cloud_installation VALUES (1,?)', (str(uuid.uuid4()),))

    def _http(self, path, token, body=None):
        url = os.getenv('SFA_SUPABASE_URL', DEFAULT_URL).rstrip('/')
        key = os.getenv('SFA_SUPABASE_PUBLISHABLE_KEY', DEFAULT_KEY)
        if url != DEFAULT_URL or not key.startswith('sb_publishable_'):
            raise CloudError(503)
        req = urllib.request.Request(url + path, headers={
            'apikey': key, 'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'},
            data=None if body is None else json.dumps(body, allow_nan=False).encode())
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                return json.load(response)
        except urllib.error.HTTPError as exc:
            # Retain only a bounded provider code, never its message or headers.
            code = 'http'
            try:
                value = json.loads(exc.read(4096)).get('code', '')
                if isinstance(value, str) and 1 <= len(value) <= 24 and value.isascii() and value.replace('_', '').isalnum():
                    code = value
            except (ValueError, AttributeError):
                pass
            raise CloudError(exc.code, code) from None
        except TimeoutError:
            raise CloudError(503, 'timeout') from None
        except (OSError, ValueError):
            raise CloudError(503, 'network_or_response') from None

    def authenticate(self, token):
        if not token or len(token)>16384:
            raise CloudError(401)
        user = self.transport('/auth/v1/user', token)
        try:
            owner = str(uuid.UUID(user['id']))
        except (KeyError, ValueError, TypeError):
            raise CloudError(401) from None
        with self.session_lock:
            self.session = (owner, token)
        return owner

    def connect(self, token, local_id, space_id):
        try:
            owner = self.authenticate(token)
        except CloudError as exc:
            raise CloudError(exc.status, 'auth_' + exc.code) from None
        with self.connection() as conn:
            resident = conn.execute('SELECT full_name,room FROM residents WHERE id=?', (local_id,)).fetchone()
            installation = conn.execute('SELECT uuid FROM cloud_installation WHERE id=1').fetchone()[0]
        if not resident:
            raise CloudError(404)
        try:
            linked = self.transport('/rest/v1/rpc/sfa_link_pc', token, {
                'p_installation': installation, 'p_local_resident': local_id,
                'p_space': str(uuid.UUID(space_id)), 'p_name': resident['full_name'], 'p_room': resident['room']})
        except CloudError as exc:
            raise CloudError(exc.status, 'link_' + exc.code) from None
        try:
            ids = [str(uuid.UUID(linked[key])) for key in ('resident_id','device_id','space_id')]
            if ids[2] != str(uuid.UUID(space_id)):
                raise ValueError()
        except (KeyError, TypeError, ValueError):
            raise CloudError(503, 'link_response') from None
        with self.connection() as conn:
            old = conn.execute('SELECT device_id FROM cloud_bindings WHERE local_resident_id=?', (local_id,)).fetchone()
            if old and old['device_id'] != ids[1]:
                raise CloudError(409)
            conn.execute('''INSERT INTO cloud_bindings(local_resident_id,resident_id,device_id,space_id,owner_id)
              VALUES(?,?,?,?,?) ON CONFLICT(local_resident_id) DO UPDATE SET enabled=1,owner_id=excluded.owner_id''',
              (local_id,*ids,owner))
        return self.status()

    def pause(self):
        with self.session_lock:
            self.session = None

    def status(self):
        with self.session_lock:
            owner = self.session[0] if self.session else None
        with self.connection() as conn:
            counts = {r[0]:r[1] for r in conn.execute('SELECT status,count(*) FROM cloud_outbox GROUP BY status')}
            links = [dict(r) for r in conn.execute('SELECT local_resident_id,resident_id,device_id,space_id,enabled FROM cloud_bindings')]
            last_error = conn.execute("SELECT last_error FROM cloud_outbox WHERE last_error IS NOT NULL ORDER BY rowid DESC LIMIT 1").fetchone()
        return {'session_active': owner is not None, 'bindings': links,
                'pending': counts.get('pending',0), 'sent': counts.get('sent',0),
                'blocked': counts.get('blocked',0), 'last_error': last_error[0] if last_error else None}

    def capture(self, conn, payload, local_id):
        kind = payload.get('type')
        if kind not in ('event','telemetry') or not local_id:
            return
        if kind == 'event' and str(payload.get('event_type','')).startswith(('GEOCERCA_', 'UBICACION_')):
            return
        binding = conn.execute('SELECT device_id,owner_id,last_sample_at FROM cloud_bindings WHERE local_resident_id=? AND enabled=1', (local_id,)).fetchone()
        if not binding:
            return
        now = time.time()
        if kind == 'telemetry' and now - binding[2] < 2:
            return
        observed = payload.get('received_at') or datetime.now(timezone.utc).isoformat()
        try:
            parsed = datetime.fromisoformat(observed)
            if parsed.tzinfo is None:
                return
        except (ValueError, TypeError):
            return
        fields = ('state','accel_g','tilt_deg','motion','fall_count') if kind=='telemetry' else ('event_type','detail')
        body = {k:payload[k] for k in fields if payload.get(k) is not None}
        for value in body.values():
            if isinstance(value,float) and not math.isfinite(value):
                return
        if kind=='event':
            body['detail'] = str(body.get('detail',''))[:1000]
        body['simulated'] = bool(payload.get('simulated', False))
        conn.execute('''INSERT INTO cloud_outbox(id,local_resident_id,device_id,owner_id,kind,observed_at,payload)
          VALUES(?,?,?,?,?,?,?)''', (str(uuid.uuid4()),local_id,binding[0],binding[1],kind,observed,json.dumps(body,allow_nan=False)))
        if kind=='telemetry':
            conn.execute('UPDATE cloud_bindings SET last_sample_at=? WHERE local_resident_id=?', (now,local_id))

    def flush(self):
        if not self.send_lock.acquire(blocking=False):
            return
        try:
            with self.session_lock:
                session = self.session
            if not session:
                return
            owner, token = session
            with self.connection() as conn:
                first = conn.execute("SELECT device_id FROM cloud_outbox WHERE status='pending' AND owner_id=? AND next_attempt<=? ORDER BY rowid LIMIT 1", (owner,time.time())).fetchone()
                if not first:
                    return
                rows = conn.execute("SELECT * FROM cloud_outbox WHERE status='pending' AND owner_id=? AND device_id=? AND next_attempt<=? ORDER BY rowid LIMIT 50", (owner,first[0],time.time())).fetchall()
            batch = [dict(id=r['id'],kind=r['kind'],observed_at=r['observed_at'],payload=json.loads(r['payload'])) for r in rows]
            try:
                result = self.transport('/rest/v1/rpc/sfa_ingest_pc',token,{'p_device':first[0],'p_batch':batch})
                acknowledged = result.get('accepted') if isinstance(result,dict) else None
                if not isinstance(acknowledged,list) or not all(isinstance(value,str) for value in acknowledged) or set(acknowledged) != {r['id'] for r in rows}:
                    raise CloudError()
            except CloudError as exc:
                if exc.status in (401,403):
                    with self.session_lock:
                        if self.session == session:
                            self.session = None
                permanent = exc.status in (400,404,409,422)
                with self.connection() as conn:
                    for row in rows:
                        delay = min(300, 2 ** min(row['attempts']+1,8))
                        conn.execute('UPDATE cloud_outbox SET attempts=attempts+1,next_attempt=?,last_error=?,status=? WHERE id=?',
                          (time.time()+delay,str(exc),'blocked' if permanent else 'pending',row['id']))
                return
            with self.connection() as conn:
                for row in rows:
                    conn.execute("UPDATE cloud_outbox SET status='sent',sent_at=?,last_error=NULL WHERE id=?", (datetime.now(timezone.utc).isoformat(),row['id']))
        finally:
            self.send_lock.release()

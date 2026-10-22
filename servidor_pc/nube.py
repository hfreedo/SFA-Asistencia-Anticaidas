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
        self.push_error = None
        self.push_sender = None

    def flush_push(self, token):
        path = os.getenv('SFA_FCM_CREDENTIALS_FILE', '')
        if not path:
            return
        try:
            from .fcm import FcmSender
            if self.push_sender is None:
                self.push_sender = FcmSender(path)
            try:
                jobs = self.transport('/rest/v1/rpc/sfa_claim_push_v2', token, {})
            except CloudError as exc:
                if exc.status != 404:
                    raise
                jobs = self.transport('/rest/v1/rpc/sfa_claim_push', token, {})
            if not isinstance(jobs, list) or len(jobs) > 10:
                raise ValueError('push_response')
            for job in jobs:
                outcome = self.push_sender.send(job)
                self.transport('/rest/v1/rpc/sfa_ack_push', token, {
                    'p_id': job['id'], 'p_lease': job['lease'], 'p_outcome': outcome})
            self.push_error = None
        except Exception:
            # A push failure must never block storage/synchronization of sensor evidence.
            self.push_error = 'push_unavailable'

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

    def _bound_session(self, local_id):
        with self.session_lock:
            session = self.session
        if not session:
            raise CloudError(401, 'session_required')
        owner, token = session
        with self.connection() as conn:
            binding = conn.execute('SELECT resident_id FROM cloud_bindings WHERE local_resident_id=? AND owner_id=? AND enabled=1',
                                   (local_id, owner)).fetchone()
        if not binding:
            raise CloudError(404, 'resident_not_linked')
        resident = str(uuid.UUID(binding[0]))
        return session, resident

    def remote_geofence(self, local_id, values=None):
        session, resident = self._bound_session(local_id)
        body = {'p_resident': resident}
        if values is not None:
            body.update(values)
        result = self.transport('/rest/v1/rpc/' + ('sfa_save_geofence' if values is not None else 'sfa_get_geofence'), session[1], body)
        with self.session_lock:
            if self.session != session:
                raise CloudError(401, 'session_changed')
        if not isinstance(result, dict) or not isinstance(result.get('can_configure'), bool):
            raise CloudError(503, 'geofence_response')
        zone = result.get('geofence')
        if zone is not None:
            try:
                zone = {key: zone[key] for key in ('home_lat','home_lng','radius_m','address_name','updated_at')}
                if not (-90 <= zone['home_lat'] <= 90 and -180 <= zone['home_lng'] <= 180 and 5 <= zone['radius_m'] <= 100000):
                    raise ValueError()
                if not isinstance(zone['address_name'], str) or len(zone['address_name']) > 100:
                    raise ValueError()
                stamp = datetime.fromisoformat(zone['updated_at'].replace('Z', '+00:00'))
                if stamp.tzinfo is None: raise ValueError()
            except (TypeError, KeyError, ValueError, AttributeError):
                raise CloudError(503, 'geofence_response') from None
        return {'can_configure': result['can_configure'], 'geofence': zone}

    def remote_location(self, local_id):
        session, resident = self._bound_session(local_id)
        owner, token = session
        # RLS is checked on every request. Never mirror private GPS into the LAN database.
        people = self.transport('/rest/v1/sfa_residents?select=id&id=eq.' + resident + '&archived_at=is.null', token)
        if not isinstance(people, list) or not any(p.get('id') == resident for p in people if isinstance(p, dict)):
            raise CloudError(403, 'resident_access')
        rows = self.transport('/rest/v1/sfa_positions?select=latitude,longitude,accuracy_m,observed_at&resident_id=eq.'
                              + resident + '&simulated=eq.false&order=observed_at.desc&limit=1', token)
        with self.session_lock:
            if self.session != session:
                raise CloudError(401, 'session_changed')
        if not isinstance(rows, list):
            raise CloudError(503, 'position_response')
        position = None
        if rows:
            try:
                row = rows[0]
                lat, lng, accuracy = (float(row[k]) for k in ('latitude', 'longitude', 'accuracy_m'))
                stamp = datetime.fromisoformat(row['observed_at'].replace('Z', '+00:00'))
                if not all(math.isfinite(v) for v in (lat, lng, accuracy)) or not (-90 <= lat <= 90 and -180 <= lng <= 180 and 0 < accuracy <= 10000) or stamp.tzinfo is None:
                    raise ValueError()
                position = dict(latitude=lat, longitude=lng, accuracy_m=accuracy, observed_at=stamp.isoformat())
            except (ValueError, KeyError, TypeError, AttributeError):
                raise CloudError(503, 'position_response') from None
        return {'source': 'supabase', 'resident_id': local_id, 'remote_resident_id': resident, 'position': position}

    def remote_incidents(self, local_id, action=None):
        session, resident = self._bound_session(local_id)
        snapshot = self.transport('/rest/v1/rpc/sfa_incidents', session[1], {'p_resident': resident})
        if not isinstance(snapshot, dict) or not isinstance(snapshot.get('events'), list):
            raise CloudError(503, 'incident_response')
        if action is not None:
            if not any(isinstance(event, dict) and event.get('id') == action['p_event'] for event in snapshot['events']):
                raise CloudError(404, 'incident_not_linked')
            with self.session_lock:
                if self.session != session: raise CloudError(401, 'session_changed')
            self.transport('/rest/v1/rpc/sfa_attend_incident', session[1], action)
            snapshot = self.transport('/rest/v1/rpc/sfa_incidents', session[1], {'p_resident': resident})
        with self.session_lock:
            if self.session != session: raise CloudError(401, 'session_changed')
        try:
            if not isinstance(snapshot.get('can_attend'), bool): raise ValueError()
            events = []
            for event in snapshot['events']:
                events.append({
                    'id': str(uuid.UUID(event['id'])), 'event_type': str(event['event_type'])[:40],
                    'observed_at': str(event['observed_at'])[:64], 'simulated': bool(event['simulated']),
                    'detail': {'text': str(event.get('detail', {}).get('text', ''))[:1000]},
                    'actor_id': event.get('actor_id'), 'outcome': event.get('outcome'), 'updated_at': event.get('updated_at'),
                })
            zone = snapshot.get('zone_status')
            if zone is not None:
                if (not isinstance(zone, dict) or zone.get('state') not in
                        ('inside','outside','uncertain','imprecise','stale','unknown','unconfigured')
                        or zone.get('last_confirmed') not in ('inside','outside','unknown')):
                    raise ValueError()
                stamp = zone.get('observed_at')
                if stamp is not None and (not isinstance(stamp, str) or datetime.fromisoformat(stamp.replace('Z','+00:00')).tzinfo is None):
                    raise ValueError()
                zone = {'state':zone['state'], 'last_confirmed':zone['last_confirmed'], 'observed_at':stamp}
            return {'viewer_id': session[0], 'can_attend': snapshot['can_attend'], 'events': events, 'zone_status':zone}
        except (ValueError, KeyError, TypeError, AttributeError):
            raise CloudError(503, 'incident_response') from None

    def status(self):
        with self.session_lock:
            owner = self.session[0] if self.session else None
        with self.connection() as conn:
            counts = {r[0]:r[1] for r in conn.execute('SELECT status,count(*) FROM cloud_outbox GROUP BY status')}
            links = [dict(r) for r in conn.execute('SELECT local_resident_id,resident_id,device_id,space_id,enabled FROM cloud_bindings')]
            last_error = conn.execute("SELECT last_error FROM cloud_outbox WHERE last_error IS NOT NULL ORDER BY rowid DESC LIMIT 1").fetchone()
        return {'session_active': owner is not None, 'bindings': links,
                'pending': counts.get('pending',0), 'sent': counts.get('sent',0),
                'blocked': counts.get('blocked',0), 'last_error': last_error[0] if last_error else None,
                'push': {'configured': bool(os.getenv('SFA_FCM_CREDENTIALS_FILE')), 'last_error': self.push_error}}

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
            self.flush_push(token)
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

"""Optional FCM HTTP v1 sender. Credentials stay on the trusted PC, never in APK."""
from __future__ import annotations

import base64
import json
import time
import urllib.error
import urllib.request
import uuid
from datetime import datetime
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

PROJECT = 'sfa-asistencia'
OAUTH_URL = 'https://oauth2.googleapis.com/token'
SEND_URL = f'https://fcm.googleapis.com/v1/projects/{PROJECT}/messages:send'


class FcmUnavailable(Exception):
    pass


def _http(url, headers, body):
    request = urllib.request.Request(url, headers=headers, data=body)
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            raw = response.read(65537)
            if len(raw) > 65536:
                raise FcmUnavailable('response_limit')
            return response.status, json.loads(raw)
    except urllib.error.HTTPError as error:
        try:
            return error.code, json.loads(error.read(65536))
        except (ValueError, OSError):
            return error.code, {}
    except (OSError, ValueError):
        raise FcmUnavailable('network') from None


def _encode(value):
    raw = json.dumps(value, separators=(',', ':')).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b'=').decode()


class FcmSender:
    def __init__(self, credentials_path, transport=None):
        path = Path(credentials_path)
        if path.stat().st_size > 32768:
            raise FcmUnavailable('credential_limit')
        value = json.loads(path.read_text(encoding='utf-8'))
        if value.get('type') != 'service_account' or value.get('project_id') != PROJECT:
            raise FcmUnavailable('credential_project')
        email = value.get('client_email', '')
        if not isinstance(email, str) or not email.endswith('@sfa-asistencia.iam.gserviceaccount.com'):
            raise FcmUnavailable('credential_identity')
        self.email = email
        self.key = serialization.load_pem_private_key(value['private_key'].encode(), password=None)
        if not isinstance(self.key, rsa.RSAPrivateKey) or self.key.key_size < 2048:
            raise FcmUnavailable('credential_key')
        self.transport = transport or _http
        self.access_token = None
        self.expires = 0

    def _access(self):
        now = time.time()
        if self.access_token and self.expires > now + 60:
            return self.access_token
        unsigned = _encode({'alg': 'RS256', 'typ': 'JWT'}) + '.' + _encode({
            'iss': self.email, 'scope': 'https://www.googleapis.com/auth/firebase.messaging',
            'aud': OAUTH_URL, 'iat': int(now), 'exp': int(now) + 3600})
        signature = self.key.sign(unsigned.encode(), padding.PKCS1v15(), hashes.SHA256())
        assertion = unsigned + '.' + base64.urlsafe_b64encode(signature).rstrip(b'=').decode()
        from urllib.parse import urlencode
        status, result = self.transport(OAUTH_URL, {'Content-Type': 'application/x-www-form-urlencoded'},
            urlencode({'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer', 'assertion': assertion}).encode())
        token = result.get('access_token')
        if status != 200 or not isinstance(token, str) or not 20 <= len(token) <= 16384:
            raise FcmUnavailable('oauth')
        self.access_token = token
        self.expires = now + min(3600, max(0, int(result.get('expires_in', 0))))
        return token

    def send(self, job):
        event_id = str(uuid.UUID(job['event_id']))
        observed = datetime.fromisoformat(job['observed_at'].replace('Z', '+00:00'))
        if observed.tzinfo is None:
            raise FcmUnavailable('timestamp')
        if not -30 <= time.time() - observed.timestamp() <= 300:
            return 'expired'
        token = job['token']
        if not isinstance(token, str) or not 20 <= len(token) <= 4096:
            raise FcmUnavailable('token')
        body = {'message': {'token': token, 'data': {
            'event_id': event_id, 'observed_at_ms': str(int(observed.timestamp() * 1000))},
            'android': {'priority': 'high', 'ttl': '300s'}}}
        status, result = self.transport(SEND_URL, {'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + self._access()}, json.dumps(body).encode())
        if status == 200 and isinstance(result.get('name'), str):
            return 'sent'  # FCM accepted, NOT proof that a phone displayed it.
        if status == 401:
            self.access_token = None
        details = result.get('error', {}).get('details', [])
        if isinstance(details, list) and any(isinstance(d, dict)
            and d.get('@type') == 'type.googleapis.com/google.firebase.fcm.v1.FcmError'
            and d.get('errorCode') == 'UNREGISTERED' for d in details):
            return 'invalid'
        return 'retry'

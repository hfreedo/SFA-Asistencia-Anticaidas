import base64
import json
import tempfile
import time
import unittest
import uuid
from datetime import datetime, timezone
from pathlib import Path

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from servidor_pc.fcm import FcmSender, FcmUnavailable, OAUTH_URL, SEND_URL


class FcmTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.addCleanup(self.folder.cleanup)
        self.path = Path(self.folder.name) / 'fixture.json'
        self.key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        self.path.write_text(json.dumps({'type':'service_account','project_id':'sfa-asistencia',
            'client_email':'fixture@sfa-asistencia.iam.gserviceaccount.com',
            'private_key':self.key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()).decode()}))
        self.job = {'event_id':str(uuid.uuid4()),'token':'fixture_token_abcdefghijklmnop',
            'observed_at':datetime.now(timezone.utc).isoformat()}

    def test_oauth_signature_and_minimal_payload_and_cache(self):
        calls=[]
        def transport(url, headers, body):
            calls.append(url)
            if url==OAUTH_URL:
                from urllib.parse import parse_qs
                assertion=parse_qs(body.decode())['assertion'][0]
                a,b,c=assertion.split('.')
                self.key.public_key().verify(base64.urlsafe_b64decode(c+'=='),(a+'.'+b).encode(),padding.PKCS1v15(),hashes.SHA256())
                claims=json.loads(base64.urlsafe_b64decode(b+'=='))
                self.assertEqual(claims['aud'],OAUTH_URL)
                self.assertLessEqual(claims['exp']-claims['iat'],3600)
                return 200,{'access_token':'fixture_access_token_abcdefghijklmnop','expires_in':3600}
            self.assertEqual(url,SEND_URL)
            payload=json.loads(body)['message']
            self.assertEqual(set(payload['data']),{'event_id','observed_at_ms'})
            self.assertNotIn('notification',payload)
            return 200,{'name':'projects/sfa-asistencia/messages/fixture'}
        sender=FcmSender(self.path,transport)
        self.assertEqual(sender.send(self.job),'sent')
        self.assertEqual(sender.send(self.job),'sent')
        self.assertEqual(calls.count(OAUTH_URL),1)

    def test_only_unregistered_revokes_token(self):
        for response,expected in [(400,'retry'),(429,'retry'),(503,'retry')]:
            sender=FcmSender(self.path,lambda *args:(response,{}))
            sender.access_token='fixture_access_token'; sender.expires=time.time()+3600
            self.assertEqual(sender.send(self.job),expected)
        sender.transport=lambda *args:(404,{'error':{'details':[{'@type':'type.googleapis.com/google.firebase.fcm.v1.FcmError','errorCode':'UNREGISTERED'}]}})
        self.assertEqual(sender.send(self.job),'invalid')

    def test_expired_never_contacts_google(self):
        self.job['observed_at']='2020-01-01T00:00:00+00:00'
        sender=FcmSender(self.path,lambda *args:self.fail('Unexpected network'))
        self.assertEqual(sender.send(self.job),'expired')

    def test_test_delivery_is_explicitly_labelled(self):
        def transport(url, headers, body):
            payload=json.loads(body)['message']['data']
            self.assertEqual(payload['is_test'],'true')
            self.assertNotIn('resident_id',payload)
            return 200,{'name':'projects/sfa-asistencia/messages/fixture-test'}
        sender=FcmSender(self.path,transport)
        sender.access_token='fixture_access_token'; sender.expires=time.time()+3600
        self.job['is_test']=True
        self.assertEqual(sender.send(self.job),'sent')

    def test_rejects_other_project(self):
        value=json.loads(self.path.read_text()); value['project_id']='other'
        self.path.write_text(json.dumps(value))
        with self.assertRaises(FcmUnavailable): FcmSender(self.path)

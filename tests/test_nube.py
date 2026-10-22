import json
import sqlite3
import tempfile
import unittest
from unittest.mock import Mock, patch
from datetime import datetime, timezone
from pathlib import Path

from servidor_pc.nube import CloudError, CloudSync

OWNER = '11111111-1111-4111-8111-111111111111'
SPACE = '22222222-2222-4222-8222-222222222222'
RESIDENT = '33333333-3333-4333-8333-333333333333'
DEVICE = '44444444-4444-4444-8444-444444444444'


class CloudSyncTests(unittest.TestCase):
    def setUp(self):
        environment = patch.dict('os.environ', {'SFA_FCM_CREDENTIALS_FILE': ''})
        environment.start()
        self.addCleanup(environment.stop)
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / 'cloud.sqlite3'
        with sqlite3.connect(self.path) as conn:
            conn.executescript('''CREATE TABLE residents(id INTEGER PRIMARY KEY,full_name TEXT,room TEXT,
              phone TEXT,medical_notes TEXT); INSERT INTO residents VALUES(1,'Fixture','Room','PRIVATE_PHONE','PRIVATE_NOTE');''')
        conn.close()
        self.requests = []
        self.failure = None

        def transport(path, token, body=None):
            self.requests.append((path,body))
            if path == '/auth/v1/user':
                return {'id':OWNER}
            if path.endswith('sfa_link_pc'):
                return {'resident_id':RESIDENT,'device_id':DEVICE,'space_id':SPACE}
            if self.failure:
                raise CloudError(self.failure)
            return {'accepted':[r['id'] for r in body['p_batch']]}
        self.cloud = CloudSync(lambda:self.path, transport)
        self.cloud.init_db()
        self.cloud.connect('PRIVATE_JWT',1,SPACE)

    def capture(self, resident=1, **fields):
        body = dict(type='event',event_type='SOS',detail='Button',received_at=datetime.now(timezone.utc).isoformat(),**fields)
        with sqlite3.connect(self.path) as conn:
            self.cloud.capture(conn,body,resident)
        conn.close()

    def test_no_private_profile_fields_or_jwt_are_persisted_or_sent(self):
        link_request = self.requests[1][1]
        self.assertEqual(set(link_request), {'p_installation','p_local_resident','p_space','p_name','p_room'})
        self.capture()
        self.cloud.flush()
        self.assertNotIn('PRIVATE_', json.dumps(self.requests))
        self.assertNotIn(b'PRIVATE_JWT', self.path.read_bytes())

    def test_success_and_retry_use_stable_ids(self):
        self.capture()
        self.failure = 503
        self.cloud.flush()
        first_id = self.requests[-1][1]['p_batch'][0]['id']
        self.assertEqual(self.cloud.status()['pending'],1)
        with self.cloud.connection() as conn:
            conn.execute('UPDATE cloud_outbox SET next_attempt=0')
        self.failure = None
        self.cloud.flush()
        self.assertEqual(first_id,self.requests[-1][1]['p_batch'][0]['id'])
        self.assertEqual(self.cloud.status()['sent'],1)

    def test_link_diagnostics_identify_stage_without_provider_message(self):
        def fail_auth(path, token, body=None):
            raise CloudError(503, 'timeout')
        self.cloud.transport = fail_auth
        with self.assertRaises(CloudError) as result:
            self.cloud.connect('PRIVATE_JWT', 1, SPACE)
        self.assertEqual(result.exception.code, 'auth_timeout')

        def fail_link(path, token, body=None):
            if path == '/auth/v1/user':
                return {'id': OWNER}
            raise CloudError(403, '42501')
        self.cloud.transport = fail_link
        with self.assertRaises(CloudError) as result:
            self.cloud.connect('PRIVATE_JWT', 1, SPACE)
        self.assertEqual(result.exception.code, 'link_42501')
        self.assertNotIn('PRIVATE_JWT', str(result.exception))

    def test_restart_preserves_queue_but_not_session(self):
        self.capture()
        restarted = CloudSync(lambda:self.path)
        restarted.init_db()
        self.assertEqual(restarted.status()['pending'],1)
        self.assertFalse(restarted.status()['session_active'])
        restarted.flush()
        self.assertEqual(restarted.status()['pending'],1)

    def test_expired_session_pauses_without_losing_events(self):
        self.capture()
        self.failure = 401
        self.cloud.flush()
        self.assertFalse(self.cloud.status()['session_active'])
        self.assertEqual(self.cloud.status()['pending'],1)

    def test_bad_data_is_blocked_not_deleted(self):
        self.capture()
        self.failure = 400
        self.cloud.flush()
        self.assertEqual(self.cloud.status()['blocked'],1)

    def test_no_binding_does_not_guess_resident(self):
        self.capture(resident=2)
        self.assertEqual(self.cloud.status()['pending'],0)

    def test_location_events_are_not_uploaded_without_location_consent(self):
        with self.cloud.connection() as conn:
            self.cloud.capture(conn, dict(type='event',event_type='GEOCERCA_SALIDA',detail='private location'),1)
        self.assertEqual(self.cloud.status()['pending'],0)

    def test_telemetry_sampled_but_events_not_throttled(self):
        sample = dict(type='telemetry',state='NORMAL',accel_g=1.0,tilt_deg=0,motion=0,fall_count=0,
                      received_at=datetime.now(timezone.utc).isoformat())
        with sqlite3.connect(self.path) as conn:
            self.cloud.capture(conn,sample,1)
            self.cloud.capture(conn,sample,1)
        conn.close()
        self.capture()
        self.capture()
        self.assertEqual(self.cloud.status()['pending'],3)

    def test_owner_change_cannot_send_other_owners_pending_data(self):
        self.capture()
        self.cloud.session = ('55555555-5555-4555-8555-555555555555','other-token')
        count = len(self.requests)
        self.cloud.flush()
        self.assertEqual(len(self.requests),count)
        self.assertEqual(self.cloud.status()['pending'],1)

    def test_pause_stops_upload(self):
        self.capture()
        self.cloud.pause()
        self.cloud.flush()
        self.assertEqual(self.cloud.status()['pending'],1)

    def test_remote_gps_requires_session_and_mapping_of_current_owner(self):
        self.cloud.pause()
        with self.assertRaises(CloudError) as error: self.cloud.remote_location(1)
        self.assertEqual(error.exception.status,401)
        self.cloud.session=('55555555-5555-4555-8555-555555555555','other-token')
        with self.assertRaises(CloudError) as error: self.cloud.remote_location(1)
        self.assertEqual(error.exception.status,404)

    def test_remote_gps_uses_rls_and_does_not_persist_positions(self):
        row={'latitude':-25.3,'longitude':-57.6,'accuracy_m':9,'observed_at':datetime.now(timezone.utc).isoformat()}
        calls=[]
        def transport(path, token, body=None):
            calls.append((path,token))
            return [{'id':RESIDENT}] if 'sfa_residents?' in path else [row]
        self.cloud.transport=transport
        result=self.cloud.remote_location(1)
        self.assertEqual(result['position'],row)
        self.assertIn('simulated=eq.false',calls[1][0])
        self.assertIn('resident_id=eq.'+RESIDENT,calls[1][0])
        self.assertTrue(all(token=='PRIVATE_JWT' for _,token in calls))
        self.assertEqual(self.cloud.status()['pending'],0)

    def test_remote_gps_never_exposes_data_after_logout_or_revocation(self):
        self.cloud.transport=lambda *args: []
        with self.assertRaises(CloudError) as error: self.cloud.remote_location(1)
        self.assertEqual(error.exception.status,403)
        def transport(path, token, body=None):
            if 'sfa_residents?' in path: return [{'id':RESIDENT}]
            self.cloud.pause()
            return []
        self.cloud.transport=transport
        with self.assertRaises(CloudError) as error: self.cloud.remote_location(1)
        self.assertEqual(error.exception.status,401)

    def test_remote_gps_rejects_malformed_provider_position(self):
        self.cloud.transport=lambda path,*args: [{'id':RESIDENT}] if 'sfa_residents?' in path else [{'latitude':91}]
        with self.assertRaises(CloudError) as error: self.cloud.remote_location(1)
        self.assertEqual(error.exception.code,'position_response')

    def test_remote_zone_uses_bound_identity_and_preserves_sqlite_independence(self):
        zone = dict(home_lat=0,home_lng=0,radius_m=5,address_name='Fixture',updated_at=datetime.now(timezone.utc).isoformat())
        self.cloud.transport = Mock(return_value={'can_configure':True,'geofence':zone,'token':'NEVER_RETURN'})
        result = self.cloud.remote_geofence(1)
        self.assertEqual(result,{'can_configure':True,'geofence':zone})
        self.cloud.transport.assert_called_with('/rest/v1/rpc/sfa_get_geofence','PRIVATE_JWT',{'p_resident':RESIDENT})
        values = {'p_lat':0,'p_lng':0,'p_radius':5,'p_label':'Fixture','p_expected':None}
        self.cloud.remote_geofence(1,values)
        self.cloud.transport.assert_called_with('/rest/v1/rpc/sfa_save_geofence','PRIVATE_JWT',{'p_resident':RESIDENT,**values})
        self.cloud.pause()
        with self.assertRaises(CloudError): self.cloud.remote_geofence(1,values)

    def test_remote_zone_discards_results_if_session_changes_in_flight(self):
        def transport(*args):
            self.cloud.pause()
            return {'can_configure':True,'geofence':None}
        self.cloud.transport=transport
        with self.assertRaises(CloudError) as error: self.cloud.remote_geofence(1)
        self.assertEqual(error.exception.code,'session_changed')

    def test_incidents_are_sanitized_and_actions_are_bound_to_selected_profile(self):
        event_id = '66666666-6666-4666-8666-666666666666'
        event = {'id':event_id,'event_type':'GEOCERCA_SALIDA','observed_at':'2026-10-21T12:00:00Z',
                 'simulated':False,'detail':{'text':'Outside','token':'PRIVATE'},'actor_id':None,'outcome':None,'updated_at':None}
        self.cloud.transport=Mock(return_value={'can_attend':True,'viewer_id':OWNER,'events':[event],'token':'PRIVATE'})
        result=self.cloud.remote_incidents(1)
        self.assertNotIn('PRIVATE',json.dumps(result))
        self.assertEqual(result['viewer_id'],OWNER)
        with self.assertRaises(CloudError) as error:
            self.cloud.remote_incidents(1,{'p_event':DEVICE,'p_expected':None,'p_outcome':'attending'})
        self.assertEqual(error.exception.status,404)
        self.assertFalse(any(call.args[0].endswith('sfa_attend_incident') for call in self.cloud.transport.call_args_list))
        action={'p_event':event_id,'p_expected':None,'p_outcome':'attending'}
        self.cloud.remote_incidents(1,action)
        self.assertTrue(any(call.args==('/rest/v1/rpc/sfa_attend_incident','PRIVATE_JWT',action) for call in self.cloud.transport.call_args_list))

    def test_incident_data_does_not_survive_a_changed_cloud_session(self):
        def transport(*args):
            self.cloud.pause()
            return {'can_attend':True,'events':[]}
        self.cloud.transport=transport
        with self.assertRaises(CloudError) as error: self.cloud.remote_incidents(1)
        self.assertEqual(error.exception.code,'session_changed')

    def test_zone_situation_is_sanitized_and_invalid_status_rejected(self):
        zone={'state':'outside','last_confirmed':'outside','observed_at':datetime.now(timezone.utc).isoformat(),'token':'PRIVATE'}
        self.cloud.transport=Mock(return_value={'can_attend':True,'events':[],'zone_status':zone})
        result=self.cloud.remote_incidents(1)
        self.assertEqual(result['zone_status']['state'],'outside')
        self.assertNotIn('PRIVATE',json.dumps(result))
        zone['state']='safe_even_without_gps'
        with self.assertRaises(CloudError): self.cloud.remote_incidents(1)

    def test_push_v2_and_legacy_fallback_without_real_credentials(self):
        with patch.dict('os.environ', {'SFA_FCM_CREDENTIALS_FILE': 'fixture-not-opened'}):
            self.cloud.push_sender = Mock()
            self.cloud.push_sender.send.return_value = 'sent'
            calls = []
            def transport(path, token, body):
                calls.append(path)
                if path.endswith('sfa_claim_push_v2'):
                    return [{'id':'job','lease':'lease','is_test':True}]
                return {}
            self.cloud.transport = transport
            self.cloud.flush_push('fixture-token')
            self.assertTrue(calls[0].endswith('sfa_claim_push_v2'))
            self.cloud.push_sender.send.assert_called_once_with({'id':'job','lease':'lease','is_test':True})
            def legacy(path, token, body):
                calls.append(path)
                if path.endswith('sfa_claim_push_v2'):
                    raise CloudError(404)
                return []
            self.cloud.transport = legacy
            self.cloud.flush_push('fixture-token')
            self.assertTrue(calls[-1].endswith('sfa_claim_push'))
            self.assertIsNone(self.cloud.push_error)

    def test_malformed_acknowledgement_cannot_lose_pending_samples(self):
        self.capture()
        self.cloud.transport = lambda *args: {'accepted':[{}]}
        self.cloud.flush()
        self.assertEqual(self.cloud.status()['pending'],1)
        self.assertEqual(self.cloud.status()['sent'],0)

    def test_capture_rolls_back_with_local_record_transaction(self):
        with self.assertRaises(RuntimeError):
            with self.cloud.connection() as conn:
                self.cloud.capture(conn,dict(type='event',event_type='SOS'),1)
                raise RuntimeError('simulate local record rollback')
        self.assertEqual(self.cloud.status()['pending'],0)


if __name__ == '__main__':
    unittest.main()

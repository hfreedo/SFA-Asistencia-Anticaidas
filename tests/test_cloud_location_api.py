import unittest
from unittest.mock import Mock, patch
from fastapi import HTTPException
from starlette.requests import Request
from servidor_pc import main
from servidor_pc.nube import CloudError


def request(host='127.0.0.1', origin=None):
    headers=[(b'host',b'localhost:8780')]
    if origin: headers.append((b'origin',origin.encode()))
    return Request({'type':'http','method':'GET','scheme':'https','path':'/api/cloud/residents/1/location',
                    'query_string':b'', 'headers':headers,'client':(host,1234),'server':('localhost',8780)})


class CloudLocationApiTests(unittest.TestCase):
    def test_monitor_link_is_loopback_only_and_requires_session(self):
        import uuid
        body = main.CloudMonitorRequest(local_resident_id=12, remote_resident_id=uuid.UUID('33333333-3333-4333-8333-333333333333'))
        with patch.object(main.cloud_sync, 'monitor', return_value={'linked': True}) as monitor:
            for incoming in (request('203.0.113.9'), request(origin='https://untrusted.invalid')):
                with self.assertRaises(HTTPException): main.cloud_monitor(body, incoming, 'Bearer fixture')
            with self.assertRaises(HTTPException): main.cloud_monitor(body, request(), '')
            monitor.assert_not_called()
            main.cloud_monitor(body, request(), 'Bearer fixture')
            monitor.assert_called_once_with('fixture', 12, str(body.remote_resident_id))

    def test_monitor_session_routes_do_not_pause_emitter_and_reject_lan(self):
        with patch.object(main.cloud_sync, 'monitor_session') as resume, patch.object(main.cloud_sync, 'pause_monitor') as pause, patch.object(main.cloud_sync, 'pause') as emitter:
            for incoming in (request('203.0.113.9'), request(origin='https://untrusted.invalid')):
                with self.assertRaises(HTTPException): main.cloud_monitor_session(incoming, 'Bearer fixture')
                with self.assertRaises(HTTPException): main.cloud_pause_monitor(incoming)
            resume.assert_not_called(); pause.assert_not_called()
            main.cloud_monitor_session(request(), 'Bearer fixture')
            main.cloud_pause_monitor(request())
            resume.assert_called_once_with('fixture'); pause.assert_called_once()
            emitter.assert_not_called()
    def test_push_tests_require_loopback_origin_and_explicit_confirmation(self):
        import uuid
        device=uuid.UUID('66666666-6666-4666-8666-666666666666')
        with patch.object(main.cloud_sync,'push_test',return_value={'devices':[]}) as send:
            main.push_test_targets(12,request())
            send.assert_called_once_with(12)
            send.reset_mock()
            with self.assertRaises(HTTPException): main.send_push_test(12,main.PushTestRequest(installation_id=device),request())
            for incoming in (request('203.0.113.9'),request(origin='https://untrusted.invalid')):
                with self.assertRaises(HTTPException): main.push_test_targets(12,incoming)
                with self.assertRaises(HTTPException): main.send_push_test(12,main.PushTestRequest(installation_id=device,confirmed=True),incoming)
            send.assert_not_called()
            main.send_push_test(12,main.PushTestRequest(installation_id=device,confirmed=True),request())
            send.assert_called_once_with(12,str(device))

    def test_cloud_incidents_cannot_be_read_or_resolved_from_lan(self):
        import uuid
        with patch.object(main.cloud_sync,'remote_incidents',return_value={'events':[]}) as incidents:
            main.get_remote_incidents(12,request())
            incidents.assert_called_once_with(12)
            body=main.RemoteAttentionRequest(p_outcome='attending')
            main.attend_remote_incident(12,uuid.UUID('66666666-6666-4666-8666-666666666666'),body,request())
            incidents.reset_mock()
            for incoming in (request('203.0.113.9'),request(origin='https://untrusted.invalid')):
                with self.assertRaises(HTTPException): main.get_remote_incidents(12,incoming)
                with self.assertRaises(HTTPException): main.attend_remote_incident(12,uuid.uuid4(),body,incoming)
            incidents.assert_not_called()
    def test_cloud_zone_read_and_write_are_loopback_only(self):
        with patch.object(main.cloud_sync, 'remote_geofence', return_value={'geofence': None, 'can_configure': True}) as zone:
            main.get_remote_geofence(12, request())
            zone.assert_called_once_with(12)
            body = main.RemoteGeofenceRequest(p_lat=0, p_lng=0, p_radius=5, p_label='Fixture')
            main.save_remote_geofence(12, body, request())
            self.assertEqual(zone.call_args.args, (12, body.model_dump()))
            zone.reset_mock()
            for incoming in (request('203.0.113.9'), request(origin='https://untrusted.invalid')):
                with self.assertRaises(HTTPException): main.get_remote_geofence(12, incoming)
                with self.assertRaises(HTTPException): main.save_remote_geofence(12, body, incoming)
            zone.assert_not_called()

    def test_loopback_reads_only_the_requested_profile(self):
        with patch.object(main.cloud_sync,'remote_location',return_value={'position':None}) as read:
            self.assertEqual(main.cloud_resident_location(12,request()),{'position':None})
            read.assert_called_once_with(12)

    def test_lan_and_foreign_origins_cannot_read_cloud_session(self):
        with patch.object(main.cloud_sync,'remote_location') as read:
            for incoming in (request('203.0.113.9'),request(origin='https://untrusted.invalid')):
                with self.assertRaises(HTTPException) as error: main.cloud_resident_location(1,incoming)
                self.assertEqual(error.exception.status_code,403)
            read.assert_not_called()

    def test_provider_errors_are_sanitized(self):
        with patch.object(main.cloud_sync,'remote_location',side_effect=CloudError(401,'session_required')):
            with self.assertRaises(HTTPException) as error: main.cloud_resident_location(1,request())
            self.assertEqual(error.exception.status_code,401)
            self.assertEqual(error.exception.detail['code'],'session_required')

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

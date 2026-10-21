import sqlite3
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import HTTPException
from pydantic import ValidationError

from servidor_pc.ubicacion import FenceInput, LocationService, PositionInput


class LocationTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.path = Path(self.tmp.name) / "test.sqlite3"
        with sqlite3.connect(self.path) as conn:
            conn.executescript("""CREATE TABLE residents (id INTEGER PRIMARY KEY);
                INSERT INTO residents VALUES (1); INSERT INTO residents VALUES (2);
                CREATE TABLE geofence_config (id INTEGER,home_lat REAL,home_lng REAL,radius_m INTEGER,address_name TEXT);
                INSERT INTO geofence_config VALUES (1,0,0,200,'Prueba');""")
        conn.close()
        self.service = LocationService(lambda: self.path)
        self.service.init_db()
        self.token = self.service.pair(1)["token"]
        self.start = datetime(2026, 10, 20, tzinfo=timezone.utc)

    def send(self, second, latitude=0, accuracy=5, token=None):
        now = self.start + timedelta(seconds=second)
        sample = PositionInput(latitude=latitude, longitude=0, accuracy_m=accuracy, observed_at=now)
        return self.service.ingest(token or self.token, sample, now)

    def test_dwell_exit_reentry_and_deduplication(self):
        self.send(0)
        snapshot, events = self.send(11)
        self.assertEqual(snapshot["status"], "inside")
        self.assertEqual(events, [])
        self.assertEqual(self.send(22, .01)[0]["status"], "pending")
        snapshot, events = self.send(33, .01)
        self.assertEqual(snapshot["status"], "outside")
        self.assertEqual([e["event_type"] for e in events], ["GEOCERCA_SALIDA"])
        self.assertEqual(self.send(44, .01)[1], [])
        self.send(55)
        _, events = self.send(66)
        self.assertEqual([e["event_type"] for e in events], ["GEOCERCA_REINGRESO"])

    def test_link_survives_staleness_elapsed_time_and_service_restart(self):
        self.send(0)
        self.service.mark_stale(self.start + timedelta(days=1))
        self.service = LocationService(lambda: self.path)
        self.service.init_db()
        snapshot, _ = self.send(86401)
        self.assertTrue(snapshot['paired'])

    def test_accidental_pair_does_not_rotate_existing_token(self):
        with self.assertRaises(HTTPException) as result:
            self.service.pair(1, replace_existing=False)
        self.assertEqual(result.exception.status_code, 409)
        self.assertTrue(self.send(0)[0]['paired'])

    def test_five_meter_demo_fence_keeps_precision_checks(self):
        self.service.set_fence(1, FenceInput(home_lat=0, home_lng=0, radius_m=5))
        self.assertEqual(self.send(0, latitude=0, accuracy=5)[0]['status'], 'uncertain')
        self.assertEqual(self.send(11, latitude=.001, accuracy=2)[0]['status'], 'pending')
        self.assertEqual(self.send(22, latitude=.001, accuracy=2)[0]['status'], 'outside')
        with self.assertRaises(ValidationError):
            FenceInput(home_lat=0, home_lng=0, radius_m=4)

    def test_small_fence_confirms_outside_when_uncertainty_is_entirely_outside(self):
        self.service.set_fence(1, FenceInput(home_lat=0, home_lng=0, radius_m=5))
        self.assertEqual(self.send(0, latitude=.00014, accuracy=9.6)[0]['status'], 'pending')
        snapshot, events = self.send(11, latitude=.00014, accuracy=9.6)
        self.assertEqual(snapshot['status'], 'outside')
        self.assertGreater(snapshot['evaluation']['distance_min_m'], 5.5)
        self.assertEqual([event['event_type'] for event in events], ['GEOCERCA_SALIDA'])

    def test_very_poor_precision_still_cannot_confirm_exit(self):
        self.service.set_fence(1, FenceInput(home_lat=0, home_lng=0, radius_m=5))
        self.send(0, latitude=.01, accuracy=51)
        snapshot, events = self.send(11, latitude=.01, accuracy=51)
        self.assertEqual(snapshot['status'], 'imprecise')
        self.assertEqual(events, [])

    def test_history_is_not_purged_after_500_events(self):
        with self.service.connection() as conn:
            for index in range(501):
                self.service.event(conn, 1, 'FIXTURE', str(index), self.start)
            self.assertEqual(conn.execute('select count(*) from location_events').fetchone()[0], 501)

    def test_precision_and_boundary_do_not_confirm_an_exit(self):
        self.assertEqual(self.send(0, .01, 80)[0]["status"], "imprecise")
        self.send(11, .01)
        snapshot, events = self.send(22, .0018)
        self.assertEqual(snapshot["status"], "uncertain")
        self.assertEqual(events, [])
        self.assertEqual(self.send(33, .01)[1], [])
        self.assertEqual(self.send(44, .01)[1][0]["event_type"], "GEOCERCA_SALIDA")

    def test_stale_once_and_recovery(self):
        self.send(0)
        self.send(11)
        now = self.start + timedelta(seconds=102)
        self.assertEqual(self.service.snapshot(1, now)["status"], "stale")
        self.assertEqual(self.service.mark_stale(now)[0]["event_type"], "UBICACION_PERDIDA")
        self.assertEqual(self.service.mark_stale(now), [])
        snapshot, events = self.send(103)
        self.assertEqual(snapshot["status"], "pending")
        self.assertEqual(events[0]["event_type"], "UBICACION_RECUPERADA")

    def test_gap_cannot_count_as_continuous_dwell(self):
        self.send(0, .01)
        self.assertEqual(self.send(100, .01)[0]["status"], "pending")
        self.assertEqual(self.send(111, .01)[1][0]["event_type"], "GEOCERCA_SALIDA")

    def test_rotation_revocation_and_hash_only(self):
        with self.service.connection() as conn:
            value = conn.execute("SELECT token_hash FROM location_devices").fetchone()[0]
        self.assertNotEqual(value, self.token)
        second = self.service.pair(1)["token"]
        with self.assertRaises(HTTPException) as error:
            self.send(0)
        self.assertEqual(error.exception.status_code, 401)
        self.send(1, token=second)
        self.service.revoke(1)
        with self.assertRaises(HTTPException):
            self.send(2, token=second)
        self.assertEqual(self.service.snapshot(1, self.start)["status"], "unlinked")

    def test_resident_and_zone_isolation(self):
        other = self.service.pair(2)["token"]
        self.service.set_fence(2, FenceInput(home_lat=.01, home_lng=0))
        self.send(0, .01)
        self.send(11, .01)
        self.send(0, .01, token=other)
        other_snapshot, events = self.send(11, .01, token=other)
        self.assertEqual(other_snapshot["resident_id"], 2)
        self.assertEqual(other_snapshot["status"], "inside")
        self.assertEqual(events, [])
        self.assertEqual(self.service.snapshot(1, self.start)["status"], "outside")

    def test_new_zone_invalidates_old_classification(self):
        self.send(0)
        self.send(11)
        self.service.set_fence(1, FenceInput(home_lat=.01, home_lng=0))
        self.assertEqual(self.service.snapshot(1, self.start)["status"], "zone_changed")
        self.assertEqual(self.send(22)[1], [])

    def test_reject_old_future_and_reordered_samples(self):
        for offset in (-91, 31):
            sample = PositionInput(latitude=0, longitude=0, accuracy_m=5, observed_at=self.start + timedelta(seconds=offset))
            with self.assertRaises(HTTPException) as error:
                self.service.ingest(self.token, sample, self.start)
            self.assertEqual(error.exception.status_code, 422)
        self.send(0)
        with self.assertRaises(HTTPException) as error:
            self.send(0)
        self.assertEqual(error.exception.status_code, 409)

    def test_invalid_coordinates_precision_and_timezone(self):
        for changes in ({"latitude": 91}, {"longitude": float("nan")}, {"accuracy_m": 0}, {"observed_at": datetime(2026, 1, 1)}):
            values = dict(latitude=0, longitude=0, accuracy_m=5, observed_at=self.start)
            values.update(changes)
            with self.assertRaises(ValidationError):
                PositionInput(**values)

    def test_deleted_resident_cannot_send(self):
        with self.service.connection() as conn:
            self.service.purge_resident(conn, 1)
            conn.execute("DELETE FROM residents WHERE id=1")
        with self.assertRaises(HTTPException):
            self.send(0)

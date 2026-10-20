from __future__ import annotations

import hashlib
import secrets
import sqlite3
from datetime import datetime, timezone
from contextlib import contextmanager
from typing import Callable

from fastapi import HTTPException
from geographiclib.geodesic import Geodesic
from pydantic import BaseModel, ConfigDict, Field, field_validator


class PositionInput(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy_m: float = Field(gt=0, le=10000)
    observed_at: datetime

    @field_validator("observed_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None:
            raise ValueError("La hora debe incluir zona horaria")
        return value.astimezone(timezone.utc)


class FenceInput(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    home_lat: float = Field(ge=-90, le=90)
    home_lng: float = Field(ge=-180, le=180)
    radius_m: int = Field(default=200, ge=25, le=100000)
    address_name: str = Field(default="Zona de referencia", max_length=160)


class LocationService:
    stale_seconds = 90
    dwell_seconds = 10

    def __init__(self, db_path: Callable):
        self.db_path = db_path

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
            conn.executescript("""
                CREATE TABLE IF NOT EXISTS location_devices (
                    resident_id INTEGER PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS resident_geofences (
                    resident_id INTEGER PRIMARY KEY, home_lat REAL NOT NULL,
                    home_lng REAL NOT NULL, radius_m INTEGER NOT NULL,
                    address_name TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS resident_locations (
                    resident_id INTEGER PRIMARY KEY, latitude REAL NOT NULL,
                    longitude REAL NOT NULL, accuracy_m REAL NOT NULL,
                    observed_at TEXT NOT NULL, received_at TEXT NOT NULL,
                    distance_m REAL NOT NULL, quality TEXT NOT NULL,
                    stable_state TEXT NOT NULL DEFAULT 'unknown',
                    candidate TEXT, candidate_since TEXT, samples INTEGER NOT NULL DEFAULT 0,
                    stale_notified INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS location_events (
                    id INTEGER PRIMARY KEY AUTOINCREMENT, resident_id INTEGER NOT NULL,
                    event_type TEXT NOT NULL, detail TEXT NOT NULL, received_at TEXT NOT NULL
                );
            """)

    def require_resident(self, conn, resident_id):
        if not conn.execute("SELECT id FROM residents WHERE id=?", (resident_id,)).fetchone():
            raise HTTPException(404, "Residente no encontrado")

    @staticmethod
    def digest(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def pair(self, resident_id):
        token = secrets.token_urlsafe(32)
        with self.connection() as conn:
            self.require_resident(conn, resident_id)
            if not conn.execute("SELECT 1 FROM resident_geofences WHERE resident_id=?", (resident_id,)).fetchone():
                fence = self.fence(conn, resident_id)
                conn.execute("INSERT INTO resident_geofences VALUES (?,?,?,?,?)", (resident_id, fence["home_lat"], fence["home_lng"], fence["radius_m"], fence["address_name"]))
            conn.execute("INSERT OR REPLACE INTO location_devices VALUES (?, ?, ?)",
                         (resident_id, self.digest(token), datetime.now(timezone.utc).isoformat()))
            conn.execute("UPDATE resident_locations SET stable_state='unknown',candidate=NULL,candidate_since=NULL,samples=0,quality='awaiting_device' WHERE resident_id=?", (resident_id,))
        return {"token": token, "resident_id": resident_id}

    def revoke(self, resident_id):
        with self.connection() as conn:
            self.require_resident(conn, resident_id)
            conn.execute("DELETE FROM location_devices WHERE resident_id=?", (resident_id,))

    def fence(self, conn, resident_id):
        row = conn.execute("SELECT home_lat,home_lng,radius_m,address_name FROM resident_geofences WHERE resident_id=?", (resident_id,)).fetchone()
        if not row:
            row = conn.execute("SELECT home_lat,home_lng,radius_m,address_name FROM geofence_config WHERE id=1").fetchone()
        return dict(row)

    def get_fence(self, resident_id):
        with self.connection() as conn:
            self.require_resident(conn, resident_id)
            return self.fence(conn, resident_id)

    def set_fence(self, resident_id, fence: FenceInput):
        with self.connection() as conn:
            self.require_resident(conn, resident_id)
            conn.execute("INSERT OR REPLACE INTO resident_geofences VALUES (?,?,?,?,?)",
                         (resident_id, fence.home_lat, fence.home_lng, fence.radius_m, fence.address_name.strip()))
            # A changed zone requires fresh observations, not the previous classification.
            conn.execute("UPDATE resident_locations SET stable_state='unknown',candidate=NULL,candidate_since=NULL,samples=0,quality='zone_changed' WHERE resident_id=?", (resident_id,))
        return fence.model_dump()

    def snapshot(self, resident_id, now=None):
        now = now or datetime.now(timezone.utc)
        with self.connection() as conn:
            self.require_resident(conn, resident_id)
            row = conn.execute("SELECT * FROM resident_locations WHERE resident_id=?", (resident_id,)).fetchone()
            paired = bool(conn.execute("SELECT 1 FROM location_devices WHERE resident_id=?", (resident_id,)).fetchone())
            events = [dict(r) for r in conn.execute("SELECT id,event_type,detail,received_at FROM location_events WHERE resident_id=? ORDER BY id DESC LIMIT 12", (resident_id,))]
        position = dict(row) if row else None
        age = max(0, (now - datetime.fromisoformat(row["observed_at"])).total_seconds()) if row else None
        status = "no_fix" if not row else "unlinked" if not paired else "stale" if age > self.stale_seconds else row["quality"]
        return {"resident_id": resident_id, "paired": paired, "status": status,
                "age_seconds": age, "position": position, "events": events}

    def event(self, conn, resident_id, kind, detail, now):
        payload = {"type": "event", "resident_id": resident_id, "event_type": kind,
                   "detail": detail, "received_at": now.isoformat(), "raw": "location"}
        conn.execute("INSERT INTO location_events (resident_id,event_type,detail,received_at) VALUES (?,?,?,?)",
                     (resident_id, kind, detail, payload["received_at"]))
        # Keep only a bounded event log, rather than storing an unlimited movement history.
        conn.execute("DELETE FROM location_events WHERE resident_id=? AND id NOT IN (SELECT id FROM location_events WHERE resident_id=? ORDER BY id DESC LIMIT 500)", (resident_id, resident_id))
        return payload

    def ingest(self, token: str, sample: PositionInput, now=None):
        now = now or datetime.now(timezone.utc)
        age = (now - sample.observed_at).total_seconds()
        if age > self.stale_seconds or age < -30:
            raise HTTPException(422, "Lectura antigua o reloj del celular incorrecto")
        events = []
        with self.connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            device = conn.execute("SELECT resident_id FROM location_devices WHERE token_hash=?", (self.digest(token),)).fetchone()
            if not device:
                raise HTTPException(401, "Vínculo no válido o revocado")
            resident_id = device["resident_id"]
            self.require_resident(conn, resident_id)
            old = conn.execute("SELECT * FROM resident_locations WHERE resident_id=?", (resident_id,)).fetchone()
            if old and sample.observed_at <= datetime.fromisoformat(old["observed_at"]):
                raise HTTPException(409, "Lectura repetida o fuera de orden")
            fence = self.fence(conn, resident_id)
            distance = Geodesic.WGS84.Inverse(fence["home_lat"], fence["home_lng"], sample.latitude, sample.longitude)["s12"]
            radius = fence["radius_m"]
            margin = min(10, radius * .1)
            if sample.accuracy_m > min(50, radius / 2):
                target, quality = None, "imprecise"
            elif distance - sample.accuracy_m > radius + margin:
                target, quality = "outside", "pending"
            elif distance + sample.accuracy_m < radius - margin:
                target, quality = "inside", "pending"
            else:
                target, quality = None, "uncertain"
            stable = old["stable_state"] if old else "unknown"
            continuous = old and (sample.observed_at - datetime.fromisoformat(old["observed_at"])).total_seconds() <= self.stale_seconds
            since, count = None, 0
            if target:
                if old and continuous and old["candidate"] == target:
                    since, count = old["candidate_since"], old["samples"] + 1
                else:
                    since, count = sample.observed_at.isoformat(), 1
                if count >= 2 and (sample.observed_at - datetime.fromisoformat(since)).total_seconds() >= self.dwell_seconds:
                    quality = target
                    if target != stable:
                        if target == "outside":
                            events.append(self.event(conn, resident_id, "GEOCERCA_SALIDA", "Ubicación confirmada fuera de la zona", now))
                        elif stable == "outside":
                            events.append(self.event(conn, resident_id, "GEOCERCA_REINGRESO", "Regreso confirmado a la zona", now))
                        stable = target
            if old and old["stale_notified"]:
                events.append(self.event(conn, resident_id, "UBICACION_RECUPERADA", "Se reciben posiciones nuevamente", now))
            conn.execute("""INSERT OR REPLACE INTO resident_locations
                (resident_id,latitude,longitude,accuracy_m,observed_at,received_at,distance_m,quality,stable_state,candidate,candidate_since,samples,stale_notified)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0)""",
                         (resident_id, sample.latitude, sample.longitude, sample.accuracy_m,
                          sample.observed_at.isoformat(), now.isoformat(), distance, quality, stable, target, since, count))
        return self.snapshot(resident_id, now), events

    def mark_stale(self, now=None):
        now = now or datetime.now(timezone.utc)
        events = []
        with self.connection() as conn:
            conn.execute("BEGIN IMMEDIATE")
            rows = conn.execute("SELECT resident_locations.* FROM resident_locations JOIN residents ON residents.id=resident_locations.resident_id JOIN location_devices ON location_devices.resident_id=resident_locations.resident_id WHERE stale_notified=0").fetchall()
            for row in rows:
                if (now - datetime.fromisoformat(row["observed_at"])).total_seconds() > self.stale_seconds:
                    conn.execute("UPDATE resident_locations SET stale_notified=1,candidate=NULL,candidate_since=NULL,samples=0 WHERE resident_id=?", (row["resident_id"],))
                    events.append(self.event(conn, row["resident_id"], "UBICACION_PERDIDA", "Sin posición reciente; no se puede confirmar la zona", now))
        return events

    def purge_resident(self, conn, resident_id=None):
        for table in ("location_devices", "resident_geofences", "resident_locations", "location_events"):
            if resident_id is None:
                conn.execute(f"DELETE FROM {table}")
            else:
                conn.execute(f"DELETE FROM {table} WHERE resident_id=?", (resident_id,))

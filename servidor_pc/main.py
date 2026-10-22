from __future__ import annotations

import asyncio
import base64
import binascii
import json
import os
import socket
import secrets
import sqlite3
import sys
import threading
import time
import urllib.request
from contextlib import asynccontextmanager, suppress
from html import escape
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

import serial
from fastapi import FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from serial.tools import list_ports
from servidor_pc.red_local import local_addresses
from servidor_pc.ubicacion import FenceInput, LocationService, PositionInput
from servidor_pc.correo import EmailChannel
from servidor_pc.nube import CloudError, CloudSync
from servidor_pc.rutas import application_home, database_path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
APP_HOME = application_home(sys.executable, BASE_DIR, getattr(sys, "frozen", False))
load_dotenv(APP_HOME / ".env")
RESOURCE_DIR = Path(getattr(sys, "_MEIPASS", BASE_DIR))
STATIC_DIR = RESOURCE_DIR / "interfaz_web" / "static"
ACCESS_DIR = RESOURCE_DIR / "interfaz_web" / "dist-acceso"

DB_PATH = database_path(APP_HOME)
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


class SerialConnectRequest(BaseModel):
    port: str
    baudrate: int = 115200


class CommandRequest(BaseModel):
    command: str


class AlertActionRequest(BaseModel):
    action: str
    note: str | None = None


class SimulationStateRequest(BaseModel):
    state: str


class ResidentProfileRequest(BaseModel):
    full_name: str
    room: str
    phone: str
    emergency_phone: str = "112"
    medical_notes: str = ""


class ResidentCreateRequest(BaseModel):
    full_name: str
    room: str
    phone: str
    emergency_phone: str = "112"
    medical_notes: str = ""


class ResidentPhotoRequest(BaseModel):
    photo_base64: str = Field(max_length=2_000_000)


class BackupResident(ResidentCreateRequest):
    is_active: bool = False
    photo_base64: str | None = Field(default=None, max_length=2_000_000)
    geofence: FenceInput | None = None


def public_resident(row: sqlite3.Row) -> dict[str, Any]:
    result = dict(row)
    photo = result.pop("photo", None)
    result["photo_url"] = (
        f"/api/residents/{result['id']}/photo" if photo else None
    )
    return result


class GeofenceConfigRequest(BaseModel):
    home_lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    home_lng: float = Field(ge=-180, le=180, allow_inf_nan=False)
    radius_m: int = Field(default=200, ge=5, le=100000)
    address_name: str = "Hogar / Residencia Central"


class NotificationConfigRequest(BaseModel):
    sound_enabled: bool = True
    telegram_token: str = ""
    telegram_chat_id: str = ""
    notify_fall: bool = True
    notify_sos: bool = True
    notify_battery: bool = True
    notify_first_motion: bool = True
    notify_geofence: bool = True


class ConfigurationBackup(BaseModel):
    format: str
    version: int
    residents: list[BackupResident] = Field(max_length=1000)
    geofence: GeofenceConfigRequest
    notifications: NotificationConfigRequest


class SerialBridge:
    def __init__(self) -> None:
        self.serial_port: serial.Serial | None = None
        self.thread: threading.Thread | None = None
        self.stop_event = threading.Event()
        self.lock = threading.Lock()
        self.loop: asyncio.AbstractEventLoop | None = None
        self.clients: set[WebSocket] = set()
        self.latest: dict[str, Any] | None = None
        self.connected_port: str | None = None
        self.connected_baudrate: int | None = None
        self.last_error: str | None = None
        self.last_response: dict[str, Any] | None = None
        self.alert_command_lock = asyncio.Lock()

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop

    def connect(self, port: str, baudrate: int) -> None:
        with self.lock:
            self.disconnect()
            try:
                self.serial_port = serial.Serial(port, baudrate, timeout=1)
            except serial.SerialException as exc:
                self.last_error = serial_error_message(exc, port)
                raise RuntimeError(self.last_error) from exc
            self.connected_port = port
            self.connected_baudrate = baudrate
            self.last_error = None
            self.latest = None
            self.stop_event.clear()
            self.thread = threading.Thread(target=self._reader_loop, daemon=True)
            self.thread.start()

    def disconnect(self) -> None:
        self.stop_event.set()
        if self.serial_port and self.serial_port.is_open:
            self.serial_port.close()
        self.serial_port = None
        self.connected_port = None
        self.connected_baudrate = None

    def send_command(self, command: str) -> None:
        if not command.strip():
            raise ValueError("Comando vacio")
        with self.lock:
            if not self.serial_port or not self.serial_port.is_open:
                raise RuntimeError("No hay puerto serial conectado")
            self.serial_port.write((command.strip() + "\n").encode("ascii", errors="ignore"))

    def status(self) -> dict[str, Any]:
        return {
            "connected": bool(self.serial_port and self.serial_port.is_open),
            "port": self.connected_port,
            "baudrate": self.connected_baudrate,
            "latest": self.latest,
            "error": self.last_error,
        }

    async def confirm_alert_command(self, command: str, timeout: float = 3.0) -> None:
        async with self.alert_command_lock:
            previous_response = self.last_response
            previous_reading = self.latest
            self.send_command(command)
            deadline = asyncio.get_running_loop().time() + timeout
            while asyncio.get_running_loop().time() < deadline:
                response = self.last_response
                if response is not None and response is not previous_response and response.get("command") == command:
                    if response.get("result") != "OK":
                        raise RuntimeError("El cinturon no acepto el comando de atencion")
                    # Do not replay pre-reset telemetry when a browser reconnects.
                    if (previous_reading and self.latest and self.latest.get("state") == "CAIDA_CONFIRMADA"
                            and self.latest.get("fall_count") == previous_reading.get("fall_count")):
                        self.latest = None
                    return
                await asyncio.sleep(0.02)
            raise TimeoutError("El cinturon no confirmo la orden. Revisa la conexion y vuelve a intentar")

    async def add_client(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.clients.add(websocket)
        await websocket.send_json({"type": "status", **self.status()})

    def remove_client(self, websocket: WebSocket) -> None:
        self.clients.discard(websocket)

    def publish_from_thread(self, payload: dict[str, Any]) -> None:
        if self.loop and self.loop.is_running():
            asyncio.run_coroutine_threadsafe(self.broadcast(payload), self.loop)

    async def broadcast(self, payload: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for client in self.clients:
            try:
                await client.send_json(payload)
            except RuntimeError:
                dead.append(client)
        for client in dead:
            self.remove_client(client)

    def _reader_loop(self) -> None:
        while not self.stop_event.is_set():
            try:
                if not self.serial_port:
                    break
                raw = self.serial_port.readline()
                if not raw:
                    continue
                line = raw.decode("utf-8", errors="replace").strip()
                if not line:
                    continue
                payload = parse_serial_line(line)
                if payload["type"] == "response":
                    self.last_response = payload
                if payload["type"] == "telemetry":
                    self.latest = payload
                if payload["type"] in {"event", "telemetry"}:
                    save_record(payload)
                self.publish_from_thread(payload)
            except serial.SerialException as exc:
                self.last_error = serial_error_message(exc, self.connected_port or "puerto")
                self.connected_port = None
                self.connected_baudrate = None
                if self.serial_port and self.serial_port.is_open:
                    self.serial_port.close()
                self.serial_port = None
                self.publish_from_thread({"type": "serial_error", "message": self.last_error})
                self.publish_from_thread({"type": "status", **self.status()})
                break


bridge = SerialBridge()
location_service = LocationService(lambda: DB_PATH)
email_channel = EmailChannel(lambda: DB_PATH)
cloud_sync = CloudSync(lambda: DB_PATH)


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_local_ip() -> str:
    addresses = local_addresses()
    return addresses[0] if addresses else "127.0.0.1"


def send_telegram_notification(text: str) -> bool:
    try:
        with sqlite3.connect(DB_PATH) as conn:
            conn.row_factory = sqlite3.Row
            cfg = conn.execute("SELECT * FROM notification_config WHERE id = 1").fetchone()
            if not cfg:
                return False
            token = (cfg["telegram_token"] or "").strip()
            chat_id = (cfg["telegram_chat_id"] or "").strip()
            if not token or not chat_id:
                return False
        url = f"https://api.telegram.org/bot{token}/sendMessage"
        data = json.dumps({"chat_id": chat_id, "text": text, "parse_mode": "HTML"}).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=5) as res:
            return res.status == 200
    except Exception as exc:
        print(f"[Telegram Alert Error]: {exc}")
        return False


def check_and_notify_event(payload: dict[str, Any]) -> None:
    event_type = payload.get("event_type")
    # A sustained telemetry state is not a new incident on every sample.
    if payload.get("type") != "event" or not event_type or payload.get("simulated"):
        return

    def _worker():
        try:
            with sqlite3.connect(DB_PATH) as conn:
                conn.row_factory = sqlite3.Row
                resident_id = payload.get("resident_id")
                prof = conn.execute("SELECT * FROM residents WHERE id=?", (resident_id,)).fetchone() if resident_id else conn.execute("SELECT * FROM residents WHERE is_active = 1 LIMIT 1").fetchone()
                if resident_id and not prof:
                    return
                if not prof:
                    prof = conn.execute("SELECT * FROM residents ORDER BY id ASC LIMIT 1").fetchone()
                cfg = conn.execute("SELECT * FROM notification_config WHERE id = 1").fetchone()

            name = prof["full_name"] if prof else "Residente"
            room = prof["room"] if prof else "Habitación"

            enabled = cfg and ((event_type == "CAIDA_CONFIRMADA" and cfg["notify_fall"])
                       or ("SOS" in str(event_type).upper() and cfg["notify_sos"])
                       or (event_type in {"GEOCERCA_SALIDA", "GEOCERCA_REINGRESO", "UBICACION_PERDIDA"} and cfg["notify_geofence"]))
            if enabled:
                msg = f"SFA Asistencia\n{event_type}\nResidente: {name}\nReferencia: {room}\n{payload.get('detail', '')}\nHora UTC: {payload.get('received_at', utc_now())}"
                threading.Thread(target=email_channel.send, args=(event_type, msg, prof["id"] if prof else None), daemon=True).start()
                send_telegram_notification(escape(msg))
        except Exception as e:
            print(f"[Event Notify Worker Error]: {e}")

    threading.Thread(target=_worker, daemon=True).start()


def init_db() -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL,
                type TEXT NOT NULL,
                raw TEXT NOT NULL,
                state TEXT,
                event_type TEXT,
                detail TEXT,
                accel_g REAL,
                tilt_deg REAL,
                motion REAL,
                fall_count INTEGER
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS residents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL,
                room TEXT NOT NULL,
                phone TEXT NOT NULL,
                emergency_phone TEXT NOT NULL DEFAULT '112',
                medical_notes TEXT DEFAULT '',
                is_active INTEGER NOT NULL DEFAULT 0,
                updated_at TEXT NOT NULL
            )
            """
        )
        if "photo" not in {r[1] for r in conn.execute("PRAGMA table_info(residents)")}:
            conn.execute("ALTER TABLE residents ADD COLUMN photo BLOB")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS geofence_config (
                id INTEGER PRIMARY KEY,
                home_lat REAL NOT NULL,
                home_lng REAL NOT NULL,
                radius_m INTEGER NOT NULL,
                address_name TEXT,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS notification_config (
                id INTEGER PRIMARY KEY,
                sound_enabled INTEGER NOT NULL DEFAULT 1,
                telegram_token TEXT DEFAULT '',
                telegram_chat_id TEXT DEFAULT '',
                notify_fall INTEGER NOT NULL DEFAULT 1,
                notify_sos INTEGER NOT NULL DEFAULT 1,
                notify_battery INTEGER NOT NULL DEFAULT 1,
                notify_first_motion INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL
            )
            """
        )

        now = utc_now()
        if not conn.execute("SELECT id FROM geofence_config WHERE id = 1").fetchone():
            conn.execute(
                "INSERT INTO geofence_config (id, home_lat, home_lng, radius_m, address_name, updated_at) VALUES (1, ?, ?, ?, ?, ?)",
                (-34.6037, -58.3816, 200, "Residencia / Hogar Central", now),
            )
        if not conn.execute("SELECT id FROM notification_config WHERE id = 1").fetchone():
            conn.execute(
                "INSERT INTO notification_config (id, sound_enabled, telegram_token, telegram_chat_id, notify_fall, notify_sos, notify_battery, notify_first_motion, updated_at) VALUES (1, 1, '', '', 1, 1, 1, 1, ?)",
                (now,),
            )
        if "notify_geofence" not in {r[1] for r in conn.execute("PRAGMA table_info(notification_config)")}:
            conn.execute("ALTER TABLE notification_config ADD COLUMN notify_geofence INTEGER NOT NULL DEFAULT 1")
    location_service.init_db()
    email_channel.init_db()
    cloud_sync.init_db()


def save_record(payload: dict[str, Any]) -> None:
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            INSERT INTO records (
                created_at, type, raw, state, event_type, detail,
                accel_g, tilt_deg, motion, fall_count
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                utc_now(),
                payload.get("type"),
                payload.get("raw", ""),
                payload.get("state"),
                payload.get("event_type"),
                payload.get("detail"),
                payload.get("accel_g"),
                payload.get("tilt_deg"),
                payload.get("motion"),
                payload.get("fall_count"),
            ),
        )
        resident_id = payload.get("resident_id")
        if not resident_id:
            active = conn.execute("SELECT id FROM residents WHERE is_active=1 LIMIT 1").fetchone()
            resident_id = active[0] if active else None
        cloud_sync.capture(conn, payload, resident_id)
    check_and_notify_event(payload)


def parse_serial_line(line: str) -> dict[str, Any]:
    parts = [part.strip() for part in line.split(",")]
    kind = parts[0].upper() if parts else "RAW"

    if kind == "TEL" and len(parts) >= 10:
        return {
            "type": "telemetry",
            "raw": line,
            "device_ms": to_int(parts[1]),
            "state": parts[2],
            "ax": to_float(parts[3]),
            "ay": to_float(parts[4]),
            "az": to_float(parts[5]),
            "accel_g": to_float(parts[6]),
            "tilt_deg": to_float(parts[7]),
            "motion": to_float(parts[8]),
            "fall_count": to_int(parts[9]),
            "received_at": utc_now(),
        }

    if kind == "EVT" and len(parts) >= 4:
        payload = {
            "type": "event",
            "raw": line,
            "device_ms": to_int(parts[1]),
            "event_type": parts[2],
            "detail": ",".join(parts[3:]),
            "received_at": utc_now(),
        }
        if parts[2] == "CAIDA_CONFIRMADA":
            payload["priority"] = "critical"
        return payload

    if kind == "RSP" and len(parts) >= 3:
        return {
            "type": "response",
            "raw": line,
            "command": parts[1],
            "result": ",".join(parts[2:]),
            "received_at": utc_now(),
        }

    if kind == "BOOT":
        return {"type": "boot", "raw": line, "received_at": utc_now()}

    return {"type": "raw", "raw": line, "received_at": utc_now()}


def to_float(value: str) -> float | None:
    try:
        return float(value)
    except ValueError:
        return None


def to_int(value: str) -> int | None:
    try:
        return int(value)
    except ValueError:
        return None


def serial_error_message(exc: Exception, port: str) -> str:
    text = str(exc).lower()
    if "access is denied" in text or "acceso denegado" in text or "permissionerror" in text:
        return f"No se puede abrir {port}: está siendo utilizado por otro programa. Cierre el Monitor Serie y vuelva a conectar."
    if "cannot find" in text or "no se encuentra" in text or "no puede encontrar" in text or "filenotfounderror" in text:
        return f"No se encuentra {port}. Revise el cable USB y actualice los puertos."
    return f"Error de comunicación con {port}: {exc}"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    bridge.set_loop(asyncio.get_running_loop())
    async def watchdog():
        while True:
            await asyncio.sleep(5)
            try:
                for payload in await asyncio.to_thread(location_service.mark_stale):
                    save_record(payload)
                    await bridge.broadcast(payload)
            except sqlite3.OperationalError:
                # A temporary database lock must not permanently disable supervision.
                continue
    task = asyncio.create_task(watchdog())
    async def synchronize_cloud():
        while True:
            await asyncio.sleep(2)
            try:
                await asyncio.to_thread(cloud_sync.flush)
            except (CloudError, sqlite3.OperationalError):
                continue
    sync_task = asyncio.create_task(synchronize_cloud())
    try:
        yield
    finally:
        task.cancel()
        sync_task.cancel()
        with suppress(asyncio.CancelledError):
            await task
        with suppress(asyncio.CancelledError):
            await sync_task
        cloud_sync.pause()
        bridge.disconnect()


app = FastAPI(title="SFA Alerta Anticaídas", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
if ACCESS_DIR.is_dir():
    app.mount("/acceso", StaticFiles(directory=ACCESS_DIR, html=True), name="access")


@app.get("/")
@app.get("/compartir-ubicacion")
def index() -> FileResponse:
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/favicon.ico")
@app.get("/favicon.svg")
def favicon() -> FileResponse:
    svg_path = STATIC_DIR / "favicon.svg"
    if svg_path.exists():
        return FileResponse(svg_path, media_type="image/svg+xml")
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/assets/{path:path}")
def direct_assets(path: str) -> FileResponse:
    asset_file = STATIC_DIR / "assets" / path
    if asset_file.exists():
        return FileResponse(asset_file)
    return FileResponse(STATIC_DIR / "index.html", status_code=404)


@app.get("/api/ports")
def ports() -> list[dict[str, Any]]:
    return [
        {
            "device": port.device,
            "description": port.description,
            "hwid": port.hwid,
        }
        for port in list_ports.comports()
    ]


@app.get("/api/status")
def status() -> dict[str, Any]:
    return bridge.status()


@app.post("/api/connect")
async def connect(req: SerialConnectRequest) -> dict[str, Any]:
    try:
        bridge.connect(req.port, req.baudrate)
    except RuntimeError:
        payload = {"type": "status", **bridge.status()}
        await bridge.broadcast(payload)
        return payload
    # El UNO suele reiniciarse al abrir el USB. Esperar evita que pierda el
    # comando y garantiza que un STREAM OFF previo no deje el tablero sin datos.
    await asyncio.sleep(2.0 if req.baudrate == 115200 else 0.2)
    try:
        bridge.send_command("STREAM ON")
    except (RuntimeError, serial.SerialException):
        pass
    payload = {"type": "status", **bridge.status()}
    await bridge.broadcast(payload)
    return payload


@app.post("/api/disconnect")
async def disconnect() -> dict[str, Any]:
    bridge.disconnect()
    payload = {"type": "status", **bridge.status()}
    await bridge.broadcast(payload)
    return payload


@app.post("/api/command")
async def command(req: CommandRequest) -> dict[str, str]:
    bridge.send_command(req.command)
    return {"status": "sent", "command": req.command}


@app.post("/api/simulate/fall")
async def simulate_fall() -> dict[str, Any]:
    payload = {
        "type": "event",
        "event_type": "CAIDA_CONFIRMADA",
        "detail": "simulacion_interfaz",
        "simulated": True,
        "raw": "EVT,0,CAIDA_CONFIRMADA,simulacion_interfaz",
        "received_at": utc_now(),
        "priority": "critical",
    }
    save_record(payload)
    await bridge.broadcast(payload)
    return payload


@app.post("/api/simulate/state")
async def simulate_state(req: SimulationStateRequest) -> dict[str, Any]:
    state = req.state.strip().upper()
    allowed = {
        "NORMAL": (1.0, 6.0, 0.012),
        "EVENTO_INERCIAL": (2.55, 28.0, 0.260),
        "POSIBLE_CAIDA": (1.18, 64.0, 0.035),
        "CAIDA_CONFIRMADA": (1.05, 72.0, 0.006),
        "ALERTA_SILENCIADA": (1.02, 61.0, 0.010),
    }
    if state not in allowed:
        return {"type": "error", "message": "Estado de simulación no soportado"}

    accel_g, tilt_deg, motion = allowed[state]
    payload = {
        "type": "telemetry",
        "raw": f"TEL,0,{state},0.000,0.000,1.000,{accel_g:.3f},{tilt_deg:.1f},{motion:.3f},0",
        "device_ms": 0,
        "state": state,
        "ax": 0.0,
        "ay": 0.0,
        "az": 1.0,
        "accel_g": accel_g,
        "tilt_deg": tilt_deg,
        "motion": motion,
        "fall_count": 0,
        "received_at": utc_now(),
        "simulated": True,
    }
    bridge.latest = payload
    save_record(payload)
    await bridge.broadcast(payload)

    if state in {"EVENTO_INERCIAL", "POSIBLE_CAIDA", "CAIDA_CONFIRMADA"}:
        event_payload = {
            "type": "event",
            "event_type": state,
            "detail": "simulacion_guiada",
            "simulated": True,
            "raw": f"EVT,0,{state},simulacion_guiada",
            "received_at": utc_now(),
            "priority": "critical" if state == "CAIDA_CONFIRMADA" else "warning",
        }
        save_record(event_payload)
        await bridge.broadcast(event_payload)

    return payload


@app.post("/api/alert-action")
async def alert_action(req: AlertActionRequest) -> dict[str, Any]:
    normalized = req.action.strip().lower()
    labels = {
        "attended": ("ALERTA_ATENDIDA", "Alerta marcada como atendida"),
        "false_alarm": ("FALSA_ALARMA", "Evento registrado como falsa alarma"),
        "mute": ("ALERTA_SILENCIADA", "Alarma silenciada desde la interfaz"),
    }
    if normalized not in labels:
        raise HTTPException(400, "Accion no soportada")

    device_command = None
    if bridge.status()["connected"]:
        device_command = "MUTE" if normalized == "mute" else "RESET"
        try:
            await bridge.confirm_alert_command(device_command)
        except TimeoutError as exc:
            raise HTTPException(504, str(exc)) from exc
        except (RuntimeError, serial.SerialException) as exc:
            raise HTTPException(409, str(exc)) from exc

    event_type, detail = labels[normalized]
    if req.note:
        detail = f"{detail}: {req.note}"

    payload = {
        "type": "event",
        "event_type": event_type,
        "detail": detail,
        "raw": f"EVT,0,{event_type},{detail}",
        "received_at": utc_now(),
        "operator_action": True,
        "device_command": device_command,
        "device_confirmed": device_command is not None,
    }
    save_record(payload)
    await bridge.broadcast(payload)
    return payload


@app.get("/api/records")
def records(limit: int = 80) -> list[dict[str, Any]]:
    limit = max(1, min(limit, 300))
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM records ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]


@app.get("/api/residents")
def get_residents() -> list[dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM residents ORDER BY is_active DESC, id ASC").fetchall()
        return [public_resident(r) for r in rows]


@app.put("/api/residents/{res_id}/photo")
def upload_resident_photo(res_id: int, req: ResidentPhotoRequest) -> dict[str, Any]:
    try:
        photo = base64.b64decode(req.photo_base64, validate=True)
    except (ValueError, binascii.Error):
        raise HTTPException(400, "Imagen codificada incorrectamente")
    if not photo.startswith(b"\xff\xd8\xff") or not photo.endswith(b"\xff\xd9"):
        raise HTTPException(400, "La foto debe estar en formato JPEG")
    if len(photo) > 1_500_000:
        raise HTTPException(413, "La foto supera el tamaño permitido")
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute("UPDATE residents SET photo = ? WHERE id = ?", (photo, res_id))
        if not cursor.rowcount:
            raise HTTPException(404, "Residente no encontrado")
    return {"photo_url": f"/api/residents/{res_id}/photo?v={time.time_ns()}"}


@app.get("/api/residents/{res_id}/photo")
def get_resident_photo(res_id: int) -> Response:
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT photo FROM residents WHERE id = ?", (res_id,)).fetchone()
    if not row or not row[0]:
        raise HTTPException(404, "Foto no disponible")
    return Response(row[0], media_type="image/jpeg", headers={
        "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
    })


@app.delete("/api/residents/{res_id}/photo")
def remove_resident_photo(res_id: int) -> dict[str, Any]:
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute("UPDATE residents SET photo = NULL WHERE id = ?", (res_id,))
        if not cursor.rowcount:
            raise HTTPException(404, "Residente no encontrado")
    return {"photo_url": None}


@app.post("/api/residents")
def create_resident(req: ResidentCreateRequest) -> dict[str, Any]:
    now = utc_now()
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            """
            INSERT INTO residents (full_name, room, phone, emergency_phone, medical_notes, is_active, updated_at)
            VALUES (?, ?, ?, ?, ?, 0, ?)
            """,
            (req.full_name.strip(), req.room.strip(), req.phone.strip(), req.emergency_phone.strip(), req.medical_notes.strip(), now),
        )
        new_id = cursor.lastrowid
        count = conn.execute("SELECT COUNT(*) FROM residents").fetchone()[0]
        if count == 1:
            conn.execute("UPDATE residents SET is_active = 1 WHERE id = ?", (new_id,))
        return {"id": new_id, "status": "ok"}


@app.post("/api/residents/{res_id}/activate")
def activate_resident(res_id: int) -> dict[str, Any]:
    now = utc_now()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("UPDATE residents SET is_active = 0")
        conn.execute("UPDATE residents SET is_active = 1, updated_at = ? WHERE id = ?", (now, res_id))
    return {"status": "ok", "active_id": res_id}


@app.delete("/api/residents/{res_id}")
def delete_resident(res_id: int) -> dict[str, Any]:
    with sqlite3.connect(DB_PATH) as conn:
        location_service.purge_resident(conn, res_id)
        conn.execute("DELETE FROM residents WHERE id = ?", (res_id,))
        active = conn.execute("SELECT id FROM residents WHERE is_active = 1").fetchone()
        if not active:
            first = conn.execute("SELECT id FROM residents ORDER BY id ASC LIMIT 1").fetchone()
            if first:
                conn.execute("UPDATE residents SET is_active = 1 WHERE id = ?", (first[0],))
    return {"status": "ok"}


@app.get("/api/profile")
def get_profile() -> dict[str, Any]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM residents WHERE is_active = 1 LIMIT 1").fetchone()
        if not row:
            row = conn.execute("SELECT * FROM residents ORDER BY id ASC LIMIT 1").fetchone()
        return public_resident(row) if row else {}


@app.put("/api/profile")
def update_profile(req: ResidentProfileRequest) -> dict[str, Any]:
    now = utc_now()
    with sqlite3.connect(DB_PATH) as conn:
        row = conn.execute("SELECT id FROM residents WHERE is_active = 1 LIMIT 1").fetchone()
        if row:
            res_id = row[0]
            conn.execute(
                """
                UPDATE residents
                SET full_name = ?, room = ?, phone = ?, emergency_phone = ?, medical_notes = ?, updated_at = ?
                WHERE id = ?
                """,
                (req.full_name.strip(), req.room.strip(), req.phone.strip(), req.emergency_phone.strip(), req.medical_notes.strip(), now, res_id),
            )
        else:
            conn.execute(
                """
                INSERT INTO residents (full_name, room, phone, emergency_phone, medical_notes, is_active, updated_at)
                VALUES (?, ?, ?, ?, ?, 1, ?)
                """,
                (req.full_name.strip(), req.room.strip(), req.phone.strip(), req.emergency_phone.strip(), req.medical_notes.strip(), now),
            )
        conn.row_factory = sqlite3.Row
        saved = conn.execute("SELECT * FROM residents WHERE is_active = 1 LIMIT 1").fetchone()
        resident = public_resident(saved)
    return {"status": "ok", "updated_at": now, "resident": resident}


@app.get("/api/geofence")
def get_geofence() -> dict[str, Any]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM geofence_config WHERE id = 1").fetchone()
        return dict(row) if row else {}


@app.put("/api/geofence")
def update_geofence(req: GeofenceConfigRequest) -> dict[str, Any]:
    now = utc_now()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            UPDATE geofence_config
            SET home_lat = ?, home_lng = ?, radius_m = ?, address_name = ?, updated_at = ?
            WHERE id = 1
            """,
            (req.home_lat, req.home_lng, req.radius_m, req.address_name.strip(), now),
        )
    return {"status": "ok", "updated_at": now}


@app.get("/api/notifications")
def get_notifications() -> dict[str, Any]:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        row = conn.execute("SELECT * FROM notification_config WHERE id = 1").fetchone()
        if not row:
            return {}
        data = dict(row)
        data["sound_enabled"] = bool(data.get("sound_enabled", 1))
        data["notify_fall"] = bool(data.get("notify_fall", 1))
        data["notify_sos"] = bool(data.get("notify_sos", 1))
        data["notify_battery"] = bool(data.get("notify_battery", 1))
        data["notify_first_motion"] = bool(data.get("notify_first_motion", 1))
        data["notify_geofence"] = bool(data.get("notify_geofence", 1))
        return data


@app.put("/api/notifications")
def update_notifications(req: NotificationConfigRequest) -> dict[str, Any]:
    now = utc_now()
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute(
            """
            UPDATE notification_config
            SET sound_enabled = ?, telegram_token = ?, telegram_chat_id = ?,
                notify_fall = ?, notify_sos = ?, notify_battery = ?, notify_first_motion = ?, notify_geofence = ?, updated_at = ?
            WHERE id = 1
            """,
            (
                int(req.sound_enabled),
                req.telegram_token.strip(),
                req.telegram_chat_id.strip(),
                int(req.notify_fall),
                int(req.notify_sos),
                int(req.notify_battery),
                int(req.notify_first_motion),
                int(req.notify_geofence),
                now,
            ),
        )
    return {"status": "ok", "updated_at": now}


@app.post("/api/notifications/test-telegram")
def test_telegram() -> dict[str, Any]:
    now = datetime.now().strftime("%H:%M:%S")
    msg = f"🔔 <b>PRUEBA DE CONEXIÓN SFA</b>\n\nEl canal de alertas de emergencia con Telegram está configurado y funcionando correctamente.\n⏱ <i>Hora del servidor: {now}</i>"
    success = send_telegram_notification(msg)
    return {"status": "ok" if success else "error", "sent": success}


@app.get("/api/network-info")
def network_info(request: Request) -> dict[str, Any]:
    addresses = local_addresses()
    server = request.scope.get("server")
    port = server[1] if server else int(os.environ.get("SFA_SERVER_PORT", "8780"))
    server_ip = server[0] if server else None
    ip = server_ip if server_ip in addresses else (addresses[0] if addresses else "127.0.0.1")
    available = False
    if ip != "127.0.0.1":
        try:
            with socket.create_connection((ip, port), timeout=0.3):
                available = True
        except OSError:
            pass
    return {
        "local_ip": ip,
        "port": port,
        "url": f"{request.url.scheme}://{ip}:{port}",
        "lan_available": available,
        "addresses": addresses,
    }


@app.get("/api/configuration/export")
def export_configuration() -> Response:
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        residents = []
        for row in conn.execute("SELECT * FROM residents ORDER BY id"):
            residents.append({
                key: row[key] for key in ("full_name", "room", "phone", "emergency_phone", "medical_notes", "is_active")
            } | {"photo_base64": base64.b64encode(row["photo"]).decode("ascii") if row["photo"] else None,
                 "geofence": location_service.fence(conn, row["id"])})
        geofence = dict(conn.execute("SELECT * FROM geofence_config WHERE id = 1").fetchone())
        notifications = dict(conn.execute("SELECT * FROM notification_config WHERE id = 1").fetchone())
    notifications["telegram_token"] = ""
    notifications["telegram_chat_id"] = ""
    payload = {"format": "sfa-configuration", "version": 1, "exported_at": utc_now(),
               "residents": residents, "geofence": geofence, "notifications": notifications}
    return Response(json.dumps(payload, ensure_ascii=False, indent=2), media_type="application/json",
                    headers={"Content-Disposition": 'attachment; filename="SFA-configuracion.json"', "Cache-Control": "no-store"})


@app.post("/api/configuration/import")
def import_configuration(backup: ConfigurationBackup) -> dict[str, Any]:
    if backup.format != "sfa-configuration" or backup.version != 1:
        raise HTTPException(400, "Formato de copia no compatible")
    photos = []
    for resident in backup.residents:
        try:
            photo = base64.b64decode(resident.photo_base64, validate=True) if resident.photo_base64 else None
        except (ValueError, binascii.Error):
            raise HTTPException(400, "Foto codificada incorrectamente")
        if photo and (len(photo) > 1_500_000 or not photo.startswith(b"\xff\xd8\xff") or not photo.endswith(b"\xff\xd9")):
            raise HTTPException(400, "Foto de la copia no válida")
        photos.append(photo)
    now = utc_now()
    with sqlite3.connect(DB_PATH) as conn:
        location_service.purge_resident(conn)
        conn.execute("DELETE FROM residents")
        active_assigned = False
        for resident, photo in zip(backup.residents, photos):
            active = bool(resident.is_active and not active_assigned)
            active_assigned |= active
            cursor = conn.execute("INSERT INTO residents (full_name, room, phone, emergency_phone, medical_notes, is_active, updated_at, photo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                         (resident.full_name.strip(), resident.room.strip(), resident.phone.strip(), resident.emergency_phone.strip(), resident.medical_notes.strip(), int(active), now, photo))
            if resident.geofence:
                fence = resident.geofence
                conn.execute("INSERT INTO resident_geofences VALUES (?,?,?,?,?)", (cursor.lastrowid, fence.home_lat, fence.home_lng, fence.radius_m, fence.address_name))
        if not active_assigned:
            conn.execute("UPDATE residents SET is_active = 1 WHERE id = (SELECT MIN(id) FROM residents)")
        geo = backup.geofence
        conn.execute("UPDATE geofence_config SET home_lat=?, home_lng=?, radius_m=?, address_name=?, updated_at=? WHERE id=1",
                     (geo.home_lat, geo.home_lng, geo.radius_m, geo.address_name, now))
        prefs = backup.notifications
        conn.execute("UPDATE notification_config SET sound_enabled=?, notify_fall=?, notify_sos=?, notify_battery=?, notify_first_motion=?, notify_geofence=?, updated_at=? WHERE id=1",
                     (prefs.sound_enabled, prefs.notify_fall, prefs.notify_sos, prefs.notify_battery, prefs.notify_first_motion, prefs.notify_geofence, now))
    return {"status": "ok", "residents_restored": len(backup.residents)}


def require_local_operator(request: Request) -> None:
    own_addresses = {"127.0.0.1", "::1", *local_addresses()}
    if not request.client or request.client.host not in own_addresses:
        raise HTTPException(403, "Esta operación se realiza desde la PC del servidor")
    origin = request.headers.get("origin")
    allowed = {f"{request.url.scheme}://{request.url.netloc}"}
    if request.client.host in {"127.0.0.1", "::1"}:
        allowed.update({"http://127.0.0.1:5173", "http://localhost:5173"})
    if origin and origin not in allowed:
        raise HTTPException(403, "Origen no autorizado")


@app.middleware("http")
async def private_responses(request: Request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/") or request.url.path == "/compartir-ubicacion":
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "no-referrer"
    return response


class LocationPairRequest(BaseModel):
    replace_existing: bool = False


@app.post("/api/residents/{resident_id}/location-device")
def pair_location_device(resident_id: int, request: Request, body: LocationPairRequest | None = None):
    require_local_operator(request)
    return location_service.pair(resident_id, replace_existing=bool(body and body.replace_existing))


@app.delete("/api/residents/{resident_id}/location-device")
def revoke_location_device(resident_id: int, request: Request):
    require_local_operator(request)
    location_service.revoke(resident_id)
    return {"status": "revoked"}


@app.get("/api/residents/{resident_id}/location")
def resident_location(resident_id: int):
    return location_service.snapshot(resident_id)


@app.get("/api/residents/{resident_id}/geofence")
def resident_geofence(resident_id: int):
    return location_service.get_fence(resident_id)


@app.get("/api/residents/{resident_id}/location-history")
def resident_location_history(resident_id: int, request: Request, limit: int = 100):
    require_local_operator(request)
    return location_service.history(resident_id, limit)


@app.put("/api/residents/{resident_id}/geofence")
def save_resident_geofence(resident_id: int, fence: FenceInput, request: Request):
    require_local_operator(request)
    return location_service.set_fence(resident_id, fence)


@app.post("/api/location")
async def receive_location(sample: PositionInput, request: Request, authorization: str = Header(default="")):
    if request.url.scheme != "https" and (not request.client or request.client.host not in {"127.0.0.1", "::1"}):
        raise HTTPException(403, "Compartir ubicación requiere HTTPS")
    if not authorization.startswith("Bearer ") or len(authorization) > 200:
        raise HTTPException(401, "Se requiere el vínculo del dispositivo")
    snapshot, events = await asyncio.to_thread(location_service.ingest, authorization[7:], sample)
    for payload in events:
        save_record(payload)
        await bridge.broadcast(payload)
    await bridge.broadcast({"type": "location", **snapshot})
    return snapshot


@app.get("/api/location/context")
def location_device_context(request: Request, authorization: str = Header(default="")):
    if request.url.scheme != 'https' and (not request.client or request.client.host not in {'127.0.0.1', '::1'}):
        raise HTTPException(403, 'Se requiere HTTPS')
    if not authorization.startswith('Bearer ') or len(authorization) > 200:
        raise HTTPException(401, 'Se requiere el vínculo del dispositivo')
    return location_service.device_context(authorization[7:])


@app.get("/api/notifications/email")
def email_status(request: Request):
    require_local_operator(request)
    return email_channel.status()


@app.post("/api/notifications/test-email")
async def test_email(request: Request):
    require_local_operator(request)
    return await asyncio.to_thread(email_channel.send, "PRUEBA", "Prueba de correo de SFA Asistencia. Confirmar recepción en el buzón; la aceptación SMTP no garantiza la entrega.")


class CloudConnectRequest(BaseModel):
    resident_id: int = Field(gt=0)
    space_id: UUID
    consent: bool


def require_cloud_operator(request: Request) -> None:
    require_local_operator(request)
    if not request.client or request.client.host not in {"127.0.0.1", "::1"}:
        raise HTTPException(403, "La vinculación cloud se realiza en localhost de esta PC")


def cloud_bearer(value: str) -> str:
    if not value.startswith("Bearer ") or len(value)>16400:
        raise HTTPException(401, "Inicia sesión con tu cuenta SFA")
    return value[7:]


@app.get("/api/cloud/status")
def cloud_status(request: Request):
    require_cloud_operator(request)
    return cloud_sync.status()


@app.get("/api/cloud/residents/{resident_id}/location")
def cloud_resident_location(resident_id: int, request: Request):
    require_cloud_operator(request)
    try:
        return cloud_sync.remote_location(resident_id)
    except CloudError as exc:
        raise HTTPException(exc.status, {"code": exc.code, "message": "No se pudo consultar el GPS remoto"}) from None


@app.post("/api/launcher/stop")
def launcher_stop(request: Request, authorization: str = Header(default="")):
    require_cloud_operator(request)
    control = getattr(app.state, 'local_shutdown', None)
    if not control or not secrets.compare_digest(authorization, 'Bearer ' + control[0]):
        raise HTTPException(403, "Se requiere el control local de esta instancia")
    control[1].should_exit = True
    return {"status": "stopping"}


class RemoteGeofenceRequest(BaseModel):
    p_lat: float = Field(ge=-90, le=90, allow_inf_nan=False)
    p_lng: float = Field(ge=-180, le=180, allow_inf_nan=False)
    p_radius: int = Field(ge=5, le=100000)
    p_label: str = Field(min_length=1, max_length=100)
    p_expected: str | None = Field(default=None, max_length=64)


class RemoteAttentionRequest(BaseModel):
    p_expected: str | None = Field(default=None, max_length=64)
    p_outcome: str = Field(pattern="^(attending|attended|false_alarm)$")


class PushTestRequest(BaseModel):
    installation_id: UUID
    confirmed: bool = False


@app.get("/api/cloud/residents/{resident_id}/push-test")
def push_test_targets(resident_id: int, request: Request):
    require_cloud_operator(request)
    try:
        return cloud_sync.push_test(resident_id)
    except CloudError as exc:
        raise HTTPException(exc.status, {"code":exc.code}) from None


@app.post("/api/cloud/residents/{resident_id}/push-test")
def send_push_test(resident_id: int, body: PushTestRequest, request: Request):
    require_cloud_operator(request)
    if not body.confirmed: raise HTTPException(422, {"code":"confirmation_required"})
    try:
        return cloud_sync.push_test(resident_id,str(body.installation_id))
    except CloudError as exc:
        raise HTTPException(exc.status, {"code":exc.code}) from None


@app.get("/api/cloud/residents/{resident_id}/incidents")
def get_remote_incidents(resident_id: int, request: Request):
    require_cloud_operator(request)
    try:
        return cloud_sync.remote_incidents(resident_id)
    except CloudError as exc:
        raise HTTPException(exc.status, {"code": exc.code}) from None


@app.post("/api/cloud/residents/{resident_id}/incidents/{event_id}/attention")
def attend_remote_incident(resident_id: int, event_id: UUID, body: RemoteAttentionRequest, request: Request):
    require_cloud_operator(request)
    try:
        return cloud_sync.remote_incidents(resident_id, {**body.model_dump(), 'p_event': str(event_id)})
    except CloudError as exc:
        raise HTTPException(exc.status, {"code": exc.code}) from None


@app.get("/api/cloud/residents/{resident_id}/geofence")
def get_remote_geofence(resident_id: int, request: Request):
    require_cloud_operator(request)
    try:
        return cloud_sync.remote_geofence(resident_id)
    except CloudError as exc:
        raise HTTPException(exc.status, {"code": exc.code}) from None


@app.put("/api/cloud/residents/{resident_id}/geofence")
def save_remote_geofence(resident_id: int, body: RemoteGeofenceRequest, request: Request):
    require_cloud_operator(request)
    try:
        return cloud_sync.remote_geofence(resident_id, body.model_dump())
    except CloudError as exc:
        raise HTTPException(exc.status, {"code": exc.code}) from None


@app.post("/api/cloud/connect")
def cloud_connect(body: CloudConnectRequest, request: Request, authorization: str = Header(default="")):
    require_cloud_operator(request)
    if not body.consent:
        raise HTTPException(422, "Se requiere autorizar los datos que se sincronizarán")
    token = cloud_bearer(authorization)
    with sqlite3.connect(DB_PATH) as conn:
        active = conn.execute("SELECT is_active FROM residents WHERE id=?", (body.resident_id,)).fetchone()
    if not active or not active[0]:
        raise HTTPException(409, "Solo se vincula el perfil activo del cinturón")
    try:
        return cloud_sync.connect(token, body.resident_id, str(body.space_id))
    except CloudError as exc:
        raise HTTPException(exc.status, {"code": exc.code, "message": "No se pudo vincular la PC"}) from None


@app.post("/api/cloud/session")
def cloud_session(request: Request, authorization: str = Header(default="")):
    require_cloud_operator(request)
    try:
        cloud_sync.authenticate(cloud_bearer(authorization))
        return cloud_sync.status()
    except CloudError as exc:
        raise HTTPException(exc.status, "La sesión cloud no está disponible") from None


@app.post("/api/cloud/pause")
def cloud_pause(request: Request):
    require_cloud_operator(request)
    cloud_sync.pause()
    return cloud_sync.status()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await bridge.add_client(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        bridge.remove_client(websocket)

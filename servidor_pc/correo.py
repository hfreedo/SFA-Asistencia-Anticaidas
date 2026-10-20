from __future__ import annotations

import os
import smtplib
import sqlite3
import ssl
import time
from datetime import datetime, timezone
from email.message import EmailMessage
from contextlib import contextmanager


class EmailChannel:
    def __init__(self, db_path):
        self.db_path = db_path

    def init_db(self):
        with self.connection() as conn:
            conn.execute("""CREATE TABLE IF NOT EXISTS email_deliveries (
                id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL,
                event_type TEXT NOT NULL, resident_id INTEGER, status TEXT NOT NULL,
                attempts INTEGER NOT NULL, error TEXT
            )""")

    @contextmanager
    def connection(self):
        conn = sqlite3.connect(self.db_path(), timeout=10)
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def config(self):
        return {key: os.getenv("SFA_SMTP_" + key.upper(), "").strip()
                for key in ("host", "port", "user", "password", "from", "to")}

    def status(self):
        cfg = self.config()
        with self.connection() as conn:
            conn.row_factory = sqlite3.Row
            rows = [dict(r) for r in conn.execute("SELECT * FROM email_deliveries ORDER BY id DESC LIMIT 10")]
        return {"configured": bool(cfg["host"] and cfg["from"] and cfg["to"]), "deliveries": rows}

    def send(self, event_type, text, resident_id=None):
        cfg = self.config()
        if not (cfg["host"] and cfg["from"] and cfg["to"]):
            return {"status": "not_configured", "sent": False}
        status, error, attempts = "failed", None, 0
        for attempt in range(3):
            attempts = attempt + 1
            try:
                port = int(cfg["port"] or "587")
                message = EmailMessage()
                message["Subject"] = f"SFA Asistencia - {event_type}"
                message["From"] = cfg["from"]
                recipients = [value.strip() for value in cfg["to"].split(",") if value.strip()]
                message["To"] = ", ".join(recipients)
                message.set_content(text)
                context = ssl.create_default_context()
                if port == 465:
                    smtp = smtplib.SMTP_SSL(cfg["host"], port, timeout=10, context=context)
                else:
                    smtp = smtplib.SMTP(cfg["host"], port, timeout=10)
                with smtp as client:
                    if port != 465:
                        client.starttls(context=context)
                    if cfg["user"]:
                        client.login(cfg["user"], cfg["password"])
                    refused = client.send_message(message, to_addrs=recipients)
                    if refused:
                        raise smtplib.SMTPRecipientsRefused(refused)
                status, error = "accepted", None
                break
            except (OSError, smtplib.SMTPException, ValueError):
                # Do not persist provider responses: they may contain addresses or credentials.
                error = "No se pudo confirmar aceptación SMTP; revisar configuración en privado"
                if attempt < 2:
                    time.sleep(2 ** attempt)
        with self.connection() as conn:
            conn.execute("INSERT INTO email_deliveries (created_at,event_type,resident_id,status,attempts,error) VALUES (?,?,?,?,?,?)",
                         (datetime.now(timezone.utc).isoformat(), event_type, resident_id, status, attempts, error))
            conn.execute("DELETE FROM email_deliveries WHERE id NOT IN (SELECT id FROM email_deliveries ORDER BY id DESC LIMIT 200)")
        return {"status": status, "sent": status == "accepted"}

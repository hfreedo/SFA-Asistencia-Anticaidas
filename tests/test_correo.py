import os
import smtplib
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from servidor_pc.correo import EmailChannel


class EmailTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.channel = EmailChannel(lambda: Path(self.tmp.name) / "email.sqlite3")
        self.channel.init_db()
        self.env = patch.dict(os.environ, {"SFA_SMTP_HOST": "smtp.example.invalid", "SFA_SMTP_PORT": "587", "SFA_SMTP_FROM": "sfa@example.invalid", "SFA_SMTP_TO": "care@example.invalid", "SFA_SMTP_USER": "", "SFA_SMTP_PASSWORD": "private"})
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_no_configuration_does_not_attempt_network(self):
        with patch.dict(os.environ, {"SFA_SMTP_HOST": ""}), patch("servidor_pc.correo.smtplib.SMTP") as smtp:
            self.assertFalse(self.channel.send("TEST", "Prueba")["sent"])
            smtp.assert_not_called()

    def test_starttls_and_accepted_log(self):
        with patch("servidor_pc.correo.smtplib.SMTP") as smtp:
            smtp.return_value.__enter__.return_value.send_message.return_value = {}
            self.assertTrue(self.channel.send("TEST", "Prueba", 1)["sent"])
            smtp.return_value.__enter__.return_value.starttls.assert_called_once()
        log = self.channel.status()["deliveries"][0]
        self.assertEqual(log["status"], "accepted")
        self.assertEqual(log["attempts"], 1)

    def test_failure_retries_and_does_not_log_provider_secrets(self):
        with patch("servidor_pc.correo.smtplib.SMTP", side_effect=smtplib.SMTPException("private")), patch("servidor_pc.correo.time.sleep"):
            self.assertFalse(self.channel.send("TEST", "Prueba")["sent"])
        row = self.channel.status()["deliveries"][0]
        self.assertEqual(row["attempts"], 3)
        self.assertNotIn("private", row["error"])

    def test_implicit_tls(self):
        with patch.dict(os.environ, {"SFA_SMTP_PORT": "465"}), patch("servidor_pc.correo.smtplib.SMTP_SSL") as smtp:
            smtp.return_value.__enter__.return_value.send_message.return_value = {}
            self.assertTrue(self.channel.send("TEST", "Prueba")["sent"])
            smtp.return_value.__enter__.return_value.starttls.assert_not_called()

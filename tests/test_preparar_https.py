import ssl
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from servidor_pc.preparar_https import covers_addresses, find_openssl, main, prepare


class HttpsPreparationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            cls.openssl = find_openssl()
        except RuntimeError as error:
            raise unittest.SkipTest(str(error))

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)

    def test_prepare_reuses_ca_and_valid_certificate(self):
        with patch("servidor_pc.preparar_https.subprocess.run", wraps=__import__('subprocess').run) as calls:
            first = prepare(self.root, ["192.168.10.2"])
            ca_key = (self.root / "certs/ca/rootCA-key.pem").read_bytes()
            certificate = first["certificate"].read_bytes()
            second = prepare(self.root, ["192.168.10.2"])
        self.assertTrue(first["generated"])
        self.assertFalse(second["generated"])
        self.assertEqual(certificate, second["certificate"].read_bytes())
        self.assertEqual(ca_key, (self.root / "certs/ca/rootCA-key.pem").read_bytes())
        self.assertFalse(any("certutil" in str(call.args) for call in calls.call_args_list))
        ssl.create_default_context(cafile=str(self.root / "certs/ca/rootCA.pem"))
        self.assertTrue(first["public_ca"].is_file())

    def test_network_change_renews_server_not_ca(self):
        first = prepare(self.root, ["192.168.10.2"])
        ca = (self.root / "certs/ca/rootCA.pem").read_bytes()
        self.assertFalse(covers_addresses(self.openssl, first["certificate"], first["key"], ["192.168.10.3"]))
        second = prepare(self.root, ["192.168.10.3"])
        self.assertTrue(second["generated"])
        self.assertEqual(ca, (self.root / "certs/ca/rootCA.pem").read_bytes())
        self.assertTrue(covers_addresses(self.openssl, second["certificate"], second["key"], ["192.168.10.3"]))

    def test_custom_paths_are_not_overwritten(self):
        certificate = self.root / "custom.pem"
        certificate.write_text("Keep existing file", encoding="ascii")
        with self.assertRaises(RuntimeError):
            prepare(self.root, [], certificate, self.root / "custom-key.pem")
        self.assertEqual(certificate.read_text(), "Keep existing file")

    def test_incomplete_ca_is_not_replaced(self):
        folder = self.root / "certs/ca"
        folder.mkdir(parents=True)
        ca = folder / "rootCA.pem"
        ca.write_text("Preserve identity", encoding="ascii")
        with self.assertRaises(RuntimeError):
            prepare(self.root, [])
        self.assertEqual(ca.read_text(), "Preserve identity")

    def test_cancel_never_installs_trust(self):
        public = self.root / "ca.cer"
        public.write_bytes(b"Public test certificate")
        result = dict(certificate=self.root / "server.pem", key=self.root / "server-key.pem", public_ca=public, generated=False)
        with patch("sys.argv", ["preparar_https", "--trust-pc"]), patch("servidor_pc.preparar_https.prepare", return_value=result), patch("builtins.input", return_value=""), patch("servidor_pc.preparar_https.subprocess.run") as execute:
            self.assertEqual(main(), 1)
            execute.assert_not_called()

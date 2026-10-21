from pathlib import Path
import socket
import ssl
import threading
import tempfile
import unittest
from unittest.mock import patch
from cryptography import x509
from servidor_pc.preparar_https import prepare


class NativeTlsTests(unittest.TestCase):
    def test_generated_chain_passes_strict_tls_handshake(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            with patch('servidor_pc.preparar_https.find_openssl', side_effect=RuntimeError('not installed')):
                result = prepare(root, ['127.0.0.1'])
            server_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
            server_context.load_cert_chain(result['certificate'], result['key'])
            with socket.socket() as listener:
                listener.bind(('127.0.0.1', 0))
                listener.listen()
                listener.settimeout(5)
                errors = []
                def accept():
                    try:
                        connection, _ = listener.accept()
                        with server_context.wrap_socket(connection, server_side=True) as secure:
                            secure.recv(1)
                            secure.send(b'1')
                    except OSError as error:
                        errors.append(error)
                thread = threading.Thread(target=accept)
                thread.start()
                try:
                    context = ssl.create_default_context(cafile=str(root / 'certs/ca/rootCA.pem'))
                    context.verify_flags |= ssl.VERIFY_X509_STRICT
                    with socket.create_connection(listener.getsockname(), timeout=3) as connection:
                        with context.wrap_socket(connection, server_hostname='localhost') as secure:
                            secure.send(b'1')
                            self.assertEqual(secure.recv(1), b'1')
                finally:
                    thread.join(timeout=6)
                self.assertFalse(thread.is_alive())
                self.assertEqual(errors, [])

    def test_without_openssl_creates_and_reuses_same_ca(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory).resolve()
            with patch('servidor_pc.preparar_https.find_openssl', side_effect=RuntimeError('not installed')):
                first = prepare(root, ['192.168.1.5'])
                ca = (root / 'certs/ca/rootCA.pem').read_bytes()
                second = prepare(root, ['192.168.1.5'])
                third = prepare(root, ['192.168.1.6'])
            self.assertTrue(first['generated'])
            self.assertFalse(second['generated'])
            self.assertTrue(third['generated'])
            self.assertEqual(ca, (root / 'certs/ca/rootCA.pem').read_bytes())
            names = x509.load_pem_x509_certificate(third['certificate'].read_bytes()).extensions.get_extension_for_class(x509.SubjectAlternativeName).value
            self.assertIn('192.168.1.6', [str(address) for address in names.get_values_for_type(x509.IPAddress)])

import socket
import unittest
from unittest.mock import MagicMock, patch

from servidor_pc.red_local import lan_sockets, local_addresses


class LocalNetworkTests(unittest.TestCase):
    def test_hotspot_discovered_without_default_route(self):
        probe = MagicMock()
        probe.__enter__.return_value = probe
        probe.connect.side_effect = OSError("No default route")
        interfaces = [(socket.AF_INET, 0, 0, "", (ip, 0)) for ip in
                      ("127.0.0.1", "169.254.1.2", "192.168.137.1", "192.168.137.1")]
        with patch("servidor_pc.red_local.socket.socket", return_value=probe), \
             patch("servidor_pc.red_local.socket.getaddrinfo", return_value=interfaces):
            self.assertEqual(local_addresses(), ["192.168.137.1"])

    def test_listener_cleanup_on_bind_failure(self):
        first, second = MagicMock(), MagicMock()
        second.bind.side_effect = OSError("Address unavailable")
        with patch("servidor_pc.red_local.socket.socket", side_effect=[first, second]):
            with self.assertRaises(OSError):
                lan_sockets(["127.0.0.1", "192.168.137.1"], 8780)
        first.close.assert_called_once()
        second.close.assert_called_once()


if __name__ == "__main__":
    unittest.main()

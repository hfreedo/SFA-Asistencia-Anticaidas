import os
import tempfile
import unittest
from servidor_pc.instancia import acquire, release


@unittest.skipUnless(os.name == 'nt', 'Windows mutex')
class SingleInstanceTests(unittest.TestCase):
    def test_only_one_launcher_per_home_and_port(self):
        with tempfile.TemporaryDirectory() as home:
            first, existing = acquire(home, 18785)
            self.assertFalse(existing)
            try:
                duplicate, existing = acquire(home, 18785)
                self.assertTrue(existing)
                self.assertIsNone(duplicate)
                other, existing = acquire(home, 18784)
                self.assertFalse(existing)
                release(other)
            finally:
                release(first)
            restarted, existing = acquire(home, 18785)
            self.assertFalse(existing)
            release(restarted)

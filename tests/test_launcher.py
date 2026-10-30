import gc
import socket
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import sfa_portable as launcher
from servidor_pc import main


class LauncherTests(unittest.TestCase):
    def test_start_open_stop_and_restart(self):
        with tempfile.TemporaryDirectory() as folder:
            with socket.socket() as sock:
                sock.bind(('127.0.0.1', 0))
                port = sock.getsockname()[1]
            database = Path(folder) / 'test.sqlite3'
            with patch.object(main, 'DB_PATH', database), patch.object(launcher, 'DB_PATH', database):
                ui = launcher.SfaPortableApp(port=port, no_browser=True)
                def wait_for(condition):
                    deadline = time.monotonic() + 15
                    while time.monotonic() < deadline:
                        ui.root.update()
                        if condition():
                            return
                        time.sleep(0.03)
                    self.fail('Launcher state transition timed out')
                try:
                    wait_for(lambda: str(ui.stop_button['state']) == 'normal')
                    with patch.object(launcher.webbrowser, 'open') as browser:
                        ui.panel_button.invoke()
                        ui.sync_button.invoke()
                        self.assertEqual(browser.call_args_list[0].args[0], f'http://localhost:{port}/')
                        self.assertEqual(browser.call_args_list[1].args[0], f'http://localhost:{port}/#preparacion')
                    ui.stop()
                    wait_for(lambda: ui.status['text'] == 'Servidor detenido')
                    self.assertFalse(launcher.port_busy(port))
                    ui.start()
                    wait_for(lambda: str(ui.stop_button['state']) == 'normal')
                    with patch.object(launcher.SfaPortableApp, 'start'):
                        controller = launcher.SfaPortableApp(port=port, no_browser=True)
                    try:
                        controller.activate(f'http://localhost:{port}', True)
                        self.assertEqual(str(controller.stop_button['state']), 'normal')
                        with patch.object(launcher.messagebox, 'askyesno', return_value=True):
                            controller.stop()
                        wait_for(lambda: controller.status['text'] == 'Servidor detenido')
                        self.assertFalse(launcher.port_busy(port))
                    finally:
                        controller.root.destroy()
                        controller.logo = None
                        controller.lan_var = None
                        del controller
                        gc.collect()
                finally:
                    if ui.server:
                        ui.server.should_exit = True
                    if ui.worker:
                        ui.worker.join(timeout=10)
                    ui.root.destroy()
                    ui.logo = None
                    ui.lan_var = None
                gc.collect()

    def test_external_server_is_not_owned_or_stopped(self):
        with patch.object(launcher.SfaPortableApp, 'start'):
            ui = launcher.SfaPortableApp(no_browser=True)
        try:
            with patch.object(launcher, 'read_control', return_value=None):
                ui.activate('https://localhost:8780', True)
            ui.root.update_idletasks()
            def check_buttons(widget):
                for child in widget.winfo_children():
                    if child.winfo_class() == 'Button':
                        bottom = child.winfo_rooty() - ui.root.winfo_rooty() + child.winfo_height()
                        self.assertLessEqual(bottom, ui.root.winfo_height())
                    check_buttons(child)
            check_buttons(ui.root)
            self.assertEqual(str(ui.stop_button['state']), 'disabled')
            self.assertEqual(str(ui.panel_button['state']), 'normal')
            self.assertIsNone(ui.server)
            with patch.object(launcher, 'read_control', return_value=None):
                ui.stop()
            self.assertIsNone(ui.server)
        finally:
            ui.root.destroy()
            ui.logo = None
            ui.lan_var = None
            del ui
            gc.collect()

from __future__ import annotations

import argparse
import json
import os
import queue
from pathlib import Path
import socket
import ssl
import sys
import threading
import time
import tkinter as tk
from tkinter import messagebox
import urllib.request
import webbrowser

import uvicorn

if sys.stdout is None:
    sys.stdout = open(os.devnull, 'w', encoding='utf-8')
if sys.stderr is None:
    sys.stderr = open(os.devnull, 'w', encoding='utf-8')

from servidor_pc.main import app, DB_PATH, RESOURCE_DIR, APP_HOME
from servidor_pc.preparar_https import prepare
from servidor_pc.instancia import acquire, release, focus_existing
from servidor_pc.red_local import lan_sockets, local_addresses
from servidor_pc.control_local import server_control, read_control

REMOTE_URL = 'https://hfreedo.github.io/SFA-Asistencia-Anticaidas/acceso.html'
BG = '#f8fafc'
TEAL = '#0d9488'


def probe_server(port, ca_file):
    # Verify identity and TLS; never treat an arbitrary open port as SFA.
    for scheme in ('http', 'https'):
        url = f'{scheme}://localhost:{port}'
        try:
            context = ssl.create_default_context()
            if ca_file.is_file():
                context.load_verify_locations(cafile=str(ca_file))
            with urllib.request.urlopen(url + '/api/status', timeout=1, context=context) as response:
                data = json.load(response)
            if isinstance(data, dict) and {'connected', 'port', 'baudrate'} <= data.keys():
                return url
        except (OSError, ValueError):
            pass
    return None


def port_busy(port):
    for host in ('127.0.0.1', '::1'):
        try:
            with socket.create_connection((host, port), timeout=0.2):
                return True
        except OSError:
            pass
    return False


class SfaPortableApp:
    def __init__(self, port=8780, lan=False, no_browser=False):
        self.port, self.lan, self.no_browser = port, lan, no_browser
        self.server = self.worker = self.url = None
        self.external = self.closing = False
        self.results = queue.Queue()
        self.home = APP_HOME
        self.tls = {}
        self.root = tk.Tk()
        self.root.title('SFA Asistencia | Centro de inicio')
        self.root.geometry('700x690')
        self.root.minsize(680, 670)
        self.root.configure(bg=BG)
        self.root.protocol('WM_DELETE_WINDOW', self.close)
        self._build_ui()
        self.start()

    def _build_ui(self):
        header = tk.Frame(self.root, bg='white', padx=24, pady=12)
        header.pack(fill='x')
        try:
            self.logo = tk.PhotoImage(master=self.root, file=str(RESOURCE_DIR / 'interfaz_web/public/assets/sfa-asistencia-logo.png'))
            scale = max(1, (max(self.logo.width(), self.logo.height()) + 63) // 64)
            self.logo = self.logo.subsample(scale)
            self.root.iconphoto(True, self.logo)
            tk.Label(header, image=self.logo, bg='white').pack(side='left', padx=(0, 16))
        except tk.TclError:
            pass
        title = tk.Frame(header, bg='white')
        title.pack(side='left')
        tk.Label(title, text='SFA Asistencia', font=('Segoe UI', 23, 'bold'), fg=TEAL, bg='white').pack(anchor='w')
        tk.Label(title, text='Centro de inicio y monitoreo', font=('Segoe UI', 11), fg='#475569', bg='white').pack(anchor='w')
        body = tk.Frame(self.root, bg=BG, padx=24, pady=12)
        body.pack(fill='both', expand=True)
        self.status = tk.Label(body, text='Comprobando servidor...', font=('Segoe UI', 13, 'bold'), bg=BG, fg='#15313a')
        self.status.pack(anchor='w')
        self.detail = tk.Label(body, text='', font=('Segoe UI', 10), bg=BG, fg='#475569', wraplength=610, justify='left')
        self.detail.pack(anchor='w', pady=(4, 10))
        row = tk.Frame(body, bg=BG)
        row.pack(fill='x')
        self.start_button = self.button(row, 'Iniciar servidor', self.start, True)
        self.start_button.pack(side='left', expand=True, fill='x', padx=(0, 6))
        self.stop_button = self.button(row, 'Detener servidor', self.stop)
        self.stop_button.pack(side='left', expand=True, fill='x', padx=(6, 0))
        self.lan_var = tk.BooleanVar(master=self.root, value=self.lan)
        self.lan_toggle = tk.Checkbutton(body, text='Celular y ubicacion: HTTPS en red local de confianza', variable=self.lan_var, bg=BG, font=('Segoe UI', 10))
        self.lan_toggle.pack(anchor='w', pady=(8, 6))
        tk.Label(body, text='Sin marcar: solo esta PC. Cambia el modo con el servidor detenido.', bg=BG, fg='#475569', font=('Segoe UI', 9)).pack(anchor='w', pady=(0, 10))
        self.panel_button = self.button(body, 'Abrir panel local', lambda: self.open_local('/'), True)
        self.panel_button.pack(fill='x', pady=(0, 8))
        self.sync_button = self.button(body, 'Abrir acceso y sincronizacion de esta PC', lambda: self.open_local('/acceso/acceso.html'))
        self.sync_button.pack(fill='x', pady=(0, 8))
        self.button(body, 'Abrir monitoreo remoto', lambda: webbrowser.open(REMOTE_URL)).pack(fill='x')
        tk.Label(body, text='El monitoreo remoto requiere internet y una cuenta autorizada.', bg=BG, fg='#475569', font=('Segoe UI', 9)).pack(anchor='w', pady=12)
        tools = tk.Frame(body, bg=BG)
        tools.pack(fill='x')
        self.button(tools, 'Carpeta de datos', self.open_data).pack(side='left', fill='x', expand=True, padx=(0, 6))
        self.button(tools, 'Certificado y ayuda Android', self.open_mobile_help).pack(side='left', fill='x', expand=True, padx=(6, 0))
        self.data_label = tk.Label(body, text=f'Datos: {DB_PATH}', bg=BG, fg='#475569', font=('Segoe UI', 9), wraplength=610, justify='left')
        self.data_label.pack(anchor='w', pady=(8, 0))

    def button(self, parent, text, command, primary=False):
        return tk.Button(parent, text=text, command=command, font=('Segoe UI', 11, 'bold'), bg=TEAL if primary else 'white', fg='white' if primary else '#15313a', activebackground='#0f766e' if primary else '#e2e8f0', activeforeground='white' if primary else '#15313a', relief='flat', cursor='hand2', padx=12, pady=9)

    def controls(self, ready=False, busy=False):
        self.start_button.configure(state='disabled' if ready or busy else 'normal')
        can_stop = not self.external or bool(self.url and read_control(self.port, self.url))
        self.stop_button.configure(state='normal' if ready and can_stop else 'disabled')
        for button in (self.panel_button, self.sync_button):
            button.configure(state='normal' if ready else 'disabled')
        self.lan_toggle.configure(state='disabled' if ready or busy else 'normal')

    def start(self):
        if self.worker and self.worker.is_alive():
            return
        self.external = False
        self.controls(busy=True)
        self.status.configure(text='Comprobando servidor...')
        self.lan = self.lan_var.get()
        threading.Thread(target=self.detect, daemon=True).start()
        self.root.after(100, self.wait_detection)

    def detect(self):
        existing = probe_server(self.port, self.home / 'certs/ca/rootCA.pem')
        busy = port_busy(self.port) if not existing else True
        tls, error = {}, None
        if self.lan and not busy:
            try:
                addresses = local_addresses()
                if not addresses:
                    raise RuntimeError('Conecta la PC a Wi-Fi, Ethernet o un hotspot antes de iniciar el modo celular.')
                result = prepare(self.home, addresses, os.getenv('SFA_TLS_CERT'), os.getenv('SFA_TLS_KEY'))
                tls = {'ssl_certfile': str(result['certificate']), 'ssl_keyfile': str(result['key'])}
            except (RuntimeError, OSError) as failure:
                error = str(failure)
        self.results.put((existing, busy, tls, error))

    def wait_detection(self):
        try:
            existing, busy, tls, error = self.results.get_nowait()
        except queue.Empty:
            self.root.after(100, self.wait_detection)
            return
        if error:
            self.status.configure(text='No se pudo preparar el acceso movil', fg='#c2410c')
            self.detail.configure(text=error)
            self.controls()
            return
        self.tls = tls
        self.activate(existing, busy)

    def activate(self, existing, busy):
        if existing:
            self.url, self.external = existing, True
            self.status.configure(text='Servidor SFA existente disponible', fg=TEAL)
            note = 'Puedes abrirlo o detenerlo de forma segura desde aqui.' if read_control(self.port, self.url) else 'Instancia antigua sin control remoto local; requiere su iniciador original.'
            self.detail.configure(text=f'{self.url}\n{note}')
            self.data_label.configure(text='Servidor externo: utiliza sus propios datos, no la carpeta de este ejecutable.')
            self.controls(ready=True)
            return
        if busy:
            self.status.configure(text='Puerto ocupado o certificado no reconocido', fg='#c2410c')
            self.detail.configure(text='No se cerrara ningun proceso ajeno. Revisa el otro iniciador y el certificado del servidor.')
            self.controls()
            return
        self.url = f'{"https" if self.tls else "http"}://localhost:{self.port}'
        os.environ['SFA_SERVER_PORT'] = str(self.port)
        self.server = uvicorn.Server(uvicorn.Config(app, host='127.0.0.1', port=self.port, log_level='warning', access_log=False, timeout_graceful_shutdown=5, **self.tls))
        self.worker = threading.Thread(target=self.run_server, daemon=True)
        self.worker.start()
        self.status.configure(text='Iniciando servidor...')
        self.root.after(200, self.wait_ready)

    def run_server(self):
        listeners = []
        try:
            with server_control(app, self.server, self.port, self.url):
                if self.lan:
                    listeners = lan_sockets(['127.0.0.1', *local_addresses()], self.port)
                    self.server.run(sockets=listeners)
                else:
                    self.server.run()
        except (Exception, SystemExit):
            pass
        finally:
            for listener in listeners:
                listener.close()

    def wait_ready(self):
        if self.server.started and self.worker.is_alive():
            self.status.configure(text='Servidor activo', fg=TEAL)
            note = 'Celular habilitado. Usa el QR del panel; Android debe confiar la CA de esta PC.' if self.lan else 'Solo esta PC. Para QR y ubicacion, detiene y activa el modo celular.'
            self.detail.configure(text=f'{self.url}\n{note}')
            self.data_label.configure(text=f'Datos: {DB_PATH}')
            self.controls(ready=True)
            self.root.after(500, self.monitor_worker)
            if not self.no_browser:
                self.open_local('/')
        elif not self.worker.is_alive():
            self.status.configure(text='No se pudo iniciar el servidor', fg='#c2410c')
            self.detail.configure(text='Comprueba el puerto y los permisos de la carpeta de datos.')
            self.controls()
        else:
            self.root.after(200, self.wait_ready)

    def monitor_worker(self):
        if self.closing or self.external:
            return
        if self.worker and self.worker.is_alive():
            self.root.after(500, self.monitor_worker)
        elif self.url:
            self.url = None
            self.status.configure(text='Servidor detenido', fg='#15313a')
            self.detail.configure(text='El servidor termino. Los datos se conservan.')
            self.controls()

    def open_local(self, path):
        if self.url:
            webbrowser.open(self.url + path)

    def open_data(self):
        Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)
        os.startfile(Path(DB_PATH).parent)

    def open_mobile_help(self):
        public_ca = self.home / 'certs/SFA_Asistencia_CA.cer'
        messagebox.showinfo('Ubicacion desde Android', '1. Activa el modo celular antes de iniciar.\n2. Conecta ambos equipos al mismo Wi-Fi o hotspot.\n3. Instala en Android el certificado CA de esta PC desde Ajustes > Seguridad > Cifrado y credenciales (el nombre varia).\n4. En el panel, abre Ubicacion y genera el QR del residente. Escanealo y permite ubicacion.\n\nNo omitas avisos TLS. La pagina debe quedar abierta. El seguimiento remoto por Supabase y la app Android siguen en una etapa posterior.')
        if public_ca.is_file():
            os.startfile(public_ca.parent)

    def stop(self):
        if self.external:
            if not self.url or not read_control(self.port, self.url):
                return
            if messagebox.askyesno('Detener SFA', 'Se detendra el monitoreo local y se pausaran los envios de esta PC. ¿Continuar?'):
                self.controls(busy=True)
                self.status.configure(text='Deteniendo servidor existente...')
                threading.Thread(target=self.stop_external, daemon=True).start()
                self.root.after(150, self.wait_external_stop)
            return
        if not self.server:
            return
        self.server.should_exit = True
        self.controls(busy=True)
        self.status.configure(text='Deteniendo servidor...')
        self.root.after(150, self.wait_stopped)

    def stop_external(self):
        token = read_control(self.port, self.url)
        success = False
        if token:
            try:
                context = ssl.create_default_context()
                ca = self.home / 'certs/ca/rootCA.pem'
                if ca.is_file():
                    context.load_verify_locations(cafile=str(ca))
                request = urllib.request.Request(self.url + '/api/launcher/stop', data=b'{}', headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'})
                with urllib.request.urlopen(request, context=context, timeout=5) as response:
                    accepted = response.status == 200
                if accepted:
                    for _ in range(100):
                        if not port_busy(self.port):
                            success = True
                            break
                        time.sleep(0.1)
            except (OSError, ValueError):
                pass
        self.results.put(success)

    def wait_external_stop(self):
        try:
            success = self.results.get_nowait()
        except queue.Empty:
            self.root.after(150, self.wait_external_stop)
            return
        if success:
            self.external = False
            self.url = None
            self.status.configure(text='Servidor detenido', fg='#15313a')
            self.detail.configure(text='El servidor existente se cerro correctamente. Sus datos se conservan.')
            self.controls()
        else:
            self.status.configure(text='No se pudo confirmar la detencion', fg='#c2410c')
            self.detail.configure(text='No se forzo el cierre de ningun proceso. Revisa si la instancia fue actualizada.')
            self.controls(ready=True)

    def wait_stopped(self):
        if self.worker and self.worker.is_alive():
            self.root.after(150, self.wait_stopped)
        elif self.closing:
            self.root.destroy()
        else:
            self.url = None
            self.status.configure(text='Servidor detenido', fg='#15313a')
            self.detail.configure(text='Los datos se conservan. Puedes iniciar de nuevo desde esta ventana.')
            self.controls()

    def close(self):
        if not self.external and self.worker and self.worker.is_alive():
            if messagebox.askyesno('Cerrar SFA', 'Cerrar detendra el servidor y pausara los envios. ¿Continuar?'):
                self.closing = True
                self.stop()
        else:
            self.root.destroy()

    def run(self):
        self.root.mainloop()


def main():
    parser = argparse.ArgumentParser(description='SFA Asistencia: centro de inicio')
    parser.add_argument('--lan', action='store_true')
    parser.add_argument('--port', type=int, default=8780)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('Puerto invalido')
    lease, existing = acquire(APP_HOME, args.port)
    if existing:
        focus_existing()
        return
    try:
        SfaPortableApp(args.port, args.lan or (APP_HOME / 'certs/sfa.pem').is_file(), args.no_browser).run()
    finally:
        release(lease)


if __name__ == '__main__':
    main()

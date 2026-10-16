from __future__ import annotations

import argparse
import os
import socket
import sys
import threading
import tkinter as tk
import urllib.request
import webbrowser
from tkinter import messagebox

import uvicorn

from servidor_pc.main import app, get_local_ip
from servidor_pc.red_local import lan_sockets, local_addresses


# PyInstaller windowed executables do not provide standard streams. Uvicorn and
# some dependencies still expect writable streams during startup.
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w", encoding="utf-8")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w", encoding="utf-8")


parser = argparse.ArgumentParser(description="SFA Asistencia portable")
parser.add_argument("--lan", action="store_true", help="Permitir acceso en la red local")
parser.add_argument("--port", type=int, default=8780)
parser.add_argument("--no-browser", action="store_true", help="No abrir el navegador automaticamente")
args = parser.parse_args()
if not 1 <= args.port <= 65535:
    parser.error("El puerto debe estar entre 1 y 65535")
HOST = get_local_ip() if args.lan else "127.0.0.1"
PORT = args.port
os.environ["SFA_SERVER_PORT"] = str(PORT)
URL = f"http://{HOST}:{PORT}/"


class SfaPortableApp:
    def __init__(self) -> None:
        self.server: uvicorn.Server | None = None
        self.startup_error: str | None = None
        self.root = tk.Tk()
        self.root.title("SFA Asistencia")
        self.root.geometry("500x330")
        self.root.resizable(False, False)
        self.root.configure(bg="#f8fafc")
        self.root.protocol("WM_DELETE_WINDOW", self.close)
        self._build_ui()
        if args.lan and HOST == "127.0.0.1":
            self.status.configure(text="No se encontro una red local", fg="#b91c1c")
            return
        if self._port_is_owned_elsewhere():
            self.status.configure(text=f"El puerto {PORT} ya esta en uso", fg="#b91c1c")
            return
        threading.Thread(target=self._run_server, daemon=True).start()
        self.root.after(400, self._wait_until_ready)

    def _build_ui(self) -> None:
        header = tk.Frame(self.root, bg="#0d9488", height=82)
        header.pack(fill="x")
        header.pack_propagate(False)
        tk.Label(
            header,
            text="SFA ASISTENCIA",
            font=("Segoe UI", 19, "bold"),
            fg="white",
            bg="#0d9488",
        ).pack(pady=(15, 0))
        tk.Label(
            header,
            text="Sistema local de alerta anticaídas",
            font=("Segoe UI", 9),
            fg="#ccfbf1",
            bg="#0d9488",
        ).pack()

        body = tk.Frame(self.root, bg="#f8fafc", padx=28, pady=24)
        body.pack(fill="both", expand=True)
        self.status = tk.Label(
            body,
            text="Iniciando servidor local...",
            font=("Segoe UI", 11, "bold"),
            fg="#b45309",
            bg="#f8fafc",
        )
        self.status.pack(pady=(0, 8))
        tk.Label(
            body,
            text=URL,
            font=("Consolas", 10),
            fg="#475569",
            bg="#f8fafc",
        ).pack(pady=(0, 20))
        self.open_button = tk.Button(
            body,
            text="Abrir panel de monitoreo",
            font=("Segoe UI", 11, "bold"),
            fg="white",
            bg="#0d9488",
            activebackground="#0f766e",
            activeforeground="white",
            relief="flat",
            padx=18,
            pady=10,
            state="disabled",
            command=lambda: webbrowser.open(URL),
        )
        self.open_button.pack(fill="x")
        tk.Label(
            body,
            text=("Acceso de red local activo. Usa una red de confianza." if args.lan else "Version 1.1.0. Manten esta ventana abierta durante el monitoreo."),
            font=("Segoe UI", 9),
            fg="#64748b",
            bg="#f8fafc",
        ).pack(pady=(17, 0))

    def _run_server(self) -> None:
        config = uvicorn.Config(
            app,
            host=HOST,
            port=PORT,
            log_level="warning",
            access_log=False,
        )
        self.server = uvicorn.Server(config)
        listeners = []
        try:
            if args.lan:
                listeners = lan_sockets(["127.0.0.1", *local_addresses()], PORT)
                self.server.run(sockets=listeners)
            else:
                self.server.run()
        except (Exception, SystemExit) as exc:
            self.startup_error = str(exc) or "El servidor no pudo iniciar"
        finally:
            for listener in listeners:
                listener.close()

    def _wait_until_ready(self) -> None:
        try:
            with urllib.request.urlopen(URL, timeout=0.5) as response:
                if response.status == 200:
                    self.status.configure(text="Sistema listo", fg="#047857")
                    self.open_button.configure(state="normal")
                    if not args.no_browser:
                        webbrowser.open(URL)
                    return
        except Exception:
            pass

        if self.startup_error:
            self.status.configure(text="No se pudo iniciar el servidor", fg="#b91c1c")
            messagebox.showerror(
                "SFA Asistencia",
                self.startup_error,
            )
            return
        self.root.after(500, self._wait_until_ready)

    def _port_is_owned_elsewhere(self) -> bool:
        for address in {HOST, "127.0.0.1"}:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as connection:
                connection.settimeout(0.2)
                if connection.connect_ex((address, PORT)) == 0:
                    return True
        return False

    def close(self) -> None:
        if self.server is not None:
            self.server.should_exit = True
        self.root.destroy()

    def run(self) -> None:
        self.root.mainloop()


if __name__ == "__main__":
    SfaPortableApp().run()

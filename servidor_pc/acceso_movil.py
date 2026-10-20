from __future__ import annotations

import socket
import argparse
import os
from pathlib import Path

import uvicorn

from servidor_pc.main import get_local_ip
from servidor_pc.red_local import lan_sockets, local_addresses


def main() -> None:
    parser = argparse.ArgumentParser(description="SFA - Acceso movil local")
    parser.add_argument("--https", action="store_true", help="Usar certificados TLS de .env")
    args = parser.parse_args()
    tls = {}
    if args.https:
        cert = os.getenv("SFA_TLS_CERT", "certs/sfa.pem")
        key = os.getenv("SFA_TLS_KEY", "certs/sfa-key.pem")
        if not Path(cert).is_file() or not Path(key).is_file():
            print("Faltan certificados TLS. Ejecuta iniciar_geolocalizacion.bat para prepararlos.")
            raise SystemExit(1)
        tls = {"ssl_certfile": cert, "ssl_keyfile": key}
    scheme = "https" if args.https else "http"
    host = get_local_ip()
    if host == "127.0.0.1":
        print("No se encontro una red local. Conecta la PC a Wi-Fi o Ethernet.")
        return
    for address in ("127.0.0.1", host):
        try:
            with socket.create_connection((address, 8780), timeout=0.3):
                print("Ya hay un servidor activo. Ejecuta detener_interfaz.bat y vuelve a iniciar.")
                return
        except OSError:
            pass
    addresses = local_addresses()
    print("Direcciones para abrir en el navegador del celular (no requiere QR):")
    for address in addresses:
        print(f"  {scheme}://{address}:8780")
    print("Usa una red de confianza: los equipos de esta red tendran acceso al panel.")
    print("Conecta el celular a la misma red. Ctrl+C detiene el servidor.")
    listeners = lan_sockets(["127.0.0.1", *addresses], 8780)
    try:
        uvicorn.Server(uvicorn.Config("servidor_pc.main:app", port=8780, **tls)).run(sockets=listeners)
    finally:
        for listener in listeners:
            listener.close()


if __name__ == "__main__":
    main()

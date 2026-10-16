from __future__ import annotations

import socket

import uvicorn

from servidor_pc.main import get_local_ip
from servidor_pc.red_local import lan_sockets, local_addresses


def main() -> None:
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
        print(f"  http://{address}:8780")
    print("Usa una red de confianza: los equipos de esta red tendran acceso al panel.")
    print("Conecta el celular a la misma red. Ctrl+C detiene el servidor.")
    listeners = lan_sockets(["127.0.0.1", *addresses], 8780)
    try:
        uvicorn.Server(uvicorn.Config("servidor_pc.main:app", port=8780)).run(sockets=listeners)
    finally:
        for listener in listeners:
            listener.close()


if __name__ == "__main__":
    main()

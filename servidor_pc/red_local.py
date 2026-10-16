from __future__ import annotations

import ipaddress
import socket


def local_addresses() -> list[str]:
    candidates: list[str] = []
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as probe:
            probe.connect(("8.8.8.8", 80))
            candidates.append(probe.getsockname()[0])
    except OSError:
        pass
    try:
        candidates.extend(info[4][0] for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET))
    except OSError:
        pass
    result = []
    for candidate in candidates:
        try:
            ip = ipaddress.ip_address(candidate)
            if ip.is_private and not ip.is_loopback and not ip.is_link_local and not ip.is_unspecified and candidate not in result:
                result.append(candidate)
        except ValueError:
            pass
    return result


def lan_sockets(addresses: list[str], port: int) -> list[socket.socket]:
    sockets = []
    try:
        for address in addresses:
            listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sockets.append(listener)
            listener.bind((address, port))
            listener.listen(128)
            listener.setblocking(False)
        return sockets
    except OSError:
        for listener in sockets:
            listener.close()
        raise

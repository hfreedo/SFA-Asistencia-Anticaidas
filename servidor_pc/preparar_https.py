"""Prepare local TLS files without silently changing any trust store."""
from __future__ import annotations

import argparse
import hashlib
import ipaddress
import os
import shutil
import ssl
import subprocess
import tempfile
from pathlib import Path

from dotenv import load_dotenv
from servidor_pc.red_local import local_addresses

from servidor_pc.rutas import application_home
import sys

ROOT = application_home(sys.executable, Path(__file__).resolve().parents[1], getattr(sys, 'frozen', False))


def find_openssl() -> str:
    executable = shutil.which("openssl")
    if executable:
        return executable
    git = shutil.which("git")
    candidates = [Path(git).resolve().parent.parent / "usr/bin/openssl.exe"] if git else []
    for variable in ("ProgramFiles", "ProgramFiles(x86)", "LOCALAPPDATA"):
        base = os.getenv(variable)
        if base:
            candidates.extend((Path(base) / "Git/usr/bin/openssl.exe", Path(base) / "Programs/Git/usr/bin/openssl.exe"))
    for candidate in candidates:
        if candidate.is_file():
            return str(candidate)
    raise RuntimeError("No se encontró OpenSSL. Instala Git para Windows o prepara certificados con mkcert según docs/GEOLOCALIZACION.md.")


def run(openssl, *arguments):
    result = subprocess.run([openssl, *map(str, arguments)], capture_output=True, text=True, errors="replace", timeout=90,
                            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0)
    if result.returncode:
        raise RuntimeError("OpenSSL no pudo completar la preparación: " + result.stderr[-1000:])
    return result.stdout


def covers_addresses(openssl, certificate, key, addresses):
    if not certificate.is_file() or not key.is_file():
        return False
    try:
        ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER).load_cert_chain(certificate, key)
        run(openssl, "x509", "-in", certificate, "-noout", "-checkend", "604800")
        run(openssl, "x509", "-in", certificate, "-noout", "-checkhost", "localhost")
        for address in addresses:
            run(openssl, "x509", "-in", certificate, "-noout", "-checkip", address)
        return True
    except (RuntimeError, OSError, ssl.SSLError):
        return False


def prepare(root: Path, addresses: list[str], certificate=None, key=None):
    if getattr(sys, 'frozen', False) or os.getenv('SFA_TLS_BACKEND') == 'native':
        from servidor_pc.tls_nativo import prepare_native
        return prepare_native(root, addresses, certificate, key)
    try:
        openssl = find_openssl()
    except RuntimeError:
        from servidor_pc.tls_nativo import prepare_native
        return prepare_native(root, addresses, certificate, key)
    addresses = list(dict.fromkeys(["127.0.0.1", *[str(ipaddress.ip_address(a)) for a in addresses]]))
    folder = root / "certs"
    certificate = Path(certificate) if certificate else folder / "sfa.pem"
    key = Path(key) if key else folder / "sfa-key.pem"
    if not certificate.is_absolute():
        certificate = root / certificate
    if not key.is_absolute():
        key = root / key
    ca = folder / "ca/rootCA.pem"
    ca_key = folder / "ca/rootCA-key.pem"
    public_ca = folder / "SFA_Asistencia_CA.cer"
    if covers_addresses(openssl, certificate, key, addresses):
        return {"certificate": certificate, "key": key, "public_ca": public_ca if public_ca.exists() else None, "generated": False}
    if certificate != folder / "sfa.pem" or key != folder / "sfa-key.pem":
        raise RuntimeError("Los certificados personalizados no existen o no cubren la red actual. No se sobrescribieron; revisa SFA_TLS_CERT/SFA_TLS_KEY.")
    if (certificate.exists() or key.exists()) and not (ca.exists() and ca_key.exists()):
        raise RuntimeError("Hay certificados anteriores no administrados por este asistente. No se sobrescribieron. Conserva una copia y revisa la guía HTTPS.")
    folder.mkdir(parents=True, exist_ok=True)
    ca.parent.mkdir(exist_ok=True)
    if ca.exists() != ca_key.exists():
        raise RuntimeError("La CA está incompleta. Recupera su par de archivos; no se reemplazó su identidad.")
    if not ca.exists():
        run(openssl, "req", "-x509", "-newkey", "rsa:3072", "-nodes", "-days", "365", "-sha256",
            "-keyout", ca_key, "-out", ca, "-subj", "/CN=SFA Asistencia CA de pruebas",
            "-addext", "basicConstraints=critical,CA:TRUE",
            "-addext", "keyUsage=critical,keyCertSign,cRLSign")
    run(openssl, "x509", "-in", ca, "-noout", "-checkend", "8035200")
    run(openssl, "x509", "-in", ca, "-outform", "DER", "-out", public_ca)
    with tempfile.TemporaryDirectory(dir=folder) as tmp:
        tmp = Path(tmp)
        temporary_key, temporary_cert = tmp / "server-key.pem", tmp / "server.pem"
        csr, extension = tmp / "server.csr", tmp / "server.ext"
        extension.write_text("basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=DNS:localhost," + ",".join("IP:" + address for address in addresses) + "\n", encoding="ascii")
        run(openssl, "req", "-new", "-newkey", "rsa:2048", "-nodes", "-keyout", temporary_key,
            "-out", csr, "-subj", "/CN=localhost")
        run(openssl, "x509", "-req", "-in", csr, "-CA", ca, "-CAkey", ca_key,
            "-set_serial", str(int.from_bytes(os.urandom(16), "big")), "-days", "90", "-sha256",
            "-extfile", extension, "-out", temporary_cert)
        run(openssl, "verify", "-CAfile", ca, "-purpose", "sslserver", temporary_cert)
        if not covers_addresses(openssl, temporary_cert, temporary_key, addresses):
            raise RuntimeError("Falló la comprobación del nuevo certificado")
        os.replace(temporary_key, key)
        os.replace(temporary_cert, certificate)
    return {"certificate": certificate, "key": key, "public_ca": public_ca, "generated": True}


def main():
    parser = argparse.ArgumentParser(description="Preparar certificados locales de SFA")
    parser.add_argument("--trust-pc", action="store_true", help="Pedir confirmación antes de confiar la CA en la cuenta Windows")
    args = parser.parse_args()
    load_dotenv(ROOT / ".env")
    try:
        result = prepare(ROOT, local_addresses(), os.getenv("SFA_TLS_CERT"), os.getenv("SFA_TLS_KEY"))
        print("Certificados HTTPS preparados." if result["generated"] else "Certificados existentes válidos para la red actual.")
        print("Servidor:", result["certificate"])
        public_ca = result["public_ca"]
        if public_ca:
            print("Certificado PUBLICO para Android:", public_ca)
            print("Huella SHA-256:", hashlib.sha256(public_ca.read_bytes()).hexdigest().upper())
            print("No se instaló confianza automáticamente. No compartas claves .pem ni .key.")
        if args.trust_pc:
            if os.name != "nt" or not public_ca:
                raise RuntimeError("La instalación asistida requiere Windows y la CA creada por este asistente")
            print("Confiar esta CA permitirá que tu cuenta Windows acepte certificados firmados por ella.")
            print("La clave privada debe permanecer protegida. Esta acción no configura el celular.")
            if input("Escribe CONFIAR SFA para autorizar, o Enter para cancelar: ").strip() != "CONFIAR SFA":
                print("Cancelado: no se modificó la confianza de Windows.")
                return 1
            subprocess.run(["certutil", "-user", "-addstore", "Root", str(public_ca)], check=True)
            print("CA agregada a la cuenta Windows. Reinicia el navegador si es necesario.")
        else:
            print("Para confiarla en la PC, ejecuta confiar_https_pc.bat y revisa su confirmación.")
        return 0
    except (RuntimeError, OSError, subprocess.SubprocessError) as error:
        print("No se pudo preparar HTTPS:", error)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

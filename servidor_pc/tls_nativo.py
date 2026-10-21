"""Local test CA generation using the bundled crypto runtime, not a system CLI."""
from datetime import datetime, timedelta, timezone
import ipaddress
from pathlib import Path
import ssl
import tempfile
import os

from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import ExtendedKeyUsageOID, NameOID


def prepare_native(root, addresses, certificate=None, key=None):
    root = Path(root).resolve()
    folder = root / 'certs'
    certificate = Path(certificate) if certificate else folder / 'sfa.pem'
    key = Path(key) if key else folder / 'sfa-key.pem'
    certificate = certificate if certificate.is_absolute() else root / certificate
    key = key if key.is_absolute() else root / key
    addresses = list(dict.fromkeys([ipaddress.ip_address('127.0.0.1'), *map(ipaddress.ip_address, addresses)]))
    ca_path, ca_key_path = folder / 'ca/rootCA.pem', folder / 'ca/rootCA-key.pem'
    public = folder / 'SFA_Asistencia_CA.cer'
    now = datetime.now(timezone.utc)
    if certificate.is_file() and key.is_file():
        try:
            ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER).load_cert_chain(certificate, key)
            current = x509.load_pem_x509_certificate(certificate.read_bytes())
            names = current.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
            if current.not_valid_before_utc <= now and current.not_valid_after_utc > now + timedelta(days=7) and 'localhost' in names.get_values_for_type(x509.DNSName) and set(addresses) <= set(names.get_values_for_type(x509.IPAddress)):
                return {'certificate': certificate, 'key': key, 'public_ca': public if public.exists() else None, 'generated': False}
        except (ValueError, OSError, x509.ExtensionNotFound):
            pass
    if certificate != folder / 'sfa.pem' or key != folder / 'sfa-key.pem':
        raise RuntimeError('Certificados personalizados no validos para esta red; no se sobrescribieron.')
    if (certificate.exists() or key.exists()) and not (ca_path.exists() and ca_key_path.exists()):
        raise RuntimeError('Certificados anteriores sin CA administrada; no se sobrescribieron.')
    if ca_path.exists() != ca_key_path.exists():
        raise RuntimeError('CA incompleta: recuperar su par de archivos antes de renovar.')
    folder.mkdir(parents=True, exist_ok=True)
    ca_path.parent.mkdir(exist_ok=True)
    if ca_path.exists():
        ca = x509.load_pem_x509_certificate(ca_path.read_bytes())
        ca_key = serialization.load_pem_private_key(ca_key_path.read_bytes(), password=None)
        if ca.not_valid_before_utc > now or ca.not_valid_after_utc < now + timedelta(days=93):
            raise RuntimeError('La CA esta proxima a vencer; no se reemplazo su identidad automaticamente.')
        def public_bytes(public_key):
            return public_key.public_bytes(serialization.Encoding.DER, serialization.PublicFormat.SubjectPublicKeyInfo)
        if public_bytes(ca.public_key()) != public_bytes(ca_key.public_key()):
            raise RuntimeError('La clave no corresponde a la CA existente.')
    else:
        ca_key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'SFA Asistencia CA de pruebas')])
        ca = x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(ca_key.public_key()).serial_number(x509.random_serial_number())
        ca = ca.not_valid_before(now - timedelta(minutes=5)).not_valid_after(now + timedelta(days=365))
        ca = ca.add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
        ca = ca.add_extension(x509.SubjectKeyIdentifier.from_public_key(ca_key.public_key()), critical=False)
        ca = ca.add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(ca_key.public_key()), critical=False)
        ca = ca.add_extension(x509.KeyUsage(False, False, False, False, False, True, True, None, None), critical=True).sign(ca_key, hashes.SHA256())
        ca_key_path.touch(mode=0o600, exist_ok=False)
        ca_key_path.write_bytes(ca_key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
        ca_path.write_bytes(ca.public_bytes(serialization.Encoding.PEM))
    public.write_bytes(ca.public_bytes(serialization.Encoding.DER))
    server_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'localhost')])
    server = x509.CertificateBuilder().subject_name(subject).issuer_name(ca.subject).public_key(server_key.public_key()).serial_number(x509.random_serial_number())
    server = server.not_valid_before(now - timedelta(minutes=5)).not_valid_after(now + timedelta(days=90))
    server = server.add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
    server = server.add_extension(x509.KeyUsage(True, False, True, False, False, False, False, None, None), critical=True)
    server = server.add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
    server = server.add_extension(x509.SubjectKeyIdentifier.from_public_key(server_key.public_key()), critical=False)
    server = server.add_extension(x509.AuthorityKeyIdentifier.from_issuer_public_key(ca.public_key()), critical=False)
    server = server.add_extension(x509.SubjectAlternativeName([x509.DNSName('localhost'), *[x509.IPAddress(address) for address in addresses]]), critical=False)
    server = server.sign(ca_key, hashes.SHA256())
    with tempfile.TemporaryDirectory(dir=folder) as temporary:
        temporary = Path(temporary)
        cert_file, key_file = temporary / 'cert.pem', temporary / 'key.pem'
        cert_file.write_bytes(server.public_bytes(serialization.Encoding.PEM))
        key_file.touch(mode=0o600, exist_ok=False)
        key_file.write_bytes(server_key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
        ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER).load_cert_chain(cert_file, key_file)
        os.replace(key_file, key)
        os.replace(cert_file, certificate)
    return {'certificate': certificate, 'key': key, 'public_ca': public, 'generated': True}

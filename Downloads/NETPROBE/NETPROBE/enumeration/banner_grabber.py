"""
NETPROBE - Banner Grabbing Module
Connects to open services and grabs raw ASCII/UTF-8 server banners using protocol probes.
"""

import socket
import ssl
from typing import Dict, Optional, Union

# Probes sent to ports if the service doesn't send an initial banner upon connection
SERVICE_PROBES = {
    80: b"HEAD / HTTP/1.1\r\nHost: localhost\r\nUser-Agent: NETPROBE/1.0\r\nAccept: */*\r\n\r\n",
    8080: b"HEAD / HTTP/1.1\r\nHost: localhost\r\nUser-Agent: NETPROBE/1.0\r\nAccept: */*\r\n\r\n",
    8000: b"HEAD / HTTP/1.1\r\nHost: localhost\r\nUser-Agent: NETPROBE/1.0\r\nAccept: */*\r\n\r\n",
    443: b"HEAD / HTTP/1.1\r\nHost: localhost\r\nUser-Agent: NETPROBE/1.0\r\nAccept: */*\r\n\r\n",
    8443: b"HEAD / HTTP/1.1\r\nHost: localhost\r\nUser-Agent: NETPROBE/1.0\r\nAccept: */*\r\n\r\n",
    21: b"",  # FTP sends banner automatically
    22: b"",  # SSH sends banner automatically
    25: b"EHLO netprobe.local\r\n",  # SMTP probe
    110: b"",  # POP3 banner
    143: b"A1 CAPABILITY\r\n",  # IMAP probe
    3306: b"",  # MySQL sends server greeting packet on connect
    5432: b"",  # PostgreSQL
    6379: b"INFO\r\n",  # Redis
    27017: b"\x3a\x00\x00\x00\xa7\x00\x00\x00\xff\xff\xff\xff\xd4\x07\x00\x00\x00\x00\x00\x00admin.$cmd\x00\x00\x00\x00\x00\xff\xff\xff\xff\x13\x00\x00\x00\x10isMaster\x00\x01\x00\x00\x00\x00",
}

GENERIC_PROBE = b"\r\n\r\nHELP\r\n"


def grab_banner(ip: str, port: int, timeout: float = 2.0, use_ssl: bool = False) -> Dict[str, Union[str, bool]]:
    """
    Connects to target IP and port, attempts banner extraction using protocol probes.
    Returns dictionary with raw banner, status, and raw response bytes representation.
    """
    banner = ""
    success = False
    raw_hex = ""

    try:
        raw_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        raw_sock.settimeout(timeout)

        if use_ssl or port in (443, 8443, 465, 993, 995, 636):
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            sock = context.wrap_socket(raw_sock, server_hostname=ip)
        else:
            sock = raw_sock

        sock.connect((ip, port))

        # Attempt passive receive first (for services that talk first like SSH, FTP, SMTP, MySQL)
        sock.settimeout(1.2)
        try:
            data = sock.recv(2048)
        except socket.timeout:
            data = b""

        # If no initial banner received, send active probe
        if not data:
            probe = SERVICE_PROBES.get(port, GENERIC_PROBE)
            if probe:
                sock.sendall(probe)
                sock.settimeout(timeout)
                try:
                    data = sock.recv(2048)
                except socket.timeout:
                    data = b""

        sock.close()

        if data:
            success = True
            raw_hex = data.hex()[:100]
            # Clean string conversion avoiding decode crashes
            banner = data.decode("utf-8", errors="replace").strip()

    except Exception as e:
        banner = f"Banner grab error: {str(e)}"
        success = False

    return {
        "ip": ip,
        "port": port,
        "success": success,
        "banner": banner,
        "raw_hex": raw_hex
    }

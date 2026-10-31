"""
NETPROBE - Service Detector Module
Analyses banners, probe signatures, and port heuristics to identify service protocol.
"""

import re
from typing import Dict, Optional, Union
from scanner.scanner_utils import get_default_service


def detect_service(ip: str, port: int, banner: str = "", raw_hex: str = "") -> Dict[str, Union[str, float]]:
    """
    Detects the service running on a given open port using protocol signatures and banner inspection.
    Returns dictionary with detected service name, protocol category, and confidence level.
    """
    banner_upper = banner.upper()
    confidence = 0.5
    service = get_default_service(port)

    # 1. SSH Signature Matching
    if "SSH-" in banner or "OPENSSH" in banner_upper:
        service = "SSH"
        confidence = 0.99

    # 2. HTTP / HTTPS Signature Matching
    elif "HTTP/" in banner_upper or "SERVER:" in banner_upper or "HTML" in banner_upper:
        service = "HTTPS" if port in (443, 8443) or "TLS" in banner_upper or "SSL" in banner_upper else "HTTP"
        confidence = 0.95

    # 3. FTP Signature Matching
    elif banner.startswith("220") and ("FTP" in banner_upper or "FILEZILLA" in banner_upper or "VSFTPD" in banner_upper):
        service = "FTP"
        confidence = 0.95
    elif banner.startswith("220"):
        service = "FTP/SMTP Greeting"
        confidence = 0.75

    # 4. SMTP Signature Matching
    elif "220" in banner and ("SMTP" in banner_upper or "POSTFIX" in banner_upper or "EXIM" in banner_upper or "MAIL" in banner_upper):
        service = "SMTP"
        confidence = 0.95

    # 5. MySQL Signature Matching
    elif "MYSQL" in banner_upper or "MARIADB" in banner_upper or (len(banner) > 5 and "5." in banner[:10] and port == 3306):
        service = "MySQL"
        confidence = 0.95

    # 6. RDP / MSRPC / SMB
    elif port == 3389 or "RDP" in banner_upper:
        service = "RDP"
        confidence = 0.90 if banner else 0.70
    elif port == 445:
        service = "SMB"
        confidence = 0.90
    elif port == 135:
        service = "MSRPC"
        confidence = 0.90

    # 7. Redis Signature Matching
    elif "REDIS" in banner_upper or "-ERR UNKNOWN COMMAND" in banner_upper or "+PONG" in banner_upper:
        service = "Redis"
        confidence = 0.95

    # 8. PostgreSQL
    elif "POSTGRESQL" in banner_upper or "FATAL: INVALID STARTUP PACKET" in banner_upper:
        service = "PostgreSQL"
        confidence = 0.95

    # Default fallback to port lookup if no active banner match
    elif port in (443, 8443) and service in ("HTTPS", "HTTPS-Alt"):
        confidence = 0.70 if banner else 0.60
    elif banner and service != "Unknown":
        confidence = 0.70
    elif service != "Unknown":
        confidence = 0.60
    else:
        service = "Unknown"
        confidence = 0.20

    return {
        "service": service,
        "confidence": confidence,
        "evidence": banner[:120] if banner else f"Default port match for TCP/{port}"
    }

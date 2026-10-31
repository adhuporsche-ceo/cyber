"""
NETPROBE - Security Rules Engine Module
Evaluates exposed services and configurations against security best-practice rules.
Rule-based structure: Detection -> Rule Evaluation -> Finding -> Severity -> Explanation -> Recommendation
"""

from typing import Dict, List, Union

SECURITY_RULES = [
    {
        "id": "RULE-TELNET-01",
        "name": "Unencrypted Telnet Service Detected",
        "service": ["Telnet"],
        "ports": [23, 992],
        "severity": "HIGH",
        "reason": "Telnet transmits all credentials and session commands in cleartext over the network without encryption.",
        "recommendation": "Disable Telnet service and migrate to SSH (TCP/22) with strong public-key authentication.",
        "confidence": "High"
    },
    {
        "id": "RULE-FTP-01",
        "name": "Plaintext FTP Service Exposed",
        "service": ["FTP"],
        "ports": [21],
        "severity": "MEDIUM",
        "reason": "Standard FTP communicates user credentials and data streams in plaintext.",
        "recommendation": "Enforce FTPS (FTP over TLS) or replace with SFTP (SSH File Transfer Protocol).",
        "confidence": "High"
    },
    {
        "id": "RULE-HTTP-UNENCRYPTED-01",
        "name": "Plaintext HTTP Service Exposed",
        "service": ["HTTP", "HTTP-Alt", "HTTP-Proxy/Alt"],
        "ports": [80, 8000, 8080],
        "severity": "LOW",
        "reason": "HTTP traffic is unencrypted, exposing web traffic and login forms to potential eavesdropping or tamper attacks.",
        "recommendation": "Configure HTTPS (TCP/443) with valid TLS certificates and enforce HSTS redirection.",
        "confidence": "High"
    },
    {
        "id": "RULE-DB-EXPOSED-01",
        "name": "Publicly Exposed Database Service",
        "service": ["MySQL", "PostgreSQL", "MSSQL", "Oracle", "MongoDB", "Redis"],
        "ports": [3306, 5432, 1433, 1521, 27017, 6379],
        "severity": "HIGH",
        "reason": "Database management ports should not be accessible directly over untrusted networks. Exposed DB services are targets for brute-force attacks and authentication bypasses.",
        "recommendation": "Restrict database access to localhost or trusted internal IP subnets using firewalls. Use SSH tunnels or VPN for remote access.",
        "confidence": "High"
    },
    {
        "id": "RULE-REMOTE-MGMT-01",
        "name": "Exposed Remote Desktop / Management Protocol",
        "service": ["RDP", "VNC"],
        "ports": [3389, 5900],
        "severity": "MEDIUM",
        "reason": "Exposed remote management portals invite credential guessing and protocol exploit attempts.",
        "recommendation": "Place remote administration consoles behind a perimeter VPN and enforce Multi-Factor Authentication (MFA).",
        "confidence": "High"
    },
    {
        "id": "RULE-SMB-NETBIOS-01",
        "name": "Exposed SMB / NetBIOS Sharing Service",
        "service": ["SMB", "NetBIOS-SSN", "MSRPC"],
        "ports": [445, 139, 135],
        "severity": "MEDIUM",
        "reason": "Exposed SMB and NetBIOS services increase internal network attack surface and allow host enumeration or lateral movement attacks.",
        "recommendation": "Ensure SMB port 445 is blocked at network perimeter firewalls and disable legacy SMBv1 protocols.",
        "confidence": "High"
    }
]


def evaluate_security_rules(host: str, port: int, service: str, banner: str = "") -> List[Dict[str, Union[str, float]]]:
    """
    Evaluates open port service info against security rules engine.
    Returns list of security finding dictionaries.
    """
    findings = []
    service_upper = service.upper()

    for rule in SECURITY_RULES:
        match = False

        # Match by port
        if port in rule["ports"]:
            match = True

        # Match by service name pattern
        for rule_svc in rule["service"]:
            rule_service_upper = rule_svc.upper()
            if service_upper == rule_service_upper or service_upper.startswith(rule_service_upper + "-") or service_upper.startswith(rule_service_upper + "/"):
                match = True
                break

        if match:
            findings.append({
                "rule_id": rule["id"],
                "host": host,
                "port": port,
                "service": service,
                "finding": rule["name"],
                "state": "Verified Configuration Issue",
                "severity": rule["severity"],
                "reason": rule["reason"],
                "evidence": f"Service '{service}' detected on TCP port {port}. Banner snippet: '{banner[:60]}'",
                "recommendation": rule["recommendation"],
                "confidence": rule["confidence"]
            })

    return findings

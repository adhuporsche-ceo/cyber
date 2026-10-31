"""
NETPROBE - Version Detector Module
Parses service banners, HTTP response headers, and protocol strings to detect software version.
"""

import re
from typing import Dict, Union

# Regex patterns for software version extraction
VERSION_PATTERNS = [
    # OpenSSH e.g. OpenSSH_8.2p1 Ubuntu-4ubuntu0.5
    (r"OpenSSH[_\s/]([0-9a-zA-Z\.\_\-]+)", "OpenSSH", "High"),
    # Apache e.g. Apache/2.4.41 (Ubuntu)
    (r"Apache[_\s/]([0-9\.]+)", "Apache HTTP Server", "High"),
    # Nginx e.g. nginx/1.18.0
    (r"nginx[_\s/]([0-9\.]+)", "nginx", "High"),
    # MySQL e.g. 5.7.33-0ubuntu0.16.04.1 or 8.0.28
    (r"([0-9]+\.[0-9]+\.[0-9]+[0-9a-zA-Z\.\_\-]*)\s*.*mysql", "MySQL", "High"),
    (r"mysql[_\s\-]*([0-9\.]+)", "MySQL", "High"),
    # MariaDB e.g. 10.3.34-MariaDB
    (r"([0-9\.]+)\-MariaDB", "MariaDB", "High"),
    # vsFTPd e.g. vsFTPd 3.0.3
    (r"vsFTPd[_\s/]([0-9\.]+)", "vsFTPd", "High"),
    # ProFTPD e.g. ProFTPD 1.3.5
    (r"ProFTPD[_\s/]([0-9\.]+)", "ProFTPD", "High"),
    # Postfix
    (r"Postfix[_\s/]([0-9\.]+)", "Postfix", "Medium"),
    # Exim e.g. Exim 4.93
    (r"Exim[_\s/]([0-9\.]+)", "Exim", "High"),
    # Lighttpd e.g. lighttpd/1.4.55
    (r"lighttpd[_\s/]([0-9\.]+)", "lighttpd", "High"),
    # Microsoft IIS e.g. Microsoft-IIS/10.0
    (r"Microsoft-IIS[_\s/]([0-9\.]+)", "Microsoft IIS", "High"),
    # Generic Server: header match
    (r"Server:\s*([a-zA-Z0-9\-\_\.]+)/([0-9\.]+)", r"\1", "Medium"),
    # Generic product version match
    (r"([a-zA-Z0-9\-_]+)[/\s]([0-9]+\.[0-9]+(?:\.[0-9]+)?)", r"\1", "Medium")
]


def detect_version(service: str, banner: str) -> Dict[str, Union[str, float]]:
    """
    Attempts to extract product name and software version from banner.
    Only returns a version when supported by sufficient evidence.
    """
    if not banner:
        return {
            "product": service,
            "version": "Unknown",
            "confidence": "Low",
            "evidence": "No banner available for version extraction"
        }

    for pattern, product_name, confidence in VERSION_PATTERNS:
        match = re.search(pattern, banner, re.IGNORECASE)
        if match:
            # Handle dynamic product name if pattern captures product
            extracted_product = product_name if not product_name.startswith("\\") else match.group(1)
            version_str = match.group(1) if product_name != extracted_product else (match.group(2) if match.lastindex >= 2 else match.group(1))

            return {
                "product": extracted_product,
                "version": version_str,
                "confidence": confidence,
                "evidence": f"Matched banner string: '{match.group(0)}'"
            }

    # If generic version string found in banner
    ver_match = re.search(r"v?([0-9]+\.[0-9]+(?:\.[0-9]+)?)", banner)
    if ver_match:
        return {
            "product": service,
            "version": ver_match.group(1),
            "confidence": "Low",
            "evidence": f"Extracted version sequence '{ver_match.group(1)}' from raw banner"
        }

    return {
        "product": service,
        "version": "Unknown",
        "confidence": "Insufficient Evidence",
        "evidence": f"Banner retrieved but no known version pattern matched ('{banner[:50]}...')"
    }

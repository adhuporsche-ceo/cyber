"""
NETPROBE - Scanner Utilities Module
Provides helper functions for IP parsing, subnet expansion, port specification parsing,
and validation.
"""

import ipaddress
import re
from typing import List, Union

TOP_20_PORTS = [21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445, 993, 995, 1723, 3306, 3389, 5900, 8080]

TOP_100_PORTS = [
    7, 9, 13, 21, 22, 23, 25, 37, 42, 53, 67, 68, 69, 79, 80, 88, 106, 110, 111, 113, 119, 135, 139, 143, 161, 179,
    199, 389, 427, 443, 445, 465, 513, 514, 515, 543, 544, 548, 554, 587, 631, 646, 873, 990, 993, 995, 1025, 1026,
    1027, 1028, 1029, 1110, 1433, 1720, 1723, 1755, 1900, 2000, 2001, 2049, 2121, 2717, 3000, 3128, 3306, 3389, 3986,
    4899, 5000, 5009, 5051, 5222, 5357, 5432, 5631, 5800, 5900, 6000, 6001, 6646, 7070, 8000, 8008, 8009, 8080, 8081,
    8443, 8888, 9100, 9999, 10000, 32768, 49152, 49153, 49154, 49155, 49156, 49157
]

COMMON_SERVICES_MAP = {
    21: "FTP",
    22: "SSH",
    23: "Telnet",
    25: "SMTP",
    53: "DNS",
    67: "DHCP",
    68: "DHCP",
    69: "TFTP",
    80: "HTTP",
    110: "POP3",
    111: "RPCBIND",
    123: "NTP",
    135: "MSRPC",
    137: "NetBIOS-NS",
    138: "NetBIOS-DGM",
    139: "NetBIOS-SSN",
    143: "IMAP",
    161: "SNMP",
    389: "LDAP",
    443: "HTTPS",
    445: "SMB",
    465: "SMTPS",
    514: "Syslog",
    587: "SMTP-Submission",
    631: "IPP",
    636: "LDAPS",
    993: "IMAPS",
    995: "POP3S",
    1433: "MSSQL",
    1521: "Oracle",
    2049: "NFS",
    3306: "MySQL",
    3389: "RDP",
    5432: "PostgreSQL",
    5900: "VNC",
    6379: "Redis",
    8000: "HTTP-Alt",
    8080: "HTTP-Proxy/Alt",
    8443: "HTTPS-Alt",
    9200: "Elasticsearch",
    11211: "Memcached",
    27017: "MongoDB"
}


def parse_targets(target_str: str) -> List[str]:
    """
    Parses a target string into a list of single IP address strings.
    Supports:
      - Single IP: '192.168.1.1' or 'localhost'
      - Hostname: 'example.com' (resolves to IP)
      - CIDR range: '192.168.1.0/28'
      - IP Range: '192.168.1.1-192.168.1.10'
      - Comma-separated combinations: '192.168.1.1, 192.168.1.5-192.168.1.8'
    """
    targets = []
    items = [item.strip() for item in target_str.split(',') if item.strip()]

    for item in items:
        # Check IP range pattern e.g. 192.168.1.1-192.168.1.10 or 192.168.1.1-10
        range_match = re.match(r"^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})-(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$", item)
        short_range_match = re.match(r"^(\d{1,3}\.\d{1,3}\.\d{1,3}\.)(\d{1,3})-(\d{1,3})$", item)

        if range_match:
            start_ip = ipaddress.IPv4Address(range_match.group(1))
            end_ip = ipaddress.IPv4Address(range_match.group(2))
            if int(start_ip) <= int(end_ip):
                for ip_int in range(int(start_ip), int(end_ip) + 1):
                    targets.append(str(ipaddress.IPv4Address(ip_int)))
        elif short_range_match:
            prefix = short_range_match.group(1)
            start_num = int(short_range_match.group(2))
            end_num = int(short_range_match.group(3))
            if start_num <= end_num:
                for n in range(start_num, end_num + 1):
                    targets.append(f"{prefix}{n}")
        else:
            try:
                # Attempt CIDR or single IP parsing
                network = ipaddress.ip_network(item, strict=False)
                if network.num_addresses == 1:
                    targets.append(str(network.network_address))
                else:
                    # Exclude network and broadcast if subnet mask < 31
                    if network.prefixlen <= 30:
                        for ip in network.hosts():
                            targets.append(str(ip))
                    else:
                        for ip in network:
                            targets.append(str(ip))
            except ValueError:
                # Might be a hostname or localhost
                targets.append(item)

    # Return unique sorted list while preserving IPv4 order if possible
    unique_targets = list(dict.fromkeys(targets))
    return unique_targets


def parse_ports(port_str: str) -> List[int]:
    """
    Parses a port specification into a sorted list of unique integer port numbers (1-65535).
    Supports:
      - 'top20' -> Top 20 common ports
      - 'top100' -> Top 100 common ports
      - 'all' or '1-65535'
      - Individual ports & ranges: '22,80,443,8000-8080'
    """
    if not port_str:
        return TOP_20_PORTS.copy()

    clean_str = port_str.strip().lower()
    if clean_str == 'top20':
        return TOP_20_PORTS.copy()
    elif clean_str == 'top100':
        return TOP_100_PORTS.copy()
    elif clean_str in ('all', 'full', '1-65535'):
        return list(range(1, 65536))

    ports = set()
    parts = clean_str.split(',')

    for part in parts:
        part = part.strip()
        if not part:
            continue
        if '-' in part:
            try:
                start_p, end_p = map(int, part.split('-'))
                if 1 <= start_p <= 65535 and 1 <= end_p <= 65535:
                    start_val, end_val = min(start_p, end_p), max(start_p, end_p)
                    ports.update(range(start_val, end_val + 1))
            except ValueError:
                pass
        else:
            try:
                p = int(part)
                if 1 <= p <= 65535:
                    ports.add(p)
            except ValueError:
                pass

    sorted_ports = sorted(list(ports))
    return sorted_ports if sorted_ports else TOP_20_PORTS.copy()


def get_default_service(port: int) -> str:
    """Returns the default service name associated with a port number, or 'Unknown'."""
    return COMMON_SERVICES_MAP.get(port, "Unknown")

"""
NETPROBE - Host Discovery Module
Determines host reachability using ICMP ping (system ping execution) and TCP socket probes.
"""

import os
import platform
import socket
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Union

# Quick probe ports commonly open on network hosts
DISCOVERY_PROBE_PORTS = [80, 443, 22, 445, 135, 3389, 8080]


def is_host_alive_icmp(ip: str, timeout_ms: int = 1000) -> bool:
    """
    Checks if a host responds to ICMP echo requests using system ping binary.
    Cross-platform (Windows & Linux/macOS support).
    """
    param_count = '-n' if platform.system().lower() == 'windows' else '-c'
    param_timeout = '-w' if platform.system().lower() == 'windows' else '-W'
    timeout_val = str(timeout_ms) if platform.system().lower() == 'windows' else str(max(1, int(timeout_ms / 1000)))

    # On Windows, ping timeout -w is in milliseconds
    cmd = ['ping', param_count, '1', param_timeout, timeout_val, ip]

    try:
        res = subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=(timeout_ms / 1000.0) + 1.0
        )
        return res.returncode == 0
    except (subprocess.TimeoutExpired, Exception):
        return False


def is_host_alive_tcp_probe(ip: str, timeout: float = 1.0) -> bool:
    """
    Checks if a host responds on any standard probe ports (TCP connect test).
    Useful when ICMP ping is blocked by host firewalls.
    """
    for port in DISCOVERY_PROBE_PORTS:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(timeout)
            result = s.connect_ex((ip, port))
            s.close()
            if result == 0 or result in (socket.errno.ECONNREFUSED, 10061):  # 10061 is WSAECONNREFUSED on Win
                # Connection refused means host network stack is active!
                return True
        except Exception:
            pass
    return False


def check_single_host(ip: str, use_icmp: bool = True, timeout: float = 1.0) -> Dict[str, Union[str, bool]]:
    """Checks reachability for a single host using ICMP ping followed by TCP probes."""
    # Special handling for localhost
    if ip in ("127.0.0.1", "localhost", "::1"):
        return {"ip": ip, "status": "UP", "method": "loopback"}

    if use_icmp and is_host_alive_icmp(ip, int(timeout * 1000)):
        return {"ip": ip, "status": "UP", "method": "ICMP Ping"}

    if is_host_alive_tcp_probe(ip, timeout):
        return {"ip": ip, "status": "UP", "method": "TCP Probe"}

    return {"ip": ip, "status": "DOWN", "method": "None"}


def discover_hosts(targets: List[str], threads: int = 50, timeout: float = 1.0) -> List[Dict[str, Union[str, bool]]]:
    """
    Performs host discovery across a list of IP targets using thread pooling.
    Returns list of host discovery result dictionaries.
    """
    results = []
    print(f"[*] Starting Host Discovery on {len(targets)} target(s) using {threads} threads...")

    with ThreadPoolExecutor(max_workers=min(threads, len(targets) or 1)) as executor:
        future_to_ip = {executor.submit(check_single_host, ip, True, timeout): ip for ip in targets}

        for future in as_completed(future_to_ip):
            res = future.result()
            results.append(res)

    # Sort results by IP string order
    results.sort(key=lambda x: x["ip"])
    return results

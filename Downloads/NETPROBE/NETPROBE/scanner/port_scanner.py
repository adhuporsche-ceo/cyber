"""
NETPROBE - Multithreaded TCP Port Scanner Module
Performs TCP Connect scans, tracks open/closed/filtered ports, and handles progress logging.
"""

import socket
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Callable, Union
from scanner.scanner_utils import get_default_service


def scan_port(ip: str, port: int, timeout: float = 1.5) -> Dict[str, Union[str, int]]:
    """
    Scans a single TCP port on a target IP address using TCP Connect scanning.
    Returns dictionary with status ('OPEN', 'CLOSED', or 'FILTERED').
    """
    start_time = time.time()
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((ip, port))
        sock.close()

        latency_ms = round((time.time() - start_time) * 1000, 2)

        if result == 0:
            return {
                "ip": ip,
                "port": port,
                "status": "OPEN",
                "service": get_default_service(port),
                "latency_ms": latency_ms
            }
        elif result in (socket.errno.ECONNREFUSED, 10061):  # WSAECONNREFUSED on Windows
            return {
                "ip": ip,
                "port": port,
                "status": "CLOSED",
                "service": get_default_service(port),
                "latency_ms": latency_ms
            }
        else:
            return {
                "ip": ip,
                "port": port,
                "status": "FILTERED",
                "service": get_default_service(port),
                "latency_ms": latency_ms
            }
    except socket.timeout:
        return {
            "ip": ip,
            "port": port,
            "status": "FILTERED",
            "service": get_default_service(port),
            "latency_ms": round(timeout * 1000, 2)
        }
    except Exception as e:
        return {
            "ip": ip,
            "port": port,
            "status": "ERROR",
            "service": get_default_service(port),
            "error": str(e),
            "latency_ms": 0.0
        }


def scan_target_ports(
    ip: str,
    ports: List[int],
    threads: int = 100,
    timeout: float = 1.5,
    show_progress: bool = True,
    callback: Optional[Callable[[Dict], None]] = None
) -> Dict[str, Union[str, List[Dict]]]:
    """
    Scans specified list of ports on target host using ThreadPoolExecutor.
    Yields or callbacks open ports as they are discovered.
    """
    total_ports = len(ports)
    open_ports = []
    closed_count = 0
    filtered_count = 0
    completed_count = 0

    scan_start = time.time()

    with ThreadPoolExecutor(max_workers=min(threads, total_ports or 1)) as executor:
        future_map = {executor.submit(scan_port, ip, port, timeout): port for port in ports}

        for future in as_completed(future_map):
            completed_count += 1
            port_result = future.result()

            if port_result["status"] == "OPEN":
                open_ports.append(port_result)
                if callback:
                    callback(port_result)
            elif port_result["status"] == "CLOSED":
                closed_count += 1
            else:
                filtered_count += 1

            if show_progress and total_ports >= 50 and completed_count % max(1, total_ports // 10) == 0:
                pct = (completed_count / total_ports) * 100
                print(f"   [Progress] {ip}: {completed_count}/{total_ports} ports scanned ({pct:.1f}%) - {len(open_ports)} OPEN ports found")

    scan_duration = round(time.time() - scan_start, 2)

    # Sort open ports numerically
    open_ports.sort(key=lambda x: x["port"])

    return {
        "ip": ip,
        "scan_time": scan_duration,
        "total_scanned": total_ports,
        "open_ports_count": len(open_ports),
        "closed_ports_count": closed_count,
        "filtered_ports_count": filtered_count,
        "open_ports": open_ports
    }

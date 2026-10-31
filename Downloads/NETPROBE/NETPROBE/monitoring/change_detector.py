"""
NETPROBE - Baseline and Change Detector Module
Compares current scan results with historical baseline states stored in SQLite or file.
Detects:
 - New host discovered / Host disappeared
 - New port opened / Previously open port closed
 - New service detected / Service version changed
 - New vulnerability detected / Previous vulnerability resolved
"""

import json
import os
from typing import Dict, List, Union
from database.database import get_latest_host_state, DB_PATH

BASELINE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "baseline.json")


def save_baseline(scan_results: List[Dict]) -> bool:
    """Saves scan results as the primary network baseline file."""
    try:
        baseline_data = {}
        for host in scan_results:
            ip = host["ip"]
            baseline_data[ip] = {
                "open_ports": [p["port"] for p in host.get("open_ports", [])],
                "services": {str(p["port"]): p.get("service", "Unknown") for p in host.get("open_ports", [])},
                "versions": {str(p["port"]): p.get("version", "Unknown") for p in host.get("open_ports", [])},
                "vulnerabilities": {str(p["port"]): [v["cve_id"] for v in p.get("vulnerabilities", [])] for p in host.get("open_ports", [])}
            }

        with open(BASELINE_FILE, "w", encoding="utf-8") as f:
            json.dump(baseline_data, f, indent=2)
        return True
    except Exception:
        return False


def load_baseline() -> Dict:
    """Loads current baseline json if present."""
    if os.path.exists(BASELINE_FILE):
        try:
            with open(BASELINE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def detect_changes(current_results: List[Dict]) -> List[Dict[str, Union[str, List]]]:
    """
    Compares current scan against loaded baseline or database historical state.
    Returns list of delta change entries per host.
    """
    baseline = load_baseline()
    change_reports = []

    current_ips = {host["ip"] for host in current_results}
    for previous_ip in set(baseline) - current_ips:
        change_reports.append({
            "ip": previous_ip,
            "total_changes": 1,
            "changes": [{
                "type": "HOST_DISAPPEARED",
                "severity": "MEDIUM",
                "description": f"Previously monitored host {previous_ip} was not observed in this cycle."
            }]
        })

    for host in current_results:
        ip = host["ip"]
        curr_ports = set(p["port"] for p in host.get("open_ports", []))

        changes = []
        host_baseline = baseline.get(ip)

        if not host_baseline:
            # Check SQLite database for previous state if no file baseline
            db_state = get_latest_host_state(ip)
            if db_state:
                prev_ports = set(p["port"] for p in db_state.get("open_ports", []))
                host_baseline = {
                    "open_ports": list(prev_ports),
                    "services": {str(p["port"]): p.get("service") for p in db_state.get("open_ports", [])},
                    "versions": {str(p["port"]): p.get("version") for p in db_state.get("open_ports", [])},
                    "vulnerabilities": db_state.get("vulnerabilities", {})
                }

        if not host_baseline:
            changes.append({
                "type": "NEW_HOST_DISCOVERED",
                "severity": "INFO",
                "description": f"Host {ip} has no previous baseline record. Newly discovered on network."
            })
        else:
            prev_ports = set(host_baseline.get("open_ports", []))

            # 1. Newly opened ports
            newly_opened = curr_ports - prev_ports
            for np in newly_opened:
                changes.append({
                    "type": "NEW_PORT_OPENED",
                    "severity": "HIGH",
                    "port": np,
                    "previous_state": "CLOSED",
                    "current_state": "OPEN",
                    "description": f"New open port detected: {np}/tcp (Previous state: CLOSED)"
                })

            # 2. Ports closed
            closed_ports = prev_ports - curr_ports
            for cp in closed_ports:
                changes.append({
                    "type": "PORT_CLOSED",
                    "severity": "INFO",
                    "port": cp,
                    "previous_state": "OPEN",
                    "current_state": "CLOSED",
                    "description": f"Previously open port closed: {cp}/tcp (REMEDIATED / CLOSED)"
                })

            # 3. Service or Version change detection
            for p_info in host.get("open_ports", []):
                p_str = str(p_info["port"])
                if p_str in host_baseline.get("versions", {}):
                    prev_ver = host_baseline["versions"][p_str]
                    curr_ver = p_info.get("version", "Unknown")
                    if curr_ver != prev_ver and curr_ver != "Unknown":
                        changes.append({
                            "type": "VERSION_CHANGED",
                            "severity": "MEDIUM",
                            "port": p_info["port"],
                            "previous_version": prev_ver,
                            "current_version": curr_ver,
                            "description": f"Software version changed on port {p_info['port']}: '{prev_ver}' -> '{curr_ver}'"
                        })

            previous_services = host_baseline.get("services", {})
            for p_info in host.get("open_ports", []):
                port_key = str(p_info["port"])
                previous_service = previous_services.get(port_key)
                current_service = p_info.get("service", "Unknown")
                if previous_service and previous_service != current_service:
                    changes.append({
                        "type": "SERVICE_CHANGED",
                        "severity": "MEDIUM",
                        "port": p_info["port"],
                        "previous_service": previous_service,
                        "current_service": current_service,
                        "description": f"Service identity changed on port {p_info['port']}: '{previous_service}' -> '{current_service}'"
                    })

            previous_vulnerabilities = host_baseline.get("vulnerabilities", {})
            for p_info in host.get("open_ports", []):
                port_key = str(p_info["port"])
                previous_cves = set(previous_vulnerabilities.get(port_key, []))
                current_cves = {v["cve_id"] for v in p_info.get("vulnerabilities", [])}
                for cve_id in sorted(current_cves - previous_cves):
                    changes.append({
                        "type": "NEW_VULNERABILITY",
                        "severity": "HIGH",
                        "port": p_info["port"],
                        "cve_id": cve_id,
                        "description": f"New vulnerability detected on port {p_info['port']}: {cve_id}"
                    })
                for cve_id in sorted(previous_cves - current_cves):
                    changes.append({
                        "type": "VULNERABILITY_RESOLVED",
                        "severity": "INFO",
                        "port": p_info["port"],
                        "cve_id": cve_id,
                        "description": f"Previously detected vulnerability no longer matched on port {p_info['port']}: {cve_id}"
                    })

        if changes:
            change_reports.append({
                "ip": ip,
                "total_changes": len(changes),
                "changes": changes
            })

    return change_reports

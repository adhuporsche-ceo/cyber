"""
NETPROBE - Database Engine Module
Manages SQLite database storage for hosts, open ports, services, security findings,
and historical scan records.
"""

import json
import os
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional, Union

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "netprobe_assets.db")


def get_connection():
    """Establishes and returns a connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_database():
    """Creates database schema tables if they do not already exist."""
    conn = get_connection()
    cursor = conn.cursor()

    # Table 1: Scans History
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scans (
            scan_id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            target_spec TEXT NOT NULL,
            total_hosts INTEGER,
            scan_duration REAL
        )
    """)

    # Table 2: Hosts Inventory
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS hosts (
            host_id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip TEXT UNIQUE NOT NULL,
            status TEXT NOT NULL,
            last_scanned TEXT NOT NULL,
            first_seen TEXT NOT NULL
        )
    """)

    # Table 3: Port Services & Fingerprints (Linked to latest scan)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS services (
            service_id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_id INTEGER,
            ip TEXT NOT NULL,
            port INTEGER NOT NULL,
            status TEXT NOT NULL,
            service TEXT,
            product TEXT,
            version TEXT,
            banner TEXT,
            confidence TEXT,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (scan_id) REFERENCES scans(scan_id)
        )
    """)

    # Table 4: Security Findings & Vulnerabilities
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS findings (
            finding_id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_id INTEGER,
            ip TEXT NOT NULL,
            port INTEGER NOT NULL,
            finding_type TEXT NOT NULL, -- 'RULE' or 'CVE'
            title TEXT NOT NULL,
            severity TEXT NOT NULL,
            reason TEXT,
            recommendation TEXT,
            cve_id TEXT,
            timestamp TEXT NOT NULL,
            FOREIGN KEY (scan_id) REFERENCES scans(scan_id)
        )
    """)

    conn.commit()
    conn.close()


def save_scan_results(target_spec: str, results: List[Dict]) -> int:
    """
    Saves a full scan execution into SQLite database tables.
    Returns generated scan_id.
    """
    init_database()
    conn = get_connection()
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # 1. Insert Scan Record
    total_hosts = len(results)
    total_dur = sum(r.get("scan_time", 0.0) for r in results)
    cursor.execute(
        "INSERT INTO scans (timestamp, target_spec, total_hosts, scan_duration) VALUES (?, ?, ?, ?)",
        (now_str, target_spec, total_hosts, total_dur)
    )
    scan_id = cursor.lastrowid

    # 2. Update Hosts and Services
    for host_res in results:
        ip = host_res["ip"]
        status = "UP" if host_res.get("open_ports_count", 0) > 0 else "DOWN"

        # Update or Insert Host
        cursor.execute("SELECT first_seen FROM hosts WHERE ip = ?", (ip,))
        row = cursor.fetchone()
        if row:
            cursor.execute("UPDATE hosts SET status = ?, last_scanned = ? WHERE ip = ?", (status, now_str, ip))
        else:
            cursor.execute("INSERT INTO hosts (ip, status, last_scanned, first_seen) VALUES (?, ?, ?, ?)", (ip, status, now_str, now_str))

        # Insert Open Ports & Enumeration Details
        for port_info in host_res.get("open_ports", []):
            port = port_info["port"]
            svc = port_info.get("service", "Unknown")
            banner = port_info.get("banner", "")
            prod = port_info.get("product", svc)
            ver = port_info.get("version", "Unknown")
            conf = port_info.get("confidence", "Medium")

            cursor.execute("""
                INSERT INTO services (scan_id, ip, port, status, service, product, version, banner, confidence, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (scan_id, ip, port, "OPEN", svc, prod, ver, banner, str(conf), now_str))

            # Insert Rule Findings
            for f in port_info.get("findings", []):
                cursor.execute("""
                    INSERT INTO findings (scan_id, ip, port, finding_type, title, severity, reason, recommendation, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (scan_id, ip, port, "RULE", f["finding"], f["severity"], f["reason"], f["recommendation"], now_str))

            # Insert Vulnerabilities
            for v in port_info.get("vulnerabilities", []):
                cursor.execute("""
                    INSERT INTO findings (scan_id, ip, port, finding_type, title, severity, reason, recommendation, cve_id, timestamp)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (scan_id, ip, port, "CVE", f"Vulnerability {v['cve_id']}", v["severity"], v["summary"], v["remediation"], v["cve_id"], now_str))

    conn.commit()
    conn.close()
    return scan_id


def get_latest_host_state(ip: str) -> Optional[Dict]:
    """Retrieves the most recent scan state for a given host IP from SQLite."""
    init_database()
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT scan_id FROM services WHERE ip = ? ORDER BY service_id DESC LIMIT 1
    """, (ip,))
    last_scan = cursor.fetchone()
    if not last_scan:
        conn.close()
        return None

    last_scan_id = last_scan["scan_id"]

    cursor.execute("SELECT * FROM services WHERE scan_id = ? AND ip = ?", (last_scan_id, ip))
    service_rows = cursor.fetchall()

    open_ports = []
    vulnerabilities = {}
    for s_row in service_rows:
        open_ports.append({
            "port": s_row["port"],
            "service": s_row["service"],
            "product": s_row["product"],
            "version": s_row["version"],
            "banner": s_row["banner"]
        })

    cursor.execute(
        "SELECT port, cve_id FROM findings WHERE scan_id = ? AND ip = ? AND finding_type = 'CVE' AND cve_id IS NOT NULL",
        (last_scan_id, ip)
    )
    for finding in cursor.fetchall():
        vulnerabilities.setdefault(str(finding["port"]), []).append(finding["cve_id"])

    conn.close()
    return {
        "ip": ip,
        "scan_id": last_scan_id,
        "open_ports": open_ports,
        "vulnerabilities": vulnerabilities
    }


def get_scan_history() -> List[Dict]:
    """Retrieves list of past scans recorded in database."""
    init_database()
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM scans ORDER BY scan_id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

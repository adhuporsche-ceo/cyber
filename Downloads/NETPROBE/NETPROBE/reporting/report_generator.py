"""
NETPROBE - Report Generator Module
Exports security assessment scan results into TXT, JSON, and HTML formats.
"""

import json
import os
import csv
from datetime import datetime
from typing import Dict, List, Union

REPORT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "reports")


def ensure_report_dir():
    """Ensures reports output directory exists."""
    if not os.path.exists(REPORT_DIR):
        os.makedirs(REPORT_DIR, exist_ok=True)


def export_json(scan_results: List[Dict], filename: str = None) -> str:
    """Exports scan results into structured JSON report file."""
    ensure_report_dir()
    if not filename:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"netprobe_report_{ts}.json"

    filepath = os.path.join(REPORT_DIR, filename)
    report_payload = {
        "generator": "NETPROBE v1.0",
        "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "scan_count": len(scan_results),
        "results": scan_results
    }

    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(report_payload, f, indent=2)

    return filepath


def export_csv(scan_results: List[Dict], filename: str = None) -> str:
    """Exports one machine-readable row per finding or potential vulnerability."""
    ensure_report_dir()
    if not filename:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"netprobe_report_{ts}.csv"

    filepath = os.path.join(REPORT_DIR, filename)
    fields = ["target", "port", "service", "type", "id", "state", "severity", "confidence", "description", "evidence", "recommendation"]
    with open(filepath, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for host in scan_results:
            for port_info in host.get("open_ports", []):
                common = {"target": host.get("ip", ""), "port": port_info.get("port", ""), "service": port_info.get("service", "")}
                for finding in port_info.get("findings", []):
                    writer.writerow({**common, "type": "finding", "id": finding.get("rule_id", ""), "state": finding.get("state", "Detected"), "severity": finding.get("severity", ""), "confidence": finding.get("confidence", ""), "description": finding.get("finding", ""), "evidence": finding.get("evidence", ""), "recommendation": finding.get("recommendation", "")})
                for vulnerability in port_info.get("vulnerabilities", []):
                    writer.writerow({**common, "type": "potential_vulnerability", "id": vulnerability.get("finding_id", vulnerability.get("cve_id", "")), "state": vulnerability.get("state", "Potentially Affected"), "severity": vulnerability.get("severity", ""), "confidence": vulnerability.get("confidence", ""), "description": vulnerability.get("summary", ""), "evidence": f"{vulnerability.get('cve_id', '')}; detected version: {vulnerability.get('detected_version', '')}", "recommendation": vulnerability.get("remediation", "")})

    return filepath


def export_txt(scan_results: List[Dict], filename: str = None) -> str:
    """Exports scan results into clean formatted ASCII text report file."""
    ensure_report_dir()
    if not filename:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"netprobe_report_{ts}.txt"

    filepath = os.path.join(REPORT_DIR, filename)

    lines = []
    lines.append("=" * 70)
    lines.append("        NETPROBE - NETWORK SECURITY ASSESSMENT REPORT")
    lines.append("=" * 70)
    lines.append(f"Generated On : {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append(f"Total Hosts  : {len(scan_results)}")
    lines.append("=" * 70 + "\n")

    for host in scan_results:
        ip = host["ip"]
        lines.append(f"HOST: {ip}")
        lines.append(f"Scan Time: {host.get('scan_time', 0.0)}s | Open Ports: {host.get('open_ports_count', 0)}")
        lines.append("-" * 70)

        for p_info in host.get("open_ports", []):
            lines.append(f"  [+] Port {p_info['port']}/tcp - Service: {p_info.get('service', 'Unknown')} (Product: {p_info.get('product', 'Unknown')} {p_info.get('version', '')})")
            if p_info.get("banner"):
                lines.append(f"      Banner     : {p_info['banner'][:80]}")
            if p_info.get("risk"):
                lines.append(f"      Risk Rating: {p_info['risk']['risk_level']} (Composite Score: {p_info['risk']['composite_score']})")
                lines.append(f"      Rationale  : {p_info['risk']['explanation']}")

            for f in p_info.get("findings", []):
                lines.append(f"      [FINDING] [{f['severity']}] {f['finding']}")
                lines.append(f"                Recommendation: {f['recommendation']}")

            for v in p_info.get("vulnerabilities", []):
                lines.append(f"      [POTENTIAL] [{v['severity']}] {v.get('finding_id', 'NPT-VULN')} {v['cve_id']} - CVSS {v.get('cvss_score', 'N/A')} ({v.get('confidence', 'UNKNOWN')})")
                lines.append(f"            Summary: {v['summary']}")
                lines.append(f"            Status: {v.get('status', 'Potentially Affected')}")
                lines.append(f"            Fix: {v['remediation']}")

            lines.append("")

        lines.append("=" * 70 + "\n")

    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    return filepath


def export_html(scan_results: List[Dict], filename: str = None) -> str:
    """Exports scan results into a responsive HTML report file."""
    ensure_report_dir()
    if not filename:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"netprobe_report_{ts}.html"

    filepath = os.path.join(REPORT_DIR, filename)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>NETPROBE Security Assessment Report</title>
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; background-color: #0f172a; color: #f8fafc; margin: 0; padding: 20px; }}
        .header {{ background: linear-gradient(135deg, #1e293b, #0f172a); border-bottom: 2px solid #38bdf8; padding: 20px; text-align: center; border-radius: 8px; }}
        h1 {{ margin: 0; color: #38bdf8; font-size: 26px; }}
        .meta {{ color: #94a3b8; font-size: 14px; margin-top: 5px; }}
        .card {{ background: #1e293b; border: 1px solid #334155; border-radius: 8px; margin: 20px 0; padding: 20px; }}
        .host-title {{ font-size: 20px; color: #f1f5f9; border-bottom: 1px solid #334155; padding-bottom: 10px; margin-bottom: 15px; }}
        table {{ width: 100%; border-collapse: collapse; margin-top: 10px; }}
        th, td {{ text-align: left; padding: 10px; border-bottom: 1px solid #334155; }}
        th {{ background-color: #0f172a; color: #38bdf8; }}
        .badge {{ padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }}
        .badge-CRITICAL {{ background: #ef4444; color: white; }}
        .badge-HIGH {{ background: #f97316; color: white; }}
        .badge-MEDIUM {{ background: #eab308; color: black; }}
        .badge-LOW {{ background: #3b82f6; color: white; }}
        .badge-INFO {{ background: #64748b; color: white; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>NETPROBE Security Assessment Report</h1>
        <div class="meta">Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Target Count: {len(scan_results)} Host(s)</div>
    </div>
"""

    for host in scan_results:
        html += f"""
    <div class="card">
        <div class="host-title">Host: {host['ip']}</div>
        <p><strong>Scan Duration:</strong> {host.get('scan_time', 0)}s | <strong>Open Ports:</strong> {host.get('open_ports_count', 0)}</p>
        
        <table>
            <thead>
                <tr>
                    <th>Port</th>
                    <th>Service</th>
                    <th>Product & Version</th>
                    <th>Risk Rating</th>
                    <th>Findings / Vulnerabilities</th>
                </tr>
            </thead>
            <tbody>
"""

        for p in host.get("open_ports", []):
            risk_lvl = p.get("risk", {}).get("risk_level", "INFO")
            findings_text = ""
            for f in p.get("findings", []):
                findings_text += f"<div><span class='badge badge-{f['severity']}'>{f['severity']}</span> {f['finding']}</div>"
            for v in p.get("vulnerabilities", []):
                findings_text += f"<div><span class='badge badge-{v['severity']}'>{v['cve_id']}</span> {v['summary'][:80]}...</div>"

            if not findings_text:
                findings_text = "<span class='badge badge-INFO'>No Direct Findings</span>"

            html += f"""
                <tr>
                    <td><strong>{p['port']}/tcp</strong></td>
                    <td>{p.get('service', 'Unknown')}</td>
                    <td>{p.get('product', 'Unknown')} {p.get('version', '')}</td>
                    <td><span class="badge badge-{risk_lvl}">{risk_lvl}</span></td>
                    <td>{findings_text}</td>
                </tr>
"""

        html += """
            </tbody>
        </table>
    </div>
"""

    html += """
</body>
</html>
"""

    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)

    return filepath

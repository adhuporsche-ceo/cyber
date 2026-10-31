#!/usr/bin/env python3
"""
NETPROBE - Network Port Scanning, Service Enumeration & Vulnerability Assessment Tool
Full Standalone CLI Application
"""

import argparse
import os
import sys
import time
from typing import List

# Ensure local imports resolve correctly
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from scanner.scanner_utils import parse_targets, parse_ports
from scanner.host_discovery import discover_hosts
from scanner.port_scanner import scan_target_ports
from enumeration.banner_grabber import grab_banner
from enumeration.service_detector import detect_service
from enumeration.version_detector import detect_version
from security.rules import evaluate_security_rules
from security.vulnerability_engine import lookup_vulnerabilities
from security.web_assessor import assess_website
from security.risk_analyzer import calculate_risk_score
from database.database import init_database, save_scan_results, get_scan_history
from monitoring.change_detector import detect_changes, save_baseline
from reporting.report_generator import export_json, export_txt, export_html, export_csv

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BANNER = r"""
====================================================================
  _  _ _____ _____ ___  ___  ___  ___  _____
 | \| |  ___|_   _| _ \| _ \/ _ \| _ \|  ___|
 | .` |  _|   | | |  _/|   / (_) | _ <|  _|
 |_|\_|____|  |_| |_|  |_|_\\___/|___/|____| 
                                             
  NETPROBE v1.0 - Network Scanning & Vulnerability Assessment Engine
====================================================================
"""
VERSION = "1.0.0"


def print_banner():
    print(BANNER)
    print("Authorized-use notice: scan only systems you own or are explicitly permitted to assess.\n")


def normalize_command_args(argv: List[str]) -> List[str]:
    """Translate memorable subcommand syntax into the legacy parser options."""
    if not argv:
        return argv

    command = argv[0].lower()
    if command in ("network", "scan", "vuln", "web", "assess", "baseline") and len(argv) == 2 and argv[1] in ("-h", "--help"):
        return ["--help"]
    if command == "baseline" and len(argv) >= 2:
        return ["--target", argv[1], "--set-baseline"] + argv[2:]
    if command in ("network", "scan", "vuln", "web", "assess") and len(argv) >= 2:
        target = argv[1]
        options = argv[2:]
        if command == "web" or (command == "assess" and "://" in target):
            return ["--website", target] + options
        return ["--target", target] + (["--discover", "--full-assessment"] if command == "assess" else []) + options
    if command == "history":
        return ["--history"] + argv[1:]
    if command == "version":
        return ["--version"] + argv[1:]
    if command == "doctor":
        return ["--doctor"] + argv[1:]
    return argv


def print_attack_surface_summary(scan_results: List[dict]):
    """Displays structured CLI summary of network attack surface."""
    print("\n" + "=" * 70)
    print("           ATTACK SURFACE MAP SUMMARY")
    print("=" * 70)

    for host in scan_results:
        print(f"Host: {host['ip']} | Active Ports: {host['open_ports_count']}")
        for p in host.get("open_ports", []):
            risk = p.get("risk", {}).get("risk_level", "INFO")
            print(f"  └── [{p['port']}/tcp] Service: {p.get('service', 'Unknown'):<12} Product: {p.get('product', 'Unknown'):<15} Version: {p.get('version', 'Unknown'):<10} Risk: [{risk}]")
            for f in p.get("findings", []):
                print(f"       ├── [FINDING] ({f['severity']}) {f['finding']}")
            for v in p.get("vulnerabilities", []):
                print(f"       └── [POTENTIAL] ({v['severity']}) {v.get('finding_id', 'NPT-VULN')} {v['cve_id']} - CVSS {v.get('cvss_score')} [{v.get('confidence', 'UNKNOWN')}]")

    print("=" * 70 + "\n")


def print_realtime_events(deltas: List[dict]):
    """Prints security-relevant changes as they are detected by a cycle."""
    for entry in deltas:
        for change in entry.get("changes", []):
            severity = change.get("severity", "INFO")
            print(f"[REALTIME][{severity}] {entry['ip']}: {change['description']}")


def execute_full_assessment(targets: List[str], ports: List[int], threads: int, timeout: float, save_db: bool = True) -> List[dict]:
    """Executes the full NETPROBE assessment pipeline on given targets."""
    results = []

    for target in targets:
        print(f"\n[+] Scanning Host: {target}")
        print("-" * 65)

        # 1. TCP Port Scanning
        scan_res = scan_target_ports(
            ip=target,
            ports=ports,
            threads=threads,
            timeout=timeout,
            show_progress=True
        )

        open_ports = scan_res.get("open_ports", [])
        if not open_ports:
            print(f"[-] No open ports found on {target}")
            results.append(scan_res)
            continue

        print(f"[+] Discovered {len(open_ports)} OPEN port(s). Performing Enumeration & Vulnerability Assessment...")

        # 2. Enumeration, Security Analysis & Risk Prioritization per Open Port
        for p_info in open_ports:
            port = p_info["port"]

            # Banner Grabbing
            banner_res = grab_banner(target, port, timeout=timeout)
            p_info["banner"] = banner_res["banner"]

            # Service Detection
            svc_res = detect_service(target, port, banner=banner_res["banner"], raw_hex=banner_res["raw_hex"])
            p_info["service"] = svc_res["service"]
            p_info["confidence"] = svc_res["confidence"]

            # Version Fingerprinting
            ver_res = detect_version(svc_res["service"], banner_res["banner"])
            p_info["product"] = ver_res["product"]
            p_info["version"] = ver_res["version"]

            # Security Rules Engine Analysis
            findings = evaluate_security_rules(target, port, svc_res["service"], banner_res["banner"])
            p_info["findings"] = findings

            # Vulnerability Intelligence Lookup
            vulns = lookup_vulnerabilities(ver_res["product"], ver_res["version"])
            p_info["vulnerabilities"] = vulns

            # Composite Risk Analysis
            risk = calculate_risk_score(findings, vulns, port, str(ver_res["confidence"]))
            p_info["risk"] = risk

            # Print Live Finding Summary
            print(f"  [+] {port}/tcp | Service: {svc_res['service']:<12} Product: {ver_res['product']} ({ver_res['version']}) | Risk: [{risk['risk_level']}]")
            if banner_res['banner']:
                print(f"      Banner: {banner_res['banner'][:70]}...")
            for f in findings:
                print(f"      └── Finding ({f['severity']}): {f['finding']}")
            for v in vulns:
                print(f"      └── Potential vulnerability ({v['severity']}): {v.get('finding_id', 'NPT-VULN')} {v['cve_id']} - {v['summary'][:60]}...")

        results.append(scan_res)

    if save_db:
        scan_id = save_scan_results(",".join(targets), results)
        print(f"\n[+] Saved scan results to SQLite Asset Database (Scan ID: {scan_id})")

    return results


def execute_website_assessment(url: str, timeout: float, save_db: bool = True) -> List[dict]:
    """Run safe HTTP/HTTPS checks against one website URL."""
    assessment = assess_website(url, timeout=timeout)
    final_url = assessment.get("url", url)
    is_https = str(final_url).startswith("https://")
    port = 443 if is_https else 80
    findings = assessment.get("findings", [])
    result = {
        "ip": final_url,
        "open_ports_count": 1,
        "open_ports": [{
            "port": port,
            "service": "HTTPS" if is_https else "HTTP",
            "product": "Web Application",
            "version": "Unknown",
            "findings": findings,
            "vulnerabilities": [],
            "risk": calculate_risk_score(findings, [], port, "High"),
        }],
        "website": assessment,
    }
    if save_db:
        save_scan_results(url, [result])
    return [result]


def export_requested_reports(scan_results: List[dict], report: str, output: str = None):
    """Export the selected report formats for either network or website results."""
    output_base, _ = os.path.splitext(output or "")

    def filename(extension: str):
        if not output:
            return None
        return output if report != "all" else output_base + extension

    if report in ("txt", "all"):
        print(f"[+] Text report exported: {export_txt(scan_results, filename('.txt'))}")
    if report in ("json", "all"):
        print(f"[+] JSON report exported: {export_json(scan_results, filename('.json'))}")
    if report in ("html", "all"):
        print(f"[+] HTML report exported: {export_html(scan_results, filename('.html'))}")
    if report in ("csv", "all"):
        print(f"[+] CSV report exported: {export_csv(scan_results, filename('.csv'))}")


def run_doctor() -> int:
    """Check the local installation without contacting any target."""
    checks = [
        ("Python", sys.version.split()[0], sys.version_info >= (3, 8)),
        ("Package", os.path.exists(os.path.join(os.path.dirname(__file__), "main.py")), True),
        ("Rules", os.path.exists(os.path.join(os.path.dirname(__file__), "security", "rules.py")), True),
        ("Vulnerability Data", os.path.exists(os.path.join(os.path.dirname(__file__), "data", "vulnerabilities.json")), True),
    ]
    print("\nNETPROBE SYSTEM CHECK\n")
    failed = False
    for name, value, passed in checks:
        status = "OK" if passed else "FAIL"
        print(f"{name:<22} [{status}] {value if isinstance(value, str) else ''}")
        failed = failed or not passed
    print("\nNETPROBE is ready." if not failed else "\n[ERROR] NETPROBE installation is incomplete.")
    return 0 if not failed else 1


def main():
    if len(sys.argv) > 1 and sys.argv[1] in ("--version", "version"):
        print(f"NETPROBE {VERSION}")
        return
    print_banner()

    normalized_args = normalize_command_args(sys.argv[1:])

    parser = argparse.ArgumentParser(
        description="NETPROBE - Network Port Scanning, Service Enumeration & Vulnerability Assessment Tool",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )

    parser.add_argument("--version", action="version", version=f"NETPROBE {VERSION}")

    parser.add_argument("-t", "--target", help="Target IP, range (192.168.1.1-10), CIDR (192.168.1.0/24), or hostname")
    parser.add_argument("-p", "--ports", default="top20", help="Ports: '22,80,443', '1-100', 'top20', 'top100', 'all'")
    parser.add_argument("--discover", action="store_true", help="Run ICMP/TCP host discovery reachability test before scan")
    parser.add_argument("--threads", type=int, default=50, help="Scanner thread concurrency (default: 50)")
    parser.add_argument("--timeout", type=float, default=1.5, help="Socket timeout in seconds (default: 1.5)")
    parser.add_argument("--set-baseline", action="store_true", help="Save this scan result as the primary baseline state")
    parser.add_argument("--check-changes", action="store_true", help="Compare scan results against previous baseline/scan state")
    parser.add_argument("--verify-remediation", action="store_true", help="Verify if previously reported security findings have been closed")
    parser.add_argument("--continuous", type=int, default=0, help="Run in continuous monitoring mode with specified interval seconds")
    parser.add_argument("--report", "--format", "-f", choices=["txt", "json", "html", "csv", "all"], help="Export scan results to specified report format")
    parser.add_argument("-o", "--output", help="Output filename; reports are written to the reports directory")
    parser.add_argument("--history", action="store_true", help="Display past scan history from SQLite database")
    parser.add_argument("--website", help="Run safe HTTP/HTTPS security checks against a website URL")
    parser.add_argument("--full-assessment", action="store_true", help=argparse.SUPPRESS)
    parser.add_argument("--doctor", action="store_true", help=argparse.SUPPRESS)

    if not normalized_args:
        parser.print_help()
        return
    args = parser.parse_args(normalized_args)

    if args.doctor:
        raise SystemExit(run_doctor())

    if args.website:
        website_results = execute_website_assessment(args.website, args.timeout)
        print_attack_surface_summary(website_results)
        if args.report:
            export_requested_reports(website_results, args.report, args.output)
        return

    # Show database history if requested
    if args.history:
        history = get_scan_history()
        print("\n[+] NETPROBE SQLite Asset Inventory History:")
        print("----------------------------------------------------------------------")
        print(f"{'ID':<5} {'Timestamp':<20} {'Target Spec':<25} {'Hosts':<8} {'Duration'}")
        print("----------------------------------------------------------------------")
        for h in history:
            print(f"{h['scan_id']:<5} {h['timestamp']:<20} {h['target_spec']:<25} {h['total_hosts']:<8} {h['scan_duration']}s")
        print("----------------------------------------------------------------------\n")
        sys.exit(0)

    if not args.target:
        parser.error("-t/--target is required unless --website is supplied")

    # Resolve target list
    targets = parse_targets(args.target)
    ports = parse_ports(args.ports)

    print(f"[*] Resolved {len(targets)} target host(s) and {len(ports)} port(s).")

    # Optional Host Discovery
    if args.discover or len(targets) > 1:
        disc = discover_hosts(targets, threads=args.threads, timeout=args.timeout)
        targets = [d["ip"] for d in disc if d["status"] == "UP"]
        if not targets:
            print("[-] Host discovery complete. No active hosts found.")
            sys.exit(0)

    # Continuous Monitoring Loop or Single Scan
    while True:
        scan_results = execute_full_assessment(
            targets=targets,
            ports=ports,
            threads=args.threads,
            timeout=args.timeout
        )

        if args.full_assessment and len(targets) == 1:
            website_target = "https://" + targets[0]
            website_results = execute_website_assessment(website_target, args.timeout, save_db=False)
            if website_results[0].get("website", {}).get("status") == "ERROR":
                website_results = execute_website_assessment("http://" + targets[0], args.timeout, save_db=False)
            scan_results.extend(website_results)

        # Attack Surface Map
        print_attack_surface_summary(scan_results)

        # Baseline & Change Detection / Remediation Verification
        if args.set_baseline:
            if save_baseline(scan_results):
                print("[+] Current scan successfully set as baseline state.")

        if args.check_changes or args.verify_remediation:
            deltas = detect_changes(scan_results)
            print_realtime_events(deltas)
            print("\n" + "=" * 70)
            print("            BASELINE DELTA & CHANGE DETECTION REPORT")
            print("=" * 70)
            if not deltas:
                print(" [+] No changes detected. Asset security state remains identical to baseline.")
            else:
                for entry in deltas:
                    print(f" Host: {entry['ip']} ({entry['total_changes']} change(s) detected)")
                    for c in entry["changes"]:
                        status_tag = "[REMEDIATED]" if c["type"] == "PORT_CLOSED" else "[NEW EXPOSURE]"
                        print(f"  └── {status_tag} {c['description']}")
            print("=" * 70 + "\n")

        # Report Export
        if args.report:
            export_requested_reports(scan_results, args.report, args.output)

        if args.continuous <= 0:
            break

        print(f"\n[*] Continuous monitoring active. Sleeping for {args.continuous} seconds before next scan loop...")
        time.sleep(args.continuous)


if __name__ == "__main__":
    main()

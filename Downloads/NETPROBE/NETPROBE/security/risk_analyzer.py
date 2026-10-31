"""
NETPROBE - Risk Analyzer Module
Calculates contextual risk levels (CRITICAL, HIGH, MEDIUM, LOW, INFO) based on findings, vulnerabilities, port exposure, and confidence.
"""

from typing import Dict, List, Union


def calculate_risk_score(findings: List[Dict], vulnerabilities: List[Dict], port: int, confidence: str) -> Dict[str, Union[str, float]]:
    """
    Calculates overall composite risk rating and clear rationale for a port/service asset.
    """
    score = 0.0
    reasons = []

    # 1. Add score for CVE vulnerabilities
    for vuln in vulnerabilities:
        cvss = vuln.get("cvss_score", 5.0)
        score += cvss * 1.2
        reasons.append(f"Vulnerability {vuln['cve_id']} ({vuln['severity']} - CVSS {cvss}) detected")

    # 2. Add score for security rule findings
    for finding in findings:
        sev = finding.get("severity", "LOW")
        if sev == "CRITICAL":
            score += 9.0
        elif sev == "HIGH":
            score += 7.0
        elif sev == "MEDIUM":
            score += 4.0
        else:
            score += 2.0
        reasons.append(f"Security Finding: {finding['finding']} [{sev}]")

    # 3. Port exposure weighting
    if port in (21, 23, 135, 139, 445, 3389, 5900):
        score += 1.5
        reasons.append(f"Port TCP/{port} is a high-risk entry vector commonly targeted by exploits")

    # 4. Confidence scaling multiplier
    if confidence == "Low" or confidence == "Insufficient Evidence":
        score *= 0.7
        reasons.append("Risk score weighted down due to low detection confidence")

    # Determine qualitative risk level
    if score >= 9.0:
        level = "CRITICAL"
    elif score >= 7.0:
        level = "HIGH"
    elif score >= 4.0:
        level = "MEDIUM"
    elif score > 0.0:
        level = "LOW"
    else:
        level = "INFO"
        reasons.append("No active security issues or high-risk exposures detected on open port")

    return {
        "risk_level": level,
        "composite_score": round(score, 1),
        "explanation": " | ".join(reasons)
    }

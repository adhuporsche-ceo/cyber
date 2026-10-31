"""Safe HTTP/HTTPS metadata and certificate checks for an authorized website."""

import datetime
import socket
import ssl
from typing import Dict, List
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler


SECURITY_HEADERS = {
    "content-security-policy": ("MEDIUM", "Content-Security-Policy header is missing.", "Define a restrictive Content-Security-Policy."),
    "x-content-type-options": ("LOW", "X-Content-Type-Options header is missing.", "Set X-Content-Type-Options: nosniff."),
    "x-frame-options": ("LOW", "Clickjacking protection header is missing.", "Set X-Frame-Options or CSP frame-ancestors."),
    "referrer-policy": ("LOW", "Referrer-Policy header is missing.", "Set a privacy-preserving Referrer-Policy."),
}

EXPOSED_PATHS = ("/.env", "/.git/HEAD", "/server-status", "/phpinfo.php", "/actuator/env")


def _finding(host: str, url: str, severity: str, name: str, reason: str, recommendation: str, evidence: str) -> Dict[str, str]:
    parsed = urlparse(url)
    return {
        "rule_id": "WEB-" + name.upper().replace(" ", "-")[:32],
        "host": host,
        "port": parsed.port or (443 if parsed.scheme == "https" else 80),
        "service": "HTTPS" if parsed.scheme == "https" else "HTTP",
        "finding": name,
        "state": "Verified Configuration Issue",
        "severity": severity,
        "reason": reason,
        "evidence": evidence[:240],
        "recommendation": recommendation,
        "confidence": "High",
    }


def _assess_tls(host: str, parsed, timeout: float, findings: List[Dict[str, str]]) -> Dict[str, object]:
    """Validate the peer certificate without weakening certificate verification."""
    if parsed.scheme != "https":
        return {}

    port = parsed.port or 443
    context = ssl.create_default_context()
    try:
        with socket.create_connection((host, port), timeout=timeout) as connection:
            with context.wrap_socket(connection, server_hostname=host) as tls_socket:
                certificate = tls_socket.getpeercert()
                cipher = tls_socket.cipher()
                not_after = certificate.get("notAfter")
                if not_after:
                    expiry = datetime.datetime.strptime(not_after, "%b %d %H:%M:%S %Y %Z")
                    days_left = (expiry - datetime.datetime.utcnow()).days
                    if days_left < 0:
                        findings.append(_finding(host, parsed.geturl(), "HIGH", "TLS Certificate Expired", "The HTTPS certificate is expired.", "Replace the certificate with a valid certificate for the hostname.", not_after))
                    elif days_left <= 30:
                        findings.append(_finding(host, parsed.geturl(), "MEDIUM", "TLS Certificate Near Expiry", "The HTTPS certificate expires within 30 days.", "Renew the certificate before its expiration date.", not_after))
                return {"valid": True, "expires": not_after or "", "protocol": tls_socket.version(), "cipher": cipher[0] if cipher else ""}
    except (ssl.SSLCertVerificationError, ssl.CertificateError) as error:
        findings.append(_finding(host, parsed.geturl(), "HIGH", "TLS Certificate Validation Failed", "The certificate could not be validated for this HTTPS connection.", "Install a trusted certificate whose hostname and validity period match the site.", str(error)))
        return {"valid": False, "error": str(error)}
    except (OSError, ssl.SSLError) as error:
        findings.append(_finding(host, parsed.geturl(), "HIGH", "HTTPS TLS Handshake Failed", "The HTTPS endpoint did not complete a validated TLS handshake.", "Verify the TLS listener and certificate configuration.", str(error)))
        return {"valid": False, "error": str(error)}


def assess_website(url: str, timeout: float = 3.0) -> Dict[str, object]:
    """Perform non-destructive GET/HEAD checks and return structured findings."""
    parsed = urlparse(url if "://" in url else "https://" + url)
    if parsed.scheme not in ("http", "https") or not parsed.hostname:
        raise ValueError("Website target must be an HTTP or HTTPS URL")

    opener = build_opener(HTTPRedirectHandler())
    request = Request(parsed.geturl(), headers={"User-Agent": "NETPROBE/1.0", "Accept": "text/html,*/*;q=0.8"})
    findings: List[Dict[str, str]] = []
    try:
        response = opener.open(request, timeout=timeout)
        body = response.read(512 * 1024).decode("utf-8", errors="replace")
    except HTTPError as error:
        response = error
        body = error.read(64 * 1024).decode("utf-8", errors="replace")
    except (URLError, OSError) as error:
        return {"url": parsed.geturl(), "status": "ERROR", "error": str(error), "findings": findings}

    final_url = response.geturl()
    final_parsed = urlparse(final_url)
    headers = {key.lower(): value for key, value in response.headers.items()}
    host = parsed.hostname
    tls = _assess_tls(host, final_parsed, timeout, findings)

    if parsed.scheme == "http" and final_parsed.scheme != "https":
        findings.append(_finding(host, final_url, "MEDIUM", "HTTP Site Does Not Redirect To HTTPS", "The site remains on plaintext HTTP.", "Redirect HTTP to HTTPS and enable HSTS after verification.", final_url))
    if "server" in headers:
        findings.append(_finding(host, final_url, "LOW", "Server Version Disclosure", "The response exposes a Server header.", "Remove or minimize the Server response header.", "Server: " + headers["server"]))
    if final_parsed.scheme == "https" and "strict-transport-security" not in headers:
        findings.append(_finding(host, final_url, "MEDIUM", "HSTS Header Missing", "HTTPS does not advertise HTTP Strict Transport Security.", "Set Strict-Transport-Security after confirming all resources use HTTPS.", "Header absent"))
    for header, (severity, reason, recommendation) in SECURITY_HEADERS.items():
        if header not in headers:
            findings.append(_finding(host, final_url, severity, reason.rstrip("."), reason, recommendation, header + " header absent"))

    for cookie in response.headers.get_all("Set-Cookie", []) or []:
        cookie_lower = cookie.lower()
        if final_parsed.scheme == "https" and "secure" not in cookie_lower:
            findings.append(_finding(host, final_url, "MEDIUM", "Secure Cookie Flag Missing", "A cookie is set over HTTPS without Secure.", "Mark HTTPS session cookies Secure.", cookie))
        if "httponly" not in cookie_lower:
            findings.append(_finding(host, final_url, "LOW", "HttpOnly Cookie Flag Missing", "A cookie is accessible to client-side scripts.", "Mark session cookies HttpOnly where possible.", cookie))
        if "samesite" not in cookie_lower:
            findings.append(_finding(host, final_url, "LOW", "SameSite Cookie Flag Missing", "A cookie does not declare SameSite.", "Set SameSite=Lax or Strict unless cross-site use is required.", cookie))

    if "<form" in body.lower() and "action=\"http://" in body.lower():
        findings.append(_finding(host, final_url, "HIGH", "Form Submits Credentials Over HTTP", "The page contains a form posting to HTTP.", "Submit forms only to HTTPS endpoints.", "HTTP form action found"))
    if response.status == 200 and ("Index of /" in body or "Directory listing for /" in body):
        findings.append(_finding(host, final_url, "MEDIUM", "Directory Listing Enabled", "The response appears to expose a directory index.", "Disable directory listing unless required.", "Directory listing marker found"))

    for path in EXPOSED_PATHS:
        try:
            probe = opener.open(Request(urljoin(final_url, path), method="HEAD", headers={"User-Agent": "NETPROBE/1.0"}), timeout=timeout)
            if probe.status == 200:
                findings.append(_finding(host, final_url, "HIGH", "Sensitive Path Exposed", "A sensitive path returned HTTP 200.", "Remove the path or restrict it with authentication and network controls.", path + " returned HTTP 200"))
        except (HTTPError, URLError, OSError):
            pass

    return {"url": final_url, "status": response.status, "server": headers.get("server", ""), "tls": tls, "findings": findings}
# NETPROBE

NETPROBE is an authorized defensive network and website security assessment tool.
It discovers exposed services, identifies banners and versions, checks website
security configuration, correlates potential vulnerabilities, and generates
reports without executing exploits or credential attacks.

## Debian and Ubuntu installation

Extract the project, then run:

```bash
cd NETPROBE
chmod +x install.sh
sudo ./install.sh
```

The installer creates an isolated environment in `/opt/netprobe` and installs
the `netprobe` command in `/usr/local/bin`.

Verify the installation:

```bash
netprobe --version
netprobe doctor
netprobe --help
```

The command works from any directory after installation.

## Commands

```bash
netprobe scan <authorized-target>
netprobe vuln <authorized-target>
netprobe web <authorized-url>
netprobe assess <authorized-target>
netprobe baseline <authorized-target>
netprobe history
netprobe doctor
```

Examples:

```bash
netprobe vuln example.com --ports 22,80,443 --format json --output report.json
netprobe web https://example.com --format html
netprobe baseline 192.168.1.10 --ports top100
```

Only scan systems you own or are explicitly authorized to assess.

## Uninstall

From the extracted project directory:

```bash
sudo ./uninstall.sh
```

The uninstall script removes only `/opt/netprobe` and `/usr/local/bin/netprobe`.

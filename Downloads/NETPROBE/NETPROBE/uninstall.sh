#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/netprobe"
BIN_PATH="/usr/local/bin/netprobe"

if [[ "$(uname -s)" != "Linux" ]]; then
    echo "[ERROR] NETPROBE currently supports Linux environments only."
    exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
    echo "[ERROR] Uninstallation requires root privileges."
    echo "Run: sudo ./uninstall.sh"
    exit 1
fi

rm -f "${BIN_PATH}"
rm -rf "${INSTALL_DIR}"
echo "NETPROBE was uninstalled."

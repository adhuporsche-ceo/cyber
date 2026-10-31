#!/usr/bin/env bash
set -euo pipefail

INSTALL_DIR="/opt/netprobe"
BIN_PATH="/usr/local/bin/netprobe"
SOURCE_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"

if [[ "$(uname -s)" != "Linux" ]]; then
    echo "[ERROR] NETPROBE currently supports Linux environments only."
    exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
    echo "[ERROR] Installation requires root privileges."
    echo "Run: sudo ./install.sh"
    exit 1
fi

PYTHON="$(command -v python3 || true)"
if [[ -z "${PYTHON}" ]]; then
    echo "[ERROR] Python 3 is required. Install python3 and python3-venv first."
    exit 1
fi

mkdir -p "${INSTALL_DIR}/source"
cp -a "${SOURCE_DIR}/." "${INSTALL_DIR}/source/"

if ! "${PYTHON}" -m venv "${INSTALL_DIR}/venv"; then
    echo "[ERROR] Could not create a virtual environment."
    echo "Install the Debian package: python3-venv"
    exit 1
fi

"${INSTALL_DIR}/venv/bin/python" -m pip install --disable-pip-version-check --no-input --no-deps -r "${INSTALL_DIR}/source/requirements.txt"
cat > "${BIN_PATH}" <<EOF
#!/usr/bin/env bash
exec "${INSTALL_DIR}/venv/bin/python" "${INSTALL_DIR}/source/main.py" "\$@"
EOF
chmod 0755 "${BIN_PATH}"
chmod 0755 "${INSTALL_DIR}/source/install.sh" "${INSTALL_DIR}/source/uninstall.sh"

"${BIN_PATH}" --version
"${BIN_PATH}" doctor

echo
echo "NETPROBE installed successfully."
echo "Try: netprobe --help"

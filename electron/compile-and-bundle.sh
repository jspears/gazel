#!/bin/bash
set -euo pipefail

OUTPUT_TAR="$1"
APP_NAME="$2"
ELECTRON_ZIP="$3"
NODE_MODULES_ROOT="${4:-}"
NODE_BIN="${5:-node}"

if [[ -z "${OUTPUT_TAR:-}" || -z "${APP_NAME:-}" || -z "${ELECTRON_ZIP:-}" ]]; then
  echo "Usage: compile-and-bundle.sh <output_tar> <app_name> <electron_zip> [node_modules_root] [node_bin]"
  exit 1
fi

WORKSPACE_DIR="${BUILD_WORKSPACE_DIRECTORY:-$(pwd)}"
NODE_MODULES_DIR=""
NODE_MODULES_LINK_CREATED=0
DIST_DIR="$(mktemp -d)"
if [[ "${NODE_BIN}" != /* ]]; then
  if command -v "${NODE_BIN}" >/dev/null 2>&1; then
    NODE_BIN="$(command -v "${NODE_BIN}")"
  elif [[ -n "${HOME:-}" && -d "${HOME}/.nvm/versions/node" ]]; then
    FOUND_NODE=$(find "${HOME}/.nvm/versions/node" -maxdepth 5 -type f -name node -perm -111 -print -quit || true)
    if [[ -n "${FOUND_NODE}" ]]; then
      NODE_BIN="${FOUND_NODE}"
    fi
  fi
fi

if [[ ! -x "${NODE_BIN}" ]]; then
  NODE_CANDIDATES=(
    "/usr/local/bin/node"
    "/opt/homebrew/bin/node"
    "/usr/bin/node"
  )
  for candidate in "${NODE_CANDIDATES[@]}"; do
    if [[ -x "${candidate}" ]]; then
      NODE_BIN="${candidate}"
      break
    fi
  done
fi

if [[ ! -x "${NODE_BIN}" ]]; then
  echo "Node binary not found or not executable: ${NODE_BIN}"
  exit 1
fi

TEMP_DIR="$(mktemp -d)"
cleanup() {
  rm -rf "${TEMP_DIR}" "${DIST_DIR}"
  if [[ "${NODE_MODULES_LINK_CREATED}" -eq 1 && -L "${WORKSPACE_DIR}/node_modules" ]]; then
    rm -f "${WORKSPACE_DIR}/node_modules"
  fi
}
trap cleanup EXIT

if [[ -n "${NODE_MODULES_ROOT}" && "${NODE_MODULES_ROOT}" != /* ]]; then
  NODE_MODULES_ROOT="${PWD}/${NODE_MODULES_ROOT}"
fi

NODE_MODULES_CANDIDATES=()
if [[ -n "${NODE_MODULES_ROOT}" ]]; then
  NODE_MODULES_CANDIDATES+=("${NODE_MODULES_ROOT}")
fi
NODE_MODULES_CANDIDATES+=(
  "${WORKSPACE_DIR}/node_modules"
  "${PWD}/node_modules"
)
if [[ -z "${NODE_MODULES_DIR}" ]]; then
  FOUND_BIN_NODE_MODULES=$(find "${PWD}/bazel-out" -maxdepth 5 -type d -name node_modules -path '*/bin/node_modules' ! -path '*aspect*' -print -quit || true)
  if [[ -n "${FOUND_BIN_NODE_MODULES}" ]]; then
    NODE_MODULES_DIR="${FOUND_BIN_NODE_MODULES}"
  fi
fi

for candidate in "${NODE_MODULES_CANDIDATES[@]}"; do
  if [[ -f "${candidate}/electron-vite/bin/electron-vite.js" ]]; then
    NODE_MODULES_DIR="${candidate}"
    break
  fi
done
echo "Resolved node_modules directory: ${NODE_MODULES_DIR:-<none>}"


if [[ -z "${NODE_MODULES_DIR}" ]]; then
  FOUND_CLI=$(find "${PWD}" -maxdepth 12 -path '*/electron-vite/bin/electron-vite.js' -print -quit || true)
  if [[ -n "${FOUND_CLI}" ]]; then
    NODE_MODULES_DIR="$(cd "$(dirname "${FOUND_CLI}")/../.." && pwd)"
  else
    echo "electron-vite CLI not found in expected locations."
    printf 'Checked:\n'
    for candidate in "${NODE_MODULES_CANDIDATES[@]}"; do
      printf '  %s\n' "${candidate}"
    done
    exit 1
  fi
fi

ELECTRON_VITE_CLI="${NODE_MODULES_DIR}/electron-vite/bin/electron-vite.js"
if [[ ! -f "${ELECTRON_VITE_CLI}" ]]; then
  echo "electron-vite CLI not found at ${ELECTRON_VITE_CLI}"
  exit 1
fi

if [[ ! -d "${WORKSPACE_DIR}/node_modules" ]]; then
  ln -s "${NODE_MODULES_DIR}" "${WORKSPACE_DIR}/node_modules"
  NODE_MODULES_LINK_CREATED=1
fi

echo "Building Electron app '${APP_NAME}'"
echo "Workspace: ${WORKSPACE_DIR}"
echo "Using electron-vite CLI at: ${ELECTRON_VITE_CLI}"

echo "Running electron-vite build..."
export NODE_PATH="${NODE_MODULES_DIR}:${NODE_PATH:-}"
(
  cd "${WORKSPACE_DIR}"
  PATH="${NODE_MODULES_DIR}/.bin:${PATH}"
  "${NODE_BIN}" "${ELECTRON_VITE_CLI}" build --mode production --outDir "${DIST_DIR}"
)

if [[ ! -d "${DIST_DIR}/main" ]]; then
  echo "electron-vite output missing main bundle in ${DIST_DIR}"
  exit 1
fi

if [[ ! -d "${DIST_DIR}/preload" ]]; then
  echo "electron-vite output missing preload bundle in ${DIST_DIR}"
  exit 1
fi

if [[ ! -d "${DIST_DIR}/renderer" ]]; then
  echo "electron-vite output missing renderer bundle in ${DIST_DIR}"
  exit 1
fi

echo "Unpacking Electron binary..."
unzip -q "${ELECTRON_ZIP}" -d "${TEMP_DIR}"

ORIGINAL_APP="${TEMP_DIR}/Electron.app"
APP_PATH="${TEMP_DIR}/${APP_NAME}.app"

if [[ ! -d "${ORIGINAL_APP}" ]]; then
  echo "Extracted archive missing Electron.app"
  exit 1
fi

mv "${ORIGINAL_APP}" "${APP_PATH}"

APP_RESOURCES="${APP_PATH}/Contents/Resources"
APP_DIR="${APP_RESOURCES}/app"

mkdir -p "${APP_DIR}"

echo "Copying electron-vite bundles..."
cp -R "${DIST_DIR}/main" "${APP_DIR}/main"
cp -R "${DIST_DIR}/preload" "${APP_DIR}/preload"
cp -R "${DIST_DIR}/renderer" "${APP_DIR}/renderer"

if [[ -d "${WORKSPACE_DIR}/electron/assets" ]]; then
  cp -R "${WORKSPACE_DIR}/electron/assets" "${APP_DIR}/assets"
fi

cat > "${APP_DIR}/package.json" <<'EOF'
{
  "name": "gazel-electron",
  "version": "1.0.0",
  "main": "main/index.js",
  "type": "commonjs"
}
EOF

EXECUTABLE_PATH="${APP_PATH}/Contents/MacOS"
if [[ -f "${EXECUTABLE_PATH}/Electron" ]]; then
  mv "${EXECUTABLE_PATH}/Electron" "${EXECUTABLE_PATH}/${APP_NAME}"
fi

PLIST_FILE="${APP_PATH}/Contents/Info.plist"
if [[ -f "${PLIST_FILE}" ]]; then
  /usr/libexec/PlistBuddy -c "Set :CFBundleDisplayName ${APP_NAME}" "${PLIST_FILE}" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Set :CFBundleName ${APP_NAME}" "${PLIST_FILE}" 2>/dev/null || true
  /usr/libexec/PlistBuddy -c "Set :CFBundleExecutable ${APP_NAME}" "${PLIST_FILE}" 2>/dev/null || true
fi

echo "Creating archive ${OUTPUT_TAR}..."
tar -czf "${OUTPUT_TAR}" -C "${TEMP_DIR}" "${APP_NAME}.app"

echo "Packaged Electron app written to ${OUTPUT_TAR}"


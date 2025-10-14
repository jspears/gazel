#!/usr/bin/env bash
set -euo pipefail

# This script runs iBazel to watch and rebuild Bazel targets,
# then runs Electron Forge in development mode

echo "Starting Gazel development with Bazel..."

# Change to workspace root
cd "$(dirname "$0")/.."

# Start iBazel in the background to watch and rebuild
echo "Starting iBazel to watch Bazel targets..."
ibazel build //client:client_src //proto:index //server:server_ts //electron:forge_config //electron:vite_main_config //electron:vite_preload_config //electron:vite_renderer_config &
IBAZEL_PID=$!

# Wait a bit for initial build
sleep 3

# Trap to kill iBazel when this script exits
trap "kill $IBAZEL_PID 2>/dev/null || true" EXIT

# Run Electron Forge
echo "Starting Electron Forge..."
exec node_modules/.bin/electron-forge start


#!/usr/bin/env bash
set -euo pipefail

# Run Electron Forge in development mode
echo "Starting Gazel Electron app with Electron Forge..."
exec node_modules/.bin/electron-forge start

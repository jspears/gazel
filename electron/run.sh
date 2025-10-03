#!/bin/bash
set -e

# Find the built app archive
APP_TAR="$(dirname "$0")/gazel.app.tar.gz"

if [ ! -f "$APP_TAR" ]; then
    echo "Error: App archive not found at $APP_TAR"
    echo "Please run 'bazel build //electron:build_app' first"
    exit 1
fi

# Extract and run the Electron app
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "Extracting Gazel app..."
tar -xzf "$APP_TAR" -C "$TEMP_DIR"
APP_PATH="$TEMP_DIR/Gazel.app"

echo "Launching Gazel..."
open -W -n "$APP_PATH"

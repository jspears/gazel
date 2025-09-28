#!/bin/bash
set -e

# Create a temporary directory for extraction
export TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Extract the app bundle
echo "Extracting {{app_name}} to $TMPDIR"
tar -xf {{app_tar}} -C "$TMPDIR"

# Run the app directly to see console output
echo "Starting {{app_name}}..."
"$TMPDIR/{{app_name}}.app/Contents/MacOS/Electron" 2>&1

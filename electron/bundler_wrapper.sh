#!/bin/bash
# Wrapper script to run the Node.js bundler with proper environment
export BAZEL_BINDIR="."
# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec node "$SCRIPT_DIR/bundler.js" "$@"

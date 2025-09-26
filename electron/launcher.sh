#!/bin/bash

# Gazel Electron App Launcher
# This script launches the Gazel Electron app using Bazel

set -e

echo "Starting Gazel Electron App..."

# Check if we're in development or production mode
MODE=${1:-dev}

if [ "$MODE" = "dev" ]; then
    echo "Running in development mode..."
    bazel run //electron:dev
elif [ "$MODE" = "prod" ]; then
    echo "Running in production mode..."
    bazel run //electron:run
elif [ "$MODE" = "package" ]; then
    echo "Building distributable packages..."
    bazel run //electron:package
else
    echo "Usage: $0 [dev|prod|package]"
    echo "  dev     - Run in development mode"
    echo "  prod    - Run in production mode"
    echo "  package - Build distributable packages"
    exit 1
fi

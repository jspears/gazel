#!/bin/bash
# Electron App Runner Script
# Based on the template from grahamjenson/bazel-electron

set -e

# Create a temporary directory for extraction
export TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

# Extract the app bundle
echo "Extracting {{app_name}} application..."
tar -xf {{app_tar}} -C "$TMPDIR"

# Platform detection and execution
PLATFORM=$(uname -s)

case "$PLATFORM" in
  Darwin)
    # macOS
    echo "Running {{app_name}} on macOS..."
    if [ -f "$TMPDIR/{{app_name}}.app/Contents/MacOS/Electron" ]; then
      # If we have bundled Electron binary
      open -W "$TMPDIR/{{app_name}}.app"
    else
      # Use system Electron
      if command -v electron &> /dev/null; then
        electron "$TMPDIR/{{app_name}}.app/Contents/Resources/app"
      elif [ -f "node_modules/.bin/electron" ]; then
        node_modules/.bin/electron "$TMPDIR/{{app_name}}.app/Contents/Resources/app"
      else
        echo "Error: Electron not found. Please install Electron globally or locally."
        exit 1
      fi
    fi
    ;;
    
  Linux)
    # Linux
    echo "Running {{app_name}} on Linux..."
    if [ -f "$TMPDIR/{{app_name}}.app/electron" ]; then
      # If we have bundled Electron binary
      "$TMPDIR/{{app_name}}.app/electron" "$TMPDIR/{{app_name}}.app/resources/app"
    else
      # Use system Electron
      if command -v electron &> /dev/null; then
        electron "$TMPDIR/{{app_name}}.app/Contents/Resources/app"
      elif [ -f "node_modules/.bin/electron" ]; then
        node_modules/.bin/electron "$TMPDIR/{{app_name}}.app/Contents/Resources/app"
      else
        echo "Error: Electron not found. Please install Electron globally or locally."
        exit 1
      fi
    fi
    ;;
    
  MINGW*|CYGWIN*|MSYS*)
    # Windows (Git Bash, Cygwin, MSYS)
    echo "Running {{app_name}} on Windows..."
    if [ -f "$TMPDIR/{{app_name}}.app/electron.exe" ]; then
      # If we have bundled Electron binary
      "$TMPDIR/{{app_name}}.app/electron.exe" "$TMPDIR/{{app_name}}.app/resources/app"
    else
      # Use system Electron
      if command -v electron &> /dev/null; then
        electron "$TMPDIR/{{app_name}}.app/Contents/Resources/app"
      elif [ -f "node_modules/.bin/electron.cmd" ]; then
        node_modules/.bin/electron.cmd "$TMPDIR/{{app_name}}.app/Contents/Resources/app"
      else
        echo "Error: Electron not found. Please install Electron globally or locally."
        exit 1
      fi
    fi
    ;;
    
  *)
    echo "Unsupported platform: $PLATFORM"
    exit 1
    ;;
esac

#!/bin/bash

# Test script for Electron integration

set -e

echo "Testing Gazel Electron App Build..."
echo "===================================="

# Check if Electron is installed
if ! npm list electron &>/dev/null; then
    echo "❌ Electron not installed. Installing..."
    pnpm add -D electron
else
    echo "✅ Electron is installed"
fi

# Check if electron-builder is installed
if ! npm list electron-builder &>/dev/null; then
    echo "❌ electron-builder not installed. Installing..."
    pnpm add -D electron-builder
else
    echo "✅ electron-builder is installed"
fi

# Build TypeScript files
echo ""
echo "Building TypeScript files..."
if npx tsc electron/main.ts electron/preload.ts --outDir electron --module esnext --target es2022 --moduleResolution bundler --esModuleInterop true; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    exit 1
fi

# Test Bazel build
echo ""
echo "Testing Bazel build..."
if bazel build //electron:electron_ts; then
    echo "✅ Bazel TypeScript build successful"
else
    echo "❌ Bazel TypeScript build failed"
    exit 1
fi

# Test the custom electron_app rule
echo ""
echo "Testing custom electron_app rule..."
if bazel build //electron:gazel_app; then
    echo "✅ Custom electron_app rule build successful"
else
    echo "❌ Custom electron_app rule build failed"
    exit 1
fi

echo ""
echo "===================================="
echo "All tests passed! ✅"
echo ""
echo "To run the Electron app:"
echo "  Development:  ./electron/launcher.sh dev"
echo "  Production:   ./electron/launcher.sh prod"
echo "  Package:      ./electron/launcher.sh package"
echo ""
echo "Or using Bazel directly:"
echo "  bazel run //electron:dev"
echo "  bazel run //electron:run"
echo "  bazel run //electron:package"

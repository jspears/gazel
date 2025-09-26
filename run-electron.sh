#!/bin/bash

# Simple script to run the Gazel Electron app

set -e

echo "🚀 Starting Gazel Electron App..."
echo ""

# Check if Electron is installed
if ! command -v electron &> /dev/null && ! [ -f "node_modules/.bin/electron" ]; then
    echo "📦 Installing Electron..."
    pnpm add -D electron electron-builder
fi

# Compile TypeScript files
echo "🔨 Compiling Electron TypeScript files..."
npx tsc electron/main.ts electron/preload.ts \
    --outDir electron \
    --module commonjs \
    --target es2022 \
    --moduleResolution node \
    --esModuleInterop true \
    --skipLibCheck true \
    --allowJs true

# Rename .js files to .cjs to work with "type": "module"
mv electron/main.js electron/main.cjs 2>/dev/null || true
mv electron/preload.js electron/preload.cjs 2>/dev/null || true

# Start Vite dev server in background
echo "🌐 Starting Vite dev server..."
npx vite &
VITE_PID=$!

# Wait a bit for Vite to start
sleep 3

# Start the Electron app
echo "🖥️  Launching Electron app..."
NODE_ENV=development npx electron electron/main.cjs

# Clean up - kill Vite when Electron exits
kill $VITE_PID 2>/dev/null || true

#!/bin/bash

echo "🚀 Setting up Gazel - Bazel Explorer"
echo "===================================="
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js >= 18.0.0"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version is too old. Please install Node.js >= 18.0.0"
    echo "   Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Check for npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed"
    exit 1
fi

echo "✅ npm $(npm -v) detected"

# Check for Bazel
if ! command -v bazel &> /dev/null; then
    echo "⚠️  Warning: Bazel is not in PATH. Make sure it's installed and accessible."
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Available commands:"
echo "  npm run dev       - Start development servers (frontend + backend)"
echo "  npm run build     - Build for production"
echo "  npm start         - Start production server"
echo "  npm run typecheck - Run TypeScript type checking"
echo ""
echo "The application will run on:"
echo "  Development: http://localhost:5173 (frontend) + http://localhost:3001 (backend)"
echo "  Production:  http://localhost:3001"
echo ""
echo "Bazel workspace configured at: /Users/justinspears/augment/augment"

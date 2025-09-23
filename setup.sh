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

# Configure Bazel workspace
echo ""
echo "🔧 Configuring Bazel workspace..."
echo ""

# Check if .env file exists and has BAZEL_WORKSPACE set
if [ -f .env ] && grep -q "BAZEL_WORKSPACE=" .env; then
    EXISTING_WORKSPACE=$(grep "BAZEL_WORKSPACE=" .env | cut -d'=' -f2)
    echo "Found existing workspace configuration: $EXISTING_WORKSPACE"
    echo -n "Do you want to keep this configuration? (Y/n): "
    read -r KEEP_CONFIG

    if [[ "$KEEP_CONFIG" =~ ^[Nn]$ ]]; then
        CONFIGURE_WORKSPACE=true
    else
        CONFIGURE_WORKSPACE=false
        echo "✅ Keeping existing workspace configuration"
    fi
else
    CONFIGURE_WORKSPACE=true
fi

if [ "$CONFIGURE_WORKSPACE" = true ]; then
    # Try to find Bazel workspace automatically
    CURRENT_DIR=$(pwd)
    PARENT_DIR=$(dirname "$CURRENT_DIR")
    GRANDPARENT_DIR=$(dirname "$PARENT_DIR")

    # Look for MODULE.bazel file
    if [ -f "$CURRENT_DIR/MODULE.bazel" ]; then
        DEFAULT_WORKSPACE="$CURRENT_DIR"
    elif [ -f "$PARENT_DIR/MODULE.bazel" ]; then
        DEFAULT_WORKSPACE="$PARENT_DIR"
    elif [ -f "$GRANDPARENT_DIR/MODULE.bazel" ]; then
        DEFAULT_WORKSPACE="$GRANDPARENT_DIR"
    else
        DEFAULT_WORKSPACE=""
    fi

    if [ -n "$DEFAULT_WORKSPACE" ]; then
        echo "Found Bazel workspace at: $DEFAULT_WORKSPACE"
        echo -n "Use this workspace? (Y/n): "
        read -r USE_DEFAULT

        if [[ ! "$USE_DEFAULT" =~ ^[Nn]$ ]]; then
            BAZEL_WORKSPACE="$DEFAULT_WORKSPACE"
        else
            echo -n "Enter the path to your Bazel workspace: "
            read -r BAZEL_WORKSPACE
        fi
    else
        echo "No Bazel workspace found in current or parent directories."
        echo -n "Enter the path to your Bazel workspace: "
        read -r BAZEL_WORKSPACE
    fi

    # Expand tilde and relative paths
    BAZEL_WORKSPACE=$(eval echo "$BAZEL_WORKSPACE")

    # Convert relative path to absolute path
    if [[ ! "$BAZEL_WORKSPACE" = /* ]]; then
        BAZEL_WORKSPACE="$(cd "$BAZEL_WORKSPACE" 2>/dev/null && pwd)" || {
            echo "❌ Invalid path: $BAZEL_WORKSPACE"
            exit 1
        }
    fi

    # Verify the workspace exists and contains MODULE.bazel file
    if [ ! -d "$BAZEL_WORKSPACE" ]; then
        echo "❌ Directory does not exist: $BAZEL_WORKSPACE"
        exit 1
    fi

    if [ ! -f "$BAZEL_WORKSPACE/MODULE.bazel" ]; then
        echo "⚠️  Warning: No MODULE.bazel file found in $BAZEL_WORKSPACE"
        echo -n "Continue anyway? (y/N): "
        read -r CONTINUE_ANYWAY

        if [[ ! "$CONTINUE_ANYWAY" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    # Write to .env file
    echo "BAZEL_WORKSPACE=$BAZEL_WORKSPACE" > .env
    echo "✅ Workspace configuration saved to .env"
    echo "   BAZEL_WORKSPACE=$BAZEL_WORKSPACE"
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

# Display workspace configuration
if [ -f .env ] && grep -q "BAZEL_WORKSPACE=" .env; then
    WORKSPACE_PATH=$(grep "BAZEL_WORKSPACE=" .env | cut -d'=' -f2)
    echo "📁 Bazel workspace: $WORKSPACE_PATH"
    echo ""
fi

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
echo "To change the Bazel workspace, edit the .env file or run this setup script again."
echo ""


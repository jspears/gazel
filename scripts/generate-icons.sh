#!/bin/bash
set -e

# Script to generate all required icon files for Electron app
# This creates .icns (macOS), .ico (Windows), and .png (Linux) from a source image

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SOURCE_ICON="$PROJECT_ROOT/electron/images/icon.png"
ASSETS_DIR="$PROJECT_ROOT/assets"
TEMP_ICONSET="$ASSETS_DIR/icon.iconset"

echo "🎨 Generating Electron app icons..."
echo ""

# Check if source icon exists
if [ ! -f "$SOURCE_ICON" ]; then
    echo "❌ Error: Source icon not found at $SOURCE_ICON"
    exit 1
fi

# Create assets directory if it doesn't exist
mkdir -p "$ASSETS_DIR"

# Copy source icon to assets
echo "📋 Copying source icon to assets/icon.png..."
cp "$SOURCE_ICON" "$ASSETS_DIR/icon.png"
echo "✅ Created: assets/icon.png"
echo ""

# Generate macOS .icns file
echo "🍎 Generating macOS .icns file..."

# Create iconset directory
mkdir -p "$TEMP_ICONSET"

# Generate all required sizes for macOS
echo "  Generating icon sizes..."
sips -z 16 16     "$SOURCE_ICON" --out "$TEMP_ICONSET/icon_16x16.png" > /dev/null 2>&1
sips -z 32 32     "$SOURCE_ICON" --out "$TEMP_ICONSET/icon_16x16@2x.png" > /dev/null 2>&1
sips -z 32 32     "$SOURCE_ICON" --out "$TEMP_ICONSET/icon_32x32.png" > /dev/null 2>&1
sips -z 64 64     "$SOURCE_ICON" --out "$TEMP_ICONSET/icon_32x32@2x.png" > /dev/null 2>&1
sips -z 128 128   "$SOURCE_ICON" --out "$TEMP_ICONSET/icon_128x128.png" > /dev/null 2>&1
sips -z 256 256   "$SOURCE_ICON" --out "$TEMP_ICONSET/icon_128x128@2x.png" > /dev/null 2>&1
sips -z 256 256   "$SOURCE_ICON" --out "$TEMP_ICONSET/icon_256x256.png" > /dev/null 2>&1
sips -z 512 512   "$SOURCE_ICON" --out "$TEMP_ICONSET/icon_256x256@2x.png" > /dev/null 2>&1
sips -z 512 512   "$SOURCE_ICON" --out "$TEMP_ICONSET/icon_512x512.png" > /dev/null 2>&1
sips -z 1024 1024 "$SOURCE_ICON" --out "$TEMP_ICONSET/icon_512x512@2x.png" > /dev/null 2>&1

echo "  Converting to .icns..."
iconutil -c icns "$TEMP_ICONSET" -o "$ASSETS_DIR/icon.icns"

# Clean up iconset directory
rm -rf "$TEMP_ICONSET"

echo "✅ Created: assets/icon.icns"
echo ""

# Generate Windows .ico file (if ImageMagick is available)
if command -v convert &> /dev/null; then
    echo "🪟 Generating Windows .ico file..."
    convert "$SOURCE_ICON" -define icon:auto-resize=256,128,64,48,32,16 "$ASSETS_DIR/icon.ico"
    echo "✅ Created: assets/icon.ico"
    echo ""
else
    echo "⚠️  ImageMagick not found - skipping .ico generation"
    echo "   To generate Windows icons, install ImageMagick:"
    echo "   brew install imagemagick"
    echo ""
fi

# Summary
echo "✨ Icon generation complete!"
echo ""
echo "Generated files:"
echo "  📄 assets/icon.png  - Linux/source icon (1024x1024)"
echo "  🍎 assets/icon.icns - macOS icon bundle"
if [ -f "$ASSETS_DIR/icon.ico" ]; then
    echo "  🪟 assets/icon.ico  - Windows icon"
fi
echo ""
echo "These icons will be used by Electron Forge when packaging the app."


#!/bin/bash
set -e

OUTPUT_TAR="$1"
APP_NAME="$2"
MAIN_JS="$3"
INDEX_HTML="$4"
ELECTRON_BINARY="$5"
shift 5

echo "Building Electron app: $APP_NAME"
echo "Output: $OUTPUT_TAR"
echo "Main JS: $MAIN_JS"
echo "Index HTML: $INDEX_HTML"
echo "Electron Binary: $ELECTRON_BINARY"

# Create temporary directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Extract Electron binary
echo "Extracting Electron binary..."
unzip -q "$ELECTRON_BINARY" -d "$TEMP_DIR"

# Create app directory structure
APP_DIR="$TEMP_DIR/Electron.app/Contents/Resources/app"
mkdir -p "$APP_DIR"

# Copy main process files
echo "Copying main process files..."
if [ -d "$MAIN_JS" ]; then
    cp -r "$MAIN_JS"/* "$APP_DIR/" 2>/dev/null || true
else
    cp "$MAIN_JS" "$APP_DIR/main.js"
fi

# Copy renderer files
echo "Copying renderer files..."
if [ -d "$INDEX_HTML" ]; then
    mkdir -p "$APP_DIR/renderer"
    cp -r "$INDEX_HTML"/* "$APP_DIR/renderer/"
else
    cp "$INDEX_HTML" "$APP_DIR/index.html"
fi

# Copy additional assets
echo "Copying additional assets..."
for asset in "$@"; do
    if [ -f "$asset" ]; then
        echo "  - Copying file: $asset"
        cp "$asset" "$APP_DIR/"
    elif [ -d "$asset" ]; then
        echo "  - Copying directory: $asset"
        cp -r "$asset"/* "$APP_DIR/"
    fi
done

# Create package.json if it doesn't exist
if [ ! -f "$APP_DIR/package.json" ]; then
    echo "Creating package.json..."
    cat > "$APP_DIR/package.json" << EOF
{
  "name": "${APP_NAME,,}",
  "version": "1.0.0",
  "main": "main.js",
  "type": "module"
}
EOF
fi

# Rename the app
echo "Renaming app to $APP_NAME..."
mv "$TEMP_DIR/Electron.app" "$TEMP_DIR/$APP_NAME.app"

# Update Info.plist with app name
PLIST_FILE="$TEMP_DIR/$APP_NAME.app/Contents/Info.plist"
if [ -f "$PLIST_FILE" ]; then
    echo "Updating Info.plist..."
    sed -i '' "s/>Electron</>$APP_NAME</g" "$PLIST_FILE"
    sed -i '' "s/>com.github.Electron</>com.gazel.$APP_NAME</g" "$PLIST_FILE"
fi

# Create tar archive
echo "Creating archive..."
tar -czf "$OUTPUT_TAR" -C "$TEMP_DIR" "$APP_NAME.app"

echo "Done! Created $OUTPUT_TAR"

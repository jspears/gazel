# Gazel Application Icons

This directory contains the application icons for the Gazel Electron app.

## Icon Files

✅ All icon files have been generated and are ready to use:

- **icon.png** (1.9 MB) - Linux icon and source image (1024x1024 pixels)
- **icon.icns** (2.7 MB) - macOS icon bundle with all required sizes
- **icon.ico** (162 KB) - Windows icon with multiple sizes

## Regenerating Icons

If you need to update the icons (e.g., after changing the source image), use the automated script:

```bash
# From the project root
./scripts/generate-icons.sh
```

This script will:
1. Copy the source icon from `electron/images/icon.png`
2. Generate all required sizes for macOS (16x16 to 1024x1024, including @2x variants)
3. Create the `.icns` bundle using macOS's built-in `iconutil`
4. Create the `.ico` file for Windows (if ImageMagick is installed)

## Manual Icon Creation

If you prefer to create icons manually, here are the commands:

### macOS (.icns)
```bash
# Using iconutil (built-in on macOS)
mkdir icon.iconset
sips -z 16 16     icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32     icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32     icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64     icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128   icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256   icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256   icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512   icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512   icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
rm -rf icon.iconset
```

### Windows (.ico)
```bash
# Using ImageMagick (install with: brew install imagemagick)
magick icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

### Linux (.png)
Use a 512x512 or 1024x1024 PNG image directly.

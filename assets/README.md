# Gazel Application Icons

This directory contains the application icons for the Gazel Electron app.

## Required Icon Files

- **icon.png** - Linux icon (512x512 pixels recommended)
- **icon.icns** - macOS icon (created from 1024x1024 source)
- **icon.ico** - Windows icon (created from multiple sizes: 16x16, 32x32, 48x48, 256x256)

## Creating Icons

You can use the following tools to create icons from a source PNG image:

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
```

### Windows (.ico)
```bash
# Using ImageMagick
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

### Linux (.png)
Use a 512x512 or 1024x1024 PNG image directly.

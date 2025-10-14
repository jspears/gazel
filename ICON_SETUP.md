# Gazel Icon Setup

## Overview

The Gazel Electron application now has proper icons configured for all platforms (macOS, Windows, and Linux).

## Icon Files

All icon files are located in the `assets/` directory:

| File | Platform | Size | Description |
|------|----------|------|-------------|
| `icon.png` | Linux | 1.9 MB | Source image (1024x1024 pixels) |
| `icon.icns` | macOS | 2.7 MB | Icon bundle with all required sizes |
| `icon.ico` | Windows | 162 KB | Multi-resolution icon |

## How Icons Are Used

### Development Mode

When running the app in development mode (`yarn start`), the icon is loaded from:
```typescript
// electron/main.ts
const iconPath = path.join(__dirname, '../../assets/icon.png');
```

### Production/Packaged Mode

When packaging the app (`yarn package` or `yarn make`), Electron Forge uses the icons configured in `electron/forge.config.ts`:

```typescript
packagerConfig: {
  icon: './assets/icon',  // Electron Forge adds the correct extension
  // ...
}
```

Electron Forge automatically selects the correct icon file based on the platform:
- **macOS**: Uses `assets/icon.icns`
- **Windows**: Uses `assets/icon.ico`
- **Linux**: Uses `assets/icon.png`

## Icon Specifications

### macOS (.icns)

The `.icns` file contains multiple resolutions for different contexts:

| Size | Filename | Usage |
|------|----------|-------|
| 16x16 | icon_16x16.png | Menu bar, small icons |
| 32x32 | icon_16x16@2x.png | Retina menu bar |
| 32x32 | icon_32x32.png | Dock (small) |
| 64x64 | icon_32x32@2x.png | Retina dock (small) |
| 128x128 | icon_128x128.png | Dock (normal) |
| 256x256 | icon_128x128@2x.png | Retina dock (normal) |
| 256x256 | icon_256x256.png | Dock (large) |
| 512x512 | icon_256x256@2x.png | Retina dock (large) |
| 512x512 | icon_512x512.png | Finder, Quick Look |
| 1024x1024 | icon_512x512@2x.png | Retina Finder, Quick Look |

### Windows (.ico)

The `.ico` file contains multiple resolutions:
- 256x256 (PNG compressed)
- 128x128
- 64x64
- 48x48
- 32x32
- 16x16

### Linux (.png)

A single 1024x1024 PNG image is used for Linux platforms.

## Regenerating Icons

If you need to update the app icon (e.g., after changing the design), follow these steps:

### 1. Update the Source Image

Replace the source icon at `electron/images/icon.png` with your new design.

**Requirements:**
- Format: PNG with transparency (RGBA)
- Size: 1024x1024 pixels (minimum)
- Recommended: Square design with padding for rounded corners

### 2. Run the Generation Script

```bash
# Using npm/yarn script
yarn generate-icons

# Or run the script directly
./scripts/generate-icons.sh
```

This will automatically:
1. Copy the source icon to `assets/icon.png`
2. Generate all required sizes for macOS
3. Create the `.icns` bundle
4. Create the `.ico` file for Windows (if ImageMagick is installed)

### 3. Test the Icons

**Development Mode:**
```bash
yarn start
```
Check that the icon appears correctly in the dock/taskbar.

**Packaged App:**
```bash
yarn package
open out/Gazel-darwin-arm64/Gazel.app
```
Check that the icon appears correctly in Finder and when the app is running.

## Icon Design Guidelines

### Best Practices

1. **Square Design**: Keep important elements within the center 80% of the canvas
2. **Transparency**: Use PNG with alpha channel for rounded corners
3. **Simplicity**: Icons should be recognizable at small sizes (16x16)
4. **Contrast**: Ensure good contrast for both light and dark backgrounds
5. **No Text**: Avoid small text that becomes unreadable at small sizes

### Platform-Specific Considerations

**macOS:**
- macOS applies rounded corners automatically
- Design should work well with rounded corners
- Test on both light and dark menu bars

**Windows:**
- Windows may add a drop shadow
- Ensure icon has good contrast with various backgrounds

**Linux:**
- Different desktop environments may apply different effects
- Keep design simple and clear

## Troubleshooting

### Icon Not Showing in Development

**Problem**: Icon doesn't appear when running `yarn start`

**Solution**: Check that `assets/icon.png` exists and is not empty:
```bash
file assets/icon.png
# Should output: PNG image data, 1024 x 1024...
```

If empty, regenerate icons:
```bash
yarn generate-icons
```

### Icon Not Showing in Packaged App

**Problem**: Icon doesn't appear in the packaged app

**Solution**: 
1. Ensure all icon files exist:
   ```bash
   ls -lh assets/icon.*
   ```

2. Check Electron Forge configuration in `electron/forge.config.ts`:
   ```typescript
   packagerConfig: {
     icon: './assets/icon',  // Should point to assets directory
   }
   ```

3. Rebuild the app:
   ```bash
   yarn package
   ```

### ImageMagick Not Found

**Problem**: Script shows "ImageMagick not found" warning

**Solution**: Install ImageMagick to generate Windows icons:
```bash
brew install imagemagick
```

Then regenerate icons:
```bash
yarn generate-icons
```

### Icon Appears Blurry

**Problem**: Icon looks blurry or pixelated

**Solution**: 
1. Ensure source image is at least 1024x1024 pixels
2. Use a high-quality PNG with no compression artifacts
3. Regenerate icons from the high-quality source

## Technical Details

### Icon Generation Process

The `scripts/generate-icons.sh` script uses:

1. **sips** (macOS built-in): Resizes images to required dimensions
2. **iconutil** (macOS built-in): Converts iconset to `.icns` bundle
3. **ImageMagick** (optional): Creates multi-resolution `.ico` file

### File Locations

```
gazel/
├── assets/                    # Generated icon files (used by Electron Forge)
│   ├── icon.png              # Linux icon (1024x1024)
│   ├── icon.icns             # macOS icon bundle
│   └── icon.ico              # Windows icon
├── electron/
│   ├── images/               # Source images
│   │   ├── icon.png          # Source icon (1024x1024)
│   │   ├── Assets.xcassets/  # iOS/mobile icons
│   │   └── android/          # Android icons
│   └── main.ts               # References icon for window
└── scripts/
    └── generate-icons.sh     # Icon generation script
```

### Electron Forge Configuration

The icon configuration in `electron/forge.config.ts`:

```typescript
const config: ForgeConfig = {
  packagerConfig: {
    name: 'Gazel',
    executableName: 'gazel',
    icon: './assets/icon',  // Electron Forge adds .icns/.ico/.png automatically
    asar: true,
    // ...
  },
  makers: [
    new MakerSquirrel({
      setupIcon: './assets/icon.ico',  // Windows installer icon
    }),
    new MakerRpm({
      options: {
        icon: './assets/icon.png',  // Linux RPM icon
      },
    }),
    new MakerDeb({
      options: {
        icon: './assets/icon.png',  // Linux DEB icon
      },
    }),
  ],
};
```

## References

- [Electron Application Icons](https://www.electronjs.org/docs/latest/tutorial/application-distribution#application-icons)
- [macOS Icon Guidelines](https://developer.apple.com/design/human-interface-guidelines/app-icons)
- [Electron Forge Packaging](https://www.electronforge.io/config/makers)
- [iconutil Documentation](https://developer.apple.com/library/archive/documentation/GraphicsAnimation/Conceptual/HighResolutionOSX/Optimizing/Optimizing.html)

## Summary

✅ **Icons are configured and ready to use**
- All required icon files have been generated
- Icons work in both development and production modes
- Easy regeneration with `yarn generate-icons`
- Platform-specific icons for macOS, Windows, and Linux

The icon setup is complete and follows Electron best practices!


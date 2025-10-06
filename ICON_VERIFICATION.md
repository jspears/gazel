# Icon Verification Checklist

Use this checklist to verify that the Gazel app icons are working correctly across all platforms and modes.

## ✅ Pre-Verification

Before testing, ensure all icon files exist:

```bash
# Check that all icon files are present and not empty
ls -lh assets/icon.*

# Expected output:
# -rw-r--r--  1 user  staff   2.7M  icon.icns
# -rw-r--r--  1 user  staff   162K  icon.ico
# -rw-r--r--  1 user  staff   1.9M  icon.png
```

All files should have non-zero sizes. If any file is missing or empty, regenerate:

```bash
pnpm generate-icons
```

## Development Mode Testing

### Test 1: Icon in Development

```bash
pnpm start
```

**What to Check:**
- [ ] App icon appears in the macOS Dock
- [ ] Icon is clear and not pixelated
- [ ] Icon matches the design in `electron/images/icon.png`

**Expected Result:** The Gazel icon should appear in the Dock while the app is running.

**Troubleshooting:**
- If no icon appears, check that `assets/icon.png` exists and is not empty
- Check the console for any errors related to icon loading
- Verify the path in `electron/main.ts` line 209: `path.join(__dirname, '../../assets/icon.png')`

## Production/Packaged Mode Testing

### Test 2: Package the App

```bash
pnpm package
```

**What to Check:**
- [ ] Packaging completes without errors
- [ ] Output directory created: `out/Gazel-darwin-arm64/`
- [ ] App bundle created: `out/Gazel-darwin-arm64/Gazel.app`

### Test 3: Icon in Finder

```bash
open out/Gazel-darwin-arm64/
```

**What to Check:**
- [ ] Gazel.app shows the correct icon in Finder (list view)
- [ ] Icon appears correctly in Finder (icon view)
- [ ] Icon appears correctly in Finder (cover flow view)
- [ ] Icon is sharp and clear at all sizes

**Expected Result:** The app bundle should display the Gazel icon in Finder.

### Test 4: Icon When Running Packaged App

```bash
open out/Gazel-darwin-arm64/Gazel.app
```

**What to Check:**
- [ ] App launches successfully
- [ ] Icon appears in the Dock
- [ ] Icon appears in the menu bar (if applicable)
- [ ] Icon appears in the app switcher (Cmd+Tab)
- [ ] Icon is clear and not pixelated

**Expected Result:** The icon should appear correctly in all macOS UI elements.

### Test 5: Icon in Get Info

```bash
# Right-click Gazel.app in Finder and select "Get Info"
# Or use this command:
open -a "Finder" out/Gazel-darwin-arm64/Gazel.app
# Then press Cmd+I
```

**What to Check:**
- [ ] Large icon appears at the top of the Get Info window
- [ ] Icon is high-resolution (not blurry on Retina displays)
- [ ] Icon matches the design

### Test 6: Icon at Different Sizes

**What to Check:**
- [ ] 16x16: Menu bar, small icons (should be recognizable)
- [ ] 32x32: Dock (small size)
- [ ] 128x128: Dock (normal size)
- [ ] 256x256: Dock (large size)
- [ ] 512x512: Finder, Quick Look
- [ ] 1024x1024: Retina displays

**How to Test:**
1. Change Dock icon size: System Preferences → Dock → Size slider
2. View app in Finder at different icon sizes: View → as Icons, adjust icon size slider
3. Use Quick Look: Select app in Finder, press Space

## Code Signing Testing (Optional)

If you have code signing configured:

### Test 7: Signed App Icon

```bash
# Sign and package
source .env
pnpm package

# Verify signature
codesign --verify --deep --strict --verbose=2 out/Gazel-darwin-arm64/Gazel.app
```

**What to Check:**
- [ ] App is properly signed
- [ ] Icon still appears correctly after signing
- [ ] No security warnings when opening the app

## Platform-Specific Testing

### macOS (Primary Platform)

**Tested:** ✅ / ❌

**Notes:**
- macOS version: _____________
- Display: Retina / Non-Retina
- Issues found: _____________

### Windows (If Applicable)

If you're building for Windows:

```bash
# Package for Windows (requires Windows or Wine)
pnpm package --platform=win32
```

**What to Check:**
- [ ] Icon appears in Windows Explorer
- [ ] Icon appears in taskbar
- [ ] Icon appears in Start menu
- [ ] `.ico` file is used correctly

### Linux (If Applicable)

If you're building for Linux:

```bash
# Package for Linux
pnpm package --platform=linux
```

**What to Check:**
- [ ] Icon appears in file manager
- [ ] Icon appears in application launcher
- [ ] Icon appears in taskbar/dock
- [ ] `.png` file is used correctly

## Common Issues and Solutions

### Issue: No Icon in Development Mode

**Symptoms:** Default Electron icon appears instead of Gazel icon

**Solution:**
1. Check that `assets/icon.png` exists and is not empty:
   ```bash
   file assets/icon.png
   ```
2. If empty or missing, regenerate:
   ```bash
   pnpm generate-icons
   ```
3. Restart the app:
   ```bash
   pnpm start
   ```

### Issue: No Icon in Packaged App

**Symptoms:** Default Electron icon appears in packaged app

**Solution:**
1. Check that `assets/icon.icns` exists:
   ```bash
   file assets/icon.icns
   # Should output: Mac OS X icon, ... bytes, "ic12" type
   ```
2. Verify Electron Forge configuration in `electron/forge.config.ts`:
   ```typescript
   packagerConfig: {
     icon: './assets/icon',  // Should be relative to project root
   }
   ```
3. Rebuild:
   ```bash
   pnpm package
   ```

### Issue: Blurry Icon

**Symptoms:** Icon appears pixelated or blurry

**Solution:**
1. Ensure source image is high quality (1024x1024 minimum)
2. Check source image:
   ```bash
   file electron/images/icon.png
   # Should be: PNG image data, 1024 x 1024...
   ```
3. Regenerate icons:
   ```bash
   pnpm generate-icons
   ```
4. Rebuild:
   ```bash
   pnpm package
   ```

### Issue: Wrong Icon Appears

**Symptoms:** Old or different icon appears

**Solution:**
1. Clear Finder icon cache:
   ```bash
   sudo rm -rf /Library/Caches/com.apple.iconservices.store
   killall Finder
   ```
2. Rebuild the app:
   ```bash
   rm -rf out/
   pnpm package
   ```
3. Open the new app bundle

## Verification Complete

Once all tests pass, the icon setup is complete and working correctly!

**Summary:**
- ✅ Icons generated for all platforms
- ✅ Development mode shows correct icon
- ✅ Packaged app shows correct icon
- ✅ Icon appears in Finder
- ✅ Icon appears in Dock
- ✅ Icon is sharp at all sizes
- ✅ Ready for distribution

## Next Steps

After verifying icons:

1. **Test the app functionality** to ensure everything works
2. **Set up code signing** (if not already done) - see `CODE_SIGNING_SETUP.md`
3. **Create installer** with `pnpm make`
4. **Distribute** the signed and notarized app

## References

- Icon Setup Documentation: `ICON_SETUP.md`
- Electron Fixes Summary: `ELECTRON_FIXES_SUMMARY.md`
- Code Signing Setup: `CODE_SIGNING_SETUP.md`


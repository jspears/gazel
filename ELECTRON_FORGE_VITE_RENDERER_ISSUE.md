# Electron Forge Vite Plugin - Renderer Not Packaged Issue

## Problem

The Electron Forge Vite plugin is **not copying the renderer build output** into the packaged application. This is a known issue with the plugin.

### Symptoms

1. Only "IpcTransport initialized" appears in the console (from preload script)
2. No renderer JavaScript executes
3. The asar archive (or app directory when `asar: false`) only contains:
   - `.vite/build/main.cjs`
   - `.vite/build/preload.cjs`
   - `package.json`
4. **Missing**: `.vite/renderer/` directory entirely

### Verification

```bash
# Check what's in the packaged app
ls -la out/Gazel-darwin-arm64/Gazel.app/Contents/Resources/app/.vite/

# Should show:
# build/      <- ✓ Present
# renderer/   <- ✗ MISSING!
```

## Root Cause

The Electron Forge Vite plugin has a known issue where it builds the renderer files correctly to `electron/.vite/renderer/main_window/` during the build process, but **fails to copy them** into the final packaged application.

This is documented in GitHub issue: https://github.com/electron/forge/issues/3423

## Current Status

### What's Working

1. ✅ Renderer files ARE being built correctly:
   ```bash
   ls -la electron/.vite/renderer/main_window/
   # Shows: index.html, assets/index-*.js, assets/index-*.css
   ```

2. ✅ Main process code is correct and uses the proper Electron Forge global variables:
   ```typescript
   if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
     mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
   } else {
     mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
   }
   ```

3. ✅ Forge configuration is correct:
   ```typescript
   renderer: [
     {
       name: 'main_window',
       config: path.resolve(electronDir, 'vite.renderer.config.ts'),
     },
   ],
   ```

### What's NOT Working

1. ✗ Renderer files are not being copied to the packaged app
2. ✗ The app shows a blank screen with only preload script output

## Attempted Solutions

### 1. Disabled ASAR Packaging

**File**: `electron/forge.config.ts`

Changed `asar: true` to `asar: false` to rule out asar-specific issues.

**Result**: Same problem - renderer files still not copied.

### 2. Updated Main Process Loading Logic

**File**: `electron/main.ts`

Updated to use the correct Electron Forge Vite plugin global variables:
- `MAIN_WINDOW_VITE_DEV_SERVER_URL` for development
- `MAIN_WINDOW_VITE_NAME` for production path

**Result**: Code is correct, but renderer files still missing from package.

## Possible Solutions

### Option 1: Manual Copy Hook (Recommended)

Add a packaging hook to manually copy the renderer files:

```typescript
// electron/forge.config.ts
import fs from 'fs-extra';

const config: ForgeConfig = {
  packagerConfig: {
    // ...
  },
  hooks: {
    packageAfterCopy: async (config, buildPath) => {
      const rendererSource = path.resolve(__dirname, '.vite/renderer');
      const rendererDest = path.join(buildPath, '.vite/renderer');
      
      if (fs.existsSync(rendererSource)) {
        await fs.copy(rendererSource, rendererDest);
        console.log('Copied renderer files to package');
      }
    },
  },
  // ...
};
```

### Option 2: Use Webpack Plugin Instead

The Webpack plugin doesn't have this issue. Consider switching from Vite to Webpack:

```bash
npm uninstall @electron-forge/plugin-vite
npm install --save-dev @electron-forge/plugin-webpack
```

### Option 3: Wait for Plugin Fix

Monitor the GitHub issue and update to a newer version of `@electron-forge/plugin-vite` when the issue is resolved.

### Option 4: Use Development Mode

For now, use development mode which works correctly:

```bash
yarn start  # Uses Vite dev server, works fine
```

## Next Steps

1. **Implement Option 1** (Manual Copy Hook) as a workaround
2. Test the packaged app after adding the hook
3. Monitor the Electron Forge repository for updates
4. Consider filing a bug report if not already reported

## Technical Details

### Build Process

1. **Build Phase** (✓ Working):
   - Vite builds main process → `.vite/build/main.cjs`
   - Vite builds preload script → `.vite/build/preload.cjs`
   - Vite builds renderer → `.vite/renderer/main_window/`

2. **Package Phase** (✗ Broken):
   - Electron Packager copies `.vite/build/` → ✓
   - Electron Packager copies `package.json` → ✓
   - Electron Packager copies `.vite/renderer/` → ✗ **MISSING**

### Expected File Structure

```
Gazel.app/
└── Contents/
    └── Resources/
        └── app/  (or app.asar)
            ├── .vite/
            │   ├── build/
            │   │   ├── main.cjs
            │   │   └── preload.cjs
            │   └── renderer/          ← MISSING!
            │       └── main_window/
            │           ├── index.html
            │           └── assets/
            │               ├── index-*.js
            │               └── index-*.css
            └── package.json
```

### Actual File Structure

```
Gazel.app/
└── Contents/
    └── Resources/
        └── app/
            ├── .vite/
            │   └── build/
            │       ├── main.cjs
            │       └── preload.cjs
            └── package.json
```

## References

- [Electron Forge Vite Plugin Documentation](https://www.electronforge.io/config/plugins/vite)
- [GitHub Issue #3423](https://github.com/electron/forge/issues/3423) - Vite template cannot generate asar
- [Electron Forge Packaging Hooks](https://www.electronforge.io/config/hooks)

## Summary

The Electron Forge Vite plugin has a packaging bug where renderer files are built but not copied to the final package. The recommended workaround is to add a `packageAfterCopy` hook to manually copy the renderer files. This is a temporary solution until the plugin is fixed upstream.


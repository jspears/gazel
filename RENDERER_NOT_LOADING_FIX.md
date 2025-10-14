# Fix: Renderer Not Loading in Packaged App

## Problem

The packaged Electron app only shows "IpcTransport initialized" in the console with no other output. Investigation revealed that **the renderer files are completely missing from the packaged app**.

### What We Found

1. **Renderer files ARE being built** to `electron/.vite/renderer/main_window/`
2. **But they're NOT included in the asar archive** when packaging
3. The asar only contains:
   - `.vite/build/main.cjs` (main process)
   - `.vite/build/preload.cjs` (preload script)
   - `package.json`
   - **Missing**: `.vite/renderer/` directory

## Root Cause

The main.ts file was not using the correct Electron Forge Vite plugin global variables and path structure. According to the [Electron Forge Vite Plugin documentation](https://www.electronforge.io/config/plugins/vite), the plugin defines global variables that must be used:

- `MAIN_WINDOW_VITE_DEV_SERVER_URL` - Dev server URL (development only)
- `MAIN_WINDOW_VITE_NAME` - Renderer name (e.g., "main_window")

The production path should be:
```javascript
path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
```

## Solution Applied

### 1. Updated `electron/main.ts`

Changed the renderer loading logic to use Electron Forge's global variables:

```typescript
// Use Electron Forge's Vite plugin global variables
// @ts-ignore - These globals are defined by Electron Forge Vite plugin
const MAIN_WINDOW_VITE_DEV_SERVER_URL = typeof globalThis.MAIN_WINDOW_VITE_DEV_SERVER_URL !== 'undefined' 
  ? globalThis.MAIN_WINDOW_VITE_DEV_SERVER_URL 
  : undefined;
// @ts-ignore
const MAIN_WINDOW_VITE_NAME = typeof globalThis.MAIN_WINDOW_VITE_NAME !== 'undefined'
  ? globalThis.MAIN_WINDOW_VITE_NAME
  : 'main_window';

if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
  // Development: load from Vite dev server
  mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
} else {
  // Production: load from built files
  const rendererPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
  mainWindow.loadFile(rendererPath);
}
```

### 2. Added Enhanced Debugging

- DevTools now opens automatically in production
- All renderer console messages are logged to main process
- Detailed logging of file paths and existence checks
- Log file at `~/Library/Logs/gazel/gazel-electron-main.log`

## Testing the Fix

### Step 1: Clean and Rebuild

```bash
# Clean previous build
rm -rf out/ electron/.vite/

# Rebuild
yarn package
```

### Step 2: Verify Renderer Files Are Included

```bash
# Extract and check asar contents
npx asar list out/Gazel-darwin-arm64/Gazel.app/Contents/Resources/app.asar

# Should now include:
# /.vite/build/main.cjs
# /.vite/build/preload.cjs
# /.vite/renderer/main_window/index.html
# /.vite/renderer/main_window/assets/index-*.js
# /.vite/renderer/main_window/assets/index-*.css
```

### Step 3: Run the Packaged App

```bash
open out/Gazel-darwin-arm64/Gazel.app
```

### Step 4: Check for Success

**Expected console output (in DevTools):**
```
IpcTransport initialized {hasUnary: true, hasStream: true}
[renderer.ts] Loading from electron/renderer.ts
[renderer.ts] window.location: file:///.../index.html
[renderer.ts] document.title: Gazel Electron App
[Client] Electron IPC client initialized
```

**Check the log file:**
```bash
cat ~/Library/Logs/gazel/gazel-electron-main.log
```

Look for:
- `Vite plugin globals` - Shows the global variables
- `Loading renderer from file` - Shows the path being used
- `Renderer finished loading` - Confirms HTML loaded
- `Renderer console [log]` - Shows renderer logs

## If It Still Doesn't Work

### Check 1: Verify Renderer Build Output

```bash
ls -la electron/.vite/renderer/main_window/
# Should show:
# index.html
# assets/index-*.js
# assets/index-*.css
```

### Check 2: Verify Asar Contents

```bash
npx asar extract out/Gazel-darwin-arm64/Gazel.app/Contents/Resources/app.asar /tmp/gazel-extracted
ls -la /tmp/gazel-extracted/.vite/
# Should show both 'build' and 'renderer' directories
```

### Check 3: Check Electron Forge Configuration

Verify `electron/forge.config.ts` has the renderer configured:

```typescript
plugins: [
  new VitePlugin({
    build: [
      {
        entry: path.resolve(electronDir, 'main.ts'),
        config: path.resolve(electronDir, 'vite.main.config.ts'),
        target: 'main',
      },
      {
        entry: path.resolve(electronDir, 'preload.ts'),
        config: path.resolve(electronDir, 'vite.preload.config.ts'),
        target: 'preload',
      },
    ],
    renderer: [  // ← This section is critical
      {
        name: 'main_window',
        config: path.resolve(electronDir, 'vite.renderer.config.ts'),
      },
    ],
  }),
],
```

### Check 4: Verify Vite Renderer Config

Check `electron/vite.renderer.config.ts`:

```typescript
export default defineConfig({
  base: './',  // ← Must be './' for Electron
  root: path.resolve(electronDir),
  build: {
    rollupOptions: {
      input: path.resolve(electronDir, 'index.html'),
    },
  },
  // ...
});
```

## Common Issues

### Issue: Renderer directory still missing from asar

**Cause**: Electron Forge Vite plugin not packaging renderer files

**Solution**: 
1. Ensure `renderer` array is configured in `forge.config.ts`
2. Ensure `electron/index.html` exists and is the entry point
3. Try cleaning node_modules and reinstalling:
   ```bash
   rm -rf node_modules yarn.lock
   yarn install
   yarn package
   ```

### Issue: "Cannot find module" errors in renderer

**Cause**: Dependencies not bundled correctly

**Solution**: Check `vite.renderer.config.ts` and ensure all dependencies are properly configured

### Issue: Blank screen but no errors

**Cause**: JavaScript loaded but Svelte app not mounting

**Solution**: 
1. Check DevTools console for errors
2. Check that `#app` div exists in HTML
3. Verify renderer.ts is importing and mounting the Svelte app correctly

## Technical Details

### How Electron Forge Vite Plugin Works

1. **Development Mode**:
   - Vite dev server runs on a port (e.g., http://localhost:5173)
   - `MAIN_WINDOW_VITE_DEV_SERVER_URL` is set to the dev server URL
   - Main process loads from the dev server

2. **Production Mode**:
   - Vite builds renderer to `.vite/renderer/main_window/`
   - Electron Forge packages everything into asar
   - `MAIN_WINDOW_VITE_NAME` is set to the renderer name
   - Main process loads from `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`

### File Structure in Packaged App

```
Gazel.app/
└── Contents/
    └── Resources/
        └── app.asar/
            ├── .vite/
            │   ├── build/
            │   │   ├── main.cjs
            │   │   └── preload.cjs
            │   └── renderer/
            │       └── main_window/
            │           ├── index.html
            │           └── assets/
            │               ├── index-*.js
            │               └── index-*.css
            └── package.json
```

## References

- [Electron Forge Vite Plugin Documentation](https://www.electronforge.io/config/plugins/vite)
- [Vite Configuration](https://vitejs.dev/config/)
- [Electron BrowserWindow Documentation](https://www.electronjs.org/docs/latest/api/browser-window)

## Summary

The fix involves:
1. ✅ Using Electron Forge's global variables (`MAIN_WINDOW_VITE_DEV_SERVER_URL`, `MAIN_WINDOW_VITE_NAME`)
2. ✅ Using the correct path structure for production: `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`
3. ✅ Adding enhanced debugging to see what's happening
4. ✅ Opening DevTools in production to see errors

After rebuilding with `yarn package`, the renderer files should be included in the asar and the app should load correctly!


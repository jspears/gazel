# Debugging the Packaged Gazel App

## Issue: Only "IpcTransport initialized" in Console

If you're seeing only "IpcTransport initialized" in the console with no other output or errors, this means:

1. ✅ The preload script is loading correctly
2. ✅ The main process is starting
3. ❌ The renderer process (Svelte app) is not starting or has errors

## Recent Changes to Help Debug

I've added the following debugging features to `electron/main.ts`:

### 1. DevTools Now Opens in Production

The packaged app will now automatically open DevTools so you can see JavaScript errors:

```typescript
// Line 311 in electron/main.ts
mainWindow.webContents.openDevTools({ mode: 'detach' });
```

### 2. Enhanced Console Logging

All renderer console messages are now logged to both:
- The terminal (if launched from terminal)
- A log file at `~/Library/Logs/gazel/gazel-electron-main.log`

### 3. Renderer Process Crash Detection

If the renderer process crashes, it will be logged with details.

## How to Debug

### Step 1: Rebuild the App

First, rebuild the app with the new debugging features:

```bash
# Clean previous build
rm -rf out/

# Rebuild
yarn package
```

### Step 2: Run the Packaged App

```bash
# Run from terminal to see logs
open out/Gazel-darwin-arm64/Gazel.app
```

### Step 3: Check DevTools

When the app opens, DevTools should automatically open in a separate window. Look for:

1. **Console Tab**: Check for JavaScript errors (red text)
2. **Network Tab**: Check if resources are loading (HTML, CSS, JS files)
3. **Sources Tab**: Check if the JavaScript files are present

### Step 4: Check the Log File

The main process logs everything to a file:

```bash
# View the log file
cat ~/Library/Logs/gazel/gazel-electron-main.log

# Or tail it in real-time
tail -f ~/Library/Logs/gazel/gazel-electron-main.log
```

Look for:
- `Loading renderer from file` - Shows the path being loaded
- `Renderer finished loading` - Confirms the HTML loaded
- `Renderer failed to load` - Shows load errors
- `Renderer console [error]` - Shows JavaScript errors
- `Renderer process gone` - Shows crashes

### Step 5: Check What You See

#### Scenario A: DevTools Shows JavaScript Errors

If you see errors in the DevTools console, they will tell you exactly what's wrong. Common errors:

**"Cannot find module"** or **"Failed to resolve module"**
- A dependency is missing or path is wrong
- Check that all files are in the `out/` directory

**"Unexpected token"** or **"SyntaxError"**
- JavaScript syntax error in the built files
- May need to rebuild with different settings

**"X is not defined"**
- A global variable or API is missing
- Check that `window.electronAPI` is available

#### Scenario B: DevTools Shows Network Errors

If the Network tab shows failed requests (red):
- Resources are not being found
- Check the paths in the built `index.html`
- May be a `base` path issue in Vite config

#### Scenario C: DevTools Console is Empty

If DevTools opens but shows nothing:
- The renderer HTML loaded but JavaScript didn't execute
- Check the Sources tab to see if JS files are present
- Look for errors in the log file

## Common Issues and Fixes

### Issue: "Cannot find module './client.ipc.js'"

**Cause**: The client.ipc.js file is not in the built output

**Fix**: Check Vite build configuration
```bash
# Check if the file exists in the build
ls -la electron/.vite/renderer/main_window/

# Rebuild with verbose output
yarn package
```

### Issue: "window.electronAPI is undefined"

**Cause**: Preload script didn't run or contextBridge failed

**Fix**: Check preload path in main.ts
```typescript
// Should be:
const preloadPath = path.join(__dirname, 'preload.cjs');
```

### Issue: Blank White Screen

**Cause**: Renderer loaded but Svelte app didn't mount

**Fix**: Check for errors in DevTools console and log file

### Issue: "Failed to load resource: net::ERR_FILE_NOT_FOUND"

**Cause**: Asset paths are incorrect in the built HTML

**Fix**: Check `base` setting in `electron/vite.renderer.config.ts`:
```typescript
export default defineConfig({
  base: './',  // Should be './' for Electron
  // ...
});
```

## Debugging Checklist

Run through this checklist:

- [ ] Rebuilt the app after adding debugging features (`yarn package`)
- [ ] DevTools opens automatically when app starts
- [ ] Checked DevTools Console tab for errors
- [ ] Checked DevTools Network tab for failed requests
- [ ] Checked DevTools Sources tab for missing files
- [ ] Checked log file at `~/Library/Logs/gazel/gazel-electron-main.log`
- [ ] Looked for "Renderer console [error]" messages in log
- [ ] Looked for "Renderer failed to load" messages in log

## Expected Console Output

When working correctly, you should see these messages in order:

1. **In DevTools Console:**
   ```
   IpcTransport initialized {hasUnary: true, hasStream: true}
   [renderer.ts] Loading from electron/renderer.ts
   [renderer.ts] window.location: file:///.../index.html
   [renderer.ts] document.title: Gazel Electron App
   [Client] Electron IPC client initialized
   ```

2. **In Terminal/Log File:**
   ```
   [Main] Main process module loaded
   [Main] createWindow invoked
   [Main] BrowserWindow created
   [Main] Loading renderer from file
   [Main] Renderer finished loading
   [Main] Renderer console [log] IpcTransport initialized
   [Main] Renderer console [log] [renderer.ts] Loading from electron/renderer.ts
   [Main] Renderer console [log] [Client] Electron IPC client initialized
   ```

## Next Steps After Debugging

Once you identify the issue:

1. **Fix the code** based on the error messages
2. **Rebuild**: `yarn package`
3. **Test**: `open out/Gazel-darwin-arm64/Gazel.app`
4. **Verify**: Check that all expected console messages appear

## Removing Debug Features (Optional)

Once the app is working, you may want to remove the DevTools auto-open in production:

```typescript
// In electron/main.ts, around line 311
// Comment out or remove this line:
// mainWindow.webContents.openDevTools({ mode: 'detach' });
```

The console logging and crash detection can stay - they're useful for production debugging.

## Getting Help

If you're still stuck after following this guide:

1. **Share the log file contents**:
   ```bash
   cat ~/Library/Logs/gazel/gazel-electron-main.log
   ```

2. **Share DevTools console errors** (screenshot or copy text)

3. **Share the build output**:
   ```bash
   ls -la out/Gazel-darwin-arm64/Gazel.app/Contents/Resources/app/.vite/
   ```

4. **Check if files are missing**:
   ```bash
   find out/Gazel-darwin-arm64/Gazel.app -name "*.js" | head -20
   ```

This information will help diagnose the issue quickly.


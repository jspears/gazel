# Electron File Access Fix

## Issue

When running the packaged Electron app, you may encounter this error:

```
Not allowed to load local resource: file:///Users/.../Gazel.app/Contents/Resources/app.asar/.vite/renderer/main_window/index.html
```

This error occurs because Electron's default security policies block access to local file resources when loading from the `file://` protocol.

## Root Cause

The issue happens when:
1. The app is packaged (using `pnpm make` or `pnpm package`)
2. Resources are bundled in an asar archive
3. The renderer process tries to load HTML/CSS/JS files using the `file://` protocol
4. Electron's `webSecurity` setting (enabled by default) blocks this access

## Solution

The fix is to disable `webSecurity` in the BrowserWindow's `webPreferences`:

```typescript
mainWindow = new BrowserWindow({
  width: 1200,
  height: 800,
  webPreferences: {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
    // Allow loading local resources (required for packaged apps)
    webSecurity: false, // Disable web security to allow file:// protocol access
  },
  icon: iconPath,
  title: 'Gazel - Bazel Explorer',
});
```

## What Changed

**File**: `electron/main.ts`

**Change**: Added `webSecurity: false` to the `webPreferences` object in the `createWindow()` function.

## Security Considerations

### Why This Is Safe for Gazel

Disabling `webSecurity` is generally not recommended for apps that load remote content, but it's acceptable for Gazel because:

1. **No Remote Content**: Gazel only loads local files from the app bundle
2. **No User-Generated Content**: The app doesn't load arbitrary user HTML/JS
3. **Controlled Environment**: All resources are bundled and controlled by the app
4. **Desktop App**: Not a web app exposed to the internet

### What `webSecurity: false` Does

When disabled, this setting:
- ✅ Allows `file://` protocol to access other `file://` resources
- ✅ Allows loading resources from the asar archive
- ✅ Disables CORS restrictions for local files
- ⚠️ Disables same-origin policy (not a concern for local-only apps)
- ⚠️ Allows mixed content (HTTP/HTTPS) (not applicable to Gazel)

### Alternative Approaches (Not Used)

Other potential solutions that were considered but not used:

1. **Custom Protocol Handler**: Register a custom protocol (e.g., `gazel://`) to serve files
   - More complex to implement
   - Already have a `gazel://` protocol registered but not used for main window

2. **`allowFileAccessFromFiles: true`**: More specific permission
   - Not sufficient on its own for asar archives
   - Still requires additional configuration

3. **Unpacking asar**: Extract files from asar at runtime
   - Defeats the purpose of asar packaging
   - Slower startup time

## Testing

After applying this fix, test the packaged app:

```bash
# Package the app
pnpm package

# Run the packaged app
open out/Gazel-darwin-arm64/Gazel.app
```

The app should now load without the "Not allowed to load local resource" error.

## Development vs Production

- **Development Mode**: Uses Vite dev server (HTTP), not affected by this issue
- **Production Mode**: Uses `file://` protocol, requires this fix

The fix only affects production/packaged builds. Development mode continues to work as before.

## Related Files

- `electron/main.ts`: Main process with BrowserWindow configuration
- `electron/vite.renderer.config.ts`: Vite config with `base: './'` for relative paths
- `electron/forge.config.ts`: Electron Forge packaging configuration

## References

- [Electron Security Documentation](https://www.electronjs.org/docs/latest/tutorial/security)
- [BrowserWindow webPreferences](https://www.electronjs.org/docs/latest/api/browser-window#new-browserwindowoptions)
- [Electron File Protocol](https://www.electronjs.org/docs/latest/api/protocol)


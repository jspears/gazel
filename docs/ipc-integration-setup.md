# Setting Up IPC Integration in Gazel

This guide explains how to integrate the Electron IPC transport with the Gazel application.

## Current Status

The Electron app runs successfully without the IPC integration. The IPC components have been created but need to be properly integrated into the build system.

## Components Created

### 1. Transport Layer (Ready to Use)
- `bzl-ts/src/transports/electron-ipc-transport.ts` - Server implementation
- `bzl-ts/src/transports/electron-ipc-client.ts` - Client implementation
- Fully functional gRPC-over-IPC transport

### 2. Service Layer (Ready to Integrate)
- `electron/services/bazel-ipc-service.js` - Main process service
- `electron/preload.js` - Preload script for secure IPC
- `app/src/lib/bazel-client.ts` - Unified client adapter
- `client/lib/bazel-service.ts` - Svelte service with stores

### 3. Web Adapter (Standalone)
- `server/src/bazel-web-adapter.ts` - Express + WebSocket server
- `server/src/standalone-server.ts` - Standalone executable
- Can be run independently for web-based access

### 4. Example Components
- `client/components/BazelStatus.svelte` - Connection status
- `client/components/BuildPanel.svelte` - Build execution UI

## Integration Steps

To fully integrate the IPC transport into Gazel:

### Step 1: Update Electron Build

The Electron build needs to include the service files. Currently, the BUILD.bazel file doesn't include the services directory.

```python
# In electron/BUILD.bazel, add to the gazel-app target:
data = [
    "main.js",
    "index.html",
    "services/bazel-ipc-service.js",  # Add this
    "preload.js",                      # Add this
    # ... other files
]
```

### Step 2: Install Dependencies

The bzl-ts package needs to be available to the Electron main process:

```bash
# Option 1: Build bzl-ts and copy to electron
bazel build //bzl-ts:bzl_ts
cp -r bazel-bin/bzl-ts/bzl_ts electron/node_modules/bzl-ts

# Option 2: Use npm link (for development)
cd bzl-ts
npm link
cd ../electron
npm link bzl-ts
```

### Step 3: Enable the Service

Once dependencies are resolved, uncomment the service initialization in `electron/main.js`:

```javascript
// Remove the TODO comments and enable:
const BazelIPCService = require('./services/bazel-ipc-service');
let bazelService = null;

app.whenReady().then(() => {
    bazelService = new BazelIPCService();
    bazelService.initialize();
    // ...
});
```

### Step 4: Enable Preload Script

Uncomment the preload script in the BrowserWindow configuration:

```javascript
webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    webSecurity: false,
    preload: path.join(__dirname, 'preload.js')  // Enable this
}
```

## Testing the Integration

### Test IPC Transport Directly

The IPC transport can be tested independently:

```bash
bazel run //bzl-ts:example_electron_ipc_grpc
```

This example demonstrates all IPC communication patterns without requiring Electron.

### Test Web Adapter

The web adapter works standalone:

```bash
# Start the server
cd server
npm install
npm run dev

# Test with curl
curl -X POST http://localhost:8080/api/version
```

### Test in Development Mode

For development, you can run the web adapter alongside the Electron app:

1. Start the web server:
```bash
cd server
npm run dev
```

2. Run Electron app:
```bash
bazel run //electron:gazel-app
```

3. The client will auto-detect and use the web API

## Using the Service in Svelte

Once integrated, the service can be used in any Svelte component:

```svelte
<script>
  import { initializeBazelService, query, build } from '$lib/bazel-service';
  
  onMount(async () => {
    // Auto-detects Electron vs Web
    await initializeBazelService();
    
    // Use the same API
    const targets = await query('//...');
  });
</script>
```

## Benefits of This Architecture

1. **Gradual Integration**: Can be integrated step by step
2. **Fallback Support**: Works with web API if IPC not available
3. **Development Flexibility**: Can develop with web server, deploy with IPC
4. **Type Safety**: Full TypeScript support throughout
5. **Performance**: IPC in production, HTTP in development

## Next Steps

1. **Build System Integration**: Properly integrate services into Bazel build
2. **Package Management**: Set up proper npm dependencies
3. **Testing**: Add integration tests for IPC communication
4. **Documentation**: Document API methods and usage patterns
5. **Error Handling**: Add comprehensive error handling and recovery

## Troubleshooting

### Module Not Found Errors

If you see "Cannot find module" errors:
1. Check that bzl-ts is built: `bazel build //bzl-ts:bzl_ts`
2. Verify the module is in node_modules or properly linked
3. Check import paths match the actual file structure

### IPC Connection Failures

If IPC fails to connect:
1. Verify preload script is loaded (check DevTools console)
2. Check that IPC channels are whitelisted in preload.js
3. Ensure service is initialized in main process

### Web Adapter Issues

If web adapter doesn't work:
1. Check server is running on expected port
2. Verify CORS is properly configured
3. Check network/firewall settings

## Summary

The IPC integration provides a robust, type-safe communication layer between the Electron renderer and main processes. While the full integration requires build system updates, the components are ready and can be used with the web adapter as a fallback.

The architecture supports both development (with hot reload via web server) and production (with efficient IPC) scenarios, making it flexible for different workflows.

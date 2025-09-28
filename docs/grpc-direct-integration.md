# Direct gRPC Integration for Gazel

## Overview

The Gazel application now uses direct gRPC communication with Bazel, eliminating the need for an HTTP server when running in Electron. This provides better performance and a more native experience.

## Architecture

### Electron Mode (No Server Required)
```
┌─────────────────────────────────────────────────────────────┐
│                     Renderer Process                          │
├─────────────────────────────────────────────────────────────┤
│  Svelte App                                                  │
│  └── ElectronBazelClient                                    │
│      └── IPC invoke() calls                                 │
└──────────────────────────┼──────────────────────────────────┘
                           │
                      Direct IPC
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     Main Process                             │
├─────────────────────────────────────────────────────────────┤
│  BazelIPCService                                            │
│  └── BazelClient (bzl-ts)                                   │
│      └── Direct gRPC to Bazel daemon                        │
└──────────────────────────────────────────────────────────────┘
```

### Web Mode (Fallback)
```
┌─────────────────────────────────────────────────────────────┐
│                      Browser                                 │
├─────────────────────────────────────────────────────────────┤
│  Svelte App                                                  │
│  └── WebBazelClient                                         │
│      └── HTTP/WebSocket calls                               │
└──────────────────────────┼──────────────────────────────────┘
                           │
                    HTTP/WebSocket
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Web Server                                │
├─────────────────────────────────────────────────────────────┤
│  BazelWebAdapter                                            │
│  └── BazelClient (bzl-ts)                                   │
│      └── Direct gRPC to Bazel daemon                        │
└──────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. BazelIPCService (`electron/services/bazel-ipc-service.js`)
- Runs in Electron main process
- Uses bzl-ts BazelClient for direct gRPC communication with Bazel
- Exposes IPC handlers for all Bazel operations
- No HTTP server required

### 2. ElectronBazelClient (`app/src/lib/bazel-client.ts`)
- Runs in renderer process
- Uses direct IPC invoke() calls
- Simple, efficient communication
- Type-safe interface

### 3. Preload Script (`electron/preload.js`)
- Securely exposes IPC channels
- Whitelisted Bazel operations
- Context isolation enabled

## Benefits

### Performance
- **No HTTP overhead**: Direct IPC communication
- **Native gRPC**: Direct connection to Bazel daemon
- **Efficient streaming**: Real-time build events

### Security
- **No exposed ports**: Everything runs within Electron
- **Context isolation**: Secure renderer process
- **Whitelisted channels**: Only approved operations

### Simplicity
- **No server management**: No need to start/stop servers
- **Single process**: Everything in the Electron app
- **Unified API**: Same interface for all operations

## Usage

### In Electron

```javascript
// Main process automatically initializes the service
const BazelIPCService = require('./services/bazel-ipc-service');
const service = new BazelIPCService();
service.initialize();
```

### In Renderer (Svelte)

```typescript
import { getBazelClient } from '$lib/bazel-client';

// Automatically uses IPC in Electron
const client = await getBazelClient();
const service = client.getService();

// Direct Bazel operations
await service.setWorkspace({ workspace: '/path/to/workspace' });
const result = await service.query({ expression: '//...' });
const buildResult = await service.build({ targets: ['//app:main'] });
```

## Available Operations

All operations use direct gRPC to the Bazel daemon:

- **Configuration**: `setWorkspace`, `getWorkspace`
- **Queries**: `query`, `cquery`, `aquery`
- **Build**: `build`, `test`, `run`, `clean`
- **Info**: `info`, `version`, `getServerStatus`, `shutdown`
- **Graphs**: `getDependencyGraph`, `getActionGraph`

## Running the Application

### Electron (Recommended)
```bash
# No server needed!
bazel run //electron:gazel-app
```

### Web Development
```bash
# Only if you need web mode
bazel run //app:dev
```

## Implementation Details

### IPC Channels

The following channels are whitelisted in the preload script:
- `bazel:setWorkspace`
- `bazel:getWorkspace`
- `bazel:query`, `bazel:cquery`, `bazel:aquery`
- `bazel:build`, `bazel:test`, `bazel:run`, `bazel:clean`
- `bazel:info`, `bazel:version`
- `bazel:getDependencyGraph`, `bazel:getActionGraph`
- `bazel:getServerStatus`, `bazel:shutdown`

### Mock Mode

When bzl-ts is not available, the service falls back to a mock implementation for development:

```javascript
// Automatically detected and used
class MockBazelClient {
  async build(targets, options) {
    return { success: true, targets, message: 'Mock build' };
  }
  // ... other mock methods
}
```

## Future Enhancements

1. **Streaming Builds**: Full streaming support for build events
2. **File Watching**: Real-time file change detection
3. **Remote Execution**: Direct remote execution support
4. **Build Event Protocol**: Full BEP integration
5. **gRPC-Web**: Direct browser-to-Bazel communication (requires proxy)

## Troubleshooting

### Service Not Loading

If you see "Could not load BazelIPCService":
1. Check that bzl-ts is built: `bazel build //bzl-ts:bzl_ts`
2. Verify the service file exists: `electron/services/bazel-ipc-service.js`
3. Check console for specific error messages

### IPC Not Working

If IPC calls fail:
1. Verify preload script is loaded (check DevTools)
2. Ensure channels are whitelisted in preload.js
3. Check that service is initialized in main process

### Fallback to Mock

The service automatically falls back to mock mode if bzl-ts is not available. This allows development without the full build system.

## Summary

The direct gRPC integration provides a clean, efficient way to communicate with Bazel from Electron without requiring an intermediate HTTP server. The architecture is simpler, more secure, and more performant than a traditional client-server approach.

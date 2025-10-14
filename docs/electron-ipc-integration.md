# Electron IPC gRPC Integration

This document describes the gRPC-over-IPC transport implementation for the Gazel Electron application, which provides efficient communication between the renderer and main processes.

## Overview

The integration provides a unified API that works in both Electron and web environments:

- **Electron Mode**: Uses IPC (Inter-Process Communication) for direct, secure communication
- **Web Mode**: Uses HTTP/WebSocket for browser-based access

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Renderer Process                      │
├─────────────────────────────────────────────────────────────┤
│  Svelte App                                                  │
│  ├── BazelClientAdapter (Abstract)                          │
│  │   ├── ElectronBazelClient ──────┐                       │
│  │   └── WebBazelClient ────────┐  │                       │
│  └── Bazel Service Store        │  │                       │
└──────────────────────────────┼──┼──────────────────────────┘
                                │  │
                         IPC    │  │  HTTP/WS
                                │  │
┌──────────────────────────────┼──┼──────────────────────────┐
│                        Main Process / Server                 │
├──────────────────────────────┼──┼──────────────────────────┤
│  ┌───────────────────────────▼──┼─────────┐                │
│  │  ElectronIPCServer           │         │                │
│  │  └── BazelIPCService         │         │                │
│  └──────────────────────────────┼─────────┘                │
│                                  │                          │
│  ┌───────────────────────────────▼─────────┐                │
│  │  BazelWebAdapter (Express + WebSocket)  │                │
│  └──────────────────────────────────────────┘                │
│                         │                                    │
│                         ▼                                    │
│  ┌─────────────────────────────────────────┐                │
│  │  BazelClient (bzl-ts)                   │                │
│  │  └── Bazel Daemon Communication         │                │
│  └─────────────────────────────────────────┘                │
└──────────────────────────────────────────────────────────────┘
```

## Components

### 1. Transport Layer (`bzl-ts/src/transports/`)

#### ElectronIPCServer
- Main process server that handles gRPC-like service calls
- Supports all 4 gRPC patterns: unary, server streaming, client streaming, duplex
- Type-safe service registration

#### ElectronIPCClient
- Renderer process client for IPC communication
- Automatic request/response correlation
- Stream management with EventEmitter

### 2. Service Layer

#### BazelIPCService (`electron/services/bazel-ipc-service.js`)
- Main process service implementation
- Uses bzl-ts BazelClient for Bazel operations
- Handles workspace management, queries, builds, etc.

#### BazelClientAdapter (`app/src/lib/bazel-client.ts`)
- Abstract adapter pattern for unified API
- ElectronBazelClient for Electron environments
- WebBazelClient for browser environments

### 3. Web Adapter (`server/src/bazel-web-adapter.ts`)
- Express server with REST API endpoints
- WebSocket support for streaming operations
- Compatible with non-Electron environments

## Usage

### In Electron Main Process

```javascript
const { ipcMain } = require('electron');
const BazelIPCService = require('./services/bazel-ipc-service');

// Initialize service
const bazelService = new BazelIPCService();
bazelService.initialize();

// Service is now ready to handle IPC calls
```

### In Renderer Process (Svelte)

```typescript
import { getBazelClient } from '$lib/bazel-client';
import { initializeBazelService, build, query } from '$lib/bazel-service';

// Initialize service (auto-detects Electron vs Web)
await initializeBazelService();

// Set workspace
await setWorkspace('/path/to/workspace');

// Execute query
const targets = await query('//...');

// Build targets
const result = await build(['//app:main']);
```

### In Web Mode

```bash
# Start the web server
npm run dev --prefix server

# Server runs on http://localhost:8080
# WebSocket on ws://localhost:8080/ws
```

## Features

### Supported Operations

- **Configuration**: Set/get workspace
- **Queries**: query, cquery, aquery
- **Build Operations**: build, test, run, clean
- **Info**: version, info, status
- **Graphs**: dependency graph, action graph
- **Streaming**: build progress, file watching

### Security

- **Electron**: IPC channels are whitelisted in preload script
- **Web**: CORS enabled, authentication can be added

### Performance

- **Query Caching**: Results cached with TTL
- **Connection Pooling**: Reuses Bazel client instances
- **Streaming**: Real-time updates without polling

## Example Components

### BazelStatus.svelte
Shows connection status, workspace, and Bazel version.

### BuildPanel.svelte
Execute builds with progress tracking and error display.

### Usage in Existing Components

```svelte
<script>
  import { query, build } from '$lib/bazel-service';
  
  async function loadTargets() {
    const targets = await query('kind(".*_binary", //...)');
    // Process targets...
  }
  
  async function buildTarget(target) {
    const result = await build([target]);
    if (result.success) {
      console.log('Build successful!');
    }
  }
</script>
```

## Development

### Running in Electron

```bash
# Install dependencies
pnpm install

# Start Electron app
bazel run //electron:gazel-app
```

### Running in Web Mode

```bash
# Start web server
cd server
npm install
npm run dev

# Start Svelte app
cd client
npm run dev

# App available at http://localhost:5173
# API at http://localhost:8080
```

## Configuration

### Environment Variables

- `VITE_BAZEL_API_URL`: Web API URL (default: `http://localhost:8080`)
- `BAZEL_WORKSPACE`: Initial workspace path

### Electron Preload

The preload script (`electron/preload.js`) exposes safe IPC methods:
- Only whitelisted channels are allowed
- Context isolation enabled
- No direct Node.js access from renderer

## Testing

### Test Electron IPC

```bash
bazel run //bzl-ts:example_electron_ipc_grpc
```

### Test Web Adapter

```bash
# Start server
node server/dist/standalone-server.js

# Test with curl
curl -X POST http://localhost:8080/api/version
curl -X POST http://localhost:8080/api/query \
  -H "Content-Type: application/json" \
  -d '{"expression": "//..."}'
```

## Troubleshooting

### Connection Issues

1. **Electron**: Check if IPC service is initialized in main process
2. **Web**: Verify server is running and accessible
3. **Both**: Check browser console for errors

### Build Errors

1. Ensure Bazel is installed and in PATH
2. Verify workspace is valid Bazel workspace
3. Check server logs for detailed errors

## Future Enhancements

1. **Authentication**: Add auth for web mode
2. **Streaming Builds**: Implement full streaming in Electron
3. **File Watching**: Real-time file change detection
4. **Remote Execution**: Support for remote build execution
5. **Build Event Protocol**: Full BEP integration
6. **Metrics**: Performance monitoring and analytics

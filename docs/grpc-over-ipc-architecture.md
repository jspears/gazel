# gRPC-over-IPC Architecture

## Overview

The Gazel Electron application now uses **true gRPC-over-IPC** communication, where gRPC semantics (including streaming) are properly marshaled over Electron's IPC mechanism. This eliminates the need for HTTP servers while maintaining full gRPC capabilities.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Renderer Process                          │
├─────────────────────────────────────────────────────────────┤
│  Svelte App                                                  │
│  └── ElectronBazelClient                                    │
│      └── ElectronIPCClient (gRPC client)                    │
│          └── createServiceClient<BazelService>              │
│              └── gRPC method calls over IPC                 │
└──────────────────────────┼──────────────────────────────────┘
                           │
                    gRPC-over-IPC
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     Main Process                             │
├─────────────────────────────────────────────────────────────┤
│  BazelIPCService                                            │
│  └── ElectronIPCServer (gRPC server)                        │
│      └── Service handlers                                   │
│          └── BazelClient (bzl-ts)                           │
│              └── Native gRPC to Bazel daemon                │
└──────────────────────────────────────────────────────────────┘
```

## Key Components

### 1. ElectronIPCServer (`bzl-ts/src/transports/electron-ipc-transport.ts`)

The server component that runs in the main process:

```javascript
class ElectronIPCServer {
  constructor(ipcMain) {
    this.ipcMain = ipcMain;
    this.services = new Map();
  }
  
  addService(name, implementation) {
    // Registers service with gRPC-style handlers
    // Automatically sets up IPC channels for each method
  }
  
  // Handles all 4 gRPC call types:
  // - Unary (request-response)
  // - Server streaming
  // - Client streaming  
  // - Bidirectional streaming
}
```

### 2. ElectronIPCClient (`bzl-ts/src/transports/electron-ipc-client.ts`)

The client component that runs in the renderer process:

```javascript
class ElectronIPCClient {
  constructor(ipcRenderer) {
    this.ipcRenderer = ipcRenderer;
  }
  
  // Makes gRPC-style calls over IPC
  unaryCall(service, method, request) { }
  serverStreamCall(service, method, request) { }
  clientStreamCall(service, method) { }
  duplexCall(service, method) { }
}

// Type-safe service client factory
function createServiceClient<T>(client, serviceName, methodDefs) {
  // Creates a proxy that marshals method calls as gRPC
}
```

### 3. Service Implementation (`electron/services/bazel-ipc-service.js`)

```javascript
class BazelIPCService {
  initialize() {
    // Create gRPC server over IPC
    this.ipcServer = new ElectronIPCServer(ipcMain);
    
    // Register service with all Bazel operations
    this.ipcServer.addService('BazelService', {
      setWorkspace: this.setWorkspace.bind(this),
      query: this.query.bind(this),
      build: this.build.bind(this),
      // ... all other methods
      buildStream: this.buildStream.bind(this), // Server streaming
      watchFiles: this.watchFiles.bind(this)     // Duplex streaming
    });
    
    this.ipcServer.start();
  }
}
```

## gRPC Call Types

### 1. Unary Calls (Request-Response)

Most Bazel operations use unary calls:

```typescript
// Client (Renderer)
const result = await service.query({ 
  expression: '//...', 
  options: {} 
});

// Server (Main)
async query(request) {
  return await this.bazelClient.query(
    request.expression, 
    request.options
  );
}
```

### 2. Server Streaming

For build progress and events:

```typescript
// Client (Renderer)
const stream = service.buildStream({ 
  targets: ['//app:main'] 
});

stream.on('data', (event) => {
  console.log('Build progress:', event);
});

stream.on('end', () => {
  console.log('Build complete');
});

// Server (Main)
buildStream(request, stream) {
  const buildStream = this.bazelClient.buildStream(
    request.targets,
    request.options
  );
  
  buildStream.on('progress', (data) => {
    stream.write({ type: 'progress', data });
  });
  
  buildStream.on('complete', () => {
    stream.end();
  });
}
```

### 3. Client Streaming

For uploading multiple files or batch operations:

```typescript
// Client (Renderer)
const stream = service.uploadFiles();

files.forEach(file => {
  stream.write({ path: file.path, content: file.content });
});

const result = await stream.end();
```

### 4. Bidirectional Streaming

For file watching with two-way communication:

```typescript
// Client (Renderer)
const stream = service.watchFiles();

// Send paths to watch
stream.write({ action: 'watch', paths: ['BUILD.bazel'] });

// Receive file changes
stream.on('data', (change) => {
  console.log('File changed:', change);
  
  // Can send more commands
  stream.write({ action: 'unwatch', paths: [change.path] });
});
```

## IPC Channel Structure

The gRPC-over-IPC transport uses structured channel names:

### Unary Calls
- Request: `grpc:BazelService:query`
- Response: Via promise resolution

### Server Streaming
- Start: `grpc:BazelService:buildStream:start`
- Data: `grpc:BazelService:buildStream:data`
- End: `grpc:BazelService:buildStream:end`
- Error: `grpc:BazelService:buildStream:error`

### Client Streaming
- Start: `grpc:BazelService:uploadFiles:start`
- Data: `grpc:BazelService:uploadFiles:data`
- End: `grpc:BazelService:uploadFiles:end`

### Duplex Streaming
- Start: `grpc:BazelService:watchFiles:start`
- Client→Server: `grpc:BazelService:watchFiles:data:client`
- Server→Client: `grpc:BazelService:watchFiles:data:server`
- End: `grpc:BazelService:watchFiles:end`

## Security

### Preload Script

The preload script whitelists specific gRPC channels:

```javascript
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    send: (channel, ...args) => {
      // Only allow gRPC channels
      const validChannels = [
        'grpc:unary:request',
        'grpc:server-stream:start',
        'grpc:BazelService:*',
        // ... specific service channels
      ];
      
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    },
    // ... similar for on() and invoke()
  }
});
```

## Benefits

### 1. True gRPC Semantics
- All 4 gRPC call types supported
- Proper streaming with backpressure
- Error propagation
- Metadata support

### 2. Type Safety
- Full TypeScript support
- Service interfaces enforced
- Compile-time checking

### 3. Performance
- No HTTP overhead
- Direct IPC communication
- Efficient binary serialization
- Native streaming

### 4. No Server Required
- No ports to manage
- No server lifecycle
- Runs entirely within Electron

## Usage Example

```typescript
// In your Svelte component
import { getBazelClient } from '$lib/bazel-client';

async function buildProject() {
  const client = await getBazelClient();
  const service = client.getService();
  
  // Unary call
  const workspace = await service.getWorkspace();
  
  // Query with gRPC
  const targets = await service.query({
    expression: '//...',
    options: { output: 'proto' }
  });
  
  // Streaming build
  const stream = service.buildStream({
    targets: ['//app:main'],
    options: { verbose: true }
  });
  
  stream.on('data', (event) => {
    updateProgress(event.progress);
  });
  
  stream.on('end', () => {
    console.log('Build complete!');
  });
}
```

## Testing

The implementation includes mock fallbacks for development:

1. **MockElectronIPCServer**: Simulates gRPC server when bzl-ts not available
2. **MockBazelClient**: Provides fake Bazel responses
3. **Mock Service**: Returns test data for UI development

## Future Enhancements

1. **Metadata Support**: Add gRPC metadata for auth/tracing
2. **Interceptors**: Add logging, retry, auth interceptors
3. **Connection Management**: Handle reconnection, keepalive
4. **Load Balancing**: Support multiple Bazel daemons
5. **gRPC-Web**: Direct browser-to-Bazel via Envoy proxy

## Summary

The gRPC-over-IPC implementation provides a complete, type-safe, and efficient way to communicate with Bazel from Electron. It maintains full gRPC semantics including all streaming patterns, while running entirely within the Electron process boundary without any external servers.

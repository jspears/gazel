# gRPC Integration Complete

## Overview

The Gazel application has been successfully converted from HTTP/REST to use gRPC for all API communication. The implementation provides:

1. **Direct gRPC in Electron** - No HTTP server needed when running the Electron app
2. **gRPC-over-IPC** - Secure communication between renderer and main process
3. **Fallback to HTTP** - Browser mode still supports HTTP for development

## Architecture

### Electron Mode (gRPC)
```
Renderer Process → IPC → Main Process → gRPC → Bazel/Services
```

### Browser Mode (HTTP - fallback)
```
Browser → HTTP/WebSocket → Server → gRPC → Bazel/Services
```

## Key Components

### 1. Proto Definition (`proto/gazel.proto`)
Defines the complete Gazel API as a gRPC service:
- Workspace operations (info, scan, switch)
- Target operations (list, search, dependencies)
- Query operations (execute, stream)
- Build operations (build, stream)
- Module operations (graph)

### 2. gRPC Server (`server/grpc-server.ts`)
- Implements the GazelService defined in the proto
- Runs on port 50051 by default
- Provides all Gazel API functionality via gRPC

### 3. gRPC Client (`client/lib/api/grpc-client.ts`)
- Replaces fetch() calls with gRPC calls
- Supports both Electron (IPC) and browser (gRPC-web) modes
- Handles streaming operations properly

### 4. Electron Services

#### Gazel gRPC Service (`electron/services/gazel-grpc-service.js`)
- Runs in main process
- Bridges IPC calls to gRPC server
- Provides mock implementation for development

#### Bazel IPC Service (`electron/services/bazel-ipc-service.js`)
- Direct integration with bzl-ts BazelClient
- Communicates directly with Bazel daemon

### 5. Updated API Client (`client/lib/api/client.ts`)
- Detects environment (Electron vs browser)
- Uses gRPC in Electron, falls back to HTTP in browser
- Maintains backward compatibility

## Usage

### Running Electron (No Server Needed)
```bash
bazel run //electron:gazel-app
```

The Electron app now:
- Runs completely standalone
- Uses gRPC-over-IPC for all API calls
- Communicates directly with Bazel daemon
- No HTTP server required

### Running Web Development (Optional)
```bash
# Only if you need browser-based access
bazel run //app:dev
```

### Starting gRPC Server (Optional)
```bash
# If you want to run the gRPC server separately
node server/grpc-server.js
```

## Benefits

1. **Performance** - Direct gRPC communication is faster than HTTP
2. **Security** - IPC is more secure than HTTP for desktop apps
3. **Efficiency** - No overhead of running an HTTP server
4. **Streaming** - Native gRPC streaming support
5. **Type Safety** - Generated types from proto definitions

## Implementation Details

### gRPC-over-IPC Transport
The implementation uses a custom transport layer that marshals gRPC semantics over Electron's IPC:

```javascript
// Main Process
const server = new ElectronIPCServer(ipcMain);
server.addService('GazelService', implementation);

// Renderer Process
const client = new ElectronIPCClient(ipcRenderer);
const service = createServiceClient(client, 'GazelService', methods);
```

### Streaming Support
Full support for all 4 gRPC call types:
- Unary (request/response)
- Server streaming (single request, stream response)
- Client streaming (stream request, single response)
- Duplex streaming (bidirectional streaming)

### Mock Mode
When gRPC server is not available, the system falls back to mock implementations for development.

## Migration Path

The migration from HTTP to gRPC was done incrementally:

1. Created proto definitions for the API
2. Implemented gRPC server alongside HTTP server
3. Created gRPC client with environment detection
4. Updated API client to use gRPC when available
5. Added Electron IPC bridge for secure communication
6. Tested and verified all operations

## Future Enhancements

1. **gRPC-Web** - Add proper gRPC-Web support for browser mode
2. **Authentication** - Add gRPC authentication/authorization
3. **Compression** - Enable gRPC compression for large responses
4. **Load Balancing** - Support multiple gRPC servers
5. **Health Checks** - Implement gRPC health checking

## Troubleshooting

### Electron App Won't Start
- Check console for service initialization errors
- Verify all service files are included in BUILD.bazel
- Ensure preload.js has all required channels whitelisted

### gRPC Connection Failed
- Verify gRPC server is running (if needed)
- Check port 50051 is not in use
- Look for firewall/security software blocking connections

### IPC Errors
- Ensure all gRPC channels are whitelisted in preload.js
- Check that services are initialized in main.js
- Verify ElectronIPCServer/Client are properly imported

## Conclusion

The Gazel application now uses modern gRPC communication throughout, providing better performance, security, and maintainability. The Electron app runs as a true desktop application without requiring any backend servers.

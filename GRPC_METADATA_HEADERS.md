# gRPC Metadata Headers Implementation

## Overview

This document describes the implementation of gRPC metadata headers to pass the Bazel workspace directory and executable path from the client to the server on every request.

## Problem

The Gazel application stores workspace configuration (workspace directory and Bazel executable path) in the browser's localStorage. However, the server needs this information to execute Bazel commands. Previously, this was handled by explicit RPC calls to set the workspace, but this approach had issues:

1. **Race conditions**: The workspace might not be set before other requests are made
2. **State management**: The server had to maintain state that could get out of sync with the client
3. **Multiple clients**: If multiple clients connected to the same server, they would interfere with each other

## Solution

Implement gRPC metadata headers to automatically pass workspace and executable information with every request:

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client (Browser)                         │
│                                                                   │
│  ┌──────────────┐                                                │
│  │ localStorage │                                                │
│  │  - workspace │                                                │
│  │  - executable│                                                │
│  └──────┬───────┘                                                │
│         │                                                         │
│         ▼                                                         │
│  ┌──────────────────────────────────────┐                       │
│  │  Metadata Provider / Interceptor     │                       │
│  │  - Reads from localStorage           │                       │
│  │  - Adds headers to every request     │                       │
│  └──────────────┬───────────────────────┘                       │
│                 │                                                 │
└─────────────────┼─────────────────────────────────────────────────┘
                  │
                  │ gRPC Request with Headers:
                  │ - bazel-workspace: /path/to/workspace
                  │ - bazel-executable: /path/to/bazelisk
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Server (Node.js)                            │
│                                                                   │
│  ┌──────────────────────────────────────┐                       │
│  │  Metadata Interceptor                │                       │
│  │  - Extracts headers from request     │                       │
│  │  - Calls setWorkspace()              │                       │
│  │  - Calls setBazelExecutable()        │                       │
│  └──────────────┬───────────────────────┘                       │
│                 │                                                 │
│                 ▼                                                 │
│  ┌──────────────────────────────────────┐                       │
│  │  Service Implementation              │                       │
│  │  - Uses configured workspace         │                       │
│  │  - Uses configured executable        │                       │
│  └──────────────────────────────────────┘                       │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. Electron IPC Transport (electron/electron-ipc-transport.ts)

**Changes:**
- Added `MetadataProvider` type and `setMetadataProvider()` function
- Modified `unary()` method to include metadata in IPC requests
- Modified `stream()` method to include metadata in IPC requests

**Key Code:**
```typescript
type MetadataProvider = () => { workspace?: string; executable?: string };

export function setMetadataProvider(provider: MetadataProvider): void {
  metadataProvider = provider;
}

// In unary method:
const metadata = this.getMetadata();
const result = await this.ipcRenderer.invoke('grpc:unary:request', {
  method: method.localName,
  service: method.parent.name,
  data: binaryInput,
  metadata  // Added metadata
});
```

### 2. Electron IPC Client Setup (electron/client.ipc.ts)

**Changes:**
- Imported `setMetadataProvider` and `storage`
- Set up metadata provider to read from localStorage

**Key Code:**
```typescript
setMetadataProvider(() => {
  const workspace = storage.getPreference('lastWorkspace');
  const executable = storage.getPreference('bazelExecutable');
  
  const metadata: { workspace?: string; executable?: string } = {};
  if (workspace) {
    metadata.workspace = workspace;
  }
  if (executable) {
    metadata.executable = executable;
  }
  
  return metadata;
});
```

### 3. Electron Main Process IPC Handler (electron/main.ts)

**Changes:**
- Modified `grpc:unary:request` handler to accept and process metadata
- Modified `grpc:stream:start` handler to accept and process metadata
- Calls `setWorkspace()` and `setBazelExecutable()` before processing requests

**Key Code:**
```typescript
ipcMain.handle('grpc:unary:request', async (_event, request: {
  service: string;
  method: string;
  data: any;
  metadata?: { workspace?: string; executable?: string };
}) => {
  const { service, method, data, metadata } = request;
  
  // Apply metadata to server config if provided
  if (metadata) {
    if (metadata.workspace) {
      const { setWorkspace } = await import('../server/config.js');
      setWorkspace(metadata.workspace);
    }
    if (metadata.executable) {
      const { setBazelExecutable } = await import('../server/config.js');
      const actualPath = setBazelExecutable(metadata.executable);
      
      // Also update the BazelService instance
      if (gazelService && typeof (gazelService as any).setBazelExecutable === 'function') {
        (gazelService as any).setBazelExecutable(actualPath);
      }
    }
  }
  
  // ... rest of handler
});
```

### 4. Web Client Metadata Interceptor (client/lib/metadata-interceptor.ts)

**New File:**
- Client-side Connect interceptor for web clients
- Reads workspace and executable from localStorage
- Adds them as HTTP headers to every request

**Key Code:**
```typescript
export const metadataInterceptor: Interceptor = (next) => async (req) => {
  const workspace = storage.getPreference('lastWorkspace');
  const executable = storage.getPreference('bazelExecutable');

  if (workspace) {
    req.header.set('bazel-workspace', workspace);
  }

  if (executable) {
    req.header.set('bazel-executable', executable);
  }

  return next(req);
};
```

### 5. Server Metadata Interceptor (server/metadata-interceptor.ts)

**New File:**
- Server-side Connect interceptor
- Extracts metadata from HTTP headers
- Configures server workspace and executable before processing request

**Key Code:**
```typescript
export const metadataInterceptor: Interceptor = (next) => async (req) => {
  const workspace = req.header.get('bazel-workspace');
  const executable = req.header.get('bazel-executable');

  if (workspace) {
    setWorkspace(workspace);
  }

  if (executable) {
    const actualPath = setBazelExecutable(executable);
    bazelService.setBazelExecutable(actualPath);
  }

  return next(req);
};
```

### 6. Web Client Setup (client/client.web.ts)

**Changes:**
- Added metadata interceptor to transport configuration

**Key Code:**
```typescript
const transport = createGrpcWebTransport({
  baseUrl: '/api',
  interceptors: [metadataInterceptor]
});
```

### 7. Server Setup (server/main.ts)

**Changes:**
- Added metadata interceptor to server configuration
- Metadata interceptor runs before logging interceptor

**Key Code:**
```typescript
const server = createServer(
  connectNodeAdapter({
    requestPathPrefix: "/api",
    interceptors: [metadataInterceptor, loggingInterceptor],
    routes(router) {
      router.service(GazelService, serviceImpl);
    },
  })
);
```

## Benefits

1. **Automatic Configuration**: Workspace and executable are automatically sent with every request
2. **No Race Conditions**: Configuration is applied before each request is processed
3. **Stateless Server**: Server doesn't need to maintain client-specific state
4. **Multi-Client Support**: Each request carries its own configuration
5. **Consistent Behavior**: Works the same way for both Electron IPC and web clients

## Header Names

- `bazel-workspace`: The absolute path to the Bazel workspace directory
- `bazel-executable`: The path to the Bazel executable (bazelisk or bazel)

## Testing

To verify the implementation:

1. **Check Console Logs**: Look for messages like:
   ```
   [IPC] Set workspace from metadata: /path/to/workspace
   [IPC] Set bazel executable from metadata: /path/to/bazelisk
   ```

2. **Test Workspace Switching**: Change workspace in the UI and verify subsequent requests use the new workspace

3. **Test Executable Configuration**: Change the Bazel executable in settings and verify it's used for subsequent commands

## Future Improvements

1. **Caching**: Cache the metadata provider result to avoid repeated localStorage reads
2. **Validation**: Add validation to ensure workspace paths exist and executables are valid
3. **Error Handling**: Better error messages when metadata is missing or invalid
4. **Additional Metadata**: Could be extended to pass other configuration like build flags, platforms, etc.

## Related Files

- `electron/electron-ipc-transport.ts` - IPC transport with metadata support
- `electron/client.ipc.ts` - Electron client setup with metadata provider
- `electron/main.ts` - Electron main process IPC handlers
- `client/lib/metadata-interceptor.ts` - Web client metadata interceptor
- `server/metadata-interceptor.ts` - Server metadata interceptor
- `client/client.web.ts` - Web client setup
- `server/main.ts` - Server setup with interceptors
- `client/lib/storage.ts` - LocalStorage service for preferences
- `server/config.ts` - Server configuration with setWorkspace/setBazelExecutable


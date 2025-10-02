# gRPC Streaming over Electron IPC

## Overview

This implementation provides full support for gRPC streaming over Electron IPC, enabling both unary and server-streaming RPC calls from the renderer process to the main process.

## Architecture

### Components

1. **IpcTransport** (`client/client.ipc.ts`)
   - Implements the Connect `Transport` interface
   - Handles both unary and streaming RPC calls
   - Manages stream lifecycle and abort signals

2. **GrpcIpcHandler** (`electron/services/grpc-ipc-handler.js`)
   - Main process handler for IPC requests
   - Routes calls to the GazelServiceImpl
   - Manages active streams and cleanup

3. **GazelServiceImpl** (`server/server.ts`)
   - The actual service implementation
   - Provides both unary and streaming methods
   - Uses async generators for streaming responses

## Features

### Unary Calls
- Standard request/response pattern
- Full type safety with protobuf schemas
- Error handling and propagation

### Server Streaming
- Async generator support
- Message queuing for backpressure handling
- Abort signal support for cancellation
- Automatic cleanup on stream completion

## IPC Channels

### Unary Channels
- `grpc:unary:request` - Main channel for unary RPC calls

### Streaming Channels
- `grpc:stream:start` - Initiate a streaming call
- `grpc:stream:message:{streamId}` - Receive stream messages
- `grpc:stream:error:{streamId}` - Receive stream errors
- `grpc:stream:complete:{streamId}` - Stream completion signal
- `grpc:stream:abort` - Abort an active stream
- `grpc:stream:cleanup` - Clean up stream resources

## Usage

### Client Side (Renderer Process)

```typescript
import { IpcTransport } from './client.ipc';
import { createClient } from '@connectrpc/connect';
import { GazelService } from '../proto';

// Create the transport
const transport = new IpcTransport(window.electron.ipcRenderer);

// Create the client
const client = createClient(GazelService, transport);

// Make a unary call
const response = await client.getWorkspaceInfo({});

// Make a streaming call
for await (const message of client.streamQuery({ query: '//...' })) {
  console.log('Received:', message);
}
```

### Server Side (Main Process)

The server implementation uses async generators for streaming:

```typescript
async *streamQuery(request: StreamQueryRequest): AsyncGenerator<StreamQueryResponse> {
  const result = await bazelService.query(request.query);
  const lines = result.stdout.split('\n');
  
  for (const chunk of chunks(lines, 10)) {
    yield create(StreamQueryResponseSchema, {
      data: { case: 'rawLine', value: chunk.join('\n') }
    });
  }
}
```

## Stream Lifecycle

1. **Initiation**
   - Client generates unique stream ID
   - Sets up message/error/complete listeners
   - Sends `grpc:stream:start` with request data

2. **Message Flow**
   - Server processes request and yields messages
   - Each message sent via `grpc:stream:message:{streamId}`
   - Client queues messages if consumer is slow

3. **Completion**
   - Server sends `grpc:stream:complete:{streamId}` when done
   - Client cleans up listeners
   - Resources are freed on both sides

4. **Cancellation**
   - Client can send `grpc:stream:abort` to cancel
   - Server aborts the async generator
   - Cleanup happens automatically

## Error Handling

- Errors in the stream are sent via `grpc:stream:error:{streamId}`
- Transport errors are propagated as exceptions
- Abort signals trigger graceful cleanup
- All listeners are removed on stream completion or error

## Testing

A test page is provided at `client/test-streaming.html` that demonstrates:
- Unary calls (GetWorkspaceInfo, ListTargets)
- Streaming calls (StreamQuery, StreamBuild)
- Stream cancellation
- Error handling

To test:
1. Open the Electron app
2. Navigate to the test page
3. Click the test buttons to see streaming in action

## Benefits

1. **Full gRPC Compatibility**: Supports all gRPC patterns
2. **Type Safety**: Full TypeScript/protobuf type safety
3. **Performance**: Direct IPC communication, no HTTP overhead
4. **Cancellation**: Proper abort signal support
5. **Resource Management**: Automatic cleanup of streams
6. **Backpressure**: Message queuing handles slow consumers

## Implementation Notes

- Stream IDs are unique per stream for message routing
- Abort controllers manage stream cancellation
- Message queuing prevents data loss
- All IPC channels are validated in preload.js
- The transport is only initialized in Electron environments

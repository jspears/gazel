# StreamManager Usage Guide

## Overview

The `StreamManager` class provides a way to convert async generators into IPC event streams and reconstruct them back into async generators. This solves the "Object is not cloneable" error when trying to pass async generators through Electron's `contextBridge`.

## Key Methods

### `startStream(generatorFn, channelPrefix)`

Starts a stream by running an async generator and emitting its values as IPC events.

**Parameters:**
- `generatorFn: () => AsyncGenerator<unknown>` - A function that returns an async generator
- `channelPrefix: string` - A prefix for the IPC channel name

**Returns:** `Promise<string>` - The unique stream ID

**Example:**
```typescript
const streamId = await streamManager.startStream(
  () => myAsyncGenerator(),
  'my-stream'
);
```

### `fromEventStream<T>(channel)`

Reconstructs an async generator from an IPC event stream. This is the key function that allows you to consume streamed data as if it were a native async generator.

**Parameters:**
- `channel: string` - The IPC channel to listen on

**Returns:** `AsyncGenerator<T>` - An async generator that yields values from the stream

**Example:**
```typescript
const channel = `stream:my-stream:${streamId}`;

for await (const value of streamManager.fromEventStream(channel)) {
  console.log('Received:', value);
}
```

### `stopStream(streamId)`

Stops an active stream and cleans up resources.

**Parameters:**
- `streamId: string` - The stream ID returned from `startStream`

**Example:**
```typescript
streamManager.stopStream(streamId);
```

## Complete Usage Example

### In the Preload Script

```typescript
import { contextBridge, ipcRenderer } from 'electron';
import { StreamManager } from './stream-manager.js';
import { GazelServiceImpl } from '../server/server.js';

const serviceImpl = new GazelServiceImpl();
const streamManager = new StreamManager(ipcRenderer);

contextBridge.exposeInMainWorld('electronAPI', {
  gazelService: {
    // Streaming method
    streamQuery: async function* (input) {
      // Start the stream
      const streamId = await streamManager.startStream(
        () => serviceImpl.streamQuery(input),
        'gazel:streamQuery'
      );
      
      // Build the channel name
      const channel = `stream:gazel:streamQuery:${streamId}`;
      
      // Reconstruct and yield from the event stream
      yield* streamManager.fromEventStream(channel);
    },
    
    // Unary method (no streaming)
    executeQuery: serviceImpl.executeQuery.bind(serviceImpl)
  }
});
```

### In the Renderer Process

```typescript
// Import the API
const { gazelService } = window.electronAPI;

// Use the streaming method just like a normal async generator
async function fetchData() {
  try {
    for await (const message of gazelService.streamQuery({ 
      query: '//...',
      outputFormat: 'streamed_jsonproto'
    })) {
      if (message.data.case === 'target') {
        console.log('Target:', message.data.value);
      } else if (message.data.case === 'error') {
        console.error('Error:', message.data.value);
        break;
      }
    }
    console.log('Stream complete!');
  } catch (error) {
    console.error('Stream failed:', error);
  }
}

fetchData();
```

## How It Works

### Event Flow

1. **Start Stream**: When you call a streaming method, `startStream()` is invoked:
   - Generates a unique stream ID
   - Creates a channel name: `stream:{prefix}:{streamId}`
   - Runs the async generator in the background
   - Emits events for each yielded value

2. **Event Types**:
   - `{ type: 'data', value: T }` - A value was yielded
   - `{ type: 'complete' }` - The generator finished successfully
   - `{ type: 'error', error: string }` - An error occurred

3. **Reconstruct Generator**: `fromEventStream()` listens to the channel:
   - Buffers incoming values if they arrive faster than consumed
   - Yields values as they're requested via `for await...of`
   - Handles completion and errors properly
   - Cleans up listeners when done

### Benefits

✅ **Solves the cloneable issue**: Async generators can't cross the context bridge, but events can

✅ **Maintains async generator API**: Client code uses `for await...of` as normal

✅ **Proper backpressure**: Values are buffered only when needed

✅ **Error handling**: Errors are propagated correctly

✅ **Resource cleanup**: Listeners are removed when the stream ends

## Advanced Usage

### With Cancellation

```typescript
async function fetchWithCancellation() {
  const streamId = await streamManager.startStream(
    () => myGenerator(),
    'my-stream'
  );
  
  const channel = `stream:my-stream:${streamId}`;
  
  try {
    for await (const value of streamManager.fromEventStream(channel)) {
      console.log(value);
      
      // Cancel after 10 items
      if (someCondition) {
        streamManager.stopStream(streamId);
        break;
      }
    }
  } catch (error) {
    console.error('Stream error:', error);
  }
}
```

### Type-Safe Streaming

```typescript
interface MyData {
  id: string;
  value: number;
}

async function* typedStream() {
  const streamId = await streamManager.startStream(
    () => myTypedGenerator(),
    'typed-stream'
  );
  
  const channel = `stream:typed-stream:${streamId}`;
  
  // Specify the type parameter
  yield* streamManager.fromEventStream<MyData>(channel);
}

// Usage
for await (const data of typedStream()) {
  console.log(data.id, data.value); // TypeScript knows the shape
}
```

## Troubleshooting

### Stream doesn't complete

Make sure your generator function properly completes:
```typescript
async function* myGenerator() {
  yield 1;
  yield 2;
  // Generator completes here automatically
}
```

### Values arrive out of order

The `fromEventStream` function maintains order by buffering values. If you're seeing out-of-order values, check that you're using unique channel names for each stream.

### Memory leaks

Always ensure streams complete or are explicitly stopped:
```typescript
try {
  for await (const value of stream) {
    // Process value
  }
} finally {
  // Cleanup happens automatically, but you can also call:
  streamManager.stopStream(streamId);
}
```


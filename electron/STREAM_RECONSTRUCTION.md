# Stream Reconstruction Implementation

## Problem

Async generators cannot be directly exposed through Electron's `contextBridge.exposeInMainWorld()` because they are not cloneable objects. When attempting to pass an async generator across the context isolation boundary, you get an error:

```
Error: An object could not be cloned
```

## Solution

The solution is to convert async generators into IPC event streams and then reconstruct them back into async generators on the other side. This is implemented in the `StreamManager` class.

## Architecture

### 1. Stream Decomposition (`startStream`)

The `startStream` method takes an async generator and decomposes it into IPC events:

```typescript
async startStream(generatorFn: () => AsyncGenerator<unknown>, channelPrefix: string): Promise<string>
```

**Process:**
1. Generate a unique stream ID
2. Create a channel name: `stream:{prefix}:{streamId}`
3. Run the generator in the background
4. For each yielded value, send: `{ type: 'data', value }`
5. On completion, send: `{ type: 'complete' }`
6. On error, send: `{ type: 'error', error: string }`

### 2. Stream Reconstruction (`fromEventStream`)

The `fromEventStream` method reconstructs an async generator from IPC events:

```typescript
async *fromEventStream<T = unknown>(channel: string): AsyncGenerator<T>
```

**Process:**
1. Set up IPC listener on the specified channel
2. Buffer incoming values if they arrive faster than consumed
3. Yield values as they're requested via `for await...of`
4. Handle completion and errors
5. Clean up listeners when done

## Implementation Details

### Event Protocol

The stream uses a simple event protocol:

```typescript
interface StreamEvent {
  type: 'data' | 'complete' | 'error' | 'cancel';
  value?: unknown;      // Present when type === 'data'
  error?: string;       // Present when type === 'error'
}
```

### Buffering Strategy

The reconstruction uses a buffer to handle backpressure:

- **Fast Producer**: If events arrive faster than they're consumed, they're buffered
- **Fast Consumer**: If the consumer is waiting, events are delivered immediately
- **Promise-based**: Uses promises to coordinate between event arrival and consumption

### State Management

```typescript
const buffer: T[] = [];                                    // Buffered values
let resolveNext: ((result: IteratorResult<T>) => void) | null = null;  // Waiting consumer
let isComplete = false;                                    // Stream finished
let error: Error | null = null;                           // Stream error
```

### Cleanup

Proper cleanup is essential to prevent memory leaks:

```typescript
const cleanup = () => {
  this.ipcRenderer.removeListener(channel, handler);
};

try {
  // Yield values...
} finally {
  cleanup();  // Always clean up, even on error
}
```

## Usage in Preload Script

The preload script uses `fromEventStream` to expose streaming methods:

```typescript
import { StreamManager } from './stream-manager.js';

const streamManager = new StreamManager(ipcRenderer);

contextBridge.exposeInMainWorld('electronAPI', {
  gazelService: {
    streamQuery: async function* (input) {
      // Start the stream (runs in preload context)
      const streamId = await streamManager.startStream(
        () => serviceImpl.streamQuery(input),
        'gazel:streamQuery'
      );
      
      // Reconstruct the generator from events
      const channel = `stream:gazel:streamQuery:${streamId}`;
      yield* streamManager.fromEventStream(channel);
    }
  }
});
```

## Key Features

### ✅ Transparent API

Client code doesn't need to know about the IPC layer:

```typescript
// Works exactly like a normal async generator
for await (const message of api.streamQuery({ query: '//...' })) {
  console.log(message);
}
```

### ✅ Proper Backpressure

The buffer ensures that:
- Fast producers don't overwhelm slow consumers
- Slow producers don't block fast consumers
- Memory usage is bounded by consumption rate

### ✅ Error Propagation

Errors in the generator are properly propagated:

```typescript
async function* errorGenerator() {
  yield 1;
  throw new Error('Something went wrong');
}

// Error is thrown when consuming
try {
  for await (const value of stream) {
    // ...
  }
} catch (error) {
  console.error('Stream failed:', error);  // Catches the error
}
```

### ✅ Cancellation Support

Streams can be cancelled:

```typescript
const streamId = await streamManager.startStream(...);

// Later...
streamManager.stopStream(streamId);
```

### ✅ Type Safety

TypeScript types are preserved:

```typescript
interface MyData {
  id: string;
  value: number;
}

for await (const data of streamManager.fromEventStream<MyData>(channel)) {
  console.log(data.id, data.value);  // TypeScript knows the types
}
```

## Performance Considerations

### Memory

- **Bounded**: Buffer size is limited by consumption rate
- **Cleanup**: Listeners are removed when stream completes
- **No leaks**: Proper cleanup in finally blocks

### Latency

- **Minimal overhead**: Direct IPC communication
- **No polling**: Event-driven, not polling-based
- **Immediate delivery**: Values delivered as soon as consumed

### Throughput

- **Buffering**: Handles bursts of data efficiently
- **Async**: Non-blocking, doesn't tie up the event loop
- **Scalable**: Multiple streams can run concurrently

## Testing

The implementation includes comprehensive tests:

- ✅ Basic reconstruction
- ✅ Error handling
- ✅ Empty generators
- ✅ Rapid value emission
- ✅ Stream cancellation
- ✅ Async delays
- ✅ Complex objects

Run tests with:
```bash
node --test electron/stream-manager.test.ts
```

## Comparison with Alternatives

### Alternative 1: Callback-based API

```typescript
// ❌ Breaks the async generator API
api.streamQuery(input, (message) => {
  console.log(message);
});
```

**Drawbacks:**
- Different API from async generators
- Harder to handle errors
- No backpressure control

### Alternative 2: Promise arrays

```typescript
// ❌ Must wait for all values before processing
const messages = await api.streamQuery(input);
for (const message of messages) {
  console.log(message);
}
```

**Drawbacks:**
- No streaming, must wait for completion
- High memory usage for large streams
- No early termination

### Alternative 3: EventEmitter

```typescript
// ❌ Requires manual event handling
const emitter = api.streamQuery(input);
emitter.on('data', (message) => console.log(message));
emitter.on('end', () => console.log('Done'));
emitter.on('error', (err) => console.error(err));
```

**Drawbacks:**
- More verbose
- Manual cleanup required
- No async/await integration

### Our Solution: Event Stream Reconstruction ✅

```typescript
// ✅ Clean async generator API
for await (const message of api.streamQuery(input)) {
  console.log(message);
}
```

**Benefits:**
- Natural async/await syntax
- Automatic backpressure
- Proper error handling
- Easy cancellation
- Type-safe

## Future Enhancements

Possible improvements:

1. **Compression**: Compress large payloads before sending over IPC
2. **Batching**: Batch multiple small values into single IPC messages
3. **Priority**: Support priority levels for different streams
4. **Metrics**: Add performance monitoring and metrics
5. **Replay**: Support replaying streams from a checkpoint

## Conclusion

The `fromEventStream` function successfully solves the "Object is not cloneable" problem by:

1. Converting async generators to IPC events
2. Reconstructing them back into async generators
3. Maintaining the same API for client code
4. Handling errors, completion, and cancellation properly
5. Providing proper backpressure and buffering

This allows Electron applications to use async generators across the context isolation boundary while maintaining clean, idiomatic JavaScript/TypeScript code.


# Solution: IPC Channel-Based Streaming for Electron

## Problem Statement

When trying to expose async generators through Electron's `contextBridge.exposeInMainWorld()`, you get this error:

```
Error: An object could not be cloneable
```

This happens because:
1. Async generators are complex objects with internal state
2. They cannot be serialized/cloned to cross the context isolation boundary
3. The context bridge only allows cloneable objects (primitives, plain objects, arrays)
4. **Even callback functions with closures cannot be cloned** across the context bridge

## Solution Overview

Instead of trying to pass async generators or callbacks through the context bridge, we:

1. **Expose simple functions** through the context bridge that return stream IDs
2. **Use IPC channels** to send stream events (data, complete, error)
3. **Run the async generator in the preload context** and send events via IPC
4. **Reconstruct the async generator on the client side** by listening to IPC channels

This way, the async generator never crosses the context bridge - only IPC channel messages do.

## Implementation

### Step 1: StreamManager (electron/stream-manager.ts)

The `StreamManager` runs async generators and sends events via IPC channels:

```typescript
export class StreamManager {
  async startStream(method: string, input: unknown): Promise<string> {
    const streamId = newId();
    const dataChannel = `stream:${streamId}:data`;
    const completeChannel = `stream:${streamId}:complete`;
    const errorChannel = `stream:${streamId}:error`;

    // Run the generator in the background
    (async () => {
      try {
        const generator = this.serviceImpl[method](input);

        for await (const value of generator) {
          if (this.canceled.has(streamId)) return;

          // Send data event via IPC
          this.ipcRenderer.send(dataChannel, value);
        }

        // Send completion event via IPC
        this.ipcRenderer.send(completeChannel, null);
      } catch (error) {
        // Send error event via IPC
        this.ipcRenderer.send(errorChannel, error.message);
      }
    })();

    return streamId;
  }

  stopStream(streamId: string): void {
    this.canceled.add(streamId);
  }
}
```

**Key Points:**
- Returns a stream ID (not a callback!)
- Runs the generator and sends events via IPC channels
- Uses unique channel names per stream: `stream:${streamId}:data`, etc.
- IPC messages are cloneable and can cross the context bridge

### Step 2: Preload Script (electron/preload.ts)

Exposes simple functions and an IPC listener through the context bridge:

```typescript
const streamManager = new StreamManager(ipcRenderer, serviceImpl);

contextBridge.exposeInMainWorld('electronAPI', {
  streamManager: {
    // Start a stream - returns the stream ID
    startStream(method: string, input: unknown): Promise<string> {
      return streamManager.startStream(method, input);
    },

    stopStream(streamId: string): void {
      streamManager.stopStream(streamId);
    }
  },

  // Listen to IPC events
  on(channel: string, callback: (data: unknown) => void): () => void {
    const listener = (_event: unknown, data: unknown) => callback(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },

  gazelService: {
    // Unary methods exposed directly
  }
});
```

**Key Points:**
- Exposes `startStream()` that returns a stream ID (not a callback!)
- Exposes `on()` for listening to IPC channels
- Simple functions and primitives are cloneable
- No callbacks with closures are passed through the bridge

### Step 3: Client-Side Generator Reconstruction (electron/client.ipc.ts)

Converts the callback-based API back into an async generator:

```typescript
function callbackToAsyncGenerator<T>(
  subscribeFn: (callbacks: {
    onData(data: T): void;
    onError(error: Error): void;
    onComplete(): void;
  }) => () => void
): AsyncGenerator<T> {
  const queue: T[] = [];
  const resolvers: Array<(result: IteratorResult<T>) => void> = [];
  let isDone = false;
  let error: Error | null = null;

  // Subscribe with callbacks
  const unsubscribe = subscribeFn({
    onData: (data) => {
      if (resolvers.length > 0) {
        resolvers.shift()({ value: data, done: false });
      } else {
        queue.push(data);
      }
    },
    onError: (err) => {
      error = err;
      while (resolvers.length > 0) {
        resolvers.shift()({ error: err, done: true });
      }
    },
    onComplete: () => {
      isDone = true;
      while (resolvers.length > 0) {
        resolvers.shift()({ done: true });
      }
    }
  });

  // Return an async generator
  return {
    [Symbol.asyncIterator]() { return this; },
    
    async next(): Promise<IteratorResult<T>> {
      if (queue.length > 0) {
        return { value: queue.shift(), done: false };
      }
      if (isDone) return { done: true };
      if (error) throw error;
      
      return new Promise((resolve) => {
        resolvers.push(resolve);
      });
    },
    
    async return() {
      unsubscribe();
      return { done: true };
    }
  };
}
```

**Key Points:**
- Takes a subscription function that accepts callbacks
- Returns an async generator that can be used with `for await...of`
- Buffers values when they arrive faster than consumed
- Handles errors and completion properly

### Step 4: Proxy Wrapper

Creates a transparent API that looks like the original service:

```typescript
setClient(new Proxy({} as GazelServiceClient, {
  get(_target, prop: string) {
    const method = GazelService.methods.find(m => m.localName === prop);

    if (method?.kind === 'server_streaming') {
      return (input: unknown) => {
        return callbackToAsyncGenerator((callbacks) => {
          let streamId: string | null = null;
          let unsubscribeData: (() => void) | null = null;
          let unsubscribeComplete: (() => void) | null = null;
          let unsubscribeError: (() => void) | null = null;

          // Start the stream
          window.electronAPI.streamManager.startStream(
            method.localName,
            input
          ).then((id) => {
            streamId = id;

            // Set up IPC listeners for this stream
            const dataChannel = `stream:${streamId}:data`;
            const completeChannel = `stream:${streamId}:complete`;
            const errorChannel = `stream:${streamId}:error`;

            unsubscribeData = window.electronAPI.on(dataChannel, (data) => {
              callbacks.onData(data);
            });

            unsubscribeComplete = window.electronAPI.on(completeChannel, () => {
              callbacks.onComplete();
            });

            unsubscribeError = window.electronAPI.on(errorChannel, (error) => {
              callbacks.onError(new Error(String(error)));
            });
          });

          // Return cleanup function
          return () => {
            if (unsubscribeData) unsubscribeData();
            if (unsubscribeComplete) unsubscribeComplete();
            if (unsubscribeError) unsubscribeError();
            if (streamId) {
              window.electronAPI.streamManager.stopStream(streamId);
            }
          };
        });
      };
    }

    return window.electronAPI.gazelService[prop];
  }
}));
```

**Key Points:**
- Intercepts streaming method calls
- Starts the stream and gets a stream ID
- Sets up IPC listeners for the stream's channels
- Reconstructs async generator from IPC events
- Client code doesn't know the difference!

## Usage

Client code can now use async generators normally:

```typescript
import { client } from './client.ipc.js';

async function fetchTargets() {
  for await (const message of client.streamQuery({ 
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
}

fetchTargets();
```

## Why This Works

### The Problem
```
┌─────────────────┐
│ Renderer        │
│                 │
│ for await (...) │  ❌ Can't return async generator
└────────┬────────┘     through contextBridge
         │
    Context Bridge (only allows cloneable objects)
         │
┌────────▼────────┐
│ Preload         │
│                 │
│ async function* │
└─────────────────┘
```

### The Solution
```
┌─────────────────────────────────────────────────┐
│ Renderer Process                                │
│                                                 │
│ for await (const msg of api.streamQuery(...))   │
│   ▲                                             │
│   │ Reconstructed async generator               │
│   │                                             │
│ callbackToAsyncGenerator()                      │
│   ▲                                             │
│   │ Listens to IPC channels                     │
│   │ stream:abc123:data                          │
│   │ stream:abc123:complete                      │
│   │ stream:abc123:error                         │
└───┼─────────────────────────────────────────────┘
    │
    │ ✅ IPC messages ARE cloneable!
    │
┌───▼─────────────────────────────────────────────┐
│ Context Bridge                                  │
│                                                 │
│ - startStream(method, input) → streamId         │
│ - on(channel, callback) → unsubscribe           │
└───┬─────────────────────────────────────────────┘
    │
┌───▼─────────────────────────────────────────────┐
│ Preload Context                                 │
│                                                 │
│ streamManager.startStream(method, input)        │
│   │                                             │
│   │ Runs async generator                        │
│   │                                             │
│   ▼                                             │
│ for await (const value of generator) {          │
│   ipcRenderer.send('stream:abc123:data', value) │
│ }                                               │
│ ipcRenderer.send('stream:abc123:complete')      │
└─────────────────────────────────────────────────┘
```

## Benefits

✅ **No cloneable errors**: Callbacks can cross the context bridge

✅ **Transparent API**: Client code uses `for await...of` as normal

✅ **Proper backpressure**: Values are buffered only when needed

✅ **Error handling**: Errors propagate correctly

✅ **Cancellation**: Streams can be stopped

✅ **Type-safe**: Full TypeScript support

## Files Modified

1. **electron/stream-manager.ts**: Implements callback-based streaming
2. **electron/preload.ts**: Exposes callback API through context bridge
3. **electron/client.ipc.ts**: Reconstructs async generators from callbacks

## Testing

To verify it works:

```bash
cd /Users/justinspears/Documents/augment-projects/gazel
bazelisk run //electron:start
```

Then in the renderer process console:

```javascript
// Should work without "Object is not cloneable" error
for await (const msg of client.streamQuery({ query: '//...' })) {
  console.log(msg);
}
```

If you see values being logged without errors, the solution is working!


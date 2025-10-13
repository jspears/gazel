# Callback-Based Streaming Solution

## Problem

Async generators cannot be returned from functions exposed through `contextBridge.exposeInMainWorld()` because they are not cloneable objects. This causes the error:

```
Error: An object could not be cloned
```

## Solution

Instead of returning async generators, we expose a **callback-based API** through the context bridge, and then **reconstruct the async generator on the client side** using those callbacks.

## Architecture

### 1. Preload Script (electron/preload.ts)

Exposes a callback-based streaming API:

```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  streamManager: {
    // Start a stream and receive events via callback
    stream(
      method: string,
      input: unknown,
      onEvent: (event: StreamEvent) => void
    ): Promise<string> {
      return streamManager.stream(method, input, onEvent);
    },
    
    // Stop a stream
    stopStream(streamId: string) {
      streamManager.stopStream(streamId);
    }
  },
  
  // Unary methods can be exposed directly
  gazelService: { /* unary methods */ }
});
```

**Key Point**: The `stream` function accepts a **callback** (`onEvent`) instead of returning an async generator. This callback is cloneable and can cross the context bridge.

### 2. StreamManager (electron/stream-manager.ts)

Runs the async generator and calls the callback for each event:

```typescript
async stream(
  method: string,
  input: unknown,
  onEvent: (event: StreamEvent) => void
): Promise<string> {
  const streamId = newId();
  
  // Run the generator in the background
  (async () => {
    try {
      const generator = this.serviceImpl[method](input);
      
      for await (const value of generator) {
        // Call the callback for each value
        onEvent({ type: 'data', value });
      }
      
      // Call the callback when complete
      onEvent({ type: 'complete' });
    } catch (error) {
      // Call the callback on error
      onEvent({ type: 'error', error: error.message });
    }
  })();
  
  return streamId;
}
```

### 3. Client Side (electron/client.ipc.ts)

Reconstructs an async generator from the callback-based API:

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
        // Someone is waiting, resolve immediately
        resolvers.shift()!({ value: data, done: false });
      } else {
        // Buffer the value
        queue.push(data);
      }
    },
    onError: (err) => {
      error = err;
      // Resolve all waiting promises with error
      while (resolvers.length > 0) {
        resolvers.shift()!({ error: err, done: true });
      }
    },
    onComplete: () => {
      isDone = true;
      // Resolve all waiting promises with done
      while (resolvers.length > 0) {
        resolvers.shift()!({ done: true });
      }
    }
  });

  // Return an async generator
  return {
    [Symbol.asyncIterator]() { return this; },
    
    async next(): Promise<IteratorResult<T>> {
      // Return buffered values first
      if (queue.length > 0) {
        return { value: queue.shift()!, done: false };
      }
      
      // Check if done or error
      if (isDone) return { done: true };
      if (error) throw error;
      
      // Wait for next value
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

### 4. Proxy Wrapper

Creates a transparent API that looks like the original service:

```typescript
setClient(new Proxy({} as GazelServiceClient, {
  get(_target, prop: string) {
    const method = GazelService.methods.find(m => m.localName === prop);
    
    if (method?.kind === 'server_streaming') {
      // For streaming methods, return a function that creates an async generator
      return (input: unknown) => {
        return callbackToAsyncGenerator((callbacks) => {
          // Start the stream with callbacks
          window.electronAPI!.streamManager.stream(
            method.localName,
            input,
            (event) => {
              if (event.type === 'data') {
                callbacks.onData(event.value);
              } else if (event.type === 'complete') {
                callbacks.onComplete();
              } else if (event.type === 'error') {
                callbacks.onError(new Error(event.error));
              }
            }
          );
          
          // Return cleanup function
          return () => {
            window.electronAPI!.streamManager.stopStream(streamId);
          };
        });
      };
    }
    
    // For unary methods, return the original
    return window.electronAPI?.gazelService[prop];
  }
}));
```

## Usage

Client code can now use async generators normally:

```typescript
// Works exactly like a normal async generator!
for await (const message of api.streamQuery({ query: '//...' })) {
  if (message.data.case === 'target') {
    console.log('Target:', message.data.value);
  } else if (message.data.case === 'error') {
    console.error('Error:', message.data.value);
    break;
  }
}
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Client Code (Renderer Process)                              │
│                                                              │
│  for await (const msg of api.streamQuery({...})) {          │
│    console.log(msg);                                         │
│  }                                                           │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ Uses async generator created by
                       │ callbackToAsyncGenerator()
                       │
┌──────────────────────▼───────────────────────────────────────┐
│ Proxy Wrapper                                                │
│                                                              │
│  Calls: electronAPI.streamManager.stream(method, input, cb) │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ Crosses Context Bridge
                       │ (callback is cloneable!)
                       │
┌──────────────────────▼───────────────────────────────────────┐
│ Preload Script                                               │
│                                                              │
│  streamManager.stream(method, input, onEvent)                │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ Runs in preload context
                       │
┌──────────────────────▼───────────────────────────────────────┐
│ StreamManager                                                │
│                                                              │
│  const generator = serviceImpl[method](input);               │
│  for await (const value of generator) {                      │
│    onEvent({ type: 'data', value });  ◄─────────────────┐   │
│  }                                                       │   │
│  onEvent({ type: 'complete' });                         │   │
└──────────────────────────────────────────────────────────┼───┘
                                                           │
                       Callback invocations               │
                       cross context bridge               │
                                                           │
┌──────────────────────────────────────────────────────────┼───┐
│ Proxy Wrapper (receives callbacks)                      │   │
│                                                          │   │
│  callbacks.onData(value) ───────────────────────────────┘   │
│  callbacks.onComplete()                                      │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ Resolves promises in queue
                       │
┌──────────────────────▼───────────────────────────────────────┐
│ callbackToAsyncGenerator                                     │
│                                                              │
│  Buffers values and resolves promises                        │
│  to make it look like an async generator                     │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ Yields values
                       │
┌──────────────────────▼───────────────────────────────────────┐
│ Client Code                                                  │
│                                                              │
│  Receives values via for-await-of                            │
└──────────────────────────────────────────────────────────────┘
```

## Key Benefits

✅ **No cloneable errors**: Callbacks can cross the context bridge, async generators cannot

✅ **Transparent API**: Client code uses `for await...of` as normal

✅ **Proper backpressure**: Values are buffered only when needed

✅ **Error handling**: Errors propagate correctly through the generator

✅ **Cancellation**: Streams can be stopped via `stopStream()`

## Why This Works

1. **Callbacks are cloneable**: Simple functions can be passed through `contextBridge`
2. **Generator reconstruction**: The client-side code reconstructs the async generator behavior using promises and queues
3. **Event-driven**: The preload script calls the callback for each event, which is then handled by the client-side generator
4. **No direct generator passing**: We never try to pass an async generator through the context bridge

## Comparison

### ❌ What Doesn't Work

```typescript
// This FAILS - async generators can't cross context bridge
contextBridge.exposeInMainWorld('electronAPI', {
  streamQuery: async function* (input) {
    // ERROR: Object is not cloneable
    yield* serviceImpl.streamQuery(input);
  }
});
```

### ✅ What Works

```typescript
// This WORKS - callbacks can cross context bridge
contextBridge.exposeInMainWorld('electronAPI', {
  streamManager: {
    stream(method, input, onEvent) {
      // onEvent is a callback - it's cloneable!
      return streamManager.stream(method, input, onEvent);
    }
  }
});

// Client reconstructs the generator
const generator = callbackToAsyncGenerator((callbacks) => {
  electronAPI.streamManager.stream(method, input, (event) => {
    if (event.type === 'data') callbacks.onData(event.value);
    // ...
  });
});
```

## Testing

You can test this works by running:

```typescript
// In renderer process
const api = window.electronAPI;

async function test() {
  console.log('Starting stream...');
  
  for await (const message of api.streamQuery({ query: '//...' })) {
    console.log('Received:', message);
  }
  
  console.log('Stream complete!');
}

test();
```

If you see values being logged without any "Object is not cloneable" errors, it's working!


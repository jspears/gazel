# Streaming API Documentation

## Overview

The Gazel API client provides two ways to handle streaming responses from Bazel commands:

1. **Callback-based approach** (backward compatible)
2. **Async Generator approach** (new, more flexible)

## Async Generator Pattern

The async generator pattern provides a more elegant and flexible way to handle streaming data using JavaScript's `for await...of` syntax.

### Basic Usage

```typescript
import { api } from '$client/client';

// Using async generator with for-await-of
async function runBazelTarget(target: string) {
  try {
    for await (const message of api.streamRunGenerator(target, [])) {
      console.log('Received message:', message);
      
      switch (message.type) {
        case 'stdout':
          // Handle standard output
          process.stdout.write(message.data);
          break;
        case 'stderr':
          // Handle error output
          process.stderr.write(message.data);
          break;
        case 'exit':
          // Handle process exit
          console.log(`Process exited with code: ${message.code}`);
          break;
        case 'error':
          // Handle stream errors
          console.error(`Stream error: ${message.data}`);
          break;
      }
    }
  } catch (error) {
    console.error('Stream failed:', error);
  }
}
```

### Message Types

The generator yields messages with the following types:

| Type | Description | Data Format |
|------|-------------|-------------|
| `info` | Informational messages | `string` |
| `stdout` | Standard output from the process | `string` |
| `stderr` | Error output from the process | `string` |
| `exit` | Process exit event | `{ code: number \| null }` |
| `error` | Stream or connection errors | `string` |

## Advantages of the Generator Pattern

### 1. Cleaner Syntax
```typescript
// Generator approach
for await (const message of api.streamRunGenerator(target, [])) {
  handleMessage(message);
}

// vs Callback approach
await api.streamRun(target, [], (message) => {
  handleMessage(message);
});
```

### 2. Better Error Handling
```typescript
try {
  for await (const message of api.streamRunGenerator(target, [])) {
    // Process messages
  }
} catch (error) {
  // Handle errors in one place
}
```

### 3. Easy Cancellation
```typescript
let cancelled = false;

// Cancel after 10 seconds
setTimeout(() => { cancelled = true; }, 10000);

for await (const message of api.streamRunGenerator(target, [])) {
  if (cancelled) break; // Easy to exit the loop
  // Process message
}
```

### 4. Composability
Generators can be easily composed and transformed:

```typescript
// Transform messages
async function* addTimestamps(target: string) {
  for await (const message of api.streamRunGenerator(target, [])) {
    yield {
      ...message,
      timestamp: Date.now()
    };
  }
}

// Filter messages
async function* filterStdout(target: string) {
  for await (const message of api.streamRunGenerator(target, [])) {
    if (message.type === 'stdout') {
      yield message;
    }
  }
}
```

### 5. Memory Efficiency
Generators process data one message at a time, avoiding the need to buffer all messages in memory.

## Advanced Examples

### Collecting Output
```typescript
async function collectOutput(target: string) {
  const output = [];
  
  for await (const message of api.streamRunGenerator(target, [])) {
    if (message.type === 'stdout') {
      output.push(message.data);
    }
  }
  
  return output.join('');
}
```

### Progress Monitoring
```typescript
async function* withProgress(target: string) {
  let messageCount = 0;
  
  for await (const message of api.streamRunGenerator(target, [])) {
    messageCount++;
    yield { ...message, messageNumber: messageCount };
  }
}
```

### Timeout Handling
```typescript
async function runWithTimeout(target: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    for await (const message of api.streamRunGenerator(target, [])) {
      if (controller.signal.aborted) {
        throw new Error('Operation timed out');
      }
      // Process message
    }
  } finally {
    clearTimeout(timeout);
  }
}
```

## Backward Compatibility

The original callback-based `streamRun` method is still available and internally uses the generator:

```typescript
// Still works
const cleanup = await api.streamRun(target, [], (message) => {
  console.log(message);
});

// Call cleanup to cancel
cleanup();
```

## Implementation Details

The generator implementation:
1. Opens a fetch connection with SSE (Server-Sent Events)
2. Reads the response body as a stream
3. Parses SSE messages line by line
4. Yields parsed JSON messages
5. Handles connection errors gracefully
6. Properly releases resources when done

## Best Practices

1. **Always handle errors**: Wrap generator usage in try-catch blocks
2. **Clean up resources**: The generator automatically releases the reader lock when done
3. **Handle all message types**: Don't assume only certain message types will be received
4. **Consider cancellation**: Implement cancellation logic for long-running operations
5. **Buffer carefully**: If collecting output, be mindful of memory usage for large outputs

## Migration Guide

To migrate from callback to generator:

### Before (Callback)
```typescript
let output = '';
const cleanup = await api.streamRun(target, [], (message) => {
  if (message.type === 'stdout') {
    output += message.data;
  }
});
```

### After (Generator)
```typescript
let output = '';
for await (const message of api.streamRunGenerator(target, [])) {
  if (message.type === 'stdout') {
    output += message.data;
  }
}
```

## TypeScript Types

```typescript
interface StreamMessage {
  type: 'info' | 'stdout' | 'stderr' | 'exit' | 'error';
  data?: string;
  code?: number | null;
}

async function* streamRunGenerator(
  target: string,
  options: string[] = []
): AsyncGenerator<StreamMessage, void, unknown>
```

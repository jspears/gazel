# streamJsonProto Implementation

## Overview

The `streamJsonProto` method provides real-time streaming of Bazel query results using the `streamed_jsonproto` output format. This allows for efficient processing of large query results without waiting for the entire query to complete.

## Features

- **Real-time streaming**: Results are yielded as they arrive from Bazel
- **Memory efficient**: Processes results incrementally instead of loading everything into memory
- **Multiple query types**: Supports `query`, `cquery`, and `aquery`
- **Error handling**: Properly handles and reports errors from the Bazel process
- **Line buffering**: Handles partial JSON objects that span multiple data chunks

## Method Signature

```typescript
async *streamJsonProto({ 
  query, 
  queryType = 'query' 
}: { 
  query: string; 
  queryType?: string;
}): AsyncGenerator<any, void, unknown>
```

### Parameters

- `query` (string, required): The Bazel query expression to execute
- `queryType` (string, optional): The type of query to run. Options:
  - `'query'` (default): Standard Bazel query
  - `'cquery'`: Configured query (includes configuration information)
  - `'aquery'`: Action query (includes build action information)

### Returns

An `AsyncGenerator` that yields parsed JSON objects from the Bazel output.

## How It Works

### 1. Process Spawning

The method uses `streamCommand` to spawn a Bazel process with the `--output=streamed_jsonproto` flag:

```typescript
const child = this.streamCommand(
  queryType,
  ['--output=streamed_jsonproto', query],
  onData,
  onError,
  onClose
);
```

### 2. Line Buffering

Since data arrives in chunks that may not align with line boundaries, the implementation maintains a buffer:

```typescript
buffer += data;
const lines = buffer.split('\n');
buffer = lines.pop() || ''; // Keep incomplete line in buffer
```

### 3. JSON Parsing

Each complete line is parsed as a JSON object:

```typescript
for (const line of lines) {
  const trimmedLine = line.trim();
  if (trimmedLine) {
    try {
      const jsonObj = JSON.parse(trimmedLine);
      pushResult(jsonObj);
    } catch (e) {
      console.error(`Failed to parse JSON line: ${trimmedLine}`, e);
    }
  }
}
```

### 4. Async Queue Pattern

The implementation uses a queue-based pattern to bridge the callback-based `streamCommand` with the async generator:

- **Queue**: Buffers results when they arrive faster than they're consumed
- **Promise resolution**: When the queue is empty, the generator waits for the next result
- **Completion signaling**: Tracks when the process has finished

## Usage Examples

### Basic Query

```typescript
import bazelService from './services/bazel.js';

for await (const result of bazelService.streamJsonProto({ 
  query: '//...',
  queryType: 'query' 
})) {
  console.log('Target:', result.rule?.name);
}
```

### CQuery (Configured Query)

```typescript
for await (const result of bazelService.streamJsonProto({ 
  query: 'deps(//app:main)',
  queryType: 'cquery' 
})) {
  console.log('Dependency:', result.rule?.name, result.rule?.ruleClass);
}
```

### AQuery (Action Query)

```typescript
for await (const result of bazelService.streamJsonProto({ 
  query: 'deps(//app:main)',
  queryType: 'aquery' 
})) {
  if (result.actions) {
    console.log('Action:', result.actions[0]?.mnemonic);
  }
}
```

### Collecting Results

```typescript
const results = [];
for await (const result of bazelService.streamJsonProto({ 
  query: '//server/...',
  queryType: 'query' 
})) {
  results.push(result);
}
console.log(`Collected ${results.length} targets`);
```

### Early Termination

```typescript
let count = 0;
for await (const result of bazelService.streamJsonProto({ 
  query: '//...',
  queryType: 'query' 
})) {
  console.log(result.rule?.name);
  if (++count >= 10) break; // Stop after 10 results
}
```

## JSON Object Structure

The structure of yielded objects depends on the query type:

### Query/CQuery Result

```json
{
  "type": "RULE",
  "rule": {
    "name": "//package:target",
    "ruleClass": "cc_library",
    "location": "//package:BUILD:10:1",
    "attribute": [
      {
        "name": "srcs",
        "stringListValue": ["file1.cc", "file2.cc"]
      },
      {
        "name": "deps",
        "stringListValue": ["//other:target"]
      }
    ]
  }
}
```

### AQuery Result

```json
{
  "actions": [
    {
      "targetId": "//package:target",
      "mnemonic": "CppCompile",
      "actionKey": "...",
      "inputDepSetIds": [...],
      "outputIds": [...]
    }
  ]
}
```

## Error Handling

The method handles several types of errors:

### Query Errors

```typescript
try {
  for await (const result of bazelService.streamJsonProto({ 
    query: 'invalid query',
    queryType: 'query' 
  })) {
    // Process results
  }
} catch (error) {
  console.error('Query failed:', error.message);
}
```

### Process Errors

If the Bazel process fails to start or crashes, the error is propagated to the caller.

### Parse Errors

Individual JSON parse errors are logged but don't stop the stream. This allows processing to continue even if some lines are malformed.

## Performance Considerations

### Memory Usage

- **Streaming**: Results are processed one at a time, keeping memory usage constant
- **Buffering**: Only incomplete lines are buffered, typically a few hundred bytes
- **Queue**: The queue only grows if results arrive faster than they're consumed

### Latency

- **First result**: Available as soon as Bazel outputs the first line
- **Subsequent results**: Yielded immediately as they're parsed
- **No batching delay**: Unlike batch processing, there's no wait for completion

### Throughput

For large queries (thousands of targets):
- **Batch processing**: Must wait for entire query to complete
- **Streaming**: Can start processing immediately and finish sooner

## Integration with Server

The `streamJsonProto` method can be used in gRPC streaming endpoints:

```typescript
async *streamQuery(
  request: StreamQueryRequest
): AsyncGenerator<StreamQueryResponse> {
  const { query, queryType } = request;
  
  for await (const jsonObj of bazelService.streamJsonProto({ 
    query, 
    queryType 
  })) {
    yield create(StreamQueryResponseSchema, {
      data: {
        case: "target",
        value: convertToProtoTarget(jsonObj)
      }
    });
  }
}
```

## Testing

Run the test file to verify the implementation:

```bash
# From the server directory
node --loader ts-node/esm services/bazel.test.ts
```

Or use the test functions programmatically:

```typescript
import { testSimpleQuery, testCQuery } from './services/bazel.test.js';

await testSimpleQuery();
await testCQuery();
```

## Comparison with Existing Methods

### `query()` method

- **Blocking**: Waits for entire query to complete
- **Memory**: Loads all results into memory
- **Use case**: Small queries or when you need all results at once

### `streamJsonProto()` method

- **Non-blocking**: Yields results as they arrive
- **Memory efficient**: Processes results incrementally
- **Use case**: Large queries, real-time updates, or when you need early results

## Future Enhancements

Potential improvements:

1. **Cancellation**: Support for aborting the query mid-stream
2. **Progress reporting**: Yield progress information alongside results
3. **Filtering**: Apply filters before yielding results
4. **Transformation**: Built-in transformation to proto format
5. **Caching**: Cache streamed results for subsequent queries

## References

- [Bazel Query Documentation](https://bazel.build/query/language)
- [Bazel CQuery Documentation](https://bazel.build/query/cquery)
- [Bazel AQuery Documentation](https://bazel.build/query/aquery)
- [Bazel Output Formats](https://bazel.build/query/language#output-formats)


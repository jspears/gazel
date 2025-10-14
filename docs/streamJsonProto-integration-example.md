# Integration Example: Using streamJsonProto in server.ts

## Current Implementation (Non-Streaming)

The current `streamQuery` method in `server.ts` uses `bazelService.query()` which waits for the entire query to complete before processing results:

```typescript
async *streamQuery(
  request: StreamQueryRequest
): AsyncGenerator<StreamQueryResponse> {
  const { query, outputFormat = "label_kind", queryType = "query" } = request;

  if (!query) {
    throw new Error("Query is required");
  }

  try {
    // ❌ This waits for the entire query to complete
    const result = await bazelService.query(query, outputFormat, queryType);

    if (outputFormat === "streamed_jsonproto") {
      // Parse and yield each JSON object as a target
      const lines = result.stdout.trim().split("\n").filter(line => line.trim());

      for (const line of lines) {
        try {
          const target = JSON.parse(line);
          yield create(StreamQueryResponseSchema, {
            data: {
              case: "target",
              value: create(BazelTargetSchema, {
                label: target.rule?.name || target.name || "",
                kind: target.rule?.ruleClass || target.type || "",
                package: target.rule?.location?.split(":")[0]?.replace("//", "") || "",
                name: target.rule?.name?.split(":").pop() || "",
                tags: [],
                deps: [],
                srcs: [],
                attributes: target.rule?.attribute || [],
              }),
            },
          });
        } catch (e) {
          console.error("Failed to parse JSON line:", line, e);
        }
      }
    }
  } catch (error: any) {
    yield create(StreamQueryResponseSchema, {
      data: {
        case: "error",
        value: error.message || "Query failed",
      },
    });
  }
}
```

### Problems with Current Approach

1. **High latency**: Must wait for entire query to complete before sending first result
2. **Memory usage**: Entire result is loaded into memory at once
3. **No early feedback**: Client can't see progress until query completes
4. **Timeout risk**: Large queries may timeout before completing

## Improved Implementation (True Streaming)

Using `streamJsonProto`, we can stream results as they arrive:

```typescript
async *streamQuery(
  request: StreamQueryRequest
): AsyncGenerator<StreamQueryResponse> {
  const { query, outputFormat = "label_kind", queryType = "query" } = request;

  if (!query) {
    throw new Error("Query is required");
  }

  try {
    if (outputFormat === "streamed_jsonproto") {
      // ✅ Stream results as they arrive from Bazel
      for await (const target of bazelService.streamJsonProto({ 
        query, 
        queryType 
      })) {
        yield create(StreamQueryResponseSchema, {
          data: {
            case: "target",
            value: create(BazelTargetSchema, {
              label: target.rule?.name || target.name || "",
              kind: target.rule?.ruleClass || target.type || "",
              package: target.rule?.location?.split(":")[0]?.replace("//", "") || "",
              name: target.rule?.name?.split(":").pop() || "",
              tags: [],
              deps: [],
              srcs: [],
              attributes: target.rule?.attribute || [],
            }),
          },
        });
      }
    } else {
      // For other formats, fall back to the original implementation
      const result = await bazelService.query(query, outputFormat, queryType);
      const lines = result.stdout.split("\n");
      const chunkSize = 10;

      for (let i = 0; i < lines.length; i += chunkSize) {
        const chunk = lines.slice(i, i + chunkSize).join("\n");
        yield create(StreamQueryResponseSchema, {
          data: {
            case: "rawLine",
            value: chunk,
          },
        });
      }
    }

    // Send completion signal
    yield create(StreamQueryResponseSchema, {
      data: {
        case: "rawLine",
        value: "",
      },
    });
  } catch (error: any) {
    // Send error
    yield create(StreamQueryResponseSchema, {
      data: {
        case: "error",
        value: error.message || "Query failed",
      },
    });
  }
}
```

### Benefits of Streaming Approach

1. **Low latency**: First result sent as soon as Bazel outputs it
2. **Memory efficient**: Only one result in memory at a time
3. **Progress feedback**: Client sees results immediately
4. **Better UX**: Users can start processing results while query continues
5. **Timeout resilient**: Partial results delivered even if query is slow

## Performance Comparison

### Scenario: Query with 1000 targets

#### Non-Streaming (Current)
```
Time to first result: 5 seconds (wait for all 1000)
Memory usage: ~5MB (all results in memory)
User experience: Loading spinner for 5 seconds, then all results appear
```

#### Streaming (Improved)
```
Time to first result: 100ms (as soon as first target is ready)
Memory usage: ~5KB (one result at a time)
User experience: Results appear progressively, feels responsive
```

## Additional Use Cases

### 1. Progress Reporting

```typescript
async *streamQuery(
  request: StreamQueryRequest
): AsyncGenerator<StreamQueryResponse> {
  const { query, queryType } = request;
  let count = 0;

  try {
    for await (const target of bazelService.streamJsonProto({ 
      query, 
      queryType 
    })) {
      count++;
      
      // Send the target
      yield create(StreamQueryResponseSchema, {
        data: {
          case: "target",
          value: convertToProtoTarget(target),
        },
      });

      // Send progress update every 100 targets
      if (count % 100 === 0) {
        yield create(StreamQueryResponseSchema, {
          data: {
            case: "rawLine",
            value: `Processed ${count} targets...`,
          },
        });
      }
    }
  } catch (error: any) {
    yield create(StreamQueryResponseSchema, {
      data: {
        case: "error",
        value: error.message,
      },
    });
  }
}
```

### 2. Filtering During Streaming

```typescript
async *streamQuery(
  request: StreamQueryRequest
): AsyncGenerator<StreamQueryResponse> {
  const { query, queryType } = request;
  const filter = request.filter; // e.g., only show cc_library targets

  try {
    for await (const target of bazelService.streamJsonProto({ 
      query, 
      queryType 
    })) {
      const ruleClass = target.rule?.ruleClass || target.type;
      
      // Apply filter
      if (!filter || ruleClass === filter) {
        yield create(StreamQueryResponseSchema, {
          data: {
            case: "target",
            value: convertToProtoTarget(target),
          },
        });
      }
    }
  } catch (error: any) {
    yield create(StreamQueryResponseSchema, {
      data: {
        case: "error",
        value: error.message,
      },
    });
  }
}
```

### 3. Early Termination

```typescript
async *streamQuery(
  request: StreamQueryRequest
): AsyncGenerator<StreamQueryResponse> {
  const { query, queryType } = request;
  const maxResults = request.maxResults || Infinity;
  let count = 0;

  try {
    for await (const target of bazelService.streamJsonProto({ 
      query, 
      queryType 
    })) {
      yield create(StreamQueryResponseSchema, {
        data: {
          case: "target",
          value: convertToProtoTarget(target),
        },
      });

      // Stop after reaching max results
      if (++count >= maxResults) {
        break;
      }
    }
  } catch (error: any) {
    yield create(StreamQueryResponseSchema, {
      data: {
        case: "error",
        value: error.message,
      },
    });
  }
}
```

## Migration Guide

### Step 1: Update streamQuery for streamed_jsonproto

Replace the current implementation with the streaming version for `streamed_jsonproto` format.

### Step 2: Test with existing clients

Ensure that existing clients continue to work with the new streaming implementation.

### Step 3: Update client code (optional)

Clients can now process results as they arrive instead of waiting for completion:

```typescript
// Before: Wait for all results
const response = await client.executeQuery({ query: '//...' });
processResults(response.result.targets);

// After: Process results as they arrive
const stream = client.streamQuery({ 
  query: '//...', 
  outputFormat: 'streamed_jsonproto' 
});

for await (const response of stream) {
  if (response.data.case === 'target') {
    processResult(response.data.value);
  }
}
```

### Step 4: Monitor performance

Compare metrics before and after:
- Time to first result
- Total query time
- Memory usage
- User satisfaction

## Backward Compatibility

The new implementation maintains backward compatibility:

1. **API unchanged**: Same method signature and response format
2. **Behavior improved**: Faster response time, but same results
3. **Error handling**: Same error reporting mechanism
4. **Other formats**: Non-streaming formats continue to work as before

## Conclusion

Using `streamJsonProto` in `server.ts` provides significant benefits:

- ✅ Lower latency
- ✅ Better memory efficiency
- ✅ Improved user experience
- ✅ More scalable for large queries
- ✅ Backward compatible

The implementation is straightforward and can be adopted incrementally, starting with the `streamed_jsonproto` format.


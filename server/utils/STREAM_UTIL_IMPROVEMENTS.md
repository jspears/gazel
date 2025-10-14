# Stream Utility Improvements

## Summary

Improved the `allCombinedStreamProcessor` function to fix race conditions and maintain correct stream index tracking.

## Problems with the Original Implementation

### 1. **Index Corruption Bug**
```typescript
// OLD CODE - BUGGY
while (promises.length > 0) {
    const result = await Promise.race(
        promises.map(async (p, idx) => ({ result: await p, idx }))
    );
    
    if (!result.result.done) {
        yield { index: result.idx, data: result.result.value };
        promises[result.idx] = streams[result.idx]?.next();
    } else {
        promises.splice(result.idx, 1);  // ❌ This breaks index mapping!
    }
}
```

**Problem**: When a stream completes and we `splice()` the array, all subsequent indices shift down. This causes:
- Wrong stream identification (stdout vs stderr confusion)
- Potential array access errors
- Lost or misattributed data

**Example Bug Scenario**:
```
Initial state:
  promises[0] = stdout stream
  promises[1] = stderr stream

If stdout completes first:
  promises.splice(0, 1)
  
Now:
  promises[0] = stderr stream  // ❌ Index changed!
  
Next iteration thinks index 0 is stdout, but it's actually stderr!
```

### 2. **Inefficient Promise Racing**
The old code created new wrapper promises on every iteration:
```typescript
promises.map(async (p, idx) => ({ result: await p, idx }))
```

This creates unnecessary promise overhead for every race operation.

### 3. **Array Mutation Issues**
Mutating the `promises` array while iterating can lead to subtle bugs and makes the code harder to reason about.

## New Implementation

### Key Improvements

1. **Stable Index Tracking with Maps**
```typescript
const activeStreams = new Map<number, AsyncGenerator<any>>();
const pendingPromises = new Map<number, Promise<IteratorResult<any>>>();
```

Using Maps instead of arrays ensures:
- Indices never change (they're map keys)
- No array splicing needed
- Clear separation between stream identity and active state

2. **Correct Stream Lifecycle Management**
```typescript
if (!result.done) {
    yield { index: idx, data: result.value };
    
    // Queue next iteration for this stream
    const stream = activeStreams.get(idx);
    if (stream) {
        pendingPromises.set(idx, stream.next());
    }
} else {
    // Stream completed, remove from active streams
    activeStreams.delete(idx);
}
```

3. **Efficient Promise Racing**
```typescript
const racePromises = Array.from(pendingPromises.entries()).map(
    async ([idx, promise]) => {
        const result = await promise;
        return { idx, result };
    }
);
```

Only races the currently pending promises, not all possible streams.

## How It Works

### Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│ Initialize                                              │
│ - Create generators for each readable stream           │
│ - Store in activeStreams Map (idx → generator)         │
│ - Create initial promises in pendingPromises Map       │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Main Loop (while pendingPromises.size > 0)             │
│                                                         │
│ 1. Race all pending promises                           │
│ 2. Get winner: { idx, result }                         │
│ 3. Remove from pendingPromises                         │
│                                                         │
│ 4. If result.done:                                     │
│    - Remove from activeStreams                         │
│    - Stream is finished                                │
│                                                         │
│ 5. If !result.done:                                    │
│    - Yield { index: idx, data: result.value }          │
│    - Queue next iteration: pendingPromises.set(...)    │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ Complete                                                │
│ - All streams have finished                            │
│ - pendingPromises is empty                             │
└─────────────────────────────────────────────────────────┘
```

### Example Execution

```typescript
// Two streams: stdout (index 0) and stderr (index 1)
const processor = allCombinedStreamProcessor(stdout, stderr);

// Initial state:
activeStreams = { 0 → stdout_gen, 1 → stderr_gen }
pendingPromises = { 0 → Promise<stdout_data>, 1 → Promise<stderr_data> }

// Iteration 1: stderr wins the race
yield { index: 1, data: "error message" }
pendingPromises = { 0 → Promise<stdout_data>, 1 → Promise<next_stderr> }

// Iteration 2: stdout wins
yield { index: 0, data: "output line 1" }
pendingPromises = { 0 → Promise<next_stdout>, 1 → Promise<next_stderr> }

// Iteration 3: stdout completes
activeStreams = { 1 → stderr_gen }  // stdout removed
pendingPromises = { 1 → Promise<next_stderr> }  // index 1 still correct!

// Iteration 4: stderr data
yield { index: 1, data: "final error" }  // ✅ Still index 1!

// Iteration 5: stderr completes
activeStreams = {}
pendingPromises = {}
// Loop exits
```

## Benefits

1. **Correctness**: Indices always map to the correct original stream
2. **Clarity**: Map-based approach is easier to understand
3. **Efficiency**: No unnecessary promise wrapping
4. **Maintainability**: Clear separation of concerns
5. **Robustness**: No array mutation bugs

## Usage

The function is used internally by `combinedStreamProcessor`:

```typescript
async function* combinedStreamProcessor(child: ChildProcess) {
    for await (const message of allCombinedStreamProcessor(child.stdout, child.stderr)) {
        yield {
            type: message.index == 0 ? 'stdout' : 'stderr',
            data: message.data,
        }
    }
}
```

This ensures that:
- `index 0` is always stdout
- `index 1` is always stderr
- Even if stdout finishes first, stderr remains at index 1

## Testing

To verify the fix works correctly, you can test scenarios like:

1. **Stdout finishes first**: Verify stderr still identified correctly
2. **Stderr finishes first**: Verify stdout still identified correctly
3. **Interleaved output**: Verify correct attribution of each line
4. **Empty streams**: Verify graceful handling
5. **Multiple streams**: Test with more than 2 streams

## Related Files

- `server/utils/stream-util.ts` - Main implementation
- `server/utils/stream-util.test.ts` - Tests (if they exist)
- `server/services/bazel.ts` - Uses this for Bazel command output


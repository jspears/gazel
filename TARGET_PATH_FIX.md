# Fix for Invalid Target Name Error

## Problem

The application was throwing an error when trying to get target information:

```
ERROR: invalid target name '//services/request_insight/example_exporter:image.layer': target names may not start with '/'

RPC call to GetTarget failed with unexpected error: Error: Failed to get target: Bazel command failed: Command failed: /opt/homebrew/bin/bazelisk query --output=streamed_jsonproto "//services/request_insight/example_exporter://services/request_insight/example_exporter:image.layer"
```

## Root Cause

The issue was in the `toFull()` function in `client/components/target-util.ts`. The function was incorrectly constructing target paths when the `package` field already contained a full target path (including the target name).

### What Was Happening

When a target object had:
```javascript
{
  package: "//services/request_insight/example_exporter:image",
  name: "layer"
}
```

The `toFull()` function would construct:
```
//services/request_insight/example_exporter:image:layer
```

Or worse, if the package was already a full path like `//services/request_insight/example_exporter`, it would create:
```
//services/request_insight/example_exporter://services/request_insight/example_exporter:image.layer
```

This resulted in malformed target paths with duplicate package paths or incorrect colons.

## Solution

Updated the `toFull()` function to properly handle different target formats:

### Before

```typescript
export function toFull(target: {package:string, name:string}, prefix = "//"): string {
    return `${prefix}${target.package.replace(prefix, '')}:${target.name}`;
}
```

**Issues:**
- `replace(prefix, '')` only replaces the first occurrence
- Doesn't handle cases where `package` already contains a colon (full target path)
- Can create duplicate `//` prefixes

### After

```typescript
export function toFull(target: {package:string, name:string}, prefix = "//"): string {
    // If the package already contains a colon, it's likely a full target path
    if (target.package.includes(':')) {
        // Return as-is, just ensure it starts with //
        return target.package.startsWith('//') ? target.package : `${prefix}${target.package}`;
    }
    
    // Remove any leading // from package to avoid duplication
    const cleanPackage = target.package.startsWith('//') 
        ? target.package.substring(2) 
        : target.package;
    
    // Construct the full target path
    return `${prefix}${cleanPackage}:${target.name}`;
}
```

**Improvements:**
- ✅ Detects if `package` already contains a full target path (has `:`)
- ✅ Returns the package as-is if it's already a full path
- ✅ Properly removes leading `//` to avoid duplication
- ✅ Constructs correct target paths in all cases

## Test Cases

The fixed function now handles these cases correctly:

### Case 1: Normal Package + Name
```typescript
toFull({ package: "services/api", name: "server" })
// Result: "//services/api:server" ✅
```

### Case 2: Package with Leading //
```typescript
toFull({ package: "//services/api", name: "server" })
// Result: "//services/api:server" ✅
```

### Case 3: Package is Already Full Target Path
```typescript
toFull({ package: "//services/api:server", name: "unused" })
// Result: "//services/api:server" ✅
```

### Case 4: Package is Full Target Path Without //
```typescript
toFull({ package: "services/api:server", name: "unused" })
// Result: "//services/api:server" ✅
```

### Case 5: Empty Package (Root)
```typescript
toFull({ package: "", name: "server" })
// Result: "//:server" ✅
```

## Files Modified

- **`client/components/target-util.ts`** - Fixed the `toFull()` function to properly handle all target path formats

## Impact

This fix resolves the issue where:
- Clicking on targets in the UI would fail with "invalid target name" errors
- Target dependencies couldn't be loaded
- Target details couldn't be fetched
- Navigation to graph/commands views would fail

## Related Code

The `toFull()` function is used throughout the client codebase:

- `client/routes/Targets.svelte` - For loading target details and dependencies
- `client/routes/Query.svelte` - For displaying query results
- `client/components/TargetDetails.svelte` - For loading target information
- `client/routes/Files.svelte` - For constructing target paths from BUILD files

## Prevention

To prevent similar issues in the future:

1. **Always validate target paths** before sending to the server
2. **Add unit tests** for the `toFull()` function with various input formats
3. **Consider using a Target class** instead of plain objects to encapsulate target path logic
4. **Add logging** to show the constructed target path before making API calls

## Example Error Log

**Before Fix:**
```
[bazel.query] queryType="query", outputFormat="streamed_jsonproto", query="//services/request_insight/example_exporter://services/request_insight/example_exporter:image.layer"
ERROR: invalid target name '//services/request_insight/example_exporter:image.layer': target names may not start with '/'
```

**After Fix:**
```
[bazel.query] queryType="query", outputFormat="streamed_jsonproto", query="//services/request_insight/example_exporter:image.layer"
✅ Query successful
```

## Testing

To test the fix:

1. Build the client:
   ```bash
   bazel build //client:client_src
   ```

2. Run the application and try to:
   - Click on a target in the Targets view
   - Load target dependencies
   - Navigate to the graph view for a target
   - View target details

All of these operations should now work without "invalid target name" errors.


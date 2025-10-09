# Refactor: getTargetsByFile → getRulesByFile

## Summary

Successfully refactored the `getTargetsByFile` RPC method to `getRulesByFile`, changing it to return Bazel `Rule` objects instead of custom `BazelTarget` objects. This provides more detailed and accurate information about rules defined in BUILD files.

## Changes Made

### 1. Protocol Buffer Definition (`proto/gazel.proto`)

**Added Import:**
```protobuf
import "src/main/protobuf/build.proto";
```

**Updated Messages:**
```protobuf
// Before
message GetTargetsByFileRequest {
  string file = 1;
}
message GetTargetsByFileResponse {
  string file = 1;
  int32 total = 2;
  repeated BazelTarget targets = 3;
}

// After
message GetRulesByFileRequest {
  string file = 1;
}
message GetRulesByFileResponse {
  string file = 1;
  repeated blaze_query.Rule rules = 2;
}
```

**Updated Service Definition:**
```protobuf
// Before
rpc GetTargetsByFile(GetTargetsByFileRequest) returns (GetTargetsByFileResponse);

// After
rpc GetRulesByFile(GetRulesByFileRequest) returns (GetRulesByFileResponse);
```

### 2. Proto BUILD Configuration (`proto/BUILD.bazel`)

**Added Dependency:**
```python
proto_library(
    name = "gazel_proto",
    srcs = gazel_srcs,
    visibility = ["//visibility:public"],
    deps = [
       "@com_google_protobuf//:any_proto",
       "@com_google_protobuf//:timestamp_proto",
       "//bzl-ts:build_proto",  # Added this
    ],
)
```

### 3. Server Implementation (`server/server.ts`)

**Updated Imports:**
```typescript
// Before
import {
  type GetTargetsByFileRequest,
  type GetTargetsByFileResponse,
  GetTargetsByFileResponseSchema,
} from "proto/gazel_pb.js";

// After
import {
  type GetRulesByFileRequest,
  type GetRulesByFileResponse,
  GetRulesByFileRequestSchema,
  GetRulesByFileResponseSchema,
} from "proto/gazel_pb.js";
```

**Renamed Method:**
```typescript
// Before
async getTargetsByFile(
  request: GetTargetsByFileRequest
): Promise<GetTargetsByFileResponse> {
  // ...
  return create(GetTargetsByFileResponseSchema, {
    file,
    rules,
  });
}

// After
async getRulesByFile(
  request: GetRulesByFileRequest
): Promise<GetRulesByFileResponse> {
  // ...
  return create(GetRulesByFileResponseSchema, {
    file,
    rules,
  });
}
```

**Updated getBuildFile Method:**
```typescript
// Before
const targetsByFile = await this.getTargetsByFile(
  create(GetTargetsByFileRequestSchema, { file: filePath })
);
const targets = targetsByFile.targets.map((item, index) => {
  return create(BuildFileTargetSchema, {
    ruleType: item.kind,
    name: item.name,
    line: Number(item.location?.split(":")[1]) || 0,
  })
});

// After
const rulesByFile = await this.getRulesByFile(
  create(GetRulesByFileRequestSchema, { file: filePath })
);
const targets = rulesByFile.rules.map((rule, index) => {
  return create(BuildFileTargetSchema, {
    ruleType: rule.ruleClass || '',
    name: rule.name?.split(':').pop() || '',
    line: Number(rule.location?.split(":")[1]) || 0,
  })
});
```

### 4. Server Tests (`server/server.test.ts`)

**Updated Test:**
```typescript
// Before
import { GetTargetsByFileRequestSchema } from "proto/index.js";

test('getTargetsByFile', async () => {
  const request = create(GetTargetsByFileRequestSchema, {
    file: 'app/BUILD.bazel'
  });
  const response = await service.getTargetsByFile(request);
  assert.equal(response.targets.length, 6);
});

// After
import { GetRulesByFileRequestSchema } from "proto/index.js";

test('getRulesByFile', async () => {
  const request = create(GetRulesByFileRequestSchema, {
    file: 'app/BUILD.bazel'
  });
  const response = await service.getRulesByFile(request);
  assert.equal(response.rules.length, 6);
});
```

### 5. Client UI (`client/routes/Files.svelte`)

**Updated State Variables:**
```typescript
// Before
let fileActions: BazelTarget[] = [];

// After
let fileRules: any[] = [];
```

**Updated API Call:**
```typescript
// Before
const result = await api.getTargetsByFile({file: fileName});
fileActions = result.targets;

// After
const result = await api.getRulesByFile({file: fileName});
fileRules = result.rules;
```

**Updated Display:**
```svelte
<!-- Before -->
{#if activeTab === 'actions'}
  File Actions ({fileActions.length})
{/if}

{#each fileActions as action}
  <div class="font-mono text-sm font-medium">{action.label}</div>
  {#if action.kind}
    <div class="text-xs text-muted-foreground mt-1">
      Type: {action.kind}
    </div>
  {/if}
{/each}

<!-- After -->
{#if activeTab === 'actions'}
  Rules Using This File ({fileRules.length})
{/if}

{#each fileRules as rule}
  <div class="font-mono text-sm font-medium">{rule.name}</div>
  {#if rule.ruleClass}
    <div class="text-xs text-muted-foreground mt-1">
      Type: {rule.ruleClass}
    </div>
  {/if}
  {#if rule.location}
    <div class="text-xs text-muted-foreground">
      Location: {rule.location}
    </div>
  {/if}
{/each}
```

## Benefits

### 1. **More Accurate Data**
- Returns actual Bazel `Rule` objects from the build graph
- Includes all rule attributes and metadata
- Consistent with Bazel's internal representation

### 2. **Better Type Safety**
- Uses generated protobuf types from Bazel's build.proto
- Eliminates custom `BazelTarget` type that was a subset of Rule
- Provides full access to rule properties

### 3. **Richer Information**
- Access to `ruleClass` (e.g., "cc_library", "py_binary")
- Full `location` information (file:line:column)
- All rule attributes available for future use
- Rule inputs, outputs, and dependencies

### 4. **Consistency**
- Aligns with other parts of the codebase that use Rule objects
- Uses the same types as Bazel's query output
- Reduces type conversions and mappings

## Rule Object Structure

The `blaze_query.Rule` type includes:

```typescript
interface Rule {
  name: string;              // Full target name (e.g., "//pkg:target")
  ruleClass: string;         // Rule type (e.g., "cc_library")
  location: string;          // Source location (e.g., "/path/BUILD:10:1")
  attribute: Attribute[];    // Rule attributes (srcs, deps, etc.)
  ruleInput: string[];       // Input files
  ruleOutput: string[];      // Output files
  defaultSetting: string[];  // Default settings
  // ... and more fields
}
```

## Testing

To verify the changes:

1. **Build the project:**
   ```bash
   bazel build //proto:index //server:server_ts //client:client_src
   ```

2. **Run the server:**
   ```bash
   bazel run //server:run
   ```

3. **Test in the UI:**
   - Navigate to the Files view
   - Select a source file (not a BUILD file)
   - Click on the "Rules Using This File" tab
   - Verify that rules are displayed with:
     - Rule name (full target path)
     - Rule class (type)
     - Location information

4. **Run tests:**
   ```bash
   bazel test //server:server_test
   ```

## Migration Notes

### For API Consumers

If you're consuming this API from other code:

1. **Update method name:**
   ```typescript
   // Before
   const response = await api.getTargetsByFile({file: "foo.cc"});
   
   // After
   const response = await api.getRulesByFile({file: "foo.cc"});
   ```

2. **Update response handling:**
   ```typescript
   // Before
   response.targets.forEach(target => {
     console.log(target.label, target.kind);
   });
   
   // After
   response.rules.forEach(rule => {
     console.log(rule.name, rule.ruleClass);
   });
   ```

3. **Access to more data:**
   ```typescript
   // Now you can access additional rule information
   response.rules.forEach(rule => {
     console.log('Rule:', rule.name);
     console.log('Type:', rule.ruleClass);
     console.log('Location:', rule.location);
     console.log('Attributes:', rule.attribute);
     console.log('Inputs:', rule.ruleInput);
     console.log('Outputs:', rule.ruleOutput);
   });
   ```

## Files Modified

- `proto/gazel.proto` - Updated RPC definition and messages
- `proto/BUILD.bazel` - Added build_proto dependency
- `server/server.ts` - Renamed method and updated implementation
- `server/server.test.ts` - Updated test to use new method
- `client/routes/Files.svelte` - Updated UI to display rules

## Backward Compatibility

⚠️ **Breaking Change**: This is a breaking change for any code that calls `getTargetsByFile`. All consumers must be updated to use `getRulesByFile` instead.

The old `GetTargetsByFileRequest` and `GetTargetsByFileResponse` types are no longer available after regenerating the proto files.

## Future Enhancements

With access to full Rule objects, we can now:

1. **Display rule attributes** - Show srcs, deps, visibility, etc.
2. **Navigate to dependencies** - Click on deps to view those rules
3. **Show rule outputs** - Display generated files
4. **Filter by rule class** - Show only certain types of rules
5. **Analyze rule relationships** - Build dependency graphs


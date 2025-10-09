# Consolidation: bzl-ts → proto

## Summary

Successfully consolidated the `bzl-ts` directory into the `proto` directory, moving all Bazel proto files, TypeScript bindings, and the fetch script into a single location. This simplifies the project structure and makes proto management more straightforward.

## Changes Made

### 1. **Moved Files**

**From `bzl-ts/` to `proto/`:**
- `bzl-ts/protos/` → `proto/bazel-protos/`
- `bzl-ts/scripts/fetch-protos.sh` → `proto/fetch-protos.sh`
- Created `proto/build_pb.ts` for easier importing

**Directory Structure:**
```
proto/
├── BUILD.bazel              # Updated with build_proto target
├── bazel-protos/            # Moved from bzl-ts/protos/
│   └── src/
│       └── main/
│           └── protobuf/
│               ├── build.proto
│               └── stardoc_output.proto
├── build_pb.ts              # Re-export for easier importing
├── fetch-protos.sh          # Moved from bzl-ts/scripts/
├── gazel.proto
├── index.ts                 # Updated exports
├── logging.proto
└── ...
```

### 2. **Updated proto/BUILD.bazel**

**Added build_proto target:**
```python
# Bazel build.proto and dependencies
proto_library(
    name = "build_proto",
    srcs = glob(["bazel-protos/src/**/*.proto"]),
    strip_import_prefix = "bazel-protos",
    visibility = ["//visibility:public"],
)

# TypeScript bindings for build.proto
ts_proto_library(
    name = "build_ts_proto",
    copy_files = False,
    node_modules = "//:node_modules",
    proto = ":build_proto",
    protoc_gen_options = {
        "import_extension": ".js",
    },
    visibility = ["//visibility:public"],
)

# TypeScript project for build_pb re-exports
ts_project(
    name = "build_pb",
    srcs = ["build_pb.ts"],
    tsconfig = ":tsconfig",
    deps = [
        ":build_ts_proto",
        "//:tsconfig",
    ],
    visibility = ["//visibility:public"],
)
```

**Updated gazel_proto dependency:**
```python
proto_library(
    name = "gazel_proto",
    srcs = gazel_srcs,
    visibility = ["//visibility:public"],
    deps = [
       "@com_google_protobuf//:any_proto",
       "@com_google_protobuf//:timestamp_proto",
       ":build_proto",  # Changed from //bzl-ts:build_proto
    ],
)
```

**Updated index target:**
```python
ts_project(
    name = "index",
    srcs = ["index.ts"],
    deps = [
        ":logging_ts_proto",
        ":gazel_ts_proto",
        ":build_pb",  # Added
        "//:tsconfig",
    ],
    visibility = ["//visibility:public"],
)
```

### 3. **Updated proto/fetch-protos.sh**

**Changed PROTO_DIR:**
```bash
# Before
PROTO_DIR="$SCRIPT_DIR/../protos"

# After
PROTO_DIR="$SCRIPT_DIR/bazel-protos"
```

### 4. **Created proto/build_pb.ts**

```typescript
// Re-export build.proto types for easier importing
export * from "proto/_virtual_imports/build_proto/src/main/protobuf/build_pb";
```

### 5. **Updated proto/index.ts**

```typescript
export * from './gazel_pb.js';
export * from './logging_pb.js';
// Note: build_pb.js is not exported here to avoid naming conflicts
// Import directly from 'proto/build_pb.js' when needed
```

**Rationale:** Both `gazel.proto` and `build.proto` define types like `QueryResult`, which would cause naming conflicts if both were exported from the same index file.

### 6. **Updated proto/gazel.proto**

**Fixed import path:**
```protobuf
// Before
import "../bzl-ts/protos/src/main/protobuf/build.proto";

// After
import "src/main/protobuf/build.proto";
```

### 7. **Updated server/BUILD.bazel**

**Changed dependencies:**
```python
# Before
deps = [
    "//bzl-ts:index",
    "//proto:index",
]

# After
deps = [
    "//proto:index",
    "//proto:build_pb",
]
```

**Updated js_binary data:**
```python
# Before
data = [
    "//bzl-ts:index",
    "//bzl-ts:build_ts_proto",
    "//proto:index",
]

# After
data = [
    "//proto:index",
    "//proto:build_pb",
    "//proto:build_ts_proto",
]
```

### 8. **Updated server/server.ts**

**Changed import path:**
```typescript
// Before
import { Rule, RuleSchema } from "bzl-ts/_virtual_imports/build_proto/src/main/protobuf/build_pb";

// After
import { Rule, RuleSchema } from "proto/_virtual_imports/build_proto/src/main/protobuf/build_pb";
```

### 9. **Removed bzl-ts Directory**

The entire `bzl-ts/` directory was removed after all files were moved and all references were updated.

## Benefits

### 1. **Simplified Structure**
- ✅ All proto files in one location
- ✅ Easier to understand project organization
- ✅ Reduced cognitive overhead

### 2. **Easier Maintenance**
- ✅ Single location for proto management
- ✅ Fetch script co-located with proto files
- ✅ Consistent naming and organization

### 3. **Better Discoverability**
- ✅ Developers know to look in `proto/` for all proto-related files
- ✅ No confusion about where Bazel protos live vs. application protos

### 4. **Cleaner Dependencies**
- ✅ All proto dependencies reference `//proto:*`
- ✅ No cross-directory dependencies between proto packages

## Import Patterns

### For Application Protos (gazel.proto, logging.proto)

```typescript
// Import from proto index
import { 
  GetWorkspaceInfoRequest,
  GetWorkspaceInfoResponse,
  // ... other types
} from "proto/index.js";
```

### For Bazel Build Protos (build.proto)

```typescript
// Import directly from build_pb to avoid conflicts
import { Rule, RuleSchema } from "proto/build_pb.js";

// Or use the virtual imports path directly
import { Rule, RuleSchema } from "proto/_virtual_imports/build_proto/src/main/protobuf/build_pb";
```

## Testing

All builds pass successfully:

```bash
✅ bazel build //proto:index
✅ bazel build //proto:build_proto
✅ bazel build //proto:build_ts_proto
✅ bazel build //server:server_ts
✅ bazel build //server:run
✅ bazel build //client:client_src
```

## Migration Notes

### For Developers

If you have local changes that reference `//bzl-ts:*`, update them to `//proto:*`:

**BUILD.bazel files:**
```python
# Before
deps = ["//bzl-ts:index"]

# After
deps = ["//proto:build_pb"]
```

**TypeScript imports:**
```typescript
// Before
import { Rule } from "bzl-ts/_virtual_imports/build_proto/src/main/protobuf/build_pb";

// After
import { Rule } from "proto/_virtual_imports/build_proto/src/main/protobuf/build_pb";
// Or
import { Rule } from "proto/build_pb.js";
```

### Fetching New Proto Files

To update Bazel proto files:

```bash
cd proto
./fetch-protos.sh
```

The script will download the latest proto files from the Bazel repository into `proto/bazel-protos/`.

## Files Modified

- `proto/BUILD.bazel` - Added build_proto targets
- `proto/fetch-protos.sh` - Updated PROTO_DIR path
- `proto/build_pb.ts` - Created for re-exports
- `proto/index.ts` - Updated exports (excluded build_pb to avoid conflicts)
- `proto/gazel.proto` - Fixed import path
- `server/BUILD.bazel` - Updated dependencies
- `server/server.ts` - Updated import path

## Files Moved

- `bzl-ts/protos/` → `proto/bazel-protos/`
- `bzl-ts/scripts/fetch-protos.sh` → `proto/fetch-protos.sh`

## Files Removed

- Entire `bzl-ts/` directory and all its contents

## Future Improvements

1. **Consider flattening proto structure** - Move `bazel-protos/src/main/protobuf/` files to `bazel-protos/` for simpler paths
2. **Add proto validation** - Ensure proto files are valid before committing
3. **Automate proto updates** - Create a Bazel rule to fetch protos automatically
4. **Document proto versioning** - Track which Bazel version the protos are from

## Conclusion

The consolidation successfully merged the `bzl-ts` directory into `proto`, creating a cleaner and more maintainable project structure. All builds pass, and the import patterns are well-documented for future development.


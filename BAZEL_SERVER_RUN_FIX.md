# Fix for `bazel run //server:run`

## Problem

The `bazel run //server:run` command was failing with the following error:

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '/private/var/tmp/_bazel_justinspears/.../bzl-ts/_virtual_imports/build_proto/src/main/protobuf/stardoc_output_pb' imported from .../build_pb.js
```

## Root Cause

The issue had two parts:

1. **Incorrect Dependencies**: The `server/BUILD.bazel` file was referencing `//:node_modules/@speajus/bzl-ts` which doesn't exist. The correct target is `//bzl-ts:index`.

2. **Missing `.js` Extensions**: The `ts_proto_library` rule was generating TypeScript/JavaScript files without `.js` extensions in their import statements. Node.js ESM requires explicit file extensions for relative imports.

## Solution

### 1. Fixed Dependencies in `server/BUILD.bazel`

**Changes:**
- Removed invalid `//:node_modules/@speajus/bzl-ts` references
- Changed to use `//bzl-ts:index` and `//bzl-ts:build_ts_proto`
- Removed unused `deps` variable
- Removed unused `swc` import

**Before:**
```python
deps = [
    "//:node_modules/@speajus/bzl-ts",  # ❌ Doesn't exist
    ...
]

ts_project(
    name = "server_ts",
    deps = [
        "//:node_modules/@speajus/bzl-ts",  # ❌ Doesn't exist
        ...
    ],
)
```

**After:**
```python
ts_project(
    name = "server_ts",
    deps = [
        "//bzl-ts:index",  # ✅ Correct target
        ...
    ],
)

js_binary(
    name = "run",
    data = [
        "//bzl-ts:index",
        "//bzl-ts:build_ts_proto",  # ✅ Include proto files
        ...
    ],
    ...
)
```

### 2. Added `.js` Extensions to Proto Imports in `bzl-ts/BUILD.bazel`

**Changes:**
- Added `protoc_gen_options` with `import_extension: ".js"` to the `ts_proto_library` rule

**Before:**
```python
ts_proto_library(
    name = "build_ts_proto",
    copy_files = False,
    node_modules = "//:node_modules",
    proto = ":build_proto",
    visibility = ["//visibility:public"],
)
```

**After:**
```python
ts_proto_library(
    name = "build_ts_proto",
    copy_files = False,
    node_modules = "//:node_modules",
    proto = ":build_proto",
    protoc_gen_options = {
        "import_extension": ".js",  # ✅ Add .js to imports
    },
    visibility = ["//visibility:public"],
)
```

This option tells `protoc-gen-es` to generate imports like:
```javascript
import { file_src_main_protobuf_stardoc_output } from "./stardoc_output_pb.js";
```

Instead of:
```javascript
import { file_src_main_protobuf_stardoc_output } from "./stardoc_output_pb";
```

## Files Modified

1. **`server/BUILD.bazel`**
   - Removed invalid dependency references
   - Fixed `ts_project` deps to use `//bzl-ts:index`
   - Added `//bzl-ts:build_ts_proto` to `js_binary` data
   - Removed unused imports and variables

2. **`bzl-ts/BUILD.bazel`**
   - Added `protoc_gen_options = { "import_extension": ".js" }` to `ts_proto_library`

## Verification

After the fix, `bazel run //server:run` successfully starts the server:

```bash
$ bazel run //server:run

INFO: Build completed successfully, 7 total actions
INFO: Running command line: bazel-bin/server/run_/run

════════════════════════════════════════════════════════════
       🚀  GAZEL SERVER STARTED 🚀
════════════════════════════════════════════════════════════

📍 Server URL:
   http://localhost:3002

📁 Bazel Workspace:
   /Users/justinspears/Documents/augment-projects/gazel

⚙️ Environment:
   development

────────────────────────────────────────────────────────────
✨ Ready to explore your Bazel workspace! ✨
────────────────────────────────────────────────────────────

📡 gRPC server ready using Connect protocol
   Available at: http://localhost:3002
   Protocol: Connect (gRPC-Web compatible)
```

## Technical Details

### Why `.js` Extensions Are Required

Node.js ESM (ECMAScript Modules) requires explicit file extensions for relative imports. This is different from CommonJS which allows extensionless imports. The TypeScript compiler and bundlers often handle this automatically, but when running directly with Node.js, the extensions must be present.

### Why `protoc_gen_options` Works

The `ts_proto_library` rule from `@aspect_rules_ts` uses `protoc-gen-es` to generate TypeScript/JavaScript code from proto files. The `protoc_gen_es` tool supports an `import_extension` option that adds the specified extension to all relative imports in the generated code.

This is the same approach used in the `buf.gen.yaml` configuration:

```yaml
plugins:
  - local: node_modules/@bufbuild/protoc-gen-es/bin/protoc-gen-es
    out: client/lib/api/generated
    opt:
      - target=ts
      - import_extension=.js  # Same option
```

### Alternative Approaches Considered

1. **Custom ESM Loader**: Tried creating a custom Node.js loader to handle extensionless imports, but this adds complexity and performance overhead.

2. **`copy_files = True`**: Tried enabling this option, but it requires `proto_srcs` to be set, which doesn't work with our setup.

3. **Patching Generated Files**: Could use a `genrule` to add `.js` extensions after generation, but this is fragile and harder to maintain.

The `protoc_gen_options` approach is the cleanest and most maintainable solution.

## Related Issues

- Node.js ESM requires explicit file extensions: https://nodejs.org/api/esm.html#mandatory-file-extensions
- protoc-gen-es `import_extension` option: https://github.com/bufbuild/protobuf-es/blob/main/docs/generated_code.md

## Future Improvements

Consider applying the same `import_extension` option to other `ts_proto_library` targets in the codebase for consistency:

- `//proto:gazel_ts_proto`
- `//proto:logging_ts_proto`

This would ensure all generated proto code follows the same pattern and works correctly with Node.js ESM.


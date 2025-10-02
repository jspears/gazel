# GazelServiceImpl Implementation

## Overview

The `GazelServiceImpl` class in `server/server.ts` implements the complete gRPC/Connect service for Gazel. This implementation extracts and consolidates the business logic from the Express route handlers into a single, cohesive service that can be used with Connect protocol.

## Implementation Details

### Service Methods

The implementation provides all 15 RPC methods defined in the `GazelService`:

#### Workspace Methods
- **getWorkspaceInfo()** - Returns detailed information about the current Bazel workspace
- **getCurrentWorkspace()** - Gets the currently configured workspace path
- **scanWorkspaces()** - Scans for available Bazel workspaces
- **switchWorkspace()** - Switches to a different Bazel workspace

#### Target Methods
- **listTargets()** - Lists all Bazel targets in the workspace
- **getTarget()** - Gets detailed information about a specific target
- **getTargetDependencies()** - Returns dependencies of a target
- **getTargetOutputs()** - Gets output files for a target
- **getReverseDependencies()** - Finds targets that depend on a given target
- **searchTargets()** - Searches for targets matching criteria

#### Query Methods
- **executeQuery()** - Executes a Bazel query and returns results
- **streamQuery()** - Streams query results (server streaming RPC)

#### Build Methods
- **buildTarget()** - Builds a specific target
- **streamBuild()** - Streams build events (server streaming RPC)

#### Module Methods
- **getModuleGraph()** - Returns the Bazel module dependency graph

### Key Features

1. **Protocol Buffer Integration**: All methods use proper protobuf message types with the `create()` function from `@bufbuild/protobuf`

2. **Service Dependencies**: The implementation uses:
   - `bazelService` - For executing Bazel commands
   - `parserService` - For parsing Bazel output
   - `config` - For workspace configuration

3. **Error Handling**: Each method includes proper error handling and meaningful error messages

4. **Streaming Support**: Implements async generators for streaming RPCs (`streamQuery` and `streamBuild`)

## Usage

### With Connect Server

```typescript
import { createConnectRouter } from "@connectrpc/connect";
import { GazelServiceImpl } from "./server.js";
import { GazelService } from "../proto/index.js";

const router = createConnectRouter();
router.service(GazelService, new GazelServiceImpl());
```

### With gRPC Server

```typescript
import { Server, ServerCredentials } from "@grpc/grpc-js";
import { GazelServiceImpl } from "./server.js";
import { GazelService } from "../proto/index.js";

const server = new Server();
server.addService(GazelService, new GazelServiceImpl());
server.bindAsync("0.0.0.0:50051", ServerCredentials.createInsecure(), () => {
  server.start();
});
```

### Direct Usage

```typescript
import { GazelServiceImpl } from "./server.js";
import { create } from "@bufbuild/protobuf";
import { GetWorkspaceInfoRequestSchema } from "../proto/gazel_pb.js";

const service = new GazelServiceImpl();
const request = create(GetWorkspaceInfoRequestSchema, {});
const response = await service.getWorkspaceInfo(request);
```

## Migration from Express Routes

The implementation consolidates logic from multiple Express route files:

| Express Route File | Service Methods |
|-------------------|-----------------|
| `routes/workspace.ts` | `getWorkspaceInfo`, `getCurrentWorkspace`, `scanWorkspaces`, `switchWorkspace` |
| `routes/targets.ts` | `listTargets`, `getTarget`, `getTargetDependencies`, `getTargetOutputs`, `getReverseDependencies`, `searchTargets` |
| `routes/query.ts` | `executeQuery`, `streamQuery` |
| `routes/commands.ts` | `buildTarget`, `streamBuild` |
| `routes/modules.ts` | `getModuleGraph` |

## Benefits

1. **Protocol Agnostic**: Can be used with Connect, gRPC, or gRPC-Web
2. **Type Safety**: Full TypeScript type safety with generated protobuf types
3. **Centralized Logic**: All business logic in one place
4. **Testable**: Easy to unit test individual methods
5. **Maintainable**: Clear separation of concerns

## Example Server

See `connect-example.ts` for a complete example of creating a Connect server with the GazelServiceImpl.

## Testing

Run the test script to verify the implementation:

```bash
cd server
npx tsx test-server.ts
```

This will test the core methods and verify they work correctly with your Bazel workspace.

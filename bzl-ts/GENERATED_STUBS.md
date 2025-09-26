# Generated TypeScript gRPC Stubs

This directory contains pre-generated TypeScript definitions for Bazel proto files.

## Generated Files

The `generated/` directory contains TypeScript interfaces and service definitions for:

- **build_event_stream.ts** - Build event stream protocol
  - Enums: `AbortReason`, `TestSize`, `TestStatus`, `Action`
  - Messages: `BuildEventId`, `BuildEvent`, `StreamId`, etc.
  - Service: `PublishBuildEventService`

- **remote_execution.ts** - Remote execution API v2
  - Messages: `Action`, `Command`, `Platform`, `Directory`, `FileNode`, etc.
  - Services: `Execution`, `ActionCache`, `ContentAddressableStorage`, `Capabilities`

- **command_line.ts** - Command line options
  - Messages: `CommandLine`, `CommandLineSection`, `ChunkList`, `Option`

- **invocation_policy.ts** - Invocation policy definitions
  - Enums: `AllowValues`, `DisallowValues`, `UseDefault`
  - Messages: `InvocationPolicy`, `FlagPolicy`, `SetValue`

- **analysis_v2.ts** - Analysis protocol v2
  - Messages: `CqueryResult`, `ConfiguredTarget`, `Target`, `Rule`

- **build.ts** - Build definitions
  - Messages: `Target`, `Rule`, `Attribute`, `FileTarget`, `PackageGroup`

## Usage

### Import TypeScript Interfaces

```typescript
import { 
  BuildEvent, 
  BuildEventId,
  TestStatus,
  AbortReason 
} from 'bzl-ts/generated/build_event_stream';

import {
  Action,
  Command,
  ExecuteRequest,
  ExecuteResponse
} from 'bzl-ts/generated/remote_execution';

// Use the TypeScript interfaces
const event: BuildEvent = {
  id: { /* ... */ },
  children: [],
  // ...
};

const action: Action = {
  commandDigest: { hash: 'abc123', sizeBytes: '1024' },
  inputRootDigest: { hash: 'def456', sizeBytes: '2048' },
  timeout: '60s',
  doNotCache: false
};
```

### Using with gRPC

```typescript
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import { PublishBuildEventService } from 'bzl-ts/generated/build_event_stream';

// Load the proto file
const packageDefinition = await protoLoader.load(
  'path/to/build_event_stream.proto',
  {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  }
);

const proto = grpc.loadPackageDefinition(packageDefinition);

// Create a client using the service definition
const client = new grpc.Client(
  'localhost:50051',
  grpc.credentials.createInsecure(),
  { 'grpc.service_config': JSON.stringify(PublishBuildEventService) }
);
```

## Regenerating Stubs

To regenerate the TypeScript stubs from updated proto files:

```bash
# 1. Fetch the latest proto files from Bazel repository
./scripts/fetch-protos.sh

# 2. Generate TypeScript stubs
node scripts/generate-simple-stubs.cjs
```

The simple stub generator parses proto files and generates TypeScript interfaces without requiring all proto dependencies to be present.

## Build with Bazel

The generated stubs can be built as a TypeScript library using Bazel:

```bash
bazel build //bzl-ts:proto_ts
```

This creates a compiled TypeScript library that can be used as a dependency in other Bazel targets.

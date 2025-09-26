# bzl-ts

TypeScript gRPC client generator for Bazel proto files.

## Overview

This package provides tools to generate TypeScript gRPC clients from Bazel's proto files, enabling TypeScript/Node.js applications to communicate with Bazel's gRPC services.

## Features

- Generate TypeScript clients from `.proto` files
- Support for Bazel's gRPC service definitions
- Type-safe client interfaces
- Batch generation for multiple proto files

## Usage

### As a Library

```typescript
import { generateGrpcClient } from 'bzl-ts';

await generateGrpcClient({
  protoPath: 'path/to/service.proto',
  outputDir: 'generated',
  packageName: 'my-service'
});
```

### As a CLI Tool

```bash
# Generate client for a single proto file
bazel run //bzl-ts:cli -- path/to/service.proto output/dir

# Generate clients for all proto files in a directory
bazel run //bzl-ts:cli -- path/to/proto/dir output/dir
```

### With Bazel

Add to your BUILD.bazel:

```python
load("//bzl-ts:defs.bzl", "generate_ts_grpc")

generate_ts_grpc(
    name = "my_grpc_client",
    proto = "@io_bazel//src/main/protobuf:build.proto",
    out = "generated/build_client.ts",
)
```

## Integration with Bazel Repository

This package is configured to work with the Bazel repository to generate TypeScript clients for Bazel's internal gRPC services. The MODULE.bazel file includes:

```python
git_repository(
    name = "io_bazel",
    remote = "https://github.com/bazelbuild/bazel.git",
    commit = "7.4.1",
)
```

## Generated Client Example

The generator creates TypeScript interfaces and client creation functions:

```typescript
import * as grpc from '@grpc/grpc-js';

export interface BuildServiceClient extends grpc.Client {
  executeBuild(
    request: BuildRequest,
    callback: grpc.requestCallback<BuildResponse>
  ): grpc.ClientUnaryCall;
  
  streamBuildEvents(
    request: BuildRequest
  ): grpc.ClientReadableStream<BuildEvent>;
}

export function createClient(
  address: string,
  credentials?: grpc.ChannelCredentials
): Promise<BuildServiceClient>;
```

## Development

```bash
# Install dependencies
pnpm install

# Build the package
bazel build //bzl-ts:bzl_ts

# Run tests
bazel test //bzl-ts:all
```

## License

Same as the parent Gazel project.

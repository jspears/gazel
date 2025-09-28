# gRPC Generated Client Integration

## Overview

The Gazel Electron application now uses **generated gRPC clients** from the bzl-ts package, providing type-safe communication with Bazel's native gRPC services including Build Event Protocol (BEP), Remote Execution API, and Content Addressable Storage (CAS).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Renderer Process                          │
├─────────────────────────────────────────────────────────────┤
│  Svelte App                                                  │
│  └── ElectronBazelClient                                    │
│      ├── BazelService (high-level API)                      │
│      └── BazelGrpcService (low-level gRPC)                  │
│          └── Generated from .proto files                     │
└──────────────────────────┼──────────────────────────────────┘
                           │
                    gRPC-over-IPC
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                     Main Process                             │
├─────────────────────────────────────────────────────────────┤
│  BazelIPCService                                            │
│  ├── BazelService handlers (high-level)                     │
│  └── BazelGrpcService handlers (low-level)                  │
│      └── Direct gRPC to Bazel daemon                        │
└──────────────────────────────────────────────────────────────┘
```

## Generated Types

### From `bzl-ts/generated/build_event_stream.ts`

```typescript
// Build Event Protocol types
export interface BuildEvent {
  id?: BuildEventId;
  children?: BuildEventId[];
  lastMessage?: boolean;
  payload?: {
    started?: BuildStarted;
    finished?: BuildFinished;
    targetComplete?: TargetComplete;
    actionExecuted?: ActionExecuted;
    testResult?: TestResult;
    // ... more event types
  };
}

export enum TestStatus {
  NO_STATUS = 0,
  PASSED = 1,
  FLAKY = 2,
  TIMEOUT = 3,
  FAILED = 4,
  // ...
}
```

### From `bzl-ts/generated/remote_execution.ts`

```typescript
// Remote Execution API v2 types
export interface ExecuteRequest {
  instanceName?: string;
  skipCacheLookup?: boolean;
  actionDigest?: Digest;
  executionPolicy?: ExecutionPolicy;
  resultsCachePolicy?: ResultsCachePolicy;
}

export interface ActionResult {
  outputFiles?: OutputFile[];
  outputFileSymlinks?: OutputSymlink[];
  outputDirectories?: OutputDirectory[];
  exitCode?: number;
  stdoutRaw?: Uint8Array;
  stdoutDigest?: Digest;
  stderrRaw?: Uint8Array;
  stderrDigest?: Digest;
  executionMetadata?: ExecutedActionMetadata;
}
```

### From `bzl-ts/generated/build.ts`

```typescript
// Query result types
export interface Target {
  type?: TargetType;
  rule?: Rule;
  sourceFile?: SourceFile;
  generatedFile?: GeneratedFile;
  packageGroup?: PackageGroup;
}

export interface Rule {
  name?: string;
  ruleClass?: string;
  location?: string;
  attribute?: Attribute[];
  ruleInput?: string[];
  ruleOutput?: string[];
  defaultSetting?: string[];
}
```

## Service Interfaces

### High-Level BazelService

```typescript
export interface BazelService {
  // Configuration
  setWorkspace(request: { workspace: string }): Promise<{ success: boolean; workspace: string }>;
  getWorkspace(): Promise<{ workspace: string }>;
  
  // Query operations
  query(request: { expression: string; options?: BuildOptions }): Promise<QueryResult>;
  cquery(request: { expression: string; options?: BuildOptions }): Promise<QueryResult>;
  aquery(request: { expression: string; options?: BuildOptions }): Promise<QueryResult>;
  
  // Build operations with streaming
  build(request: { targets: string[]; options?: BuildOptions }): Promise<BuildResult>;
  buildStream(request: { targets: string[]; options?: BuildOptions }): EventStream<BuildEvent>;
  
  // Test operations with streaming
  test(request: { targets: string[]; options?: TestOptions }): Promise<TestResult>;
  testStream(request: { targets: string[]; options?: TestOptions }): EventStream<BuildEvent>;
  
  // Remote execution (if configured)
  executeRemote?(request: ExecuteRequest): Promise<ExecuteResponse>;
  getCapabilities?(): Promise<ServerCapabilities>;
}
```

### Low-Level BazelGrpcService

```typescript
export interface BazelGrpcService {
  // Build Event Protocol
  publishBuildEvent(request: PublishBuildEventRequest): Promise<PublishBuildEventResponse>;
  publishBuildToolEventStream(): DuplexStream<BuildEvent, PublishBuildToolEventStreamResponse>;
  
  // Remote Execution API v2
  execute?(request: ExecuteRequest): ServerStream<ExecuteResponse>;
  waitExecution?(request: WaitExecutionRequest): ServerStream<ExecuteResponse>;
  getActionResult?(request: GetActionResultRequest): Promise<ActionResult>;
  updateActionResult?(request: UpdateActionResultRequest): Promise<ActionResult>;
  
  // Content Addressable Storage
  findMissingBlobs?(request: FindMissingBlobsRequest): Promise<FindMissingBlobsResponse>;
  batchUpdateBlobs?(request: BatchUpdateBlobsRequest): Promise<BatchUpdateBlobsResponse>;
  batchReadBlobs?(request: BatchReadBlobsRequest): Promise<BatchReadBlobsResponse>;
  getTree?(request: GetTreeRequest): ServerStream<GetTreeResponse>;
}
```

## Client Implementation

### ElectronBazelClient

```typescript
export class ElectronBazelClient extends BazelClientAdapter {
  private ipcClient: ElectronIPCClient | null = null;
  private service: BazelService | null = null;
  private grpcService: BazelGrpcService | null = null;

  async connect(): Promise<void> {
    // Create gRPC-over-IPC client
    this.ipcClient = new ElectronIPCClient(ipcRenderer);
    
    // Create low-level gRPC service client
    this.grpcService = createServiceClient<BazelGrpcService>(
      this.ipcClient,
      'BazelGrpcService',
      {
        publishBuildEvent: { type: 'unary' },
        publishBuildToolEventStream: { type: 'duplex' },
        execute: { type: 'serverStream' },
        // ... all methods defined
      }
    );
    
    // Create high-level service client
    this.service = createServiceClient<BazelService>(
      this.ipcClient,
      'BazelService',
      {
        query: { type: 'unary' },
        buildStream: { type: 'serverStream' },
        // ... all methods defined
      }
    );
  }
  
  getService(): BazelService {
    return this.service;
  }
  
  getGrpcService(): BazelGrpcService | null {
    return this.grpcService;
  }
}
```

## Usage Examples

### Basic Build with BEP Streaming

```typescript
const client = await getBazelClient();
const service = client.getService();

// Start a streaming build
const stream = service.buildStream({
  targets: ['//app:main'],
  options: {
    config: 'release',
    verbose: true
  }
});

// Handle build events
stream.on('data', (event: BuildEvent) => {
  if (event.payload?.started) {
    console.log('Build started:', event.payload.started);
  } else if (event.payload?.targetComplete) {
    console.log('Target complete:', event.payload.targetComplete);
  } else if (event.payload?.finished) {
    console.log('Build finished:', event.payload.finished);
  }
});

stream.on('end', () => {
  console.log('Build stream ended');
});
```

### Remote Execution

```typescript
const client = await getBazelClient();
const grpcService = client.getGrpcService();

if (grpcService?.execute) {
  // Execute action remotely
  const executeStream = grpcService.execute({
    instanceName: 'remote-default',
    actionDigest: {
      hash: 'abc123...',
      sizeBytes: 1024
    }
  });
  
  executeStream.on('data', (response: ExecuteResponse) => {
    console.log('Execution status:', response.metadata?.stage);
    
    if (response.done && response.result) {
      console.log('Exit code:', response.result.exitCode);
    }
  });
}
```

### Content Addressable Storage

```typescript
const grpcService = client.getGrpcService();

// Check for missing blobs
const missing = await grpcService.findMissingBlobs({
  instanceName: 'remote-default',
  blobDigests: [
    { hash: 'abc123', sizeBytes: 100 },
    { hash: 'def456', sizeBytes: 200 }
  ]
});

console.log('Missing blobs:', missing.missingBlobDigests);

// Upload missing blobs
if (missing.missingBlobDigests.length > 0) {
  const uploadResult = await grpcService.batchUpdateBlobs({
    instanceName: 'remote-default',
    requests: missing.missingBlobDigests.map(digest => ({
      digest,
      data: new Uint8Array([/* blob data */])
    }))
  });
  
  console.log('Upload results:', uploadResult.responses);
}
```

## Benefits

1. **Type Safety**: All gRPC types are generated from .proto files
2. **Full Protocol Support**: Complete BEP, Remote Execution, and CAS APIs
3. **Streaming**: Native support for all gRPC streaming patterns
4. **Performance**: Direct gRPC communication without HTTP overhead
5. **Compatibility**: Works with any Bazel-compatible remote execution service

## Future Enhancements

1. **Proto Updates**: Automatically regenerate types when .proto files change
2. **Service Discovery**: Auto-detect available gRPC services
3. **Metrics**: Add performance monitoring for gRPC calls
4. **Caching**: Implement client-side caching for query results
5. **Retry Logic**: Add automatic retry with exponential backoff

## Summary

The integration of generated gRPC clients provides a complete, type-safe implementation of Bazel's native protocols. This enables advanced features like remote execution, build event streaming, and content-addressable storage while maintaining the simplicity of the high-level API for common operations.

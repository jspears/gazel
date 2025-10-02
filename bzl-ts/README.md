# bzl-ts

TypeScript client library for interfacing with the Bazel daemon, providing full access to Bazel's build, query, and event streaming capabilities.

## Overview

bzl-ts is a comprehensive TypeScript client that interfaces with the Bazel daemon through multiple protocols:

- **Build Event Protocol (BEP)** - Real-time streaming of build events
- **gRPC APIs** - Remote Execution, Remote Caching, and Build Event Service
- **Command Server Protocol** - Direct daemon communication
- **CLI Wrapper** - Typed wrapper around Bazel CLI commands

## Features

- 🚀 **Full Bazel Daemon Integration** - Connect to existing local or remote Bazel daemons
- 📊 **Build Event Streaming** - Real-time build events with full TypeScript typing
- 🔍 **Query Capabilities** - Support for query, cquery, and aquery with typed results
- 🏗️ **Build Management** - Execute builds, tests, and runs with progress tracking
- 📈 **Performance Analysis** - Analyze build performance and action graphs
- 🔄 **File Watch Integration** - Watch for changes and trigger builds
- 🌐 **Remote Execution** - Support for remote build execution and caching
- 💾 **Server Lifecycle** - Manage Bazel server state (start/stop/restart)
- 🎯 **Proto Type Generation** - Generate TypeScript types from Bazel's internal proto definitions

## Installation

```bash
pnpm add bzl-ts
```

## Quick Start

```typescript
import { BazelClient } from 'bzl-ts';

// Connect to Bazel daemon
const bazel = new BazelClient({
  workspace: '/path/to/workspace',
  // Optional: connect to remote execution
  remote: {
    executor: 'grpc://remote-exec.example.com',
    cache: 'grpc://remote-cache.example.com'
  }
});

// Build a target with event streaming
const buildStream = bazel.buildStream('//app:main', {
  config: 'release',
  platforms: ['//platforms:linux']
});

buildStream.on('progress', (event) => {
  console.log(`Progress: ${event.message}`);
});

buildStream.on('targetComplete', (event) => {
  console.log(`Target ${event.label} completed: ${event.success}`);
});

await buildStream.wait();
```

## API Documentation

### Client Initialization

```typescript
const bazel = new BazelClient({
  workspace: string;           // Path to Bazel workspace
  outputBase?: string;         // Custom output base
  serverOpts?: {
    maxIdleSeconds?: number;   // Server idle timeout
    startupOpts?: string[];    // Additional startup options
  };
  remote?: {
    executor?: string;         // Remote execution endpoint
    cache?: string;           // Remote cache endpoint
    instanceName?: string;    // Remote instance name
  };
});
```

### Build Operations

```typescript
// Simple build (Promise-based)
const result = await bazel.build('//target:name', {
  config?: string;
  platforms?: string[];
  keepGoing?: boolean;
  jobs?: number;
});

// Build with event streaming
const stream = bazel.buildStream('//target:name', options);
stream.on('started', (event) => { /* ... */ });
stream.on('progress', (event) => { /* ... */ });
stream.on('targetComplete', (event) => { /* ... */ });
stream.on('testResult', (event) => { /* ... */ });
stream.on('finished', (event) => { /* ... */ });

// Test targets
const testResults = await bazel.test('//tests/...', {
  testFilter?: string;
  testTimeout?: number;
  nocache?: boolean;
});

// Run executable targets
const runResult = await bazel.run('//app:binary', ['--arg1', '--arg2']);
```

### Query Operations

```typescript
// Basic query
const deps = await bazel.query('deps(//app:main)');

// Configured query (cquery)
const configured = await bazel.cquery('//app:main', {
  config: 'release',
  output: 'proto'  // or 'json', 'text'
});

// Action query (aquery)
const actions = await bazel.aquery('//app:main', {
  includeCommandline: true,
  includeArtifacts: true
});

// Structured query API
const targets = await bazel.queryBuilder()
  .kind('java_library')
  .deps('//app:main')
  .except('//third_party/...')
  .execute();
```

### Build Event Protocol

```typescript
// Subscribe to all build events
const subscription = bazel.subscribeToBuildEvents();

subscription.on('buildEvent', (event: BuildEvent) => {
  switch(event.id.typeCase) {
    case 'started':
      console.log('Build started:', event.id.started);
      break;
    case 'targetCompleted':
      console.log('Target completed:', event.id.targetCompleted);
      break;
    case 'testResult':
      console.log('Test result:', event.id.testResult);
      break;
  }
});

// Connect to Build Event Service (BES)
const bes = bazel.connectToBES('grpc://bes.example.com');
await bes.publishBuildEvents(buildStream);
```

### Graph and Analysis

```typescript
// Get dependency graph
const graph = await bazel.getDependencyGraph('//app:main');
graph.nodes.forEach(node => {
  console.log(`${node.label}: ${node.ruleClass}`);
});

// Analyze build performance
const profile = await bazel.analyzeProfile('/path/to/profile.gz');
console.log('Critical path:', profile.criticalPath);
console.log('Slowest actions:', profile.slowestActions);

// Get action graph
const actionGraph = await bazel.getActionGraph('//app:main');
actionGraph.actions.forEach(action => {
  console.log(`${action.mnemonic}: ${action.duration}ms`);
});
```

### File Watching

```typescript
// Watch for changes and rebuild
const watcher = bazel.watch(['//app:main'], {
  onFileChange: (files) => {
    console.log('Files changed:', files);
  },
  debounceMs: 500
});

watcher.on('buildStarted', () => console.log('Rebuilding...'));
watcher.on('buildComplete', (result) => console.log('Build done:', result));

// Stop watching
watcher.stop();
```

### Server Management

```typescript
// Check server status
const status = await bazel.getServerStatus();
console.log('PID:', status.pid);
console.log('Uptime:', status.uptime);

// Restart server
await bazel.restartServer();

// Shutdown server
await bazel.shutdown();

// Clean build outputs
await bazel.clean({
  expunge: true  // Also clean cache
});
```

## Architecture

The client uses multiple communication channels:

1. **gRPC Channels** - For BEP, Remote Execution, and BES
2. **Command Protocol** - Direct daemon communication via domain sockets
3. **CLI Process** - Fallback for operations not available via protocols
4. **File System** - For reading build outputs and profiles

## Type Definitions

All Bazel protocol buffer messages are fully typed:

```typescript
import { 
  BuildEvent,
  BuildEventId,
  TestResult,
  ActionExecuted,
  TargetComplete,
  BuildMetrics
} from 'bzl-ts/types';
```

## Proto Generation from Bazel Internal Types

This project includes support for generating TypeScript types from Bazel's internal proto definitions without copying them into your project. This is achieved through a custom repository rule that fetches Bazel's source and exposes the proto files.

### Using Bazel Proto Types

```protobuf
// Import Bazel's internal proto types
import "src/main/protobuf/build.proto";
import "src/main/protobuf/spawn.proto";
import "src/main/java/com/google/devtools/build/lib/buildeventstream/proto/build_event_stream.proto";

message MyBazelInfo {
  build_event_stream.BuildEvent build_event = 1;
  tools.protos.ExecLogEntry.Spawn spawn_info = 2;
  blaze_query.Target target = 3;
}
```

### Build Commands

```bash
# Build proto with Bazel dependencies
bazel build //bzl-ts:bazel_example_proto
bazel build //bzl-ts:bazel_example_ts_proto

# Generated TypeScript files will be in:
# bazel-bin/bzl-ts/protos/*.{js,d.ts}
```

## Examples

See the `examples/` directory for complete examples:

- `basic-build.ts` - Simple build operations
- `event-streaming.ts` - Build event streaming
- `query-graph.ts` - Query and graph operations
- `remote-execution.ts` - Remote execution setup
- `watch-mode.ts` - File watching and auto-rebuild
- `performance-analysis.ts` - Build performance analysis
- `example-usage.ts` - Using generated Bazel proto types

## Contributing

See CONTRIBUTING.md for development setup and guidelines.

## License

Apache 2.0

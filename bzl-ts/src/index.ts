/**
 * bzl-ts - TypeScript client for Bazel daemon
 */

// Main client
export { BazelClient, BuildStream } from './client.js';
export type {
  BazelClientOptions,
  BuildOptions,
  QueryOptions,
  TestOptions
} from './client.js';

// Services
export { BuildEventService, BuildEventServiceClient } from './services/build-event-service.js';
export { RemoteExecutionService } from './services/remote-execution.js';
export { QueryService, QueryBuilder } from './services/query-service.js';
export { CommandServer } from './services/command-server.js';
export { FileWatcher } from './services/file-watcher.js';

// Electron IPC Transport
export {
  ElectronIPCServer,
  IPCMessageType,
  type IPCMessage,
  type UnaryHandler,
  type ServerStreamHandler,
  type ClientStreamHandler,
  type DuplexStreamHandler,
  type ServerStream,
  type ClientStream,
  type DuplexStream
} from './transports/electron-ipc-transport.js';

export {
  ElectronIPCClient,
  createServiceClient
} from './transports/electron-ipc-client.js';

// Types from generated proto definitions
export {
  buildEventStream,
  remoteExecution,
  commandLine,
  analysisV2,
  invocationPolicy,
  build
} from '../generated/index.js';

// Re-export commonly used types for convenience
export type BuildEvent = import('../generated').buildEventStream.BuildEvent;
export type BuildEventId = import('../generated').buildEventStream.BuildEventId;
export type TestStatus = import('../generated').buildEventStream.TestStatus;
export type Action = import('../generated').remoteExecution.Action;
export type Command = import('../generated').remoteExecution.Command;
export type Digest = import('../generated').remoteExecution.Digest;
export type ActionResult = import('../generated').remoteExecution.ActionResult;
export type ExecuteRequest = import('../generated').remoteExecution.ExecuteRequest;
export type ExecuteResponse = import('../generated').remoteExecution.ExecuteResponse;

// Query types
export type {
  DependencyGraph,
  GraphNode,
  GraphEdge,
  ActionGraph,
  Action as ActionNode,
  Artifact
} from './services/query-service.js';

// File watcher types
export type { FileWatcherOptions } from './services/file-watcher.js';

// Remote execution types
export type { RemoteExecutionOptions } from './services/remote-execution.js';

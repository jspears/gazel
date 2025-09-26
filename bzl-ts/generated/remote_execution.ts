/**
 * Generated TypeScript definitions for remote_execution
 * Package: build.bazel.remote.execution.v2
 * Auto-generated - do not edit directly
 */

import * as grpc from '@grpc/grpc-js';

// Enums
export enum OutputDirectoryFormat {
  TREE_ONLY = 0,
  DIRECTORY_ONLY = 1,
  TREE_AND_DIRECTORY = 2,
}

export enum Value {
  UNKNOWN = 0,
  CACHE_CHECK = 1,
  QUEUED = 2,
  EXECUTING = 3,
  COMPLETED = 4,
}

export enum Value2 {
  UNKNOWN = 0,
  SHA256 = 1,
  SHA1 = 2,
  MD5 = 3,
  VSO = 4,
  SHA384 = 5,
  SHA512 = 6,
  MURMUR3 = 7,
  m = 2,
}

export enum Value3 {
  UNKNOWN = 0,
  DISALLOWED = 1,
  ALLOWED = 2,
}

export enum Value4 {
  IDENTITY = 0,
  ZSTD = 1,
  DEFLATE = 2,
  BROTLI = 3,
}

// Message Types
export interface Action {
  command_digest?: any;
  input_root_digest?: any;
  timeout?: any;
  do_not_cache?: boolean;
  salt?: Uint8Array;
  platform?: any;
}

export interface Command {
  name?: string;
  value?: string;
}

export interface Platform {
  name?: string;
  value?: string;
}

export interface Directory {
  files?: any;
  directories?: any;
  symlinks?: any;
  node_properties?: any;
}

export interface NodeProperty {
  name?: string;
  value?: string;
}

export interface NodeProperties {
  properties?: any;
  mtime?: any;
  unix_mode?: any;
}

export interface FileNode {
  name?: string;
  digest?: any;
  is_executable?: boolean;
  node_properties?: any;
}

export interface DirectoryNode {
  name?: string;
  digest?: any;
}

export interface SymlinkNode {
  name?: string;
  target?: string;
  node_properties?: any;
}

export interface Digest {
  hash?: string;
  size_bytes?: string;
}

export interface ExecutedActionMetadata {
  worker?: string;
  queued_timestamp?: any;
  worker_start_timestamp?: any;
  worker_completed_timestamp?: any;
  input_fetch_start_timestamp?: any;
  input_fetch_completed_timestamp?: any;
  execution_start_timestamp?: any;
  execution_completed_timestamp?: any;
  virtual_execution_duration?: any;
  output_upload_start_timestamp?: any;
  output_upload_completed_timestamp?: any;
  auxiliary_metadata?: any;
}

export interface ActionResult {
  output_files?: any;
  output_file_symlinks?: any;
  output_symlinks?: any;
}

export interface OutputFile {
  path?: string;
  digest?: any;
  is_executable?: boolean;
  contents?: Uint8Array;
  node_properties?: any;
}

export interface Tree {
  root?: any;
  children?: any;
}

export interface OutputDirectory {
  path?: string;
  tree_digest?: any;
  is_topologically_sorted?: boolean;
  root_directory_digest?: any;
}

export interface OutputSymlink {
  path?: string;
  target?: string;
  node_properties?: any;
}

export interface ExecutionPolicy {
  priority?: number;
}

export interface ResultsCachePolicy {
  priority?: number;
}

export interface ExecuteRequest {
  instance_name?: string;
  skip_cache_lookup?: boolean;
  action_digest?: any;
  execution_policy?: any;
  results_cache_policy?: any;
  digest_function?: any;
  inline_stdout?: boolean;
  inline_stderr?: boolean;
  inline_output_files?: string;
}

export interface LogFile {
  digest?: any;
  human_readable?: boolean;
}

export interface ExecuteResponse {
  result?: any;
  cached_result?: boolean;
  status?: any;
  message?: string;
}

export interface ExecutionStage {
  [key: string]: any;
}

export interface ExecuteOperationMetadata {
  stage?: any;
  action_digest?: any;
  stdout_stream_name?: string;
  stderr_stream_name?: string;
  partial_execution_metadata?: any;
  digest_function?: any;
}

export interface WaitExecutionRequest {
  name?: string;
}

export interface GetActionResultRequest {
  instance_name?: string;
  action_digest?: any;
  inline_stdout?: boolean;
  inline_stderr?: boolean;
  inline_output_files?: string;
  digest_function?: any;
}

export interface UpdateActionResultRequest {
  instance_name?: string;
  action_digest?: any;
  action_result?: any;
  results_cache_policy?: any;
  digest_function?: any;
}

export interface FindMissingBlobsRequest {
  instance_name?: string;
  blob_digests?: any;
  digest_function?: any;
}

export interface FindMissingBlobsResponse {
  missing_blob_digests?: any;
}

export interface BatchUpdateBlobsRequest {
  digest?: any;
  data?: Uint8Array;
  compressor?: any;
}

export interface BatchUpdateBlobsResponse {
  digest?: any;
  status?: any;
}

export interface BatchReadBlobsRequest {
  instance_name?: string;
  digests?: any;
  acceptable_compressors?: any;
  digest_function?: any;
}

export interface BatchReadBlobsResponse {
  digest?: any;
  data?: Uint8Array;
  compressor?: any;
  status?: any;
}

export interface GetTreeRequest {
  instance_name?: string;
  root_digest?: any;
  page_size?: number;
  page_token?: string;
  digest_function?: any;
}

export interface GetTreeResponse {
  directories?: any;
  next_page_token?: string;
}

export interface SplitBlobRequest {
  instance_name?: string;
  blob_digest?: any;
  digest_function?: any;
}

export interface SplitBlobResponse {
  chunk_digests?: any;
}

export interface SpliceBlobRequest {
  instance_name?: string;
  blob_digest?: any;
  chunk_digests?: any;
  digest_function?: any;
}

export interface SpliceBlobResponse {
  blob_digest?: any;
}

export interface GetCapabilitiesRequest {
  instance_name?: string;
}

export interface ServerCapabilities {
  cache_capabilities?: any;
  execution_capabilities?: any;
  deprecated_api_version?: any;
  low_api_version?: any;
  high_api_version?: any;
}

export interface DigestFunction {
  m?: any;
}

export interface ActionCacheUpdateCapabilities {
  update_enabled?: boolean;
}

export interface PriorityCapabilities {
  min_priority?: number;
  max_priority?: number;
}

export interface SymlinkAbsolutePathStrategy {
  [key: string]: any;
}

export interface Compressor {
  [key: string]: any;
}

export interface CacheCapabilities {
  digest_functions?: any;
  action_cache_update_capabilities?: any;
  cache_priority_capabilities?: any;
  max_batch_total_size_bytes?: string;
  symlink_absolute_path_strategy?: any;
  supported_compressors?: any;
  supported_batch_update_compressors?: any;
  max_cas_blob_size_bytes?: string;
  blob_split_support?: boolean;
  blob_splice_support?: boolean;
}

export interface ExecutionCapabilities {
  digest_function?: any;
  exec_enabled?: boolean;
  execution_priority_capabilities?: any;
  supported_node_properties?: string;
  digest_functions?: any;
}

export interface ToolDetails {
  tool_name?: string;
  tool_version?: string;
}

export interface RequestMetadata {
  tool_details?: any;
  action_id?: string;
  tool_invocation_id?: string;
  correlated_invocations_id?: string;
  action_mnemonic?: string;
  target_id?: string;
  configuration_id?: string;
}

// Service Definitions
export interface ExecutionClient extends grpc.Client {
}

export interface ActionCacheClient extends grpc.Client {
  GetActionResult(request: GetActionResultRequest, callback: grpc.requestCallback<ActionResult>): grpc.ClientUnaryCall;
}

export interface ContentAddressableStorageClient extends grpc.Client {
  FindMissingBlobs(request: FindMissingBlobsRequest, callback: grpc.requestCallback<FindMissingBlobsResponse>): grpc.ClientUnaryCall;
}

export interface CapabilitiesClient extends grpc.Client {
  GetCapabilities(request: GetCapabilitiesRequest, callback: grpc.requestCallback<ServerCapabilities>): grpc.ClientUnaryCall;
}

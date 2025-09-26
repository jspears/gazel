/**
 * Generated TypeScript definitions for build_event_stream
 * Package: build_event_stream
 * Auto-generated - do not edit directly
 */

import * as grpc from '@grpc/grpc-js';

// Enums
export enum AbortReason {
  UNKNOWN = 0,
  USER_INTERRUPTED = 1,
  NO_ANALYZE = 8,
  NO_BUILD = 9,
  TIME_OUT = 2,
  REMOTE_ENVIRONMENT_FAILURE = 3,
  INTERNAL = 4,
  LOADING_FAILURE = 5,
  ANALYSIS_FAILURE = 6,
  SKIPPED = 7,
  INCOMPLETE = 10,
  OUT_OF_MEMORY = 11,
}

export enum TestSize {
  UNKNOWN = 0,
  SMALL = 1,
  MEDIUM = 2,
  LARGE = 3,
  ENORMOUS = 4,
}

export enum TestStatus {
  NO_STATUS = 0,
  PASSED = 1,
  FLAKY = 2,
  TIMEOUT = 3,
  FAILED = 4,
  INCOMPLETE = 5,
  REMOTE_FAILURE = 6,
  FAILED_TO_BUILD = 7,
  TOOL_HALTED_BEFORE_TESTING = 8,
}

export enum Action {
  UNKNOWN = 0,
  CREATE = 1,
  DELETE = 2,
}

// Message Types
export interface BuildEventId {
  details?: string;
}

export interface ProgressId {
  opaque_count?: number;
}

export interface BuildStartedId {
  [key: string]: any;
}

export interface UnstructuredCommandLineId {
  [key: string]: any;
}

export interface StructuredCommandLineId {
  command_line_label?: string;
}

export interface WorkspaceStatusId {
  [key: string]: any;
}

export interface OptionsParsedId {
  [key: string]: any;
}

export interface FetchId {
  url?: string;
}

export interface PatternExpandedId {
  pattern?: string;
}

export interface WorkspaceConfigId {
  [key: string]: any;
}

export interface BuildMetadataId {
  [key: string]: any;
}

export interface TargetConfiguredId {
  label?: string;
  aspect?: string;
}

export interface NamedSetOfFilesId {
  id?: string;
}

export interface ConfigurationId {
  id?: string;
}

export interface TargetCompletedId {
  label?: string;
  configuration?: any;
  aspect?: string;
}

export interface ActionCompletedId {
  primary_output?: string;
  label?: string;
  configuration?: any;
}

export interface UnconfiguredLabelId {
  label?: string;
}

export interface ConfiguredLabelId {
  label?: string;
  configuration?: any;
}

export interface TestResultId {
  label?: string;
  configuration?: any;
  run?: number;
  shard?: number;
  attempt?: number;
}

export interface TestProgressId {
  label?: string;
  configuration?: any;
  run?: number;
  shard?: number;
  attempt?: number;
  opaque_count?: number;
}

export interface TestSummaryId {
  label?: string;
  configuration?: any;
}

export interface TargetSummaryId {
  label?: string;
  configuration?: any;
}

export interface BuildFinishedId {
  [key: string]: any;
}

export interface BuildToolLogsId {
  [key: string]: any;
}

export interface BuildMetricsId {
  [key: string]: any;
}

export interface ConvenienceSymlinksIdentifiedId {
  [key: string]: any;
}

export interface ExecRequestId {
  [key: string]: any;
}

export interface Progress {
  stdout?: string;
  stderr?: string;
}

export interface Aborted {
  [key: string]: any;
}

export interface BuildStarted {
  uuid?: string;
  start_time_millis?: string;
  start_time?: any;
  build_tool_version?: string;
  options_description?: string;
  command?: string;
  working_directory?: string;
  workspace_directory?: string;
  server_pid?: string;
}

export interface WorkspaceConfig {
  local_exec_root?: string;
}

export interface UnstructuredCommandLine {
  args?: string;
}

export interface OptionsParsed {
  startup_options?: string;
  explicit_startup_options?: string;
  cmd_line?: string;
  explicit_cmd_line?: string;
  invocation_policy?: any;
  tool_tag?: string;
}

export interface Fetch {
  success?: boolean;
}

export interface WorkspaceStatus {
  key?: string;
  value?: string;
}

export interface BuildMetadata {
  [key: string]: any;
}

export interface Configuration {
  mnemonic?: string;
  platform_name?: string;
  cpu?: string;
  is_tool?: boolean;
}

export interface PatternExpanded {
  suite_label?: string;
  test_labels?: string;
}

export interface TargetConfigured {
  target_kind?: string;
  test_size?: any;
  tag?: string;
}

export interface File {
  path_prefix?: string;
  name?: string;
  uri?: string;
  contents?: Uint8Array;
  symlink_target_path?: string;
}

export interface NamedSetOfFiles {
  files?: any;
  file_sets?: any;
}

export interface ActionExecuted {
  success?: boolean;
  type?: string;
  exit_code?: number;
  stdout?: any;
  stderr?: any;
  label?: string;
  configuration?: any;
  primary_output?: any;
  command_line?: string;
  action_metadata_logs?: any;
  failure_detail?: any;
  start_time?: any;
  end_time?: any;
  strategy_details?: any;
}

export interface OutputGroup {
  name?: string;
  file_sets?: any;
  incomplete?: boolean;
}

export interface TargetComplete {
  success?: boolean;
  target_kind?: string;
  test_size?: any;
  output_group?: any;
  important_output?: any;
  directory_output?: any;
  tag?: string;
  test_timeout_seconds?: string;
  test_timeout?: any;
  failure_detail?: any;
}

export interface TestResult {
  status?: any;
  status_details?: string;
  cached_locally?: boolean;
  test_attempt_start_millis_epoch?: string;
  test_attempt_start?: any;
  test_attempt_duration_millis?: string;
  test_attempt_duration?: any;
  test_action_output?: any;
  warning?: string;
  timeout_seconds?: number;
  strategy?: string;
  cached_remotely?: boolean;
  exit_code?: number;
  hostname?: string;
  child?: any;
  name?: string;
  time_millis?: string;
  time?: any;
}

export interface ResourceUsage {
  name?: string;
  value?: string;
}

export interface TestProgress {
  uri?: string;
}

export interface TestSummary {
  overall_status?: any;
  total_run_count?: number;
  run_count?: number;
  attempt_count?: number;
  shard_count?: number;
  passed?: any;
  failed?: any;
  total_num_cached?: number;
  first_start_time_millis?: string;
  first_start_time?: any;
  last_stop_time_millis?: string;
  last_stop_time?: any;
  total_run_duration_millis?: string;
  total_run_duration?: any;
}

export interface TargetSummary {
  overall_build_success?: boolean;
  overall_test_status?: any;
}

export interface BuildFinished {
  name?: string;
  code?: number;
}

export interface AnomalyReport {
  was_suspended?: boolean;
}

export interface BuildMetrics {
  actions_created?: string;
  actions_created_not_including_aspects?: string;
  actions_executed?: string;
  mnemonic?: string;
  first_started_ms?: string;
  last_ended_ms?: string;
  system_time?: any;
  user_time?: any;
}

export interface RunnerCount {
  name?: string;
  count?: number;
  exec_kind?: string;
}

export interface MemoryMetrics {
  used_heap_size_post_build?: string;
  peak_post_gc_heap_size?: string;
  peak_post_gc_tenured_space_heap_size?: string;
  type?: string;
  garbage_collected?: string;
}

export interface TargetMetrics {
  targets_loaded?: string;
  targets_configured?: string;
  targets_configured_not_including_aspects?: string;
}

export interface PackageMetrics {
  packages_loaded?: string;
  package_load_metrics?: any;
}

export interface TimingMetrics {
  cpu_time_in_ms?: string;
  wall_time_in_ms?: string;
  analysis_phase_time_in_ms?: string;
  execution_phase_time_in_ms?: string;
}

export interface CumulativeMetrics {
  num_analyses?: number;
  num_builds?: number;
}

export interface ArtifactMetrics {
  size_in_bytes?: string;
  count?: number;
}

export interface BuildGraphMetrics {
  action_lookup_value_count?: number;
  action_lookup_value_count_not_including_aspects?: number;
  action_count?: number;
  action_count_not_including_aspects?: number;
  input_file_configured_target_count?: number;
  output_file_configured_target_count?: number;
  other_configured_target_count?: number;
  output_artifact_count?: number;
  post_invocation_skyframe_node_count?: number;
}

export interface WorkerMetrics {
  worker_id?: number;
  worker_ids?: number;
  process_id?: number;
  mnemonic?: string;
  is_multiplex?: boolean;
  is_sandbox?: boolean;
  is_measurable?: boolean;
  worker_key_hash?: string;
  collect_time_in_ms?: string;
  worker_memory_in_kb?: number;
  last_action_start_time_in_ms?: string;
}

export interface NetworkMetrics {
  bytes_sent?: string;
  bytes_recv?: string;
  packets_sent?: string;
  packets_recv?: string;
  peak_bytes_sent_per_sec?: string;
  peak_bytes_recv_per_sec?: string;
  peak_packets_sent_per_sec?: string;
  peak_packets_recv_per_sec?: string;
}

export interface WorkerPoolMetrics {
  worker_pool_stats?: any;
  hash?: number;
  mnemonic?: string;
  created_count?: string;
  destroyed_count?: string;
  evicted_count?: string;
}

export interface BuildToolLogs {
  log?: any;
}

export interface ConvenienceSymlinksIdentified {
  convenience_symlinks?: any;
}

export interface ConvenienceSymlink {
  [key: string]: any;
}

export interface ExecRequestConstructed {
  working_directory?: Uint8Array;
  argv?: Uint8Array;
  environment_variable?: any;
  environment_variable_to_clear?: Uint8Array;
  should_exec?: boolean;
}

export interface EnvironmentVariable {
  name?: Uint8Array;
  value?: Uint8Array;
}

export interface BuildEvent {
  id?: any;
  children?: any;
  last_message?: boolean;
  progress?: any;
  aborted?: any;
  started?: any;
  unstructured_command_line?: any;
  structured_command_line?: any;
  options_parsed?: any;
  workspace_status?: any;
  fetch?: any;
  configuration?: any;
  expanded?: any;
  configured?: any;
  action?: any;
  named_set_of_files?: any;
  completed?: any;
  test_result?: any;
  test_progress?: any;
  test_summary?: any;
  target_summary?: any;
  finished?: any;
  build_tool_logs?: any;
  build_metrics?: any;
  workspace_info?: any;
  build_metadata?: any;
  convenience_symlinks_identified?: any;
  exec_request?: any;
}

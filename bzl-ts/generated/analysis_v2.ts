/**
 * Generated TypeScript definitions for analysis_v2
 * Package: analysis
 * Auto-generated - do not edit directly
 */

import * as grpc from '@grpc/grpc-js';

// Message Types
export interface ActionGraphContainer {
  artifacts?: any;
  actions?: any;
  targets?: any;
  dep_set_of_files?: any;
  configuration?: any;
  aspect_descriptors?: any;
  rule_classes?: any;
  path_fragments?: any;
}

export interface Artifact {
  id?: number;
  path_fragment_id?: number;
  is_tree_artifact?: boolean;
}

export interface Action {
  target_id?: number;
  aspect_descriptor_ids?: number;
  action_key?: string;
  mnemonic?: string;
  configuration_id?: number;
  arguments?: string;
  environment_variables?: any;
  input_dep_set_ids?: number;
  output_ids?: number;
  discovers_inputs?: boolean;
  execution_info?: any;
  param_files?: any;
  primary_output_id?: number;
  execution_platform?: string;
  template_content?: string;
  substitutions?: any;
  file_contents?: string;
  unresolved_symlink_target?: string;
  is_executable?: boolean;
}

export interface Target {
  id?: number;
  label?: string;
  rule_class_id?: number;
}

export interface RuleClass {
  id?: number;
  name?: string;
}

export interface AspectDescriptor {
  id?: number;
  name?: string;
  parameters?: any;
}

export interface DepSetOfFiles {
  id?: number;
  transitive_dep_set_ids?: number;
  direct_artifact_ids?: number;
}

export interface Configuration {
  id?: number;
  mnemonic?: string;
  platform_name?: string;
  checksum?: string;
  is_tool?: boolean;
}

export interface KeyValuePair {
  key?: string;
  value?: string;
}

export interface ConfiguredTarget {
  target?: any;
  configuration?: any;
  configuration_id?: number;
}

export interface CqueryResult {
  results?: any;
  configurations?: any;
}

export interface ParamFile {
  exec_path?: string;
  arguments?: string;
}

export interface PathFragment {
  id?: number;
  label?: string;
  parent_id?: number;
}

/**
 * Generated TypeScript definitions for command_line
 * Package: command_line
 * Auto-generated - do not edit directly
 */

import * as grpc from '@grpc/grpc-js';

// Message Types
export interface CommandLine {
  command_line_label?: string;
  sections?: any;
}

export interface CommandLineSection {
  section_label?: string;
  chunk_list?: any;
  option_list?: any;
}

export interface ChunkList {
  chunk?: string;
}

export interface OptionList {
  option?: any;
}

export interface Option {
  combined_form?: string;
  option_name?: string;
  option_value?: string;
  effect_tags?: any;
  metadata_tags?: any;
}

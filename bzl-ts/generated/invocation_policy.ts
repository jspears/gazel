/**
 * Generated TypeScript definitions for invocation_policy
 * Package: blaze.invocation_policy
 * Auto-generated - do not edit directly
 */

import * as grpc from '@grpc/grpc-js';

// Enums
export enum Behavior {
  UNDEFINED = 0,
  ALLOW_OVERRIDES = 1,
  APPEND = 2,
  FINAL_VALUE_IGNORE_OVERRIDES = 3,
}

// Message Types
export interface InvocationPolicy {
  flag_policies?: any;
}

export interface FlagPolicy {
  flag_name?: string;
  commands?: string;
  set_value?: any;
  use_default?: any;
  disallow_values?: any;
  allow_values?: any;
}

export interface SetValue {
  flag_value?: string;
}

export interface UseDefault {
  [key: string]: any;
}

export interface DisallowValues {
  disallowed_values?: string;
  new_value?: string;
  use_default?: any;
}

export interface AllowValues {
  allowed_values?: string;
  new_value?: string;
  use_default?: any;
}

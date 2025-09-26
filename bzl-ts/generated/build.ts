/**
 * Generated TypeScript definitions for build
 * Package: blaze_query
 * Auto-generated - do not edit directly
 */

import * as grpc from '@grpc/grpc-js';

// Enums
export enum SymlinkBehavior {
  COPY = 1,
  DEREFERENCE = 2,
}

export enum Discriminator {
  INTEGER = 1,
  STRING = 2,
  LABEL = 3,
  OUTPUT = 4,
  STRING_LIST = 5,
  LABEL_LIST = 6,
  OUTPUT_LIST = 7,
  DISTRIBUTION_SET = 8,
  LICENSE = 9,
  STRING_DICT = 10,
  FILESET_ENTRY_LIST = 11,
  LABEL_LIST_DICT = 12,
  STRING_LIST_DICT = 13,
  BOOLEAN = 14,
  TRISTATE = 15,
  INTEGER_LIST = 16,
  UNKNOWN = 18,
  LABEL_DICT_UNARY = 19,
  SELECTOR_LIST = 20,
  LABEL_KEYED_STRING_DICT = 21,
  DEPRECATED_STRING_DICT_UNARY = 17,
}

export enum Tristate {
  NO = 0,
  YES = 1,
  AUTO = 2,
}

export enum Discriminator2 {
  RULE = 1,
  SOURCE_FILE = 2,
  GENERATED_FILE = 3,
  PACKAGE_GROUP = 4,
  ENVIRONMENT_GROUP = 5,
}

export enum AllowedRuleClasses {
  ANY = 1,
  SPECIFIED = 2,
}

// Message Types
export interface License {
  license_type?: string;
  exception?: string;
}

export interface StringDictEntry {
  key?: string;
  value?: string;
}

export interface LabelDictUnaryEntry {
  key?: string;
  value?: string;
}

export interface LabelListDictEntry {
  key?: string;
  value?: string;
}

export interface LabelKeyedStringDictEntry {
  key?: string;
  value?: string;
}

export interface StringListDictEntry {
  key?: string;
  value?: string;
}

export interface FilesetEntry {
  [key: string]: any;
}

export interface Attribute {
  STRING?: any;
  LABEL?: any;
  OUTPUT?: any;
  STRING_LIST?: any;
  LABEL_LIST?: any;
  OUTPUT_LIST?: any;
  DISTRIBUTION_SET?: any;
  LICENSE?: any;
  STRING_DICT?: any;
  FILESET_ENTRY_LIST?: any;
  LABEL_LIST_DICT?: any;
  STRING_LIST_DICT?: any;
  BOOLEAN?: any;
  TRISTATE?: any;
  INTEGER_LIST?: any;
  UNKNOWN?: any;
  LABEL_DICT_UNARY?: any;
  SELECTOR_LIST?: any;
  LABEL_KEYED_STRING_DICT?: any;
  DEPRECATED_STRING_DICT_UNARY?: any;
}

export interface SelectorEntry {
  label?: string;
}

export interface Selector {
  entries?: any;
  has_default_value?: boolean;
  no_match_error?: string;
}

export interface SelectorList {
  type?: any;
  elements?: any;
}

export interface Rule {
  name?: string;
  rule_class?: string;
  location?: string;
  attribute?: any;
  rule_input?: string;
  configured_rule_input?: any;
  rule_output?: string;
  default_setting?: string;
  DEPRECATED_public_by_default?: boolean;
  DEPRECATED_is_skylark?: boolean;
  skylark_environment_hash_code?: string;
  instantiation_stack?: string;
  definition_stack?: string;
}

export interface ConfiguredRuleInput {
  label?: string;
  configuration_checksum?: string;
  configuration_id?: number;
}

export interface RuleSummary {
  rule?: any;
  dependency?: any;
  location?: string;
}

export interface PackageGroup {
  name?: string;
  contained_package?: string;
  included_package_group?: string;
}

export interface EnvironmentGroup {
  name?: string;
  environment?: string;
  default?: string;
}

export interface SourceFile {
  name?: string;
  location?: string;
  subinclude?: string;
  package_group?: string;
  visibility_label?: string;
  feature?: string;
  license?: any;
  package_contains_errors?: boolean;
}

export interface GeneratedFile {
  name?: string;
  generating_rule?: string;
  location?: string;
}

export interface Target {
  [key: string]: any;
}

export interface QueryResult {
  target?: any;
}

export interface AllowedRuleClassInfo {
  SPECIFIED?: any;
}

export interface AttributeDefinition {
  name?: string;
  type?: any;
  mandatory?: boolean;
  allowed_rule_classes?: any;
  documentation?: string;
  allow_empty?: boolean;
  allow_single_file?: boolean;
  default?: any;
  executable?: boolean;
  configurable?: boolean;
  nodep?: boolean;
  cfg_is_host?: boolean;
}

export interface AttributeValue {
  int?: number;
  string?: string;
  bool?: boolean;
  list?: any;
  dict?: any;
  key?: string;
  value?: any;
}

export interface RuleDefinition {
  name?: string;
  attribute?: any;
  documentation?: string;
  label?: string;
}

export interface BuildLanguage {
  rule?: any;
}

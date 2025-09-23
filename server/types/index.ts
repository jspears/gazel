export interface Config {
  port: number;
  bazelWorkspace: string;
  bazelExecutable: string;
  cors: {
    origin: boolean | string[];
    credentials: boolean;
  };
  cache: {
    ttl: number;
    maxSize: number;
  };
}

export interface BazelTarget {
  type: string;
  name: string;
  class?: string;
  location?: string;
  attributes?: Record<string, any>;
  inputs?: string[];
  outputs?: string[];
  package?: string;
  target?: string;
  full?: string;
  ruleType?: string;
}

export interface BazelQueryResult {
  targets: BazelTarget[];
  total?: number;
  byPackage?: Record<string, BazelTarget[]>;
}

export interface WorkspaceInfo {
  workspace_path: string;
  workspace_name: string;
  workspace_file_exists: boolean;
  bazel_version: string;
  [key: string]: string | boolean | undefined;
}

export interface BuildFile {
  path: string;
  name: string;
  type: 'workspace' | 'build' | 'module';
}

export interface CommandResult {
  stdout: string;
  stderr: string;
}

export interface ParsedTarget {
  package?: string;
  target?: string;
  full: string;
  ruleType?: string;
}

export interface CachedQuery {
  data: CommandResult;
  timestamp: number;
}

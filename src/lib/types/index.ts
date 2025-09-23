export interface WorkspaceInfo {
  workspace_path: string;
  workspace_name: string;
  workspace_file_exists: boolean;
  bazel_version: string;
  [key: string]: any;
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

export interface BuildFile {
  path: string;
  name: string;
  type: 'workspace' | 'build';
  targets?: number;
}

export interface QueryTemplate {
  name: string;
  query: string;
  description: string;
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  description?: string;
  createdAt: string;
}

export interface CommandHistory {
  id: string;
  command: string;
  target: string;
  options: string[];
  timestamp: string;
  success: boolean;
  output?: string;
  error?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  loading?: boolean;
}

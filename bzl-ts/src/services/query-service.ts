/**
 * Query Service - Handles Bazel query, cquery, and aquery operations
 */

import { spawn } from 'child_process';
import { analysisV2, build } from '../../generated/index.js';

export interface QueryOptions {
  config?: string;
  output?: 'proto' | 'json' | 'text' | 'graph' | 'xml';
  universeScope?: string;
  keepGoing?: boolean;
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  ruleClass?: string;
  location?: string;
  attributes?: Record<string, any>;
}

export interface GraphEdge {
  from: string;
  to: string;
  type: 'dependency' | 'runtime' | 'host' | 'implicit';
}

export interface ActionGraph {
  actions: Action[];
  artifacts: Artifact[];
}

export interface Action {
  id: string;
  mnemonic: string;
  targetLabel?: string;
  commandLine?: string[];
  inputs: string[];
  outputs: string[];
  duration?: number;
}

export interface Artifact {
  id: string;
  path: string;
  isSource: boolean;
  owner?: string;
}

export class QueryService {
  constructor(private client: any) {}

  /**
   * Execute a Bazel query
   */
  async query(expression: string, options: QueryOptions = {}): Promise<any> {
    const args = ['query', expression];
    
    if (options.output) {
      args.push(`--output=${options.output}`);
    }
    if (options.universeScope) {
      args.push(`--universe_scope=${options.universeScope}`);
    }
    if (options.keepGoing) {
      args.push('--keep_going');
    }

    const result = await this.runQuery(args);
    return this.parseQueryResult(result, options.output || 'text');
  }

  /**
   * Execute a configured query (cquery)
   */
  async cquery(expression: string, options: QueryOptions = {}): Promise<any> {
    const args = ['cquery', expression];
    
    if (options.config) {
      args.push(`--config=${options.config}`);
    }
    if (options.output) {
      args.push(`--output=${options.output}`);
    }

    const result = await this.runQuery(args);
    return this.parseQueryResult(result, options.output || 'text');
  }

  /**
   * Execute an action query (aquery)
   */
  async aquery(expression: string, options: QueryOptions & {
    includeCommandline?: boolean;
    includeArtifacts?: boolean;
    includeSchedulingInfo?: boolean;
  } = {}): Promise<any> {
    const args = ['aquery', expression];
    
    if (options.config) {
      args.push(`--config=${options.config}`);
    }
    if (options.output) {
      args.push(`--output=${options.output}`);
    }
    if (options.includeCommandline) {
      args.push('--include_commandline');
    }
    if (options.includeArtifacts) {
      args.push('--include_artifacts');
    }
    if (options.includeSchedulingInfo) {
      args.push('--include_scheduling_info');
    }

    const result = await this.runQuery(args);
    return this.parseActionQueryResult(result, options.output || 'text');
  }

  /**
   * Get dependency graph for a target
   */
  async getDependencyGraph(target: string): Promise<DependencyGraph> {
    // Query for all dependencies
    const depsResult = await this.query(`deps(${target})`, { output: 'proto' });
    
    // Query for graph structure
    const graphResult = await this.query(`deps(${target})`, { output: 'graph' });
    
    return this.buildDependencyGraph(depsResult, graphResult);
  }

  /**
   * Get action graph for a target
   */
  async getActionGraph(target: string): Promise<ActionGraph> {
    const result = await this.aquery(target, {
      output: 'proto',
      includeCommandline: true,
      includeArtifacts: true
    });

    return this.buildActionGraph(result);
  }

  /**
   * Query builder for fluent API
   */
  queryBuilder(): QueryBuilder {
    return new QueryBuilder(this);
  }

  /**
   * Run a query command
   */
  private runQuery(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      const process = spawn('bazel', args, {
        cwd: this.client.workspace,
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';

      process.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('exit', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Query failed: ${stderr}`));
        }
      });
    });
  }

  /**
   * Parse query results based on output format
   */
  private parseQueryResult(result: string, format: string): any {
    switch (format) {
      case 'json':
        return JSON.parse(result);
      
      case 'proto':
        // Parse proto binary format
        return this.parseProtoQueryResult(result);
      
      case 'xml':
        // Parse XML format
        return this.parseXmlQueryResult(result);
      
      case 'graph':
        // Parse graph format
        return this.parseGraphQueryResult(result);
      
      case 'text':
      default:
        // Return as array of lines
        return result.trim().split('\n').filter(line => line.length > 0);
    }
  }

  /**
   * Parse action query results
   */
  private parseActionQueryResult(result: string, format: string): any {
    if (format === 'proto') {
      // Parse proto format for action query
      return this.parseProtoActionQueryResult(result);
    }
    return this.parseQueryResult(result, format);
  }

  /**
   * Parse proto format query result
   */
  private parseProtoQueryResult(data: string): build.QueryResult {
    // This would normally use protobuf deserialization
    // For now, return a mock structure
    return {
      target: []
    };
  }

  /**
   * Parse proto format action query result
   */
  private parseProtoActionQueryResult(data: string): analysisV2.ActionGraphContainer {
    // This would normally use protobuf deserialization
    // For now, return a mock structure
    return {
      artifacts: [],
      actions: [],
      targets: []
    };
  }

  /**
   * Parse XML query result
   */
  private parseXmlQueryResult(xml: string): any {
    // Simple XML parsing - in production would use a proper XML parser
    const targets: any[] = [];
    const targetMatches = xml.matchAll(/<target name="([^"]+)"[^>]*>/g);
    for (const match of targetMatches) {
      targets.push({ name: match[1] });
    }
    return targets;
  }

  /**
   * Parse graph format query result
   */
  private parseGraphQueryResult(graph: string): any {
    const nodes: string[] = [];
    const edges: Array<[string, string]> = [];
    
    const lines = graph.split('\n');
    for (const line of lines) {
      if (line.includes('->')) {
        const [from, to] = line.split('->').map(s => s.trim().replace(/"/g, ''));
        edges.push([from, to]);
        if (!nodes.includes(from)) nodes.push(from);
        if (!nodes.includes(to)) nodes.push(to);
      } else if (line.trim().startsWith('"')) {
        const node = line.trim().replace(/"/g, '').replace(';', '');
        if (!nodes.includes(node)) nodes.push(node);
      }
    }
    
    return { nodes, edges };
  }

  /**
   * Build dependency graph from query results
   */
  private buildDependencyGraph(targets: any, graphData: any): DependencyGraph {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];

    // Create nodes from targets
    for (const target of targets) {
      nodes.push({
        id: target.name || target,
        label: target.name || target,
        ruleClass: target.ruleClass,
        location: target.location
      });
    }

    // Create edges from graph data
    if (graphData.edges) {
      for (const [from, to] of graphData.edges) {
        edges.push({
          from,
          to,
          type: 'dependency'
        });
      }
    }

    return { nodes, edges };
  }

  /**
   * Build action graph from aquery results
   */
  private buildActionGraph(data: any): ActionGraph {
    const actions: Action[] = [];
    const artifacts: Artifact[] = [];

    // Parse actions
    if (data.actions) {
      for (const action of data.actions) {
        actions.push({
          id: action.id,
          mnemonic: action.mnemonic,
          targetLabel: action.targetId,
          commandLine: action.arguments,
          inputs: action.inputDepSetIds || [],
          outputs: action.outputIds || []
        });
      }
    }

    // Parse artifacts
    if (data.artifacts) {
      for (const artifact of data.artifacts) {
        artifacts.push({
          id: artifact.id,
          path: artifact.execPath,
          isSource: artifact.isTreeArtifact === false,
          owner: artifact.targetId
        });
      }
    }

    return { actions, artifacts };
  }
}

/**
 * Fluent query builder
 */
export class QueryBuilder {
  private parts: string[] = [];

  constructor(private service: QueryService) {}

  kind(ruleType: string): this {
    this.parts.push(`kind("${ruleType}", ...)`);
    return this;
  }

  deps(target: string): this {
    this.parts.push(`deps(${target})`);
    return this;
  }

  rdeps(target: string, depth?: number): this {
    if (depth) {
      this.parts.push(`rdeps(${target}, ${depth})`);
    } else {
      this.parts.push(`rdeps(${target})`);
    }
    return this;
  }

  filter(pattern: string): this {
    this.parts.push(`filter("${pattern}", ...)`);
    return this;
  }

  except(pattern: string): this {
    this.parts.push(`except(${pattern})`);
    return this;
  }

  async execute(options?: QueryOptions): Promise<any> {
    const expression = this.parts.join(' ');
    return this.service.query(expression, options);
  }
}

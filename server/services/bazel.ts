import { exec, spawn, ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { dirname, join } from 'node:path';
import { existsSync } from 'node:fs';
import config from '../config.js';
import type { CommandResult, CachedQuery, WorkspaceInfo } from '../types/index.js';

const execAsync = promisify(exec);

interface BazelError extends Error {
  command?: string;
  stdout?: string;
  stderr?: string;
  code?: number;
}

class BazelService {
  private workspace: string;
  private executable: string;
  private queryCache: Map<string, CachedQuery>;

  constructor() {
    this.workspace = config.bazelWorkspace;
    this.executable = config.bazelExecutable;
    this.queryCache = new Map();

    // If workspace is empty and we're running from a Bazel output directory,
    // try to find the actual workspace root
    if (!this.workspace || this.workspace.trim() === '') {
      this.workspace = this.findWorkspaceRoot();
    }
  }

  /**
   * Find the workspace root when running from a Bazel output directory
   */
  private findWorkspaceRoot(): string {
    const cwd = process.cwd();

    // Check if we're in a Bazel output directory
    if (cwd.includes('bazel-out') || cwd.includes('execroot')) {
      // Try to extract workspace from BUILD_WORKSPACE_DIRECTORY env var (set by bazel run)
      const workspaceDir = process.env.BUILD_WORKSPACE_DIRECTORY;
      if (workspaceDir) {
        console.log(`[BazelService] Detected workspace from BUILD_WORKSPACE_DIRECTORY: ${workspaceDir}`);
        return workspaceDir;
      }

      // Fallback: try to find WORKSPACE or MODULE.bazel file by walking up
      let dir = cwd;
      for (let i = 0; i < 10; i++) {
        const parentDir = dirname(dir);
        if (parentDir === dir) break; // Reached root
        dir = parentDir;

        try {
          if (existsSync(join(dir, 'MODULE.bazel')) ||
              existsSync(join(dir, 'WORKSPACE')) ||
              existsSync(join(dir, 'WORKSPACE.bazel'))) {
            console.log(`[BazelService] Found workspace root: ${dir}`);
            return dir;
          }
        } catch (e) {
          // Continue searching
        }
      }
    }

    // Default to current directory
    console.log(`[BazelService] Using current directory as workspace: ${cwd}`);
    return cwd;
  }

  /**
   * Execute a Bazel command
   */
  async execute(
    command: string | string[],
    args: string[] = [],
    options: Record<string, any> = {}
  ): Promise<CommandResult> {
    // Handle both old style (command as string) and new style (command as array)
    let finalArgs: string[];
    if (Array.isArray(command)) {
      // New style: entire command as array
      finalArgs = command;
    } else {
      // Old style: command + args
      finalArgs = [command, ...args];
    }

    // Add --noblock_for_lock to avoid waiting for locks from parent Bazel processes
    // This is important when running Bazel commands from within a Bazel-launched app
    // if (!finalArgs.includes('--noblock_for_lock')) {
    //   finalArgs.unshift('--noblock_for_lock');
    // }

    // Build command string with proper escaping
    const cmdStr = `${this.executable} ${finalArgs.map(arg => {
      // Skip escaping for flags that start with --
      if (arg.startsWith('--')) {
        return arg;
      }
      // Properly escape arguments that contain spaces or special characters
      if (arg.includes(' ') || arg.includes('(') || arg.includes(')') || arg.includes('@') || arg.includes(':')) {
        // If already quoted, remove quotes (we'll add them back properly)
        if (arg.startsWith('"') && arg.endsWith('"')) {
          arg = arg.slice(1, -1);
        }
        // Escape internal quotes and add outer quotes
        return `"${arg.replace(/"/g, '\\"')}"`;
      }
      return arg;
    }).join(' ')}`;

    console.log(`Executing: ${cmdStr} in ${this.workspace}`);
    try {
      const result = await execAsync(cmdStr, {
        cwd: this.workspace,
        maxBuffer: 100 * 1024 * 1024, // 100MB buffer - increased for large dependency graphs
        ...options
      });

      return result;
    } catch (error: any) {
      console.error(`Bazel command failed: ${error.message}`);
      const bazelError: BazelError = new Error(`Bazel command failed: ${error.message}`);
      bazelError.command = cmdStr;
      bazelError.stdout = error.stdout;
      bazelError.stderr = error.stderr;
      bazelError.code = error.code;
      throw bazelError;
    }
  }

  /**
   * Execute a Bazel query
   */
  async query(query: string, outputFormat: string = 'xml', queryType: string = 'query'): Promise<CommandResult> {
    // Ensure queryType has a valid value
    if (!queryType || queryType.trim() === '') {
      queryType = 'query';
    }

    const cacheKey = `${queryType}:${query}:${outputFormat}`;

    // Check cache
    if (this.queryCache.has(cacheKey)) {
      const cached = this.queryCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < config.cache.ttl) {
        console.log(`Using cached result for ${queryType}: ${query}`);
        return cached.data;
      }
    }

    // Build the full command array: [queryType, --output=format, query]
    const fullCommand = [
      queryType,
      `--output=${outputFormat}`,
      query  // Don't quote here - execute will handle it
    ];

    console.log(`[bazel.query] queryType="${queryType}", outputFormat="${outputFormat}", query="${query}"`);
    console.log(`[bazel.query] Building command: ${JSON.stringify(fullCommand)}`);
    const result = await this.execute(fullCommand);
    
    // Cache the result
    if (this.queryCache.size >= config.cache.maxSize) {
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey!);
    }
    
    this.queryCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });
    
    return result;
  }

  /**
   * Get Bazel version
   */
  async getBazelVersion(): Promise<string> {
    try {
      const result = await this.execute('version', []);

      // Parse version from output
      // Look for "Build label: X.X.X" which contains the actual Bazel version
      // or "bazel X.X.X" in simpler outputs
      const buildLabelMatch = result.stdout.match(/Build label:\s*([\d.]+(?:-\w+)?)/i);
      if (buildLabelMatch) {
        return buildLabelMatch[1];
      }

      // Fallback to looking for "bazel X.X.X" pattern
      const bazelMatch = result.stdout.match(/^bazel\s+([\d.]+(?:-\w+)?)/im);
      if (bazelMatch) {
        return bazelMatch[1];
      }

      // If neither pattern matches, try to find any version number on first line
      const lines = result.stdout.trim().split('\n');
      const firstLine = lines[0] || '';
      const versionMatch = firstLine.match(/([\d.]+(?:-\w+)?)/);

      return versionMatch ? versionMatch[1] : 'unknown';
    } catch (error) {
      console.error('Failed to get Bazel version:', error);
      return 'unknown';
    }
  }

  /**
   * Get workspace info
   */
  async getWorkspaceInfo(): Promise<Partial<WorkspaceInfo>> {
    try {
      const result = await this.execute('info', ['workspace']);
      const info: Record<string, string> = {};

      // Parse the output
      const lines = result.stdout.split('\n');
      for (const line of lines) {
        if (line.includes(':')) {
          const [key, value] = line.split(':').map(s => s.trim());
          info[key.toLowerCase().replace(/\s+/g, '_')] = value;
        }
      }

      return info;
    } catch (error) {
      console.error('Failed to get workspace info:', error);
      return {};
    }
  }

  /**
   * List all targets in the workspace
   */
  async listTargets(pattern: string = '//...'): Promise<CommandResult> {
    return this.query(pattern, 'label');
  }

  /**
   * Get target details
   */
  async getTargetInfo(target: string): Promise<CommandResult> {
    // Don't quote here - query method and execute will handle escaping
    return this.query(target, 'xml');
  }

  /**
   * Get target outputs (what files it produces)
   */
  async getTargetOutputs(target: string): Promise<CommandResult> {
    // Use cquery to get the actual output files
    // --output=files shows the output files
    // Don't add quotes here - execute will handle escaping
    return this.execute([
      'cquery',
      target,
      '--output=files'
    ]);
  }

  /**
   * Get target build info without actually building
   */
  async getTargetBuildInfo(target: string): Promise<CommandResult> {
    // Use build --nobuild --explain to get build info without building
    return this.execute([
      'build',
      target,
      '--nobuild',
      '--explain=/dev/stdout',
      '--verbose_explanations'
    ]);
  }

  /**
   * Get target dependencies
   */
  async getTargetDependencies(target: string, depth: number = 1): Promise<CommandResult> {
    // The target might already contain quotes or special characters
    // Let Bazel handle the escaping by passing it as-is in the query
    const query = depth === -1
      ? `deps(${target})`
      : `deps(${target}, ${depth})`;

    return this.query(query, 'streamed_jsonproto');
  }

  /**
   * Get reverse dependencies (what depends on this target)
   */
  async getReverseDependencies(target: string): Promise<CommandResult> {
    // Don't add quotes - let Bazel handle the target as-is
    return this.query(`rdeps(//..., ${target})`, 'streamed_jsonproto');
  }

  /**
   * Build a target
   */
  async build(target: string, options: string[] = []): Promise<CommandResult> {
    return this.execute('build', [target, ...options]);
  }

  /**
   * Test a target
   */
  async test(target: string, options: string[] = []): Promise<CommandResult> {
    return this.execute('test', [target, ...options]);
  }

  /**
   * Stream command output (for long-running commands)
   */
  streamCommand(
    command: string,
    args: string[] = [],
    onData?: (data: string) => void,
    onError?: (data: string) => void,
    onClose?: (code: number | null) => void
  ): ChildProcess {
    console.log(`Executing: ${this.executable} ${command} ${args.join(' ')} in ${this.workspace}`);

    // Don't use shell: true as it can cause issues with command parsing
    // Instead, pass the command and args directly to spawn
    const child = spawn(this.executable, [command, ...args], {
      cwd: this.workspace,
      env: { ...process.env },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    if (onData) {
      child.stdout?.on('data', (data: Buffer) => {
        onData(data.toString());
      });
    }

    if (onError) {
      child.stderr?.on('data', (data: Buffer) => {
        const errorStr = data.toString();
        onError(errorStr);
      });
    }

    if (onClose) {
      child.on('close', (code: number | null) => {
        onClose(code);
      });
    }


    return child;
  }

  /**
   * Clear query cache
   */
  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Update the workspace path dynamically
   */
  setWorkspace(newWorkspace: string): void {
    this.workspace = newWorkspace;
    this.clearCache();
  }
}

export default new BazelService();

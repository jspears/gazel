/**
 * BazelClient - Main TypeScript client for interfacing with Bazel daemon
 */

import { EventEmitter } from 'events';
import * as grpc from '@grpc/grpc-js';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs/promises';
import { 
  buildEventStream,
  remoteExecution,
  commandLine,
  analysisV2,
  build
} from '../generated/index.js';
import { BuildEventService } from './services/build-event-service.js';
import { RemoteExecutionService } from './services/remote-execution.js';
import { QueryService } from './services/query-service.js';
import { CommandServer } from './services/command-server.js';
import { FileWatcher } from './services/file-watcher.js';

export interface BazelClientOptions {
  workspace: string;
  outputBase?: string;
  serverOpts?: {
    maxIdleSeconds?: number;
    startupOpts?: string[];
  };
  remote?: {
    executor?: string;
    cas?: string;
    cache?: string;
    instanceName?: string;
    apiKey?: string;
    headers?: Record<string, string>;
  };
}

export interface BuildOptions {
  config?: string;
  platforms?: string[];
  keepGoing?: boolean;
  jobs?: number;
  verbose?: boolean;
  [key: string]: any;
}

export interface QueryOptions {
  config?: string;
  output?: 'proto' | 'json' | 'text' | 'graph';
  universeScope?: string;
}

export interface TestOptions extends BuildOptions {
  testFilter?: string;
  testTimeout?: number;
  nocache?: boolean;
  testOutput?: 'all' | 'errors' | 'summary';
}

export class BuildStream extends EventEmitter {
  private process?: ChildProcess;
  private bepService?: BuildEventService;
  
  constructor(
    private client: BazelClient,
    private targets: string | string[],
    private options: BuildOptions
  ) {
    super();
  }

  async start(): Promise<void> {
    // Start BEP service to receive events
    this.bepService = new BuildEventService();
    const bepPort = await this.bepService.start();

    // Build command with BEP flags
    const targetsArray = Array.isArray(this.targets) ? this.targets : [this.targets];
    const args = [
      'build',
      ...targetsArray,
      `--bes_backend=grpc://localhost:${bepPort}`,
      '--bes_results_url=',
      '--build_event_publish_all_actions'
    ];

    // Add options
    if (this.options.config) {
      args.push(`--config=${this.options.config}`);
    }
    if (this.options.platforms) {
      args.push(...this.options.platforms.map(p => `--platforms=${p}`));
    }
    if (this.options.keepGoing) {
      args.push('--keep_going');
    }
    if (this.options.jobs) {
      args.push(`--jobs=${this.options.jobs}`);
    }

    // Subscribe to BEP events
    this.bepService.on('buildEvent', (event: buildEventStream.BuildEvent) => {
      this.handleBuildEvent(event);
    });

    // Start build process
    this.process = spawn('bazelisk', args, {
      cwd: this.client.workspace,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    this.process.stdout?.on('data', (data) => {
      this.emit('stdout', data.toString());
    });

    this.process.stderr?.on('data', (data) => {
      this.emit('stderr', data.toString());
    });

    this.process.on('exit', (code) => {
      this.emit('exit', code);
      this.cleanup();
    });
  }

  private handleBuildEvent(event: buildEventStream.BuildEvent): void {
    if (!event.id) return;

    // Emit specific events based on event type
    if (event.id.started) {
      this.emit('started', event);
    } else if (event.id.progress) {
      this.emit('progress', {
        message: event.progress?.stderr || event.progress?.stdout || ''
      });
    } else if (event.id.targetCompleted) {
      this.emit('targetComplete', {
        label: event.id.targetCompleted.label,
        success: event.completed?.success || false,
        outputs: event.completed?.outputGroup || []
      });
    } else if (event.id.testResult) {
      this.emit('testResult', {
        label: event.id.testResult.label,
        status: event.testResult?.status,
        cached: event.testResult?.cachedLocally || false
      });
    } else if (event.id.buildFinished) {
      this.emit('finished', {
        success: event.finished?.exitCode?.code === 0,
        exitCode: event.finished?.exitCode?.code
      });
    }

    // Always emit raw event
    this.emit('buildEvent', event);
  }

  async wait(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.once('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Build failed with exit code ${code}`));
        }
      });
    });
  }

  stop(): void {
    this.process?.kill();
    this.cleanup();
  }

  private cleanup(): void {
    this.bepService?.stop();
    this.removeAllListeners();
  }
}

export class BazelClient {
  public readonly workspace: string;
  public readonly remote?: BazelClientOptions['remote'];
  public readonly remoteExecution?: RemoteExecutionService;
  private outputBase?: string;
  private serverOpts?: BazelClientOptions['serverOpts'];
  private commandServer?: CommandServer;
  private queryService: QueryService;

  constructor(options: BazelClientOptions) {
    this.workspace = path.resolve(options.workspace);
    this.outputBase = options.outputBase;
    this.serverOpts = options.serverOpts;
    this.remote = options.remote;
    
    this.queryService = new QueryService(this);
    
    if (options.remote?.executor) {
      this.remoteExecution = new RemoteExecutionService(options.remote);
    }
  }

  /**
   * Build targets with promise-based API
   */
  async build(targets: string | string[], options: BuildOptions = {}): Promise<any> {
    const stream = this.buildStream(targets, options);
    await stream.start();
    return stream.wait();
  }

  /**
   * Build targets with event streaming
   */
  buildStream(targets: string | string[], options: BuildOptions = {}): BuildStream {
    return new BuildStream(this, targets, options);
  }

  /**
   * Test targets
   */
  async test(targets: string | string[], options: TestOptions = {}): Promise<any> {
    const args = ['test', ...(Array.isArray(targets) ? targets : [targets])];
    
    if (options.testFilter) {
      args.push(`--test_filter=${options.testFilter}`);
    }
    if (options.testTimeout) {
      args.push(`--test_timeout=${options.testTimeout}`);
    }
    if (options.nocache) {
      args.push('--nocache_test_results');
    }
    if (options.testOutput) {
      args.push(`--test_output=${options.testOutput}`);
    }

    return this.runBazelCommand(args, options);
  }

  /**
   * Run executable targets
   */
  async run(target: string, runArgs: string[] = []): Promise<any> {
    const args = ['run', target];
    if (runArgs.length > 0) {
      args.push('--', ...runArgs);
    }
    return this.runBazelCommand(args);
  }

  /**
   * Query operations
   */
  async query(expression: string, options: QueryOptions = {}): Promise<any> {
    return this.queryService.query(expression, options);
  }

  async cquery(expression: string, options: QueryOptions = {}): Promise<any> {
    return this.queryService.cquery(expression, options);
  }

  async aquery(expression: string, options: QueryOptions = {}): Promise<any> {
    return this.queryService.aquery(expression, options);
  }

  /**
   * Get dependency graph
   */
  async getDependencyGraph(target: string) {
    return this.queryService.getDependencyGraph(target);
  }

  /**
   * Get action graph
   */
  async getActionGraph(target: string){
    return this.queryService.getActionGraph(target);
  }

  /**
   * Watch for file changes
   */
  watch(targets: string[], options: any = {}): FileWatcher {
    return new FileWatcher(this, targets, options);
  }

  /**
   * Server management
   */
  async getServerStatus(): Promise<any> {
    const result = await this.runBazelCommand(['info', 'server_pid']);
    const pid = parseInt(result.stdout.trim());
    
    const uptimeResult = await this.runBazelCommand(['info', 'server_log']);
    
    return {
      pid,
      running: !isNaN(pid) && pid > 0,
      logPath: uptimeResult.stdout.trim()
    };
  }

  async restartServer(): Promise<void> {
    await this.shutdown();
    // Server will auto-start on next command
  }

  async shutdown(): Promise<void> {
    await this.runBazelCommand(['shutdown']);
  }

  async clean(options: { expunge?: boolean } = {}): Promise<void> {
    const args = options.expunge ? ['clean', '--expunge'] : ['clean'];
    await this.runBazelCommand(args);
  }

  /**
   * Internal helper to run Bazel commands
   */
  private runBazelCommand(args: string[], options: any = {}): Promise<any> {
    return new Promise((resolve, reject) => {
      const process = spawn('bazelisk', args, {
        cwd: this.workspace,
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
          resolve({ stdout, stderr, code });
        } else {
          reject(new Error(`Bazel command failed: ${stderr}`));
        }
      });
    });
  }
}

/**
 * File Watcher - Watch for file changes and trigger rebuilds
 */

import { EventEmitter } from 'events';
import * as chokidar from 'chokidar';
import * as path from 'path';
import { debounce } from '../utils/debounce.js';

export interface FileWatcherOptions {
  onFileChange?: (files: string[]) => void;
  debounceMs?: number;
  ignored?: string[];
  persistent?: boolean;
}

export class FileWatcher extends EventEmitter {
  private watcher?: chokidar.FSWatcher;
  private changedFiles: Set<string> = new Set();
  private buildInProgress: boolean = false;
  private debouncedBuild: () => void;

  constructor(
    private client: any,
    private targets: string[],
    private options: FileWatcherOptions = {}
  ) {
    super();
    
    // Create debounced build function
    this.debouncedBuild = debounce(
      () => this.triggerBuild(),
      options.debounceMs || 500
    );
  }

  /**
   * Start watching for file changes
   */
  async start(): Promise<void> {
    // Get the source files for the targets
    const sourceFiles = await this.getSourceFiles();
    
    // Set up file watcher
    this.watcher = chokidar.watch(sourceFiles, {
      persistent: this.options.persistent !== false,
      ignored: [
        '**/bazel-*/**',  // Ignore bazel output directories
        '**/node_modules/**',
        '**/.git/**',
        ...(this.options.ignored || [])
      ],
      ignoreInitial: true,
      cwd: this.client.workspace
    });

    // Handle file events
    this.watcher.on('change', (filePath) => this.handleFileChange(filePath));
    this.watcher.on('add', (filePath) => this.handleFileChange(filePath));
    this.watcher.on('unlink', (filePath) => this.handleFileChange(filePath));
    
    this.watcher.on('ready', () => {
      this.emit('ready');
      console.log(`Watching ${sourceFiles.length} files for changes...`);
    });

    this.watcher.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = undefined;
    }
    this.changedFiles.clear();
    this.removeAllListeners();
  }

  /**
   * Handle file change event
   */
  private handleFileChange(filePath: string): void {
    if (this.buildInProgress) {
      // Queue the change for next build
      this.changedFiles.add(filePath);
      return;
    }

    this.changedFiles.add(filePath);
    
    // Notify about file change
    if (this.options.onFileChange) {
      this.options.onFileChange(Array.from(this.changedFiles));
    }
    
    this.emit('fileChange', Array.from(this.changedFiles));
    
    // Trigger debounced build
    this.debouncedBuild();
  }

  /**
   * Trigger a build
   */
  private async triggerBuild(): Promise<void> {
    if (this.buildInProgress || this.changedFiles.size === 0) {
      return;
    }

    this.buildInProgress = true;
    const files = Array.from(this.changedFiles);
    this.changedFiles.clear();

    this.emit('buildStarted', { files, targets: this.targets });

    try {
      // Run the build
      const buildStream = this.client.buildStream(this.targets, {
        // Could add specific options for watch mode
      });

      buildStream.on('progress', (event: any) => {
        this.emit('buildProgress', event);
      });

      buildStream.on('targetComplete', (event: any) => {
        this.emit('targetComplete', event);
      });

      await buildStream.start();
      await buildStream.wait();

      this.emit('buildComplete', {
        success: true,
        files,
        targets: this.targets
      });
    } catch (error) {
      this.emit('buildComplete', {
        success: false,
        error,
        files,
        targets: this.targets
      });
    } finally {
      this.buildInProgress = false;
      
      // If there were changes during the build, trigger another build
      if (this.changedFiles.size > 0) {
        this.debouncedBuild();
      }
    }
  }

  /**
   * Get source files for the targets
   */
  private async getSourceFiles(): Promise<string[]> {
    // Query for all source files of the targets
    const query = `kind('source file', deps(set(${this.targets.join(' ')})))`;
    const result = await this.client.query(query);
    
    // Convert target labels to file paths
    const files: string[] = [];
    for (const target of result) {
      // Convert //package:file to package/file
      const filePath = target.replace(/^\/\//, '').replace(':', '/');
      files.push(path.join(this.client.workspace, filePath));
    }
    
    return files;
  }

  /**
   * Manually trigger a rebuild
   */
  async rebuild(): Promise<void> {
    await this.triggerBuild();
  }

  /**
   * Check if a build is in progress
   */
  isBuilding(): boolean {
    return this.buildInProgress;
  }

  /**
   * Get the list of changed files waiting to be built
   */
  getPendingChanges(): string[] {
    return Array.from(this.changedFiles);
  }
}

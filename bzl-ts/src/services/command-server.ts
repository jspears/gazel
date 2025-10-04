/**
 * Command Server - Direct communication with Bazel daemon via command protocol
 */

import * as net from 'net';
import * as path from 'path';
import * as fs from 'fs/promises';
import { EventEmitter } from 'events';

/**
 * Bazel Command Server Protocol implementation
 * Communicates with Bazel daemon via domain sockets
 */
export class CommandServer extends EventEmitter {
  private socket?: net.Socket;
  private connected: boolean = false;
  private requestId: number = 0;
  private pendingRequests: Map<number, {
    resolve: (value: any) => void;
    reject: (error: Error) => void;
  }> = new Map();

  constructor(
    private workspace: string,
    private outputBase?: string
  ) {
    super();
  }

  /**
   * Connect to the Bazel daemon
   * Note: This is a simplified implementation. The real Bazel command server
   * uses gRPC over TCP, not Unix domain sockets.
   */
  async connect(): Promise<void> {
    // For this simplified version, we just verify Bazel is available
    try {
      const { execSync } = await import('child_process');
      execSync('bazelisk version', {
        cwd: this.workspace,
        encoding: 'utf8'
      });
      this.connected = true;
      this.emit('connected');
    } catch (error) {
      this.connected = false;
      throw new Error('Failed to connect to Bazel. Is Bazel installed?');
    }
  }

  /**
   * Disconnect from the daemon
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.destroy();
      this.socket = undefined;
    }
    this.connected = false;
    this.pendingRequests.clear();
    this.emit('disconnected');
  }

  /**
   * Send a command to the daemon
   * Note: This is a simplified implementation using command execution
   * The real implementation would use gRPC protocol
   */
  async sendCommand(command: string, args: string[] = []): Promise<any> {
    if (!this.connected) {
      await this.connect();
    }

    // For this simplified version, we execute Bazel commands directly
    const { execSync } = await import('child_process');

    try {
      const fullCommand = ['bazelisk', command, ...args].join(' ');
      const result = execSync(fullCommand, {
        cwd: this.workspace,
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });

      this.emit('output', result);
      return result;
    } catch (error: any) {
      this.emit('error', error);
      throw new Error(`Command failed: ${command} ${args.join(' ')}\n${error.message}`);
    }
  }

  /**
   * Handle response from daemon
   */
  private handleResponse(data: Buffer): void {
    const lines = data.toString().split('\n');
    
    for (const line of lines) {
      if (!line) continue;
      
      try {
        const response = JSON.parse(line);
        const pending = this.pendingRequests.get(response.id);
        
        if (pending) {
          this.pendingRequests.delete(response.id);
          
          if (response.error) {
            pending.reject(new Error(response.error));
          } else {
            pending.resolve(response.result);
          }
        }
      } catch (err) {
        console.error('Failed to parse response:', err);
      }
    }
  }

  /**
   * Get the socket path for the Bazel daemon
   */
  private async getSocketPath(): Promise<string> {
    // Get output base
    const outputBase = this.outputBase || await this.getOutputBase();
    
    // Socket is at <output_base>/server/command.socket
    return path.join(outputBase, 'server', 'command.socket');
  }

  /**
   * Get the output base directory
   */
  private async getOutputBase(): Promise<string> {
    // Try to get output base from bazel info command
    const { execSync } = await import('child_process');
    try {
      const outputBase = execSync('bazelisk info output_base', {
        cwd: this.workspace,
        encoding: 'utf8'
      }).trim();

      return outputBase;
    } catch (error) {
      // Fallback to computing the path manually
      const homeDir = process.env.HOME || process.env.USERPROFILE || '';
      const defaultOutputBase = path.join(homeDir, '.cache', 'bazel');

      // Check if custom output base is set
      try {
        const bazelrcPath = path.join(this.workspace, '.bazelrc');
        const content = await fs.readFile(bazelrcPath, 'utf-8');
        const match = content.match(/startup\s+--output_base=(.+)/);
        if (match) {
          return match[1].trim();
        }
      } catch {
        // Ignore if .bazelrc doesn't exist
      }

      // Use workspace hash to find the right output base
      const crypto = await import('crypto');
      const workspaceHash = crypto.createHash('md5')
        .update(this.workspace)
        .digest('hex');

      return path.join(defaultOutputBase, `_bazel_${process.env.USER}`, workspaceHash);
    }
  }

  /**
   * Check if connected to daemon
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * High-level command methods
   */

  async build(targets: string[], options: Record<string, any> = {}): Promise<any> {
    const args = [...targets];
    
    for (const [key, value] of Object.entries(options)) {
      if (value === true) {
        args.push(`--${key}`);
      } else if (value !== false) {
        args.push(`--${key}=${value}`);
      }
    }
    
    return this.sendCommand('build', args);
  }

  async query(expression: string, options: Record<string, any> = {}): Promise<any> {
    const args = [expression];
    
    for (const [key, value] of Object.entries(options)) {
      if (value === true) {
        args.push(`--${key}`);
      } else if (value !== false) {
        args.push(`--${key}=${value}`);
      }
    }
    
    return this.sendCommand('query', args);
  }

  async info(key?: string): Promise<any> {
    const args = key ? [key] : [];
    return this.sendCommand('info', args);
  }

  async clean(expunge: boolean = false): Promise<any> {
    const args = expunge ? ['--expunge'] : [];
    return this.sendCommand('clean', args);
  }

  async shutdown(): Promise<any> {
    return this.sendCommand('shutdown');
  }
}

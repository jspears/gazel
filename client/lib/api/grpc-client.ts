/**
 * gRPC Client for Gazel API
 * Replaces the HTTP/REST client with gRPC-web or native gRPC (in Electron)
 */

import type {
  WorkspaceInfo,
  BazelTarget,
  BuildFile,
  QueryTemplate,
  SavedQuery,
  CommandHistory
} from '$types';

// Import Connect client for browser
// TODO: Fix generated proto exports before enabling these imports
// import { createClient, type Client } from '@connectrpc/connect';
// import { createConnectTransport } from '@connectrpc/connect-web';
// import { GazelService } from './generated/gazel_connect.js';
// import { create } from '@bufbuild/protobuf';
// import * as schemas from './generated/gazel_pb.js';

// For browser environment, we'll use Connect (gRPC-web)
// For Electron, we can use native gRPC through IPC

interface GazelServiceClient {
  // Workspace operations
  getWorkspaceInfo(request: any, callback: (error: any, response: any) => void): void;
  getCurrentWorkspace(request: any, callback: (error: any, response: any) => void): void;
  scanWorkspaces(request: any, callback: (error: any, response: any) => void): void;
  switchWorkspace(request: any, callback: (error: any, response: any) => void): void;
  
  // Target operations
  listTargets(request: any, callback: (error: any, response: any) => void): void;
  getTarget(request: any, callback: (error: any, response: any) => void): void;
  getTargetDependencies(request: any, callback: (error: any, response: any) => void): void;
  getTargetOutputs(request: any, callback: (error: any, response: any) => void): void;
  getReverseDependencies(request: any, callback: (error: any, response: any) => void): void;
  searchTargets(request: any, callback: (error: any, response: any) => void): void;
  
  // Query operations
  executeQuery(request: any, callback: (error: any, response: any) => void): void;
  streamQuery(request: any): any; // Returns a stream
  
  // Build operations
  buildTarget(request: any, callback: (error: any, response: any) => void): void;
  streamBuild(request: any): any; // Returns a stream
  
  // Module operations
  getModuleGraph(request: any, callback: (error: any, response: any) => void): void;
}

export class GazelGrpcClient {
  private client: GazelServiceClient | null = null;
  private isElectron: boolean;

  constructor() {
    // Detect if we're running in Electron
    this.isElectron = typeof window !== 'undefined' &&
                      !!(window as any).electron?.ipcRenderer;
  }

  async connect(host = 'localhost', port = 8080): Promise<void> {
    console.log(`[GazelGrpcClient] Connecting... isElectron: ${this.isElectron}, host: ${host}, port: ${port}`);
    try {
      if (this.isElectron) {
        // In Electron, use IPC to communicate with main process gRPC client
        await this.connectElectron();
      } else {
        // In browser, use grpc-web on port 8080
        await this.connectBrowser(host, Number(window.location.port || port));
      }
      console.log('[GazelGrpcClient] Connection successful');
    } catch (error) {
      console.error('[GazelGrpcClient] Connection failed:', error);
      throw error;
    }
  }

  private async connectElectron(): Promise<void> {
    // In Electron, we can use direct IPC handlers instead of the bzl-ts transport
    // Create a proxy client that uses IPC directly
    const ipcRenderer = (window as any).electron?.ipcRenderer;

    if (!ipcRenderer) {
      console.warn('[GazelGrpcClient] Electron IPC not available, using mock');
      this.client = this.createMockClient();
      return;
    }

    // Create a client that proxies calls through IPC
    this.client = {
      getWorkspaceInfo: (request, callback) => {
        ipcRenderer.invoke('grpc:GazelService:getWorkspaceInfo', request)
          .then((response: any) => callback(null, response))
          .catch((error: any) => callback(error));
      },
      getCurrentWorkspace: (request, callback) => {
        ipcRenderer.invoke('grpc:GazelService:getCurrentWorkspace', request)
          .then((response: any) => callback(null, response))
          .catch((error: any) => callback(error));
      },
      scanWorkspaces: (request, callback) => {
        ipcRenderer.invoke('grpc:GazelService:scanWorkspaces', request)
          .then((response: any) => callback(null, response))
          .catch((error: any) => callback(error));
      },
      switchWorkspace: (request, callback) => {
        ipcRenderer.invoke('grpc:GazelService:switchWorkspace', request)
          .then((response: any) => callback(null, response))
          .catch((error: any) => callback(error));
      },
      listTargets: (request, callback) => {
        ipcRenderer.invoke('grpc:GazelService:listTargets', request)
          .then((response: any) => callback(null, response))
          .catch((error: any) => callback(error));
      },
      getTarget: (request, callback) => {
        ipcRenderer.invoke('grpc:GazelService:getTarget', request)
          .then((response: any) => callback(null, response))
          .catch((error: any) => callback(error));
      },
      getTargetDependencies: (request, callback) => {
        ipcRenderer.invoke('grpc:GazelService:getTargetDependencies', request)
          .then((response: any) => callback(null, response))
          .catch((error: any) => callback(error));
      },
      getTargetOutputs: (request, callback) => {
        ipcRenderer.invoke('grpc:GazelService:getTargetOutputs', request)
          .then((response: any) => callback(null, response))
          .catch((error: any) => callback(error));
      },
      getReverseDependencies: (request, callback) => {
        ipcRenderer.invoke('grpc:GazelService:getReverseDependencies', request)
          .then((response: any) => callback(null, response))
          .catch((error: any) => callback(error));
      },
      searchTargets: (request, callback) => {
        ipcRenderer.invoke('grpc:GazelService:searchTargets', request)
          .then((response: any) => callback(null, response))
          .catch((error: any) => callback(error));
      },
      executeQuery: (request, callback) => {
        ipcRenderer.invoke('grpc:GazelService:executeQuery', request)
          .then((response: any) => callback(null, response))
          .catch((error: any) => callback(error));
      },
      streamQuery: (request) => {
        // For streaming, create a simple event emitter-like object
        const listeners: { [key: string]: Function[] } = {};
        const stream = {
          on: (event: string, handler: Function) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(handler);
          },
          emit: (event: string, data?: any) => {
            if (listeners[event]) {
              listeners[event].forEach(handler => handler(data));
            }
          },
          cancel: () => {
            // Cleanup if needed
          }
        };

        // Start the stream via IPC
        ipcRenderer.invoke('grpc:GazelService:streamQuery', request)
          .then((response: any) => {
            // Handle streaming response
            if (response && response.data) {
              stream.emit('data', response);
            }
            stream.emit('end');
          })
          .catch((error: any) => {
            stream.emit('error', error);
          });

        return stream;
      },
      buildTarget: (request, callback) => {
        ipcRenderer.invoke('grpc:GazelService:buildTarget', request)
          .then((response: any) => callback(null, response))
          .catch((error: any) => callback(error));
      },
      streamBuild: (request) => {
        // Create a simple event emitter-like object
        const listeners: { [key: string]: Function[] } = {};
        const stream = {
          on: (event: string, handler: Function) => {
            if (!listeners[event]) listeners[event] = [];
            listeners[event].push(handler);
          },
          emit: (event: string, data?: any) => {
            if (listeners[event]) {
              listeners[event].forEach(handler => handler(data));
            }
          },
          cancel: () => {
            // Cleanup if needed
          }
        };

        ipcRenderer.invoke('grpc:GazelService:streamBuild', request)
          .then((response: any) => {
            if (response && response.data) {
              stream.emit('data', response);
            }
            stream.emit('end');
          })
          .catch((error: any) => {
            stream.emit('error', error);
          });

        return stream;
      },
      getModuleGraph: (request, callback) => {
        ipcRenderer.invoke('grpc:GazelService:getModuleGraph', request)
          .then((response: any) => callback(null, response))
          .catch((error: any) => callback(error));
      }
    };

    console.log('[GazelGrpcClient] Connected via Electron IPC');
  }

  private async connectBrowser(host: string, port: number): Promise<void> {
    console.log(`[GazelGrpcClient] Connecting to gRPC-web server at http://${host}:${port}`);

    // Use direct HTTP calls to the gRPC-web server
    const baseUrl = `http://${host}:${port}`;

    // Helper function to make gRPC-web calls
    const callMethod = async (method: string, request: any) => {
      const response = await fetch(`${baseUrl}/gazel.GazelService/${method}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request || {})
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`gRPC-web call failed: ${error}`);
      }

      return response.json();
    };

    // Create a client that uses direct HTTP calls
    this.client = {
      getWorkspaceInfo: (request, callback) => {
        callMethod('GetWorkspaceInfo', request)
          .then(response => callback(null, response))
          .catch(error => callback(error, null));
      },
      getCurrentWorkspace: (request, callback) => {
        callMethod('GetCurrentWorkspace', request)
          .then(response => callback(null, response))
          .catch(error => callback(error, null));
      },
      scanWorkspaces: (request, callback) => {
        callMethod('ScanWorkspaces', request)
          .then(response => callback(null, response))
          .catch(error => callback(error, null));
      },
      switchWorkspace: (request, callback) => {
        callMethod('SwitchWorkspace', request)
          .then(response => callback(null, response))
          .catch(error => callback(error, null));
      },
      listTargets: (request, callback) => {
        callMethod('ListTargets', request)
          .then(response => callback(null, response))
          .catch(error => callback(error, null));
      },
      getTarget: (request, callback) => {
        callMethod('GetTarget', request)
          .then(response => callback(null, response))
          .catch(error => callback(error, null));
      },
      getTargetDependencies: (request, callback) => {
        callMethod('GetTargetDependencies', request)
          .then(response => callback(null, response))
          .catch(error => callback(error, null));
      },
      getTargetOutputs: (request, callback) => {
        callMethod('GetTargetOutputs', request)
          .then(response => callback(null, response))
          .catch(error => callback(error, null));
      },
      getReverseDependencies: (request, callback) => {
        callMethod('GetReverseDependencies', request)
          .then(response => callback(null, response))
          .catch(error => callback(error, null));
      },
      searchTargets: (request, callback) => {
        callMethod('SearchTargets', request)
          .then(response => callback(null, response))
          .catch(error => callback(error, null));
      },
      executeQuery: (request, callback) => {
        callMethod('ExecuteQuery', request)
          .then(response => callback(null, response))
          .catch(error => callback(error, null));
      },
      streamQuery: (_request) => {
        // Streaming not yet implemented for HTTP
        console.warn('[GazelGrpcClient] Streaming not yet implemented in HTTP client');
        return {
          on: () => {},
          cancel: () => {}
        };
      },
      buildTarget: (request, callback) => {
        callMethod('BuildTarget', request)
          .then(response => callback(null, response))
          .catch(error => callback(error, null));
      },
      streamBuild: (_request) => {
        // Streaming not yet implemented for HTTP
        console.warn('[GazelGrpcClient] Streaming not yet implemented in HTTP client');
        return {
          on: () => {},
          cancel: () => {}
        };
      },
      getModuleGraph: (request, callback) => {
        callMethod('GetModuleGraph', request)
          .then(response => callback(null, response))
          .catch(error => callback(error, null));
      }
    };

    console.log('[GazelGrpcClient] Connected via HTTP to gRPC-web server at', baseUrl);
  }

  private createMockClient(): GazelServiceClient {
    return {
      getWorkspaceInfo: (request, callback) => {
        callback(null, {
          info: {
            path: '/mock/workspace',
            name: 'mock-workspace',
            valid: true,
            packages: ['//mock'],
            target_count: 10,
            file_count: 5
          }
        });
      },
      getCurrentWorkspace: (request, callback) => {
        callback(null, {
          configured: true,
          workspace: '/mock/workspace',
          valid: true
        });
      },
      scanWorkspaces: (request, callback) => {
        callback(null, {
          workspaces: [
            { path: '/mock/workspace', name: 'mock', type: 'current' }
          ]
        });
      },
      switchWorkspace: (request, callback) => {
        callback(null, {
          success: true,
          workspace: request.workspace,
          message: 'Switched'
        });
      },
      listTargets: (request, callback) => {
        callback(null, {
          total: 1,
          targets: [
            { label: '//mock:target', kind: 'mock_rule', package: '//mock', name: 'target' }
          ],
          by_package: {}
        });
      },
      getTarget: (request, callback) => {
        callback(null, {
          target: { label: request.target, kind: 'mock_rule' }
        });
      },
      getTargetDependencies: (request, callback) => {
        callback(null, {
          target: request.target,
          depth: request.depth,
          total: 0,
          dependencies: []
        });
      },
      getTargetOutputs: (request, callback) => {
        callback(null, {
          target: request.target,
          outputs: [],
          count: 0
        });
      },
      getReverseDependencies: (request, callback) => {
        callback(null, {
          target: request.target,
          total: 0,
          dependencies: []
        });
      },
      searchTargets: (request, callback) => {
        callback(null, {
          query: request.query,
          total: 0,
          targets: []
        });
      },
      executeQuery: (request, callback) => {
        callback(null, {
          query: request.query,
          output_format: request.output_format,
          result: { targets: [] },
          raw: ''
        });
      },
      streamQuery: (request) => {
        // Return a mock stream
        const stream = {
          on: (event: string, handler: Function) => {},
          cancel: () => {}
        };
        return stream;
      },
      buildTarget: (request, callback) => {
        callback(null, {
          success: true,
          output: 'Mock build complete'
        });
      },
      streamBuild: (request) => {
        // Return a mock stream
        const stream = {
          on: (event: string, handler: Function) => {},
          cancel: () => {}
        };
        return stream;
      },
      getModuleGraph: (request, callback) => {
        callback(null, {
          root: 'mock',
          modules: [],
          dependencies: [],
          statistics: {
            total_modules: 0,
            direct_dependencies: 0,
            dev_dependencies: 0,
            indirect_dependencies: 0
          }
        });
      }
    };
  }

  // ===== Public API Methods =====

  async getWorkspaceInfo(): Promise<WorkspaceInfo> {
    return new Promise((resolve, reject) => {
      this.client!.getWorkspaceInfo({}, (error, response) => {
        if (error) reject(error);
        else resolve(response.info);
      });
    });
  }

  async getCurrentWorkspace(): Promise<{
    configured: boolean;
    workspace: string | null;
    valid?: boolean;
    error?: string;
  }> {
    return new Promise((resolve, reject) => {
      this.client!.getCurrentWorkspace({}, (error, response) => {
        if (error) reject(error);
        else resolve({
          configured: response.configured,
          workspace: response.workspace || null,
          valid: response.valid,
          error: response.error
        });
      });
    });
  }

  async scanWorkspaces(): Promise<{
    workspaces: Array<{
      path: string;
      name: string;
      type: 'current' | 'parent' | 'home' | 'discovered';
    }>
  }> {
    return new Promise((resolve, reject) => {
      this.client!.scanWorkspaces({}, (error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  }

  async switchWorkspace(workspace: string): Promise<{
    success: boolean;
    workspace: string;
    message: string;
  }> {
    return new Promise((resolve, reject) => {
      this.client!.switchWorkspace({ workspace }, (error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  }

  async getWorkspaceFiles(): Promise<{ total: number; files: any[] }> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Client not initialized'));
        return;
      }

      // For Electron, make IPC call
      if ((window as any).electron?.ipcRenderer) {
        (window as any).electron.ipcRenderer.invoke('grpc:GazelService:getWorkspaceFiles', {})
          .then((response: any) => resolve(response))
          .catch((error: any) => reject(error));
      } else {
        // Mock response for browser
        resolve({ total: 0, files: [] });
      }
    });
  }

  async getWorkspaceConfig(): Promise<{ bazelrc_exists: boolean; configurations: Record<string, string[]> }> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Client not initialized'));
        return;
      }

      // For Electron, make IPC call
      if ((window as any).electron?.ipcRenderer) {
        (window as any).electron.ipcRenderer.invoke('grpc:GazelService:getWorkspaceConfig', {})
          .then((response: any) => resolve(response))
          .catch((error: any) => reject(error));
      } else {
        // Mock response for browser
        resolve({ bazelrc_exists: false, configurations: {} });
      }
    });
  }

  async getBuildFile(path: string): Promise<{
    path: string;
    content: string;
    targets: Array<{ ruleType: string; name: string; line: number }>;
    lines: number;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Client not initialized'));
        return;
      }

      // For Electron, make IPC call
      if ((window as any).electron?.ipcRenderer) {
        (window as any).electron.ipcRenderer.invoke('grpc:GazelService:getBuildFile', { path })
          .then((response: any) => resolve(response))
          .catch((error: any) => reject(error));
      } else {
        // Mock response for browser
        resolve({
          path,
          content: '# Mock BUILD file content',
          targets: [],
          lines: 1
        });
      }
    });
  }

  async listBuildFiles(): Promise<{ total: number; files: any[] }> {
    // This is the same as getWorkspaceFiles
    return this.getWorkspaceFiles();
  }

  async listTargets(pattern = '//...', format = 'label_kind'): Promise<{
    total: number;
    targets: BazelTarget[];
    byPackage: Record<string, BazelTarget[]>;
  }> {
    return new Promise((resolve, reject) => {
      this.client!.listTargets({ pattern, format }, (error, response) => {
        if (error) reject(error);
        else {
          // Convert proto format back to expected format
          const byPackage: Record<string, BazelTarget[]> = {};
          if (response.by_package) {
            for (const [pkg, list] of Object.entries(response.by_package)) {
              byPackage[pkg] = (list as any).targets || [];
            }
          }
          resolve({
            total: response.total,
            targets: response.targets,
            byPackage
          });
        }
      });
    });
  }

  async executeQuery(query: string, outputFormat = 'label_kind'): Promise<{
    query: string;
    outputFormat: string;
    result: { targets: BazelTarget[] };
    raw: string;
  }> {
    return new Promise((resolve, reject) => {
      this.client!.executeQuery({ query, output_format: outputFormat }, (error, response) => {
        if (error) reject(error);
        else resolve({
          query: response.query,
          outputFormat: response.output_format,
          result: response.result,
          raw: response.raw
        });
      });
    });
  }

  async getTarget(target: string): Promise<{ target: BazelTarget }> {
    return new Promise((resolve, reject) => {
      this.client!.getTarget({ target }, (error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  }

  async getTargetDependencies(target: string, depth = 1): Promise<{
    target: string;
    depth: number;
    total: number;
    dependencies: BazelTarget[];
  }> {
    return new Promise((resolve, reject) => {
      this.client!.getTargetDependencies({ target, depth }, (error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  }

  async getTargetOutputs(target: string): Promise<{
    target: string;
    outputs: Array<{path: string; filename: string; type: string}>;
    count: number;
    error?: string;
  }> {
    return new Promise((resolve, reject) => {
      this.client!.getTargetOutputs({ target }, (error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  }

  async getReverseDependencies(target: string): Promise<{
    target: string;
    total: number;
    dependencies: BazelTarget[];
  }> {
    return new Promise((resolve, reject) => {
      this.client!.getReverseDependencies({ target }, (error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  }

  async searchTargets(query: string, type?: string, pkg?: string): Promise<{
    query: string;
    total: number;
    targets: BazelTarget[];
  }> {
    return new Promise((resolve, reject) => {
      this.client!.searchTargets({ query, type, package: pkg }, (error, response) => {
        if (error) reject(error);
        else resolve(response);
      });
    });
  }

  async buildTarget(target: string, options: string[] = []): Promise<{
    success: boolean;
    output: string;
    stderr?: string;
    error?: string;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Client not initialized'));
        return;
      }

      // For Electron, make IPC call
      if ((window as any).electron?.ipcRenderer) {
        (window as any).electron.ipcRenderer.invoke('grpc:GazelService:buildTarget', { target, options })
          .then((response: any) => resolve(response))
          .catch((error: any) => reject(error));
      } else {
        // Mock response for browser
        resolve({
          success: false,
          output: '',
          error: 'Build not available in browser mode'
        });
      }
    });
  }

  async testTarget(target: string, options: string[] = []): Promise<{
    success: boolean;
    output: string;
    stderr?: string;
    error?: string;
  }> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('Client not initialized'));
        return;
      }

      // For Electron, make IPC call
      if ((window as any).electron?.ipcRenderer) {
        (window as any).electron.ipcRenderer.invoke('grpc:GazelService:testTarget', { target, options })
          .then((response: any) => resolve(response))
          .catch((error: any) => reject(error));
      } else {
        // Mock response for browser
        resolve({
          success: false,
          output: '',
          error: 'Test not available in browser mode'
        });
      }
    });
  }

  streamBuild(target: string, options: string[] = [], onMessage: (data: any) => void): any {
    // For Electron, use IPC for streaming
    if ((window as any).electron?.ipcRenderer) {
      (window as any).electron.ipcRenderer.invoke('grpc:GazelService:streamBuild', { target, options })
        .then((response: any) => {
          onMessage({ type: 'stdout', data: response.output || '' });
          if (response.error) {
            onMessage({ type: 'stderr', data: response.error });
          }
          onMessage({ type: 'exit', data: response.success ? '0' : '1' });
        })
        .catch((error: any) => {
          onMessage({ type: 'stderr', data: error.message });
          onMessage({ type: 'exit', data: '1' });
        });

      // Return a mock stream object
      return {
        close: () => {
          // TODO: Implement stream cancellation
        }
      };
    }

    // Mock for browser
    onMessage({ type: 'stderr', data: 'Streaming not available in browser mode' });
    onMessage({ type: 'exit', data: '1' });
    return { close: () => {} };
  }

  streamRun(target: string, options: string[] = [], onMessage: (data: any) => void): any {
    // For Electron, use IPC for streaming
    if ((window as any).electron?.ipcRenderer) {
      (window as any).electron.ipcRenderer.invoke('grpc:GazelService:runTarget', { target, options })
        .then((response: any) => {
          onMessage({ type: 'stdout', data: response.output || '' });
          if (response.error) {
            onMessage({ type: 'stderr', data: response.error });
          }
          onMessage({ type: 'exit', data: response.success ? '0' : '1' });
        })
        .catch((error: any) => {
          onMessage({ type: 'stderr', data: error.message });
          onMessage({ type: 'exit', data: '1' });
        });

      // Return a mock stream object
      return {
        close: () => {
          // TODO: Implement stream cancellation
        }
      };
    }

    // Mock for browser
    onMessage({ type: 'stderr', data: 'Run not available in browser mode' });
    onMessage({ type: 'exit', data: '1' });
    return { close: () => {} };
  }

  async getModuleGraph(): Promise<{
    root: string;
    modules: any[];
    dependencies: any[];
    statistics: {
      totalModules: number;
      directDependencies: number;
      devDependencies: number;
      indirectDependencies: number;
    };
  }> {
    return new Promise((resolve, reject) => {
      this.client!.getModuleGraph({}, (error, response) => {
        if (error) reject(error);
        else resolve({
          root: response.root,
          modules: response.modules,
          dependencies: response.dependencies,
          statistics: {
            totalModules: response.statistics.total_modules,
            directDependencies: response.statistics.direct_dependencies,
            devDependencies: response.statistics.dev_dependencies,
            indirectDependencies: response.statistics.indirect_dependencies
          }
        });
      });
    });
  }

  // Helper to convert streaming queries
  async *streamQueryAsObjects(query: string): AsyncGenerator<any, void, unknown> {
    if (!this.client) {
      throw new Error('Client not initialized');
    }

    const stream = this.client.streamQuery({ query, parse_xml: true });
    const buffer: any[] = [];
    let ended = false;

    // Set up event listeners
    stream.on('data', (response: any) => {
      if (response.target) {
        buffer.push(response.target);
      }
    });

    stream.on('end', () => {
      ended = true;
    });

    stream.on('error', (error: any) => {
      ended = true;
      throw error;
    });

    // Poll for data and yield items
    while (!ended || buffer.length > 0) {
      if (buffer.length > 0) {
        yield buffer.shift();
      } else if (!ended) {
        // Wait a bit for more data
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  disconnect(): void {
    // Clean up gRPC connection if needed
    this.client = null;
  }
}

// Export singleton instance
export const gazelGrpcClient = new GazelGrpcClient();

/**
 * Example: Electron IPC gRPC Transport
 * Demonstrates using gRPC-like communication over Electron's IPC
 */

import {
  ElectronIPCServer,
  UnaryHandler,
  ServerStreamHandler,
  ClientStreamHandler,
  DuplexStreamHandler,
  ServerStream,
  ClientStream,
  DuplexStream
} from '../src/transports/electron-ipc-transport.js';

import {
  ElectronIPCClient,
  createServiceClient
} from '../src/transports/electron-ipc-client.js';

// Example service definition
interface BuildRequest {
  targets: string[];
  options?: Record<string, any>;
}

interface BuildResponse {
  success: boolean;
  outputs: string[];
  errors?: string[];
}

interface BuildEvent {
  type: 'progress' | 'output' | 'error' | 'complete';
  message: string;
  progress?: number;
}

interface QueryRequest {
  expression: string;
  options?: Record<string, any>;
}

interface QueryResponse {
  targets: string[];
}

interface FileChange {
  path: string;
  type: 'created' | 'modified' | 'deleted';
}

// Service interface
interface BazelService {
  // Unary call
  build(request: BuildRequest): Promise<BuildResponse>;
  
  // Server streaming
  watchBuild(request: BuildRequest): ClientStream<BuildEvent>;
  
  // Client streaming
  batchQuery(requests: ClientStream<QueryRequest>): Promise<QueryResponse>;
  
  // Duplex streaming
  watchFiles(stream: DuplexStream<FileChange, BuildEvent>): void;
}

/**
 * Main process implementation
 */
export function setupMainProcess(ipcMain: any): ElectronIPCServer {
  const server = new ElectronIPCServer(ipcMain);
  
  // Implement the Bazel service
  const bazelServiceImpl = {
    // Unary call implementation
    build: async (request: BuildRequest): Promise<BuildResponse> => {
      console.log('[Main] Building targets:', request.targets);
      
      // Simulate build process
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return {
        success: true,
        outputs: request.targets.map(t => `bazel-out/${t}`),
        errors: []
      };
    },
    
    // Server streaming implementation
    watchBuild: (request: BuildRequest, stream: ServerStream<BuildEvent>) => {
      console.log('[Main] Starting build watch for:', request.targets);
      
      // Simulate build events
      let progress = 0;
      const interval = setInterval(() => {
        progress += 20;
        
        if (progress <= 100) {
          stream.write({
            type: 'progress',
            message: `Building ${request.targets[0]}...`,
            progress
          });
        } else {
          stream.write({
            type: 'complete',
            message: 'Build completed successfully'
          });
          stream.end();
          clearInterval(interval);
        }
      }, 500);
    },
    
    // Client streaming implementation
    batchQuery: async (stream: ClientStream<QueryRequest>): Promise<QueryResponse> => {
      console.log('[Main] Starting batch query');
      
      const allTargets: string[] = [];
      
      return new Promise((resolve, reject) => {
        stream.on('data', (request: QueryRequest) => {
          console.log('[Main] Query:', request.expression);
          // Simulate query processing
          allTargets.push(`//target:${request.expression}`);
        });
        
        stream.on('end', () => {
          console.log('[Main] Batch query complete');
          resolve({ targets: allTargets });
        });
        
        stream.on('error', (error) => {
          console.error('[Main] Batch query error:', error);
          reject(error);
        });
      });
    },
    
    // Duplex streaming implementation
    watchFiles: (stream: DuplexStream<FileChange, BuildEvent>) => {
      console.log('[Main] Starting file watch');

      stream.on('data', (change: FileChange) => {
        console.log('[Main] File change:', change);

        // Only respond if we have valid change data
        if (change && change.path) {
          // Respond to file changes with build events
          stream.write({
            type: 'output',
            message: `Detected ${change.type}: ${change.path}`
          });

          // Simulate incremental build
          if (change.type !== 'deleted') {
            stream.write({
              type: 'progress',
              message: `Rebuilding affected targets...`,
              progress: 50
            });

            setTimeout(() => {
              stream.write({
                type: 'complete',
                message: 'Incremental build complete'
              });
            }, 1000);
          }
        }
      });

      stream.on('end', () => {
        console.log('[Main] File watch ended');
      });

      stream.on('error', (error) => {
        console.error('[Main] File watch error:', error);
      });
    }
  };
  
  // Register the service
  server.addService('BazelService', bazelServiceImpl);
  
  console.log('[Main] gRPC-over-IPC server ready');
  
  return server;
}

/**
 * Renderer process client
 */
export async function setupRendererProcess(ipcRenderer: any): Promise<void> {
  const client = new ElectronIPCClient(ipcRenderer);
  
  // Create typed service client
  const bazelService = createServiceClient<BazelService>(
    client,
    'BazelService',
    {
      build: { type: 'unary' },
      watchBuild: { type: 'serverStream' },
      batchQuery: { type: 'clientStream' },
      watchFiles: { type: 'duplex' }
    }
  );
  
  console.log('[Renderer] Starting gRPC-over-IPC examples\n');
  
  // Example 1: Unary call
  console.log('1. Unary Call - Build targets');
  try {
    const buildResult = await (bazelService as any).build({
      targets: ['//app:main', '//lib:core'],
      options: { config: 'release' }
    });
    console.log('   Build result:', buildResult);
  } catch (error) {
    console.error('   Build error:', error);
  }
  
  // Example 2: Server streaming
  console.log('\n2. Server Streaming - Watch build progress');
  const buildStream = (bazelService as any).watchBuild({
    targets: ['//app:main']
  });
  
  buildStream.on('data', (event: BuildEvent) => {
    console.log('   Build event:', event);
  });
  
  buildStream.on('end', () => {
    console.log('   Build watch ended');
  });
  
  buildStream.on('error', (error: Error) => {
    console.error('   Build watch error:', error);
  });
  
  // Wait for stream to complete
  await new Promise(resolve => buildStream.on('end', resolve));
  
  // Example 3: Client streaming
  console.log('\n3. Client Streaming - Batch queries');
  const { stream: queryStream, response: queryResponse } = await (bazelService as any).batchQuery();
  
  // Send multiple queries
  queryStream.write({ expression: 'deps(//app:main)' });
  queryStream.write({ expression: 'rdeps(//..., //lib:core)' });
  queryStream.write({ expression: 'tests(//...)' });
  queryStream.end();
  
  const batchResult = await queryResponse;
  console.log('   Batch query result:', batchResult);
  
  // Example 4: Duplex streaming
  console.log('\n4. Duplex Streaming - File watching with incremental builds');
  const fileStream = (bazelService as any).watchFiles() as DuplexStream<FileChange, BuildEvent>;
  
  fileStream.on('data', (event: BuildEvent) => {
    console.log('   Build event from file watch:', event);
  });
  
  // Simulate file changes
  fileStream.write({ path: 'src/main.ts', type: 'modified' });
  
  setTimeout(() => {
    fileStream.write({ path: 'src/utils.ts', type: 'created' });
  }, 1500);
  
  setTimeout(() => {
    fileStream.write({ path: 'src/old.ts', type: 'deleted' });
    fileStream.end();
  }, 3000);
  
  // Wait for completion
  await new Promise(resolve => fileStream.on('end', resolve));
  
  console.log('\n✅ All IPC-gRPC examples completed!');
  
  // Clean up
  client.close();
}

/**
 * Mock IPC for testing without Electron
 */
class MockIPC {
  private handlers: Map<string, Function> = new Map();
  private listeners: Map<string, Set<Function>> = new Map();
  
  // IpcMain methods
  handle(channel: string, handler: Function): void {
    this.handlers.set(channel, handler);
  }
  
  on(channel: string, listener: Function): void {
    if (!this.listeners.has(channel)) {
      this.listeners.set(channel, new Set());
    }
    this.listeners.get(channel)!.add(listener);
  }
  
  // IpcRenderer methods
  async invoke(channel: string, ...args: any[]): Promise<any> {
    const handler = this.handlers.get(channel);
    if (handler) {
      return handler({ sender: this }, ...args);
    }
    throw new Error(`No handler for channel: ${channel}`);
  }

  send(channel: string, ...args: any[]): void {
    // Use setTimeout to avoid infinite loops in mock
    setTimeout(() => {
      const listeners = this.listeners.get(channel);
      if (listeners) {
        for (const listener of listeners) {
          listener({ sender: this }, ...args);
        }
      }
    }, 0);
  }
  
  removeListener(channel: string, listener: Function): void {
    const listeners = this.listeners.get(channel);
    if (listeners) {
      listeners.delete(listener);
    }
  }
}

/**
 * Run the example
 */
async function main() {
  console.log('Electron IPC gRPC Transport Example');
  console.log('====================================\n');
  
  // Create mock IPC for testing
  const mockIPC = new MockIPC();
  
  // Setup main process
  const server = setupMainProcess(mockIPC);
  
  // Setup renderer process
  await setupRendererProcess(mockIPC);
  
  // Cleanup
  server.close();
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

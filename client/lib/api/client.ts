// import type {
//   WorkspaceInfo,
//   BazelTarget,
//   BuildFile,
//   QueryTemplate,
//   SavedQuery,
//   CommandHistory
// } from '$types';
// import { GazelGrpcClient } from './grpc-client';

import { getClient } from "../../client";

// // Detect if we're in Electron or browser
// const isElectron = typeof window !== 'undefined' &&
//                    !!(window as any).electron?.ipcRenderer;

// // Use gRPC in both Electron and browser
// const USE_GRPC = true;

// console.log('[ApiClient] Module loaded, USE_GRPC:', USE_GRPC, 'isElectron:', isElectron);

// // When running in Electron without a server, we need to handle API calls differently
// const ELECTRON_STANDALONE = isElectron && !window.location.href.startsWith('http://localhost');

// class ApiClient {
//   private grpcClient: GazelGrpcClient | null = null;
//   private abortController: AbortController | null = null;
//   private initialized = false;

//   constructor() {
//     console.log(`[ApiClient] Constructor called, USE_GRPC: ${USE_GRPC}`);
//     if (USE_GRPC) {
//       this.grpcClient = new GazelGrpcClient();
//       console.log('[ApiClient] GazelGrpcClient created, client:', this.grpcClient);
//     } else {
//       console.error('[ApiClient] gRPC is disabled! USE_GRPC is false');
//     }
//   }

//   private async ensureInitialized(): Promise<void> {
//     console.log('[ApiClient] ensureInitialized called, initialized:', this.initialized, 'grpcClient:', !!this.grpcClient);
//     if (!this.initialized && this.grpcClient) {
//       console.log('[ApiClient] Initializing gRPC client...');
//       await this.grpcClient.connect();
//       this.initialized = true;
//       console.log('[ApiClient] gRPC client initialized');
//     } else if (!this.grpcClient) {
//       console.error('[ApiClient] Cannot initialize - grpcClient is null!');
//     }
//   }

//   // Cancel all pending requests
//   cancelPendingRequests(): void {
//     if (this.abortController) {
//       this.abortController.abort();
//       this.abortController = null;
//     }
//     // TODO: Cancel gRPC streams
//   }

//   // Modules endpoints
//   async getModuleGraph(): Promise<{
//     root: string;
//     modules: Array<{
//       key: string;
//       name: string;
//       version: string;
//       location?: {
//         file?: string;
//         line?: number;
//         column?: number;
//       };
//       compatibility_level?: number;
//       repo_name?: string;
//       bazel_compatibility?: string[];
//       module_rule_exports_all_rules?: boolean;
//       tags?: string[];
//       dependencies?: Array<{
//         key: string;
//         name: string;
//         version: string;
//         dev_dependency?: boolean;
//       }>;
//       resolved_dependencies?: Array<{
//         key: string;
//         name: string;
//         version: string;
//         registry?: string;
//       }>;
//       extension_usages?: Array<{
//         extension_bzl_file: string;
//         extension_name: string;
//         location?: {
//           file?: string;
//           line?: number;
//           column?: number;
//         };
//         imports?: Record<string, string>;
//         dev_dependency?: boolean;
//         isolate?: boolean;
//       }>;
//       dependencyCount: number;
//       extensionCount: number;
//     }>;
//     dependencies: Array<{
//       from: string;
//       to: string;
//       type: 'direct' | 'dev' | 'indirect';
//       version: string;
//     }>;
//     statistics: {
//       totalModules: number;
//       directDependencies: number;
//       devDependencies: number;
//       indirectDependencies: number;
//     };
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.getModuleGraph();
//   }

//   async getModuleInfo(moduleName: string): Promise<any> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.getModuleInfo(moduleName);
//   }

//   // Workspace endpoints
//   async getWorkspaceInfo(): Promise<WorkspaceInfo> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.getWorkspaceInfo();
//   }

//   async getWorkspaceFiles(): Promise<{ total: number; files: BuildFile[] }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.getWorkspaceFiles();
//   }

//   async getWorkspaceConfig(): Promise<{ bazelrc_exists: boolean; configurations: Record<string, string[]> }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.getWorkspaceConfig();
//   }

//   async getCurrentWorkspace(): Promise<{
//     configured: boolean;
//     workspace: string | null;
//     valid?: boolean;
//     error?: string;
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.getCurrentWorkspace();
//   }

//   async scanWorkspaces(): Promise<{
//     workspaces: Array<{
//       path: string;
//       name: string;
//       type: 'current' | 'parent' | 'home' | 'discovered';
//     }>
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.scanWorkspaces();
//   }

//   async switchWorkspace(workspace: string): Promise<{
//     success: boolean;
//     workspace: string;
//     message: string;
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.switchWorkspace(workspace);
//   }

//   // Targets endpoints
//   async listTargets(pattern = '//...', format = 'label_kind'): Promise<{
//     total: number;
//     targets: BazelTarget[];
//     byPackage: Record<string, BazelTarget[]>;
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.listTargets(pattern, format);
//   }

//   async getTarget(target: string): Promise<BazelTarget> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     const response = await this.grpcClient.getTarget(target);
//     return response.target;
//   }

//   async getTargetDependencies(target: string, depth = 1): Promise<{
//     target: string;
//     depth: number;
//     total: number;
//     dependencies: BazelTarget[];
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.getTargetDependencies(target, depth);
//   }

//   async getTargetsByFile(file: string): Promise<{
//     file: string;
//     total: number;
//     targets: BazelTarget[];
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.getTargetsByFile(file);
//   }

//   async getTargetOutputs(target: string): Promise<{
//     target: string;
//     outputs: Array<{path: string; filename: string; type: string}>;
//     count: number;
//     error?: string;
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.getTargetOutputs(target);
//   }

//   async getReverseDependencies(target: string): Promise<{
//     target: string;
//     total: number;
//     dependencies: BazelTarget[];
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.getReverseDependencies(target);
//   }

//   async searchTargets(query: string, type?: string, pkg?: string): Promise<{
//     query: string;
//     total: number;
//     targets: BazelTarget[];
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.searchTargets(query, type, pkg);
//   }

//   // Query endpoints
//   async executeQuery(query: string, outputFormat = 'label_kind'): Promise<{
//     query: string;
//     outputFormat: string;
//     result: { targets: BazelTarget[] };
//     raw: string;
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.executeQuery(query, outputFormat);
//   }

//   async getSavedQueries(): Promise<SavedQuery[]> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.getSavedQueries();
//   }

//   async saveQuery(name: string, query: string, description?: string): Promise<SavedQuery> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.saveQuery(name, query, description);
//   }

//   async deleteQuery(id: string): Promise<{ success: boolean }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.deleteQuery(id);
//   }

//   async getQueryTemplates(): Promise<QueryTemplate[]> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.getQueryTemplates();
//   }

//   // Files endpoints
//   async listBuildFiles(): Promise<{ total: number; files: BuildFile[] }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.listBuildFiles();
//   }

//   async getBuildFile(path: string): Promise<{
//     path: string;
//     content: string;
//     targets: Array<{ ruleType: string; name: string; line: number }>;
//     lines: number;
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.getBuildFile(path);
//   }

//   async getWorkspaceFile(): Promise<{
//     path: string;
//     content: string;
//     workspaceName: string;
//     externalDependencies: string[];
//     lines: number;
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.getWorkspaceFile();
//   }

//   async searchInFiles(query: string, caseSensitive = false): Promise<{
//     query: string;
//     caseSensitive: boolean;
//     total: number;
//     results: Array<{ file: string; line: number; content: string }>;
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.searchInFiles(query, caseSensitive);
//   }

//   // Commands endpoints
//   async buildTarget(target: string, options: string[] = []): Promise<{
//     success: boolean;
//     output: string;
//     stderr?: string;
//     error?: string;
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.buildTarget(target, options);
//   }

//   async testTarget(target: string, options: string[] = []): Promise<{
//     success: boolean;
//     output: string;
//     stderr?: string;
//     error?: string;
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.testTarget(target, options);
//   }

//   streamBuild(target: string, options: string[] = [], onMessage: (data: any) => void): EventSource | any {
//     // Use gRPC streaming
//     this.ensureInitialized().then(() => {
//       if (!this.grpcClient) {
//         throw new Error('gRPC client not available');
//       }
//       return this.grpcClient.streamBuild(target, options, onMessage);
//     });
//     // Return a mock EventSource-like object for compatibility
//     return {
//       close: () => {
//         // TODO: Cancel gRPC stream
//       }
//     };
//   }

//   /**
//    * Stream run output using gRPC
//    * @param target - The target to run
//    * @param options - Additional options for the run command
//    * @param onMessage - Callback function for each message
//    * @returns EventSource-like object
//    */
//   streamRun(target: string, options: string[] = [], onMessage: (data: any) => void): EventSource | any {
//     // Use gRPC streaming
//     this.ensureInitialized().then(() => {
//       if (!this.grpcClient) {
//         throw new Error('gRPC client not available');
//       }
//       return this.grpcClient.streamRun(target, options, onMessage);
//     });
//     // Return a mock EventSource-like object for compatibility
//     return {
//       close: () => {
//         // TODO: Cancel gRPC stream
//       }
//     };
//   }



//   async getCommandHistory(limit = 50): Promise<{
//     total: number;
//     history: CommandHistory[];
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.getCommandHistory(limit);
//   }

//   async clearCommandHistory(): Promise<{ success: boolean }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.clearCommandHistory();
//   }

//   async cleanBazel(expunge = false): Promise<{
//     success: boolean;
//     output: string;
//     error?: string;
//   }> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     return this.grpcClient.cleanBazel(expunge);
//   }

//   // Streaming endpoints for large queries
//   async streamQuery(query: string, parseXml = false): Promise<Response> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     // For now, return a mock Response object
//     // TODO: Implement proper streaming in gRPC client
//     const result = await this.grpcClient.executeQuery(query, 'xml');
//     return new Response(result.raw, {
//       status: 200,
//       headers: new Headers({ 'content-type': 'text/xml' })
//     });
//   }

//   async streamQueryCompact(query: string): Promise<Response> {
//     await this.ensureInitialized();
//     if (!this.grpcClient) {
//       throw new Error('gRPC client not available');
//     }
//     // For now, return a mock Response object
//     // TODO: Implement proper streaming in gRPC client
//     const result = await this.grpcClient.executeQuery(query, 'label');
//     return new Response(result.raw, {
//       status: 200,
//       headers: new Headers({ 'content-type': 'text/plain' })
//     });
//   }

//   /**
//    * Stream and parse large XML query results
//    */
//   async *streamQueryAsObjects(query: string): AsyncGenerator<any, void, unknown> {
//     const response = await this.streamQuery(query, true);
//     const reader = response.body?.getReader();

//     if (!reader) {
//       throw new Error('Response body is not readable');
//     }

//     const decoder = new TextDecoder();
//     let buffer = '';

//     try {
//       while (true) {
//         const { done, value } = await reader.read();

//         if (done) break;

//         buffer += decoder.decode(value, { stream: true });

//         // Try to parse complete JSON objects from the buffer
//         // The stream sends JSON objects separated by commas and newlines
//         const lines = buffer.split('\n');
//         buffer = lines.pop() || ''; // Keep the incomplete line in buffer

//         for (const line of lines) {
//           const trimmed = line.trim();
//           if (trimmed && trimmed !== '[' && trimmed !== ']') {
//             // Remove trailing comma if present
//             const jsonStr = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;
//             try {
//               const obj = JSON.parse(jsonStr);
//               yield obj;
//             } catch (e) {
//               // Skip malformed JSON
//               console.warn('Failed to parse JSON chunk:', jsonStr);
//             }
//           }
//         }
//       }

//       // Process any remaining buffer
//       if (buffer.trim() && buffer.trim() !== ']') {
//         const jsonStr = buffer.trim().endsWith(',') ? buffer.trim().slice(0, -1) : buffer.trim();
//         try {
//           const obj = JSON.parse(jsonStr);
//           yield obj;
//         } catch (e) {
//           console.warn('Failed to parse final JSON chunk:', jsonStr);
//         }
//       }
//     } finally {
//       reader.releaseLock();
//     }
//   }
// }

// export const api = new ApiClient();
export const api = getClient();

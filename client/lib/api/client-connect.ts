/**
 * API Client using Connect-ES for proper gRPC-web support
 */

import { createPromiseClient, createConnectTransport } from '@connectrpc/connect-web';
import { GazelService } from './generated/gazel_connect';
import type { PromiseClient } from '@connectrpc/connect';
import type {
  WorkspaceInfo,
  BazelTarget,
  BuildFile,
  QueryTemplate,
  SavedQuery,
  CommandHistory
} from '$types';

// Type for the Gazel service client
type GazelClient = PromiseClient<typeof GazelService>;

// Detect if we're in Electron or browser
const isElectron = typeof window !== 'undefined' &&
                   !!(window as any).electron?.ipcRenderer;

console.log('[ApiClient] Using Connect-ES client, isElectron:', isElectron);

class ApiClient {
  private client: GazelClient | null = null;
  private abortController: AbortController | null = null;
  private baseUrl: string;

  constructor() {
    // Determine the base URL based on environment
    if (typeof window !== 'undefined') {
      // In browser, use the current origin
      this.baseUrl = window.location.origin;
    } else {
      // In Node/test environment
      this.baseUrl = 'http://localhost:3002';
    }
    
    console.log('[ApiClient] Initialized with baseUrl:', this.baseUrl);
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.client) {
      console.log('[ApiClient] Creating Connect client...');
      
      // Create a Connect transport
      const transport = createConnectTransport({
        baseUrl: this.baseUrl,
        // Use JSON format for easier debugging
        useBinaryFormat: false,
        // Add interceptors if needed
        interceptors: [],
      });

      // Create the promise-based client
      this.client = createPromiseClient(GazelService, transport);
      
      console.log('[ApiClient] Connect client created');
    }
  }

  // Cancel all pending requests
  cancelRequests() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  // Workspace operations
  async getWorkspaceInfo(): Promise<WorkspaceInfo | null> {
    try {
      await this.ensureInitialized();
      const response = await this.client!.getWorkspaceInfo({});
      return response.info || null;
    } catch (error) {
      console.error('[ApiClient] Failed to get workspace info:', error);
      throw error;
    }
  }

  async getCurrentWorkspace(): Promise<{ configured: boolean; workspace: string; valid: boolean; error?: string }> {
    try {
      await this.ensureInitialized();
      const response = await this.client!.getCurrentWorkspace({});
      return response;
    } catch (error) {
      console.error('[ApiClient] Failed to get current workspace:', error);
      throw error;
    }
  }

  async switchWorkspace(workspace: string): Promise<{ success: boolean; message?: string }> {
    try {
      await this.ensureInitialized();
      const response = await this.client!.switchWorkspace({ workspace });
      return response;
    } catch (error) {
      console.error('[ApiClient] Failed to switch workspace:', error);
      throw error;
    }
  }

  async scanWorkspaces(): Promise<Array<{ path: string; name: string; type: string }>> {
    try {
      await this.ensureInitialized();
      const response = await this.client!.scanWorkspaces({});
      return response.workspaces || [];
    } catch (error) {
      console.error('[ApiClient] Failed to scan workspaces:', error);
      throw error;
    }
  }

  // Target operations
  async listTargets(pattern = '//...', format = 'label_kind'): Promise<{ targets: BazelTarget[]; total: number }> {
    try {
      await this.ensureInitialized();
      const response = await this.client!.listTargets({ pattern, format });
      return {
        targets: response.targets || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error('[ApiClient] Failed to list targets:', error);
      throw error;
    }
  }

  async getTarget(label: string): Promise<BazelTarget | null> {
    try {
      await this.ensureInitialized();
      const response = await this.client!.getTarget({ target: label });
      return response.target || null;
    } catch (error) {
      console.error('[ApiClient] Failed to get target:', error);
      throw error;
    }
  }

  async searchTargets(query: string): Promise<{ targets: BazelTarget[]; total: number }> {
    try {
      await this.ensureInitialized();
      const response = await this.client!.searchTargets({ query });
      return {
        targets: response.targets || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error('[ApiClient] Failed to search targets:', error);
      throw error;
    }
  }

  async getTargetDependencies(target: string, depth = 1): Promise<{ dependencies: BazelTarget[]; total: number }> {
    try {
      await this.ensureInitialized();
      const response = await this.client!.getTargetDependencies({ target, depth });
      return {
        dependencies: response.dependencies || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error('[ApiClient] Failed to get target dependencies:', error);
      throw error;
    }
  }

  async getReverseDependencies(target: string): Promise<{ dependencies: BazelTarget[]; total: number }> {
    try {
      await this.ensureInitialized();
      const response = await this.client!.getReverseDependencies({ target });
      return {
        dependencies: response.dependencies || [],
        total: response.total || 0
      };
    } catch (error) {
      console.error('[ApiClient] Failed to get reverse dependencies:', error);
      throw error;
    }
  }

  async getTargetOutputs(target: string): Promise<{ outputs: string[]; count: number }> {
    try {
      await this.ensureInitialized();
      const response = await this.client!.getTargetOutputs({ target });
      return {
        outputs: response.outputs || [],
        count: response.count || 0
      };
    } catch (error) {
      console.error('[ApiClient] Failed to get target outputs:', error);
      throw error;
    }
  }

  // Query operations
  async executeQuery(query: string, outputFormat = 'label'): Promise<{ result: any; raw?: string }> {
    try {
      await this.ensureInitialized();
      const response = await this.client!.executeQuery({ 
        query,
        outputFormat
      });
      return {
        result: response.result,
        raw: response.raw
      };
    } catch (error) {
      console.error('[ApiClient] Failed to execute query:', error);
      throw error;
    }
  }

  // Build operations
  async buildTarget(target: string, options: string[] = []): Promise<{ success: boolean; output?: string; error?: string }> {
    try {
      await this.ensureInitialized();
      const response = await this.client!.buildTarget({ target, options });
      return response;
    } catch (error) {
      console.error('[ApiClient] Failed to build target:', error);
      throw error;
    }
  }

  // Module operations
  async getModuleGraph(): Promise<any> {
    try {
      await this.ensureInitialized();
      const response = await this.client!.getModuleGraph({});
      return response;
    } catch (error) {
      console.error('[ApiClient] Failed to get module graph:', error);
      throw error;
    }
  }

  // Streaming operations
  async *streamQuery(query: string, outputFormat = 'label', parseXml = false) {
    try {
      await this.ensureInitialized();
      const stream = this.client!.streamQuery({ 
        query,
        outputFormat,
        parseXml
      });

      for await (const response of stream) {
        yield response;
      }
    } catch (error) {
      console.error('[ApiClient] Failed to stream query:', error);
      throw error;
    }
  }

  async *streamBuild(target: string, options: string[] = []) {
    try {
      await this.ensureInitialized();
      const stream = this.client!.streamBuild({ 
        target,
        options
      });

      for await (const response of stream) {
        yield response;
      }
    } catch (error) {
      console.error('[ApiClient] Failed to stream build:', error);
      throw error;
    }
  }

  // Legacy REST API methods (for backward compatibility)
  async getWorkspaceFiles(path?: string): Promise<any> {
    // This would need to be implemented as a gRPC method or use REST fallback
    console.warn('[ApiClient] getWorkspaceFiles not yet implemented in gRPC');
    return { files: [] };
  }

  async getBuildFile(path: string): Promise<BuildFile | null> {
    // This would need to be implemented as a gRPC method or use REST fallback
    console.warn('[ApiClient] getBuildFile not yet implemented in gRPC');
    return null;
  }

  async getQueryTemplates(): Promise<QueryTemplate[]> {
    // This would need to be implemented as a gRPC method or use REST fallback
    console.warn('[ApiClient] getQueryTemplates not yet implemented in gRPC');
    return [];
  }

  async getSavedQueries(): Promise<SavedQuery[]> {
    // This would need to be implemented as a gRPC method or use REST fallback
    console.warn('[ApiClient] getSavedQueries not yet implemented in gRPC');
    return [];
  }

  async saveQuery(query: SavedQuery): Promise<SavedQuery> {
    // This would need to be implemented as a gRPC method or use REST fallback
    console.warn('[ApiClient] saveQuery not yet implemented in gRPC');
    return query;
  }

  async getCommandHistory(): Promise<CommandHistory[]> {
    // This would need to be implemented as a gRPC method or use REST fallback
    console.warn('[ApiClient] getCommandHistory not yet implemented in gRPC');
    return [];
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
export default apiClient;

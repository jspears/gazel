/**
 * Connect-ES gRPC Client for Gazel API
 * Using the official Connect-ES library for proper gRPC-web support
 */

import { createPromiseClient, createConnectTransport } from '@connectrpc/connect-web';
import { GazelService } from './generated/gazel_connect';
import type { PromiseClient } from '@connectrpc/connect';

// Type for the Gazel service client
export type GazelClient = PromiseClient<typeof GazelService>;

/**
 * Create a Connect client for the Gazel service
 * @param baseUrl The base URL of the server (e.g., 'http://localhost:3002')
 * @returns A promise-based client for the Gazel service
 */
export function createGazelClient(baseUrl: string): GazelClient {
  // Create a Connect transport for the browser
  const transport = createConnectTransport({
    baseUrl,
    // Use JSON format for easier debugging (can switch to binary for production)
    useBinaryFormat: false,
    // Add interceptors if needed (for auth, logging, etc.)
    interceptors: [],
  });

  // Create and return the promise-based client
  return createPromiseClient(GazelService, transport);
}

/**
 * Default client instance
 */
let defaultClient: GazelClient | null = null;

/**
 * Get or create the default client
 * @param baseUrl Optional base URL, defaults to current origin or localhost:3002
 * @returns The default Gazel client
 */
export function getDefaultClient(baseUrl?: string): GazelClient {
  if (!defaultClient) {
    // Determine the base URL
    const url = baseUrl || (
      typeof window !== 'undefined' 
        ? window.location.origin 
        : 'http://localhost:3002'
    );
    
    defaultClient = createGazelClient(url);
  }
  
  return defaultClient;
}

/**
 * Example usage wrapper for common operations
 */
export class GazelApiClient {
  private client: GazelClient;

  constructor(baseUrl?: string) {
    this.client = getDefaultClient(baseUrl);
  }

  /**
   * Get current workspace
   */
  async getCurrentWorkspace() {
    try {
      const response = await this.client.getCurrentWorkspace({});
      return response;
    } catch (error) {
      console.error('[GazelApiClient] Failed to get current workspace:', error);
      throw error;
    }
  }

  /**
   * Switch to a new workspace
   */
  async switchWorkspace(workspace: string) {
    try {
      const response = await this.client.switchWorkspace({ workspace });
      return response;
    } catch (error) {
      console.error('[GazelApiClient] Failed to switch workspace:', error);
      throw error;
    }
  }

  /**
   * Get workspace info
   */
  async getWorkspaceInfo(path?: string) {
    try {
      const response = await this.client.getWorkspaceInfo({ path });
      return response;
    } catch (error) {
      console.error('[GazelApiClient] Failed to get workspace info:', error);
      throw error;
    }
  }

  /**
   * Scan for workspaces
   */
  async scanWorkspaces(path?: string) {
    try {
      const response = await this.client.scanWorkspaces({ path });
      return response;
    } catch (error) {
      console.error('[GazelApiClient] Failed to scan workspaces:', error);
      throw error;
    }
  }

  /**
   * List targets
   */
  async listTargets(pattern = '//...', format?: string) {
    try {
      const response = await this.client.listTargets({ pattern, format });
      return response;
    } catch (error) {
      console.error('[GazelApiClient] Failed to list targets:', error);
      throw error;
    }
  }

  /**
   * Get a specific target
   */
  async getTarget(target: string) {
    try {
      const response = await this.client.getTarget({ target });
      return response;
    } catch (error) {
      console.error('[GazelApiClient] Failed to get target:', error);
      throw error;
    }
  }

  /**
   * Search targets
   */
  async searchTargets(query: string, type?: string, packageFilter?: string) {
    try {
      const response = await this.client.searchTargets({ 
        query, 
        type,
        package: packageFilter 
      });
      return response;
    } catch (error) {
      console.error('[GazelApiClient] Failed to search targets:', error);
      throw error;
    }
  }

  /**
   * Execute a Bazel query
   */
  async executeQuery(query: string, outputFormat = 'label') {
    try {
      const response = await this.client.executeQuery({ 
        query,
        output_format: outputFormat 
      });
      return response;
    } catch (error) {
      console.error('[GazelApiClient] Failed to execute query:', error);
      throw error;
    }
  }

  /**
   * Build a target
   */
  async buildTarget(target: string, options?: string[]) {
    try {
      const response = await this.client.buildTarget({ 
        target,
        options: options || []
      });
      return response;
    } catch (error) {
      console.error('[GazelApiClient] Failed to build target:', error);
      throw error;
    }
  }

  /**
   * Get target dependencies
   */
  async getTargetDependencies(target: string, depth = 1) {
    try {
      const response = await this.client.getTargetDependencies({ 
        target,
        depth
      });
      return response;
    } catch (error) {
      console.error('[GazelApiClient] Failed to get target dependencies:', error);
      throw error;
    }
  }

  /**
   * Get reverse dependencies
   */
  async getReverseDependencies(target: string) {
    try {
      const response = await this.client.getReverseDependencies({ target });
      return response;
    } catch (error) {
      console.error('[GazelApiClient] Failed to get reverse dependencies:', error);
      throw error;
    }
  }

  /**
   * Get target outputs
   */
  async getTargetOutputs(target: string) {
    try {
      const response = await this.client.getTargetOutputs({ target });
      return response;
    } catch (error) {
      console.error('[GazelApiClient] Failed to get target outputs:', error);
      throw error;
    }
  }

  /**
   * Get module graph
   */
  async getModuleGraph() {
    try {
      const response = await this.client.getModuleGraph({});
      return response;
    } catch (error) {
      console.error('[GazelApiClient] Failed to get module graph:', error);
      throw error;
    }
  }

  /**
   * Stream query results
   * Note: This returns an async iterable for streaming responses
   */
  async *streamQuery(query: string, outputFormat = 'label', parseXml = false) {
    try {
      const stream = this.client.streamQuery({ 
        query,
        output_format: outputFormat,
        parse_xml: parseXml
      });

      for await (const response of stream) {
        yield response;
      }
    } catch (error) {
      console.error('[GazelApiClient] Failed to stream query:', error);
      throw error;
    }
  }

  /**
   * Stream build output
   * Note: This returns an async iterable for streaming responses
   */
  async *streamBuild(target: string, options?: string[]) {
    try {
      const stream = this.client.streamBuild({ 
        target,
        options: options || []
      });

      for await (const response of stream) {
        yield response;
      }
    } catch (error) {
      console.error('[GazelApiClient] Failed to stream build:', error);
      throw error;
    }
  }
}

// Export a default instance for convenience
export const gazelApi = new GazelApiClient();

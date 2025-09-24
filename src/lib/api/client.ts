import type {
  WorkspaceInfo,
  BazelTarget,
  BuildFile,
  QueryTemplate,
  SavedQuery,
  CommandHistory
} from '$types';

const API_BASE = '/api';

class ApiClient {
  private async fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText }));
      const errorMessage = errorData.error || `HTTP ${response.status}`;
      const error: any = new Error(errorMessage);
      error.response = response;
      error.data = errorData;
      // Include command if present in error response
      if (errorData.command) {
        error.command = errorData.command;
      }
      throw error;
    }

    return response.json();
  }

  // Workspace endpoints
  async getWorkspaceInfo(): Promise<WorkspaceInfo> {
    return this.fetchJson<WorkspaceInfo>('/workspace/info');
  }

  async getWorkspaceFiles(): Promise<{ total: number; files: BuildFile[] }> {
    return this.fetchJson('/workspace/files');
  }

  async getWorkspaceConfig(): Promise<{ bazelrc_exists: boolean; configurations: Record<string, string[]> }> {
    return this.fetchJson('/workspace/config');
  }

  async getCurrentWorkspace(): Promise<{
    configured: boolean;
    workspace: string | null;
    valid?: boolean;
    error?: string;
  }> {
    return this.fetchJson('/workspace/current');
  }

  async scanWorkspaces(): Promise<{
    workspaces: Array<{
      path: string;
      name: string;
      type: 'current' | 'parent' | 'home' | 'discovered';
    }>
  }> {
    return this.fetchJson('/workspace/scan');
  }

  async switchWorkspace(workspace: string): Promise<{
    success: boolean;
    workspace: string;
    message: string;
  }> {
    return this.fetchJson('/workspace/switch', {
      method: 'POST',
      body: JSON.stringify({ workspace }),
    });
  }

  // Targets endpoints
  async listTargets(pattern = '//...', format = 'label_kind'): Promise<{
    total: number;
    targets: BazelTarget[];
    byPackage: Record<string, BazelTarget[]>;
  }> {
    return this.fetchJson(`/targets?pattern=${encodeURIComponent(pattern)}&format=${format}`);
  }

  async getTarget(target: string): Promise<BazelTarget> {
    return this.fetchJson(`/targets/${encodeURIComponent(target)}`);
  }

  async getTargetDependencies(target: string, depth = 1): Promise<{
    target: string;
    depth: number;
    total: number;
    dependencies: BazelTarget[];
  }> {
    // Use query parameters to avoid conflicts with complex target names
    const params = new URLSearchParams({ target, depth: depth.toString() });
    return this.fetchJson(`/targets/dependencies?${params}`);
  }

  async getTargetsByFile(file: string): Promise<{
    file: string;
    total: number;
    targets: BazelTarget[];
  }> {
    return this.fetchJson(`/targets/by-file?file=${encodeURIComponent(file)}`);
  }

  async getTargetOutputs(target: string): Promise<{
    target: string;
    outputs: Array<{path: string; filename: string; type: string}>;
    count: number;
    error?: string;
  }> {
    // Use query parameter instead of path to avoid conflicts with targets containing /outputs
    const params = new URLSearchParams({ target });
    return this.fetchJson(`/targets/outputs?${params}`);
  }

  async getReverseDependencies(target: string): Promise<{
    target: string;
    total: number;
    dependencies: BazelTarget[];
  }> {
    // Use query parameter to avoid conflicts with complex target names
    const params = new URLSearchParams({ target });
    return this.fetchJson(`/targets/rdeps?${params}`);
  }

  async searchTargets(query: string, type?: string, pkg?: string): Promise<{
    query: string;
    total: number;
    targets: BazelTarget[];
  }> {
    return this.fetchJson('/targets/search', {
      method: 'POST',
      body: JSON.stringify({ query, type, package: pkg }),
    });
  }

  // Query endpoints
  async executeQuery(query: string, outputFormat = 'label_kind'): Promise<{
    query: string;
    outputFormat: string;
    result: { targets: BazelTarget[] };
    raw: string;
  }> {
    return this.fetchJson('/query', {
      method: 'POST',
      body: JSON.stringify({ query, outputFormat }),
    });
  }

  async getSavedQueries(): Promise<SavedQuery[]> {
    return this.fetchJson('/query/saved');
  }

  async saveQuery(name: string, query: string, description?: string): Promise<SavedQuery> {
    return this.fetchJson('/query/save', {
      method: 'POST',
      body: JSON.stringify({ name, query, description }),
    });
  }

  async deleteQuery(id: string): Promise<{ success: boolean }> {
    return this.fetchJson(`/query/saved/${id}`, {
      method: 'DELETE',
    });
  }

  async getQueryTemplates(): Promise<QueryTemplate[]> {
    return this.fetchJson('/query/templates');
  }

  // Files endpoints
  async listBuildFiles(): Promise<{ total: number; files: BuildFile[] }> {
    return this.fetchJson('/files/build');
  }

  async getBuildFile(path: string): Promise<{
    path: string;
    content: string;
    targets: Array<{ ruleType: string; name: string; line: number }>;
    lines: number;
  }> {
    return this.fetchJson(`/files/build/${encodeURIComponent(path)}`);
  }

  async getWorkspaceFile(): Promise<{
    path: string;
    content: string;
    workspaceName: string;
    externalDependencies: string[];
    lines: number;
  }> {
    return this.fetchJson('/files/workspace');
  }

  async searchInFiles(query: string, caseSensitive = false): Promise<{
    query: string;
    caseSensitive: boolean;
    total: number;
    results: Array<{ file: string; line: number; content: string }>;
  }> {
    return this.fetchJson('/files/search', {
      method: 'POST',
      body: JSON.stringify({ query, caseSensitive }),
    });
  }

  // Commands endpoints
  async buildTarget(target: string, options: string[] = []): Promise<{
    success: boolean;
    output: string;
    stderr?: string;
    error?: string;
  }> {
    return this.fetchJson('/commands/build', {
      method: 'POST',
      body: JSON.stringify({ target, options }),
    });
  }

  async testTarget(target: string, options: string[] = []): Promise<{
    success: boolean;
    output: string;
    stderr?: string;
    error?: string;
  }> {
    return this.fetchJson('/commands/test', {
      method: 'POST',
      body: JSON.stringify({ target, options }),
    });
  }

  streamBuild(target: string, options: string[] = [], onMessage: (data: any) => void): EventSource {
    const params = new URLSearchParams({ target, options: options.join(',') });
    const eventSource = new EventSource(`${API_BASE}/commands/build/stream?${params}`);

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    return eventSource;
  }

  async streamRun(target: string, options: string[] = [], onMessage: (data: any) => void): Promise<() => void> {
    const response = await fetch(`${API_BASE}/commands/run/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ target, options }),
    });

    if (!response.ok) {
      throw new Error(`Failed to start stream: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const readStream = async () => {
      if (!reader) return;

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            // Stream ended normally or was closed
            if (buffer.trim()) {
              // Process any remaining data in buffer
              if (buffer.startsWith('data: ')) {
                try {
                  const data = JSON.parse(buffer.slice(6));
                  onMessage(data);
                } catch (e) {
                  console.error('Failed to parse final SSE data:', e);
                }
              }
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                onMessage(data);
              } catch (e) {
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      } catch (error) {
        console.error('Stream reading error:', error);
        // Send an error message to the callback
        onMessage({ type: 'error', data: 'Stream connection lost' });
      }
    };

    readStream();

    // Return a cleanup function
    return () => {
      reader?.cancel();
    };
  }

  async getCommandHistory(limit = 50): Promise<{
    total: number;
    history: CommandHistory[];
  }> {
    return this.fetchJson(`/commands/history?limit=${limit}`);
  }

  async clearCommandHistory(): Promise<{ success: boolean }> {
    return this.fetchJson('/commands/history', {
      method: 'DELETE',
    });
  }

  async cleanBazel(expunge = false): Promise<{
    success: boolean;
    output: string;
    error?: string;
  }> {
    return this.fetchJson('/commands/clean', {
      method: 'POST',
      body: JSON.stringify({ expunge }),
    });
  }

  // Streaming endpoints for large queries
  async streamQuery(query: string, parseXml = false): Promise<Response> {
    const response = await fetch('/api/stream/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        outputFormat: 'xml',
        parseXml
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || 'Stream query failed');
    }

    return response;
  }

  async streamQueryCompact(query: string): Promise<Response> {
    const response = await fetch('/api/stream/query-compact', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || 'Stream query failed');
    }

    return response;
  }

  /**
   * Stream and parse large XML query results
   */
  async *streamQueryAsObjects(query: string): AsyncGenerator<any, void, unknown> {
    const response = await this.streamQuery(query, true);
    const reader = response.body?.getReader();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Try to parse complete JSON objects from the buffer
        // The stream sends JSON objects separated by commas and newlines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && trimmed !== '[' && trimmed !== ']') {
            // Remove trailing comma if present
            const jsonStr = trimmed.endsWith(',') ? trimmed.slice(0, -1) : trimmed;
            try {
              const obj = JSON.parse(jsonStr);
              yield obj;
            } catch (e) {
              // Skip malformed JSON
              console.warn('Failed to parse JSON chunk:', jsonStr);
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim() && buffer.trim() !== ']') {
        const jsonStr = buffer.trim().endsWith(',') ? buffer.trim().slice(0, -1) : buffer.trim();
        try {
          const obj = JSON.parse(jsonStr);
          yield obj;
        } catch (e) {
          console.warn('Failed to parse final JSON chunk:', jsonStr);
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

export const api = new ApiClient();

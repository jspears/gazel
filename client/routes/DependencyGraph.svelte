<script lang="ts">
  import { onMount } from 'svelte';
  import { GitBranch, Search, Download, ZoomIn, ZoomOut, Maximize2 } from 'lucide-svelte';
  import DependencyGraph from '../components/DependencyGraph.svelte';
  import EnhancedDependencyGraph from '../components/EnhancedDependencyGraph.svelte';
  import ElkDependencyGraph from '../components/ElkDependencyGraph.svelte';
  import { api } from '../client.js';
  import { updateParam } from '../lib/navigation.js';

  export let target: string | null = null;

  $: targetInput = target;
  let filterInput = '';
  let xmlData = '';
  let targets: any[] = [];
  let loading = false;
  let error: string | null = null;
  let showRawXml = false;
  let queryType = 'deps'; // 'deps' or 'direct'
  let maxDepth = 0; // 0 means unlimited
  let useStreaming = true; // Use streaming with streamed_jsonproto for better performance
  let useJsonProto = true; // Use streamed_jsonproto instead of XML

  // Example targets for quick access
  const exampleTargets = [
    '//...',
    '//src/...',
    '//test/...',
    '//clients/vscode:test',
    '//server:main',
    '//lib/...'
  ];

  // Watch for initialTarget changes
  $: if (target){
    // Automatically generate the graph when a target is provided
    if (useStreaming) {
      fetchDependencyGraphStreaming();
    } else {
      fetchDependencyGraph();
    }
  }
  
  async function fetchDependencyGraph() {
    if (!targetInput.trim()) {
      error = 'Please enter a target pattern';
      return;
    }

    loading = true;
    error = null;
    targets = [];

    try {
      // Build query based on options
      let query: string;
      if (queryType === 'direct') {
        // Only direct dependencies
        query = `filter("^${targetInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$", deps(${targetInput}, 1))`;
      } else if (maxDepth > 0) {
        // Limited depth
        query = `deps(${targetInput}, ${maxDepth})`;
      } else {
        // Full transitive dependencies
        query = `deps(${targetInput})`;
      }

      if (useJsonProto) {
        // Use streamed_jsonproto for structured data
        const result = await api.executeQuery({
          query,
          outputFormat: 'streamed_jsonproto'
        });

        if (result.result && result.result.length > 0) {
          targets = result.result;
          xmlData = convertTargetsToXml(targets);
        } else {
          error = 'No data received from query';
        }
      } else {
        // Use XML format
        const result = await api.executeQuery({ query, outputFormat: 'xml' });

        if (result.raw) {
          xmlData = result.raw;
        } else {
          error = 'No XML data received from query';
        }
      }
    } catch (err: any) {
      error = err.message || 'Failed to fetch dependency graph';
      if (err.details) {
        error += `\n${err.details}`;
      }
      // If buffer exceeded, suggest using streaming
      if (error.includes('maxBuffer')) {
        error += '\n\nTip: Try enabling streaming mode for very large graphs.';
      }
    } finally {
      loading = false;
    }
  }
  
  function useExampleTarget(target: string) {
    targetInput = target;
    fetchDependencyGraph();
  }

  function downloadDot() {
    // For DOT format, we need to re-query with graph output
    fetchDotFormat();
  }
  
  async function fetchDotFormat() {
    if (!targetInput.trim()) return;

    try {
      const query = `deps(${targetInput})`;
      const result = await api.executeQuery({query, queryType: 'query', outputFormat: 'graph'});

      if (result.raw) {
        const blob = new Blob([result.raw], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `dependency-graph-${targetInput.replace(/[^a-z0-9]/gi, '_')}.dot`;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Failed to download DOT format:', err);
    }
  }

  async function fetchDependencyGraphStreaming() {
    if (!targetInput.trim()) {
      error = 'Please enter a target pattern';
      return;
    }

    loading = true;
    error = null;
    xmlData = '';
    targets = [];

    try {
      // Build query based on options
      let query: string;
      if (queryType === 'direct') {
        query = `filter("^${targetInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$", deps(${targetInput}, 1))`;
      } else if (maxDepth > 0) {
        query = `deps(${targetInput}, ${maxDepth})`;
      } else {
        query = `deps(${targetInput})`;
      }

      if (useJsonProto) {
        // Use streamed_jsonproto format for structured data
        const response = api.streamQuery({
          query,
          outputFormat: 'streamed_jsonproto'
        });

        for await (const message of response) {
          if (message.data.case === 'target') {
            // Collect targets as they stream in
            targets.push(message.data.value);
          } else if (message.data.case === 'error') {
            error = message.data.value;
            break;
          }
        }

        // Convert targets to XML format for the graph component
        // (ElkDependencyGraph expects XML, we'll need to convert or update the component)
        xmlData = convertTargetsToXml(targets);

        if (!xmlData && targets.length === 0) {
          error = 'No data received from query';
        }
      } else {
        // Use XML format
        const response = api.streamQuery({
          query,
          outputFormat: 'xml'
        });

        for await (const message of response) {
          if (message.data.case === 'rawLine') {
            xmlData += message.data.value;
          } else if (message.data.case === 'error') {
            error = message.data.value;
            break;
          }
        }

        if (!xmlData) {
          error = 'No XML data received from query';
        }
      }
    } catch (err: any) {
      error = err.message || 'Failed to fetch dependency graph';
      if (err.details) {
        error += `\n${err.details}`;
      }
    } finally {
      loading = false;
    }
  }

  // Convert targets from streamed_jsonproto to XML format
  function convertTargetsToXml(targets: any[]): string {
    if (targets.length === 0) return '';

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<query version="2">\n';

    for (const target of targets) {
      xml += `  <rule class="${target.ruleClass || 'unknown'}" location="${target.location || ''}" name="${target.label || ''}">\n`;

      // Add attributes if available
      if (target.attributes && target.attributes.length > 0) {
        for (const attr of target.attributes) {
          if (attr.name === 'deps' && attr.stringListValue) {
            xml += `    <list name="deps">\n`;
            for (const dep of attr.stringListValue) {
              xml += `      <label value="${dep}" />\n`;
            }
            xml += `    </list>\n`;
          }
        }
      }

      xml += `  </rule>\n`;
    }

    xml += '</query>';
    return xml;
  }
</script>

<div class="space-y-6">
  <!-- Controls Section -->
  <div class="bg-card rounded-lg border p-6">
    <div class="space-y-4">
      <div>
        <label for="target" class="block text-sm font-medium mb-2">
          Target Pattern
        </label>
        <div class="flex gap-2">
          <input
            id="target"
            type="text"
            bind:value={targetInput}
            placeholder="e.g., //clients/vscode:test or //..."
            class="flex-1 px-3 py-2 border rounded-md bg-background"
            on:keydown={(e) => e.key === 'Enter' && fetchDependencyGraph()}
          />
          <button
            on:click={() => useStreaming ? fetchDependencyGraphStreaming() : fetchDependencyGraph()}
            disabled={loading || !targetInput.trim()}
            class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            <GitBranch class="w-4 h-4" />
            {loading ? 'Loading...' : 'Generate Graph'}
          </button>
        </div>
      </div>
      
      <!-- Query Options -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label for="queryType" class="block text-sm font-medium mb-2">
            Query Type
          </label>
          <select
            id="queryType"
            bind:value={queryType}
            class="w-full px-3 py-2 border rounded-md bg-background"
          >
            <option value="deps">All Dependencies</option>
            <option value="direct">Direct Dependencies Only</option>
          </select>
        </div>

        <div>
          <label for="maxDepth" class="block text-sm font-medium mb-2">
            Max Depth (0 = unlimited)
          </label>
          <input
            id="maxDepth"
            type="number"
            min="0"
            max="10"
            bind:value={maxDepth}
            disabled={queryType === 'direct'}
            class="w-full px-3 py-2 border rounded-md bg-background disabled:opacity-50"
          />
        </div>

        <div>
          <label for="filter" class="block text-sm font-medium mb-2">
            Filter Targets (optional)
          </label>
          <div class="flex gap-2">
            <input
              id="filter"
              type="text"
              bind:value={filterInput}
              placeholder="Filter by name..."
              class="flex-1 px-3 py-2 border rounded-md bg-background"
            />
            <button
              class="px-3 py-2 border rounded-md hover:bg-muted"
              title="Search"
            >
              <Search class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Advanced Options -->
      <div class="flex items-center gap-4 pt-2 border-t">
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            bind:checked={useStreaming}
            class="rounded"
          />
          <span>Use Streaming (for large graphs)</span>
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            bind:checked={useJsonProto}
            class="rounded"
          />
          <span>Use JSON Proto (faster, structured data)</span>
        </label>
      </div>

      <!-- Example Targets -->
      <div>
        <p class="text-sm text-muted-foreground mb-2">Quick examples:</p>
        <div class="flex flex-wrap gap-2">
          {#each exampleTargets as target}
            <button
              on:click={() => useExampleTarget(target)}
              class="px-3 py-1 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80"
            >
              {target}
            </button>
          {/each}
        </div>
      </div>

    </div>
  </div>
  
  <!-- Graph Display -->
  {#if error}
    <div class="bg-destructive/10 text-destructive p-4 rounded-md">
      <pre class="whitespace-pre-wrap">{error}</pre>
    </div>
  {/if}
  
  {#if xmlData}
    <div class="bg-card rounded-lg border">
      <div class="p-4 border-b flex items-center justify-between">
        <h3 class="font-semibold flex items-center gap-2">
          <GitBranch class="w-4 h-4" />
          Dependency Graph
          {#if targetInput}
            <span class="text-sm font-normal text-muted-foreground">
              for {targetInput}
              {#if targets.length > 0}
                ({targets.length} targets)
              {/if}
            </span>
          {/if}
        </h3>
        
        <div class="flex items-center gap-2">
          <button
            on:click={downloadDot}
            class="px-3 py-1 text-sm border rounded-md hover:bg-muted flex items-center gap-1"
            title="Download as DOT"
          >
            <Download class="w-4 h-4" />
            DOT
          </button>
          <button
            on:click={() => showRawXml = !showRawXml}
            class="px-3 py-1 text-sm border rounded-md hover:bg-muted"
            title="Toggle raw XML"
          >
            {showRawXml ? 'Hide' : 'Show'} XML
          </button>
        </div>
      </div>
      
      <div class="p-4">
        {#if showRawXml}
          <div class="mb-4">
            <h4 class="text-sm font-medium mb-2">Raw XML Output</h4>
            <pre class="font-mono text-xs bg-muted p-4 rounded overflow-x-auto max-h-64">
              {xmlData}
            </pre>
          </div>
        {/if}
        
        <div class="bg-background rounded-lg" style="height: 600px;">
            <ElkDependencyGraph {xmlData} filter={filterInput} />
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Instructions -->
  {#if !xmlData && !loading}
    <div class="bg-card rounded-lg border p-8 text-center">
      <GitBranch class="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
      <h3 class="text-lg font-semibold mb-2">Visualize Bazel Dependencies</h3>
      <p class="text-muted-foreground mb-4">
        Enter a target pattern above to generate an interactive dependency graph.
      </p>
      <div class="text-sm text-muted-foreground space-y-2">
        <p><strong>Examples:</strong></p>
        <p><code>//...</code> - All targets in the workspace</p>
        <p><code>//src/...</code> - All targets under src/</p>
        <p><code>//app:main</code> - Specific target</p>
        <p><code>deps(//app:main)</code> - Dependencies of a target</p>
      </div>
    </div>
  {/if}
</div>

<style>
  code {
    background-color: var(--muted);
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
    font-family: monospace;
  }
</style>

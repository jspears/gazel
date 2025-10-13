<script lang="ts">
  import { onMount } from 'svelte';
  import { Play, Save, BookOpen, Trash2, Clock } from 'lucide-svelte';
  import { api } from '../client.js';
  import type { QueryTemplate, SavedQuery, BazelTarget } from '@speajus/gazel-proto';
  import { storage } from '../lib/storage.js';
  import { toFull } from '../components/target-util.js';
  import { Graphviz } from '@hpcc-js/wasm/graphviz';
  
  let query = '';
  let queryType = 'query'; // 'query', 'aquery', or 'cquery'
  let outputFormat = 'label_kind';
  let queryResult: { targets: BazelTarget[] } | null = null;
  let rawOutput = '';
  let templates: QueryTemplate[] = [];
  let savedQueries: SavedQuery[] = [];
  let loading = false;
  let error: string | null = null;
  let saveDialogOpen = false;
  let queryName = '';
  let queryDescription = '';
  let recentQueries = storage.getRecentQueries();
  let graphSvg = '';
  let graphContainer: HTMLDivElement;

  // Output formats available for each query type
  const outputFormats = {
    query: [
      { value: 'label', label: 'Label' },
      { value: 'label_kind', label: 'Label with Kind' },
      { value: 'xml', label: 'XML' },
      { value: 'graph', label: 'Graph (DOT)' },
      { value: 'proto', label: 'Protocol Buffer' },
      { value: 'textproto', label: 'Text Protocol Buffer' },
      { value: 'jsonproto', label: 'JSON Protocol Buffer' },
    ],
    cquery: [
      { value: 'label', label: 'Label' },
      { value: 'label_kind', label: 'Label with Kind' },
      { value: 'transitions', label: 'Transitions (lite)' },
      { value: 'proto', label: 'Protocol Buffer' },
      { value: 'textproto', label: 'Text Protocol Buffer' },
      { value: 'jsonproto', label: 'JSON Protocol Buffer' },
      { value: 'graph', label: 'Graph (DOT)' },
      { value: 'files', label: 'Output Files' },
      { value: 'starlark', label: 'Starlark' },
    ],
    aquery: [
      { value: 'text', label: 'Text (human-readable)' },
      { value: 'summary', label: 'Summary' },
      { value: 'proto', label: 'Protocol Buffer' },
      { value: 'textproto', label: 'Text Protocol Buffer' },
      { value: 'jsonproto', label: 'JSON Protocol Buffer' },
      { value: 'commands', label: 'Commands' },
    ],
  };

  // Get available formats for current query type
  $: availableFormats = outputFormats[queryType as keyof typeof outputFormats] || outputFormats.query;

  // Update output format when query type changes if current format is not available
  $: {
    const formatValues = availableFormats.map(f => f.value);
    if (!formatValues.includes(outputFormat)) {
      // Set to first available format for this query type
      outputFormat = availableFormats[0]?.value || 'label_kind';
    }
  }

  // Separate templates into examples and regular templates
  $: exampleTemplates = templates.filter(t => t.category === 'examples');
  $: regularTemplates = templates.filter(t => t.category !== 'examples');

  onMount(() => {
    loadTemplates();
    loadSavedQueries();
    recentQueries = storage.getRecentQueries();
  });

  async function loadTemplates() {
    try {
      templates = (await api.getQueryTemplates({})).templates;
    } catch (err: any) {
      // Don't log error if request was aborted due to page reload (workspace switching)
      if (!err.isAborted) {
        console.error('Failed to load templates:', err);
      }
    }
  }

  async function loadSavedQueries() {
    try {
      savedQueries = (await api.getSavedQueries()).queries;
    } catch (err: any) {
      // Don't log error if request was aborted due to page reload (workspace switching)
      if (!err.isAborted) {
        console.error('Failed to load saved queries:', err);
      }
    }
  }

  async function renderGraph(dotSource: string) {
    try {
      const graphviz = await Graphviz.load();
      const svg = graphviz.dot(dotSource);
      graphSvg = svg;
    } catch (err) {
      console.error('Failed to render graph:', err);
      graphSvg = '';
    }
  }

  async function executeQuery() {
    if (!query.trim()) return;

    try {
      loading = true;
      error = null;
      graphSvg = '';
      const result = await api.executeQuery({ query, outputFormat, queryType });
      queryResult = result.result;
      rawOutput = result.raw;

      // If output format is graph, render it
      if (outputFormat === 'graph' && rawOutput) {
        await renderGraph(rawOutput);
      }

      // Save to recent queries
      storage.addRecentQuery(query, outputFormat);
      recentQueries = storage.getRecentQueries();
    } catch (err: any) {
      // Don't show error if request was aborted due to page reload (workspace switching)
      if (!err.isAborted) {
        error = err.message;
        // Check if the error contains command info
        if (err.command) {
          error += `\n\nFailed command: ${err.command}`;
        }
      }
      if (err.data?.details) {
        error += `\n\nDetails: ${err.data.details}`;
      }
      queryResult = null;
    } finally {
      loading = false;
    }
  }

  async function saveQuery() {
    if (!queryName.trim() || !query.trim()) return;

    try {
      await api.saveQuery(queryName, query, queryDescription);
      await loadSavedQueries();
      saveDialogOpen = false;
      queryName = '';
      queryDescription = '';
    } catch (err: any) {
      error = err.message;
    }
  }

  async function deleteQuery(id: string) {
    try {
      await api.deleteQuery(id);
      await loadSavedQueries();
    } catch (err: any) {
      error = err.message;
    }
  }

  function useTemplate(template: QueryTemplate) {
    // Set the query type and output format from the template
    if (template.queryType) {
      queryType = template.queryType;
    }
    if (template.outputFormat) {
      outputFormat = template.outputFormat;
    }

    // If template has parameters, show a simple substitution
    if (template.parameters && template.parameters.length > 0) {
      // Replace parameters with placeholder format
      let queryText = template.template;
      for (const param of template.parameters) {
        queryText = queryText.replace(`{${param}}`, `<${param}>`);
      }
      query = queryText;
    } else {
      query = template.template;
    }
  }

  function useSavedQuery(savedQuery: SavedQuery) {
    query = savedQuery.query;
  }
</script>

<div class="space-y-6">
  <div class="bg-card rounded-lg border p-6">
    <div class="space-y-4">
      <div>
        <label for="query" class="block text-sm font-medium mb-2">Bazel Query</label>
        <textarea
          id="query"
          bind:value={query}
          placeholder="Enter your Bazel query expression..."
          class="w-full h-32 px-3 py-2 border rounded-md bg-background font-mono text-sm"
        ></textarea>
      </div>

      <div class="flex gap-4">
        <div class="flex-1">
          <label for="queryType" class="block text-sm font-medium mb-2">Query Type</label>
          <select
            id="queryType"
            bind:value={queryType}
            class="w-full px-3 py-2 border rounded-md bg-background"
          >
            <option value="query">query - Standard query</option>
            <option value="cquery">cquery - Configured query</option>
            <option value="aquery">aquery - Action graph query</option>
          </select>
        </div>

        <div class="flex-1">
          <label for="format" class="block text-sm font-medium mb-2">Output Format</label>
          <select
            id="format"
            bind:value={outputFormat}
            class="w-full px-3 py-2 border rounded-md bg-background"
          >
            {#each availableFormats as format}
              <option value={format.value}>{format.label}</option>
            {/each}
          </select>
        </div>

        <div class="flex items-end gap-2">
          <button
           onclick={executeQuery}
            disabled={loading || !query.trim()}
            class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            <Play class="w-4 h-4" />
            Execute
          </button>
          <button
           onclick={() => saveDialogOpen = true}
            disabled={!query.trim()}
            class="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 disabled:opacity-50 flex items-center gap-2"
          >
            <Save class="w-4 h-4" />
            Save
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="space-y-4">
      {#if exampleTemplates.length > 0}
        <div class="bg-card rounded-lg border">
          <div class="p-4 border-b">
            <h3 class="font-semibold flex items-center gap-2">
              <Play class="w-4 h-4" />
              Example Queries
            </h3>
            <p class="text-xs text-muted-foreground mt-1">Ready-to-run examples</p>
          </div>
          <div class="max-h-[300px] overflow-y-auto">
            {#each exampleTemplates as template}
              <button
               onclick={() => useTemplate(template)}
                class="w-full text-left px-4 py-3 hover:bg-muted border-b last:border-b-0 transition-colors"
              >
                <div class="flex items-center gap-2 mb-1">
                  <div class="font-medium text-sm">{template.name}</div>
                  {#if template.queryType}
                    <span
                      class="text-xs px-1.5 py-0.5 rounded font-mono {template.queryType === 'query' ? 'bg-blue-500/10 text-blue-600' : template.queryType === 'cquery' ? 'bg-purple-500/10 text-purple-600' : 'bg-green-500/10 text-green-600'}"
                    >
                      {template.queryType}
                    </span>
                  {/if}
                </div>
                <div class="text-xs text-muted-foreground">{template.description}</div>
                <div class="text-xs font-mono text-muted-foreground mt-1 bg-muted/30 px-2 py-1 rounded">
                  {template.template}
                </div>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      <div class="bg-card rounded-lg border">
        <div class="p-4 border-b">
          <h3 class="font-semibold flex items-center gap-2">
            <BookOpen class="w-4 h-4" />
            Query Templates
          </h3>
          <p class="text-xs text-muted-foreground mt-1">Templates with parameters</p>
        </div>
        <div class="max-h-[400px] overflow-y-auto">
          {#each regularTemplates as template}
            <button
             onclick={() => useTemplate(template)}
              class="w-full text-left px-4 py-3 hover:bg-muted border-b last:border-b-0 transition-colors"
            >
              <div class="flex items-center gap-2 mb-1">
                <div class="font-medium text-sm">{template.name}</div>
                {#if template.category}
                  <span
                    class="text-xs px-1.5 py-0.5 rounded font-mono {template.category === 'query' ? 'bg-blue-500/10 text-blue-600' : template.queryType === 'cquery' ? 'bg-purple-500/10 text-purple-600' : 'bg-green-500/10 text-green-600'}"
                  >
                    {template.category}
                  </span>
                {/if}
              </div>
              <div class="text-xs text-muted-foreground">{template.description}</div>
              <div class="text-xs font-mono text-muted-foreground mt-1 bg-muted/30 px-2 py-1 rounded">
                {template.template}
              </div>
            </button>
          {/each}
        </div>
      </div>

      <div class="bg-card rounded-lg border">
        <div class="p-4 border-b">
          <h3 class="font-semibold">Saved Queries</h3>
        </div>
        <div class="max-h-[300px] overflow-y-auto">
          {#if savedQueries.length === 0}
            <div class="p-4 text-sm text-muted-foreground">No saved queries</div>
          {/if}
          {#each savedQueries as saved}
            <div class="px-4 py-3 hover:bg-muted border-b last:border-b-0 flex items-center justify-between">
              <button
               onclick={() => useSavedQuery(saved)}
                class="flex-1 text-left"
              >
                <div class="font-medium text-sm">{saved.name}</div>
                {#if saved.description}
                  <div class="text-xs text-muted-foreground mt-1">{saved.description}</div>
                {/if}
              </button>
              <button
               onclick={() => deleteQuery(saved.id)}
                class="p-1 hover:bg-destructive/10 rounded"
              >
                <Trash2 class="w-4 h-4 text-destructive" />
              </button>
            </div>
          {/each}
        </div>
      </div>

      <div class="bg-card rounded-lg border">
        <div class="p-4 border-b flex items-center justify-between">
          <h3 class="font-semibold flex items-center gap-2">
            <Clock class="w-4 h-4" />
            Recent Queries
          </h3>
          {#if recentQueries.length > 0}
            <button
             onclick={() => {
                storage.clearRecentQueries();
                recentQueries = [];
              }}
              class="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          {/if}
        </div>
        <div class="max-h-[300px] overflow-y-auto">
          {#if recentQueries.length === 0}
            <div class="p-4 text-sm text-muted-foreground">No recent queries</div>
          {/if}
          {#each recentQueries as recent}
            <button
             onclick={() => {
                query = recent.query;
                outputFormat = recent.format;
              }}
              class="w-full text-left px-4 py-3 hover:bg-muted border-b last:border-b-0"
            >
              <div class="font-mono text-sm truncate">{recent.query}</div>
              <div class="text-xs text-muted-foreground mt-1">
                Format: {recent.format} • {new Date(recent.timestamp).toLocaleString()}
              </div>
            </button>
          {/each}
        </div>
      </div>
    </div>

    <div class="lg:col-span-2 bg-card rounded-lg border">
      <div class="p-4 border-b">
        <h3 class="font-semibold">
          Query Results
          {#if queryResult && queryResult.targets && queryResult.targets.length > 0}
            <span class="text-sm font-normal text-muted-foreground ml-2">
              (Found {queryResult.targets.length} targets)
            </span>
          {/if}
        </h3>
      </div>
      <div class="p-4 max-h-[600px] overflow-auto">
        {#if loading}
          <div class="text-muted-foreground">Executing query...</div>
        {:else if error}
          <div class="bg-destructive/10 text-destructive p-4 rounded-md">
            <pre class="whitespace-pre-wrap">{error}</pre>
          </div>
        {:else if queryResult}
          <div class="space-y-2">
            <div class="text-sm text-muted-foreground mb-2">
              Found {queryResult.targets.length} targets
            </div>
            {#if outputFormat === 'graph'}
              {#if graphSvg}
                <div class="border rounded-lg p-4 bg-white overflow-auto" bind:this={graphContainer}>
                  {@html graphSvg}
                </div>
              {:else}
                <pre class="font-mono text-xs bg-muted p-4 rounded overflow-x-auto">{rawOutput}</pre>
              {/if}
            {:else if outputFormat === 'xml'}
              <pre class="font-mono text-xs bg-muted p-4 rounded overflow-x-auto">{rawOutput}</pre>
            {:else}
              {#each queryResult.targets as target}
                <div class="font-mono text-sm py-1">
                  {target.label || target.name || toFull(target)}
                  {#if target.kind}
                    <span class="text-muted-foreground ml-2">({target.kind})</span>
                  {/if}
                </div>
              {/each}
            {/if}
          </div>
        {:else}
          <p class="text-muted-foreground">Execute a query to see results</p>
        {/if}
      </div>
    </div>
  </div>

  {#if saveDialogOpen}
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div class="bg-card p-6 rounded-lg w-full max-w-md">
        <h3 class="text-lg font-semibold mb-4">Save Query</h3>
        <div class="space-y-4">
          <div>
            <label for="name" class="block text-sm font-medium mb-2">Name</label>
            <input
              id="name"
              type="text"
              bind:value={queryName}
              class="w-full px-3 py-2 border rounded-md bg-background"
              placeholder="My Query"
            />
          </div>
          <div>
            <label for="description" class="block text-sm font-medium mb-2">Description (optional)</label>
            <textarea
              id="description"
              bind:value={queryDescription}
              class="w-full h-20 px-3 py-2 border rounded-md bg-background"
              placeholder="What does this query do?"
            ></textarea>
          </div>
          <div class="flex gap-2 justify-end">
            <button
             onclick={() => saveDialogOpen = false}
              class="px-4 py-2 border rounded-md hover:bg-muted"
            >
              Cancel
            </button>
            <button
             onclick={saveQuery}
              disabled={!queryName.trim()}
              class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

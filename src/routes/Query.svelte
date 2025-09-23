<script lang="ts">
  import { onMount } from 'svelte';
  import { Play, Save, BookOpen, Trash2 } from 'lucide-svelte';
  import { api } from '$lib/api/client';
  import type { QueryTemplate, SavedQuery, BazelTarget } from '$lib/types';
  
  let query = '';
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

  onMount(() => {
    loadTemplates();
    loadSavedQueries();
  });

  async function loadTemplates() {
    try {
      templates = await api.getQueryTemplates();
    } catch (err) {
      console.error('Failed to load templates:', err);
    }
  }

  async function loadSavedQueries() {
    try {
      savedQueries = await api.getSavedQueries();
    } catch (err) {
      console.error('Failed to load saved queries:', err);
    }
  }

  async function executeQuery() {
    if (!query.trim()) return;

    try {
      loading = true;
      error = null;
      const result = await api.executeQuery(query, outputFormat);
      queryResult = result.result;
      rawOutput = result.raw;
    } catch (err: any) {
      error = err.message;
      // Check if the error contains command info
      if (err.command) {
        error += `\n\nFailed command: ${err.command}`;
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
    query = template.query;
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
        />
      </div>

      <div class="flex gap-4">
        <div class="flex-1">
          <label for="format" class="block text-sm font-medium mb-2">Output Format</label>
          <select
            id="format"
            bind:value={outputFormat}
            class="w-full px-3 py-2 border rounded-md bg-background"
          >
            <option value="label">Label</option>
            <option value="label_kind">Label with Kind</option>
            <option value="xml">XML</option>
          </select>
        </div>

        <div class="flex items-end gap-2">
          <button
            on:click={executeQuery}
            disabled={loading || !query.trim()}
            class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
          >
            <Play class="w-4 h-4" />
            Execute
          </button>
          <button
            on:click={() => saveDialogOpen = true}
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
      <div class="bg-card rounded-lg border">
        <div class="p-4 border-b">
          <h3 class="font-semibold flex items-center gap-2">
            <BookOpen class="w-4 h-4" />
            Query Templates
          </h3>
        </div>
        <div class="max-h-[300px] overflow-y-auto">
          {#each templates as template}
            <button
              on:click={() => useTemplate(template)}
              class="w-full text-left px-4 py-3 hover:bg-muted border-b last:border-b-0"
            >
              <div class="font-medium text-sm">{template.name}</div>
              <div class="text-xs text-muted-foreground mt-1">{template.description}</div>
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
                on:click={() => useSavedQuery(saved)}
                class="flex-1 text-left"
              >
                <div class="font-medium text-sm">{saved.name}</div>
                {#if saved.description}
                  <div class="text-xs text-muted-foreground mt-1">{saved.description}</div>
                {/if}
              </button>
              <button
                on:click={() => deleteQuery(saved.id)}
                class="p-1 hover:bg-destructive/10 rounded"
              >
                <Trash2 class="w-4 h-4 text-destructive" />
              </button>
            </div>
          {/each}
        </div>
      </div>
    </div>

    <div class="lg:col-span-2 bg-card rounded-lg border">
      <div class="p-4 border-b">
        <h3 class="font-semibold">Query Results</h3>
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
            {#if outputFormat === 'xml'}
              <pre class="font-mono text-xs bg-muted p-4 rounded overflow-x-auto">{rawOutput}</pre>
            {:else}
              {#each queryResult.targets as target}
                <div class="font-mono text-sm py-1">
                  {target.full || target.name}
                  {#if target.ruleType}
                    <span class="text-muted-foreground ml-2">({target.ruleType})</span>
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
            />
          </div>
          <div class="flex gap-2 justify-end">
            <button
              on:click={() => saveDialogOpen = false}
              class="px-4 py-2 border rounded-md hover:bg-muted"
            >
              Cancel
            </button>
            <button
              on:click={saveQuery}
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

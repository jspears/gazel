<script lang="ts">
  import { onMount } from 'svelte';
  import ElkDependencyGraph from '../components/ElkDependencyGraph.svelte';
  
  let xmlData = '';
  let loading = true;
  let error: string | null = null;
  
  onMount(async () => {
    try {
      // Load the sample XML file
      const response = await fetch('/samples/graph-deps.xml');
      if (!response.ok) {
        throw new Error(`Failed to load sample: ${response.statusText}`);
      }
      xmlData = await response.text();
      loading = false;
    } catch (err: any) {
      error = err.message || 'Failed to load sample XML';
      loading = false;
    }
  });
</script>

<div class="container mx-auto p-6">
  <h1 class="text-2xl font-bold mb-4">Enhanced Dependency Graph Test</h1>
  
  {#if loading}
    <div class="text-center py-8">
      <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      <p class="mt-2">Loading sample XML...</p>
    </div>
  {:else if error}
    <div class="bg-destructive/10 text-destructive p-4 rounded-md">
      {error}
    </div>
  {:else if xmlData}
    <div class="space-y-4">
      <div class="bg-muted p-4 rounded-md">
        <h2 class="font-semibold mb-2">Sample: graph-deps.xml</h2>
        <p class="text-sm text-muted-foreground">
          This shows the enhanced visualization with proper deps, srcs, and hdrs connections.
        </p>
      </div>
      
      <div class="bg-card rounded-lg border" style="height: 700px;">
        <ElkDependencyGraph {xmlData} filter="" />
      </div>
    </div>
  {/if}
</div>

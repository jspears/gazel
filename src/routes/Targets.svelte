<script lang="ts">
  import { onMount } from 'svelte';
  import { Search, Filter, Target, ChevronRight, FileCode, ExternalLink } from 'lucide-svelte';
  import { api } from '$lib/api/client';
  import type { BazelTarget } from '$lib/types';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();
  
  let targets: BazelTarget[] = [];
  let filteredTargets: BazelTarget[] = [];
  let byPackage: Record<string, BazelTarget[]> = {};
  let loading = false;
  let error: string | null = null;
  let searchQuery = '';
  let selectedType = '';
  let selectedTarget: BazelTarget | null = null;
  let targetDependencies: BazelTarget[] = [];
  let targetOutputs: Array<{path: string; filename: string; type: string}> = [];
  let loadingOutputs = false;

  onMount(() => {
    loadTargets();
  });

  async function loadTargets() {
    try {
      loading = true;
      error = null;
      const result = await api.listTargets();
      targets = result.targets;
      filteredTargets = targets;
      byPackage = result.byPackage;
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function searchTargets() {
    if (!searchQuery.trim()) {
      filteredTargets = targets;
      return;
    }

    try {
      loading = true;
      const result = await api.searchTargets(searchQuery, selectedType);
      filteredTargets = result.targets;
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function selectTarget(target: BazelTarget) {
    selectedTarget = target;
    targetOutputs = [];

    if (target.full) {
      try {
        const deps = await api.getTargetDependencies(target.full, 1);
        targetDependencies = deps.dependencies;
      } catch (err) {
        console.error('Failed to load dependencies:', err);
        targetDependencies = [];
      }

      // Load outputs for the selected target
      loadingOutputs = true;
      try {
        const outputResult = await api.getTargetOutputs(target.full);
        targetOutputs = outputResult.outputs || [];
      } catch (err) {
        console.error('Failed to load outputs:', err);
        targetOutputs = [];
      } finally {
        loadingOutputs = false;
      }
    }
  }

  function filterByType(type: string) {
    selectedType = type;
    if (!type) {
      filteredTargets = targets;
    } else {
      filteredTargets = targets.filter(t => t.ruleType === type);
    }
  }

  function navigateToBuildFile(target: BazelTarget) {
    if (target.location) {
      // Extract the BUILD file path from the location (format: //package:target:line:column)
      const match = target.location.match(/^([^:]+)/);
      if (match) {
        const buildPath = match[1].replace('//', '') + '/BUILD';
        // Dispatch event to parent to switch to Files tab with this file
        dispatch('navigate-to-file', { path: buildPath });
      }
    }
  }

  function getBuildFilePath(target: BazelTarget): string | null {
    if (target.location) {
      const match = target.location.match(/^([^:]+)/);
      if (match) {
        return match[1].replace('//', '') + '/BUILD';
      }
    }
    if (target.package) {
      return target.package.replace('//', '') + '/BUILD';
    }
    return null;
  }

  function getExpectedOutputs(ruleType: string): string {
    const outputPatterns: Record<string, string> = {
      'cc_binary': 'Executable binary file',
      'cc_library': 'Static library (.a) and/or shared library (.so)',
      'cc_test': 'Test executable',
      'py_binary': 'Python executable or .pex file',
      'py_library': 'Python source files and compiled .pyc files',
      'py_test': 'Python test executable',
      'java_binary': 'JAR file and/or executable wrapper',
      'java_library': 'JAR file with compiled classes',
      'java_test': 'Test JAR and test runner',
      'go_binary': 'Go executable',
      'go_library': 'Go archive file (.a)',
      'go_test': 'Go test executable',
      'rust_binary': 'Rust executable',
      'rust_library': 'Rust library (.rlib)',
      'proto_library': 'Protocol buffer descriptor sets',
      'filegroup': 'Collection of files',
      'genrule': 'Custom generated files defined by the rule'
    };

    return outputPatterns[ruleType] || 'Target outputs';
  }

  $: uniqueTypes = [...new Set(targets.map(t => t.ruleType).filter(Boolean))];
</script>

<div class="space-y-6">
  <div class="flex gap-4">
    <div class="flex-1">
      <div class="relative">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          bind:value={searchQuery}
          on:input={searchTargets}
          placeholder="Search targets..."
          class="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
        />
      </div>
    </div>
    <select
      bind:value={selectedType}
      on:change={() => filterByType(selectedType)}
      class="px-4 py-2 border rounded-md bg-background"
    >
      <option value="">All types</option>
      {#each uniqueTypes as type}
        <option value={type}>{type}</option>
      {/each}
    </select>
    <button
      on:click={loadTargets}
      class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
    >
      Refresh
    </button>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="text-muted-foreground">Loading targets...</div>
    </div>
  {:else if error}
    <div class="bg-destructive/10 text-destructive p-4 rounded-md">
      Error: {error}
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-card rounded-lg border">
        <div class="p-4 border-b">
          <h3 class="font-semibold">Targets ({filteredTargets.length})</h3>
        </div>
        <div class="max-h-[600px] overflow-y-auto">
          {#each filteredTargets.slice(0, 100) as target}
            <button
              on:click={() => selectTarget(target)}
              class="w-full text-left px-4 py-3 hover:bg-muted border-b last:border-b-0 flex items-center justify-between group"
              class:bg-muted={selectedTarget === target}
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <Target class="w-4 h-4 text-muted-foreground" />
                  <span class="font-mono text-sm truncate">{target.full || target.name}</span>
                </div>
                {#if target.ruleType}
                  <span class="text-xs text-muted-foreground">{target.ruleType}</span>
                {/if}
              </div>
              <ChevronRight class="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </button>
          {/each}
          {#if filteredTargets.length > 100}
            <div class="p-4 text-center text-sm text-muted-foreground">
              Showing first 100 of {filteredTargets.length} targets
            </div>
          {/if}
        </div>
      </div>

      <div class="bg-card rounded-lg border">
        <div class="p-4 border-b">
          <h3 class="font-semibold">Target Details</h3>
        </div>
        <div class="p-4">
          {#if selectedTarget}
            <div class="space-y-4">
              <div>
                <h4 class="text-sm font-medium text-muted-foreground mb-1">Name</h4>
                <p class="font-mono text-sm">{selectedTarget.name || selectedTarget.full}</p>
              </div>
              
              {#if selectedTarget.ruleType}
                <div>
                  <h4 class="text-sm font-medium text-muted-foreground mb-1">Type</h4>
                  <p class="font-mono text-sm">{selectedTarget.ruleType}</p>
                  <p class="text-xs text-muted-foreground mt-1">
                    Expected: {getExpectedOutputs(selectedTarget.ruleType)}
                  </p>
                </div>
              {/if}

              {#if targetOutputs.length > 0 || loadingOutputs}
                <div class="col-span-2 border-l-4 border-primary pl-4">
                  <h4 class="text-sm font-medium text-primary mb-2 flex items-center gap-2">
                    <span class="font-semibold">Returns / Outputs</span>
                    {#if !loadingOutputs}
                      <span class="text-xs text-muted-foreground">({targetOutputs.length} files)</span>
                    {/if}
                  </h4>
                  {#if loadingOutputs}
                    <p class="text-sm text-muted-foreground">Loading outputs...</p>
                  {:else if targetOutputs.length > 0}
                    <div class="space-y-1 max-h-32 overflow-y-auto bg-muted/30 p-2 rounded">
                      {#each targetOutputs as output}
                        <div class="flex items-center gap-2 text-sm">
                          <span class="font-mono text-xs px-1 py-0.5 bg-primary/10 text-primary rounded">
                            .{output.type}
                          </span>
                          <span class="font-mono text-sm truncate" title={output.path}>
                            {output.filename}
                          </span>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <p class="text-sm text-muted-foreground">No outputs detected</p>
                  {/if}
                </div>
              {/if}
              
              {#if selectedTarget.location}
                <div>
                  <h4 class="text-sm font-medium text-muted-foreground mb-1">Location</h4>
                  <div class="flex items-center gap-2">
                    <p class="font-mono text-sm">{selectedTarget.location}</p>
                    {#if getBuildFilePath(selectedTarget)}
                      <button
                        on:click={() => selectedTarget && navigateToBuildFile(selectedTarget)}
                        class="p-1 hover:bg-muted rounded flex items-center gap-1 text-xs text-primary"
                        title="View in BUILD file"
                      >
                        <FileCode class="w-3 h-3" />
                        <ExternalLink class="w-3 h-3" />
                      </button>
                    {/if}
                  </div>
                </div>
              {/if}
              
              {#if selectedTarget.attributes && Object.keys(selectedTarget.attributes).length > 0}
                <div>
                  <h4 class="text-sm font-medium text-muted-foreground mb-1">Attributes</h4>
                  <div class="space-y-1">
                    {#each Object.entries(selectedTarget.attributes) as [key, value]}
                      <div class="text-sm">
                        <span class="font-mono text-muted-foreground">{key}:</span>
                        <span class="font-mono ml-2">
                          {typeof value === 'object' ? JSON.stringify(value) : value}
                        </span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
              
              {#if targetDependencies.length > 0}
                <div>
                  <h4 class="text-sm font-medium text-muted-foreground mb-1">
                    Direct Dependencies ({targetDependencies.length})
                  </h4>
                  <div class="space-y-1 max-h-40 overflow-y-auto">
                    {#each targetDependencies as dep}
                      <div class="font-mono text-sm text-muted-foreground">
                        {dep.full || dep.name}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {:else}
            <p class="text-muted-foreground">Select a target to view details</p>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

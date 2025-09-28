<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Target, ChevronRight, FileCode, ExternalLink, Play, GitBranch, Terminal, TestTube } from 'lucide-svelte';
  import type { BazelTarget } from '$lib/types';
  import CopyButton from './CopyButton.svelte';
  import { api } from '$lib/api/client';

  const dispatch = createEventDispatcher();

  export let target: BazelTarget | null = null;
  export let showActions = true;
  export let showNavigation = false; // Default to false to hide navigation
  export let compact = false;

  let targetDependencies: BazelTarget[] = [];
  let targetReverseDependencies: BazelTarget[] = [];
  let targetOutputs: Array<{path: string; filename: string; type: string}> = [];
  let loadingOutputs = false;
  let loadingReverseDeps = false;
  let loadingDeps = false;

  $: if (target?.full) {
    loadTargetDetails(target.full);
  }

  async function loadTargetDetails(targetName: string) {
    // Reset state
    targetDependencies = [];
    targetReverseDependencies = [];
    targetOutputs = [];

    // Load direct dependencies
    loadingDeps = true;
    try {
      const deps = await api.getTargetDependencies(targetName, 1);
      targetDependencies = deps.dependencies;
    } catch (err) {
      console.error('Failed to load dependencies:', err);
      targetDependencies = [];
    } finally {
      loadingDeps = false;
    }

    // Load reverse dependencies (what depends on this target)
    loadingReverseDeps = true;
    try {
      const rdeps = await api.getReverseDependencies(targetName);
      targetReverseDependencies = rdeps.dependencies || [];
    } catch (err) {
      console.error('Failed to load reverse dependencies:', err);
      targetReverseDependencies = [];
    } finally {
      loadingReverseDeps = false;
    }

    // Load outputs for the selected target
    loadingOutputs = true;
    try {
      const outputResult = await api.getTargetOutputs(targetName);
      targetOutputs = outputResult.outputs || [];
    } catch (err) {
      console.error('Failed to load outputs:', err);
      targetOutputs = [];
    } finally {
      loadingOutputs = false;
    }
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

  function isExecutableTarget(target: BazelTarget): boolean {
    if (!target.ruleType && !target.type) return false;

    const ruleType = target.ruleType || target.type || '';
    const executableTypes = [
      'cc_binary',
      'cc_test',
      'py_binary',
      'py_test',
      'java_binary',
      'java_test',
      'go_binary',
      'go_test',
      'rust_binary',
      'sh_binary',
      'sh_test'
    ];

    return executableTypes.includes(ruleType);
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

  function navigateToBuildFile() {
    if (target && target.location) {
      const match = target.location.match(/^([^:]+)/);
      if (match) {
        const buildPath = match[1].replace('//', '') + '/BUILD';
        dispatch('navigate-to-file', { path: buildPath });
      }
    }
  }

  function navigateToGraph() {
    if (target) {
      const targetName = target.full || target.name;
      if (targetName) {
        dispatch('navigate-to-graph', { target: targetName });
      }
    }
  }

  function navigateToCommands() {
    if (target) {
      const targetName = target.full || target.name;
      if (targetName) {
        dispatch('navigate-to-commands', { target: targetName });
      }
    }
  }

  function runTarget() {
    if (target) {
      dispatch('run-target', { target: target.full || target.name });
    }
  }

  function navigateToTarget(dep: BazelTarget) {
    dispatch('navigate-to-target', { target: dep });
  }
</script>

{#if target}
  <div class="space-y-4 {compact ? 'text-sm' : ''}">
    <div>
      <h4 class="text-sm font-medium text-muted-foreground mb-1">Name</h4>
      <div class="flex items-center gap-2">
        <p class="font-mono {compact ? 'text-sm' : ''}">{target.name || target.full}</p>
        {#if showNavigation}
          <button
            on:click={navigateToGraph}
            class="p-1 hover:bg-muted rounded transition-colors"
            title="View in dependency graph"
          >
            <GitBranch class="w-4 h-4 text-muted-foreground hover:text-primary" />
          </button>
          <button
            on:click={navigateToCommands}
            class="p-1 hover:bg-muted rounded transition-colors"
            title="Open in Commands tab"
          >
            <Terminal class="w-4 h-4 text-muted-foreground hover:text-primary" />
          </button>
        {/if}
        <CopyButton text={target.name || target.full || ''} size="sm" />
      </div>
    </div>
    
    {#if target.ruleType || target.type}
      <div>
        <h4 class="text-sm font-medium text-muted-foreground mb-1">Type</h4>
        <p class="font-mono {compact ? 'text-sm' : ''}">{target.ruleType || target.type}</p>
        <p class="text-xs text-muted-foreground mt-1">
          Expected: {getExpectedOutputs(target.ruleType || target.type || '')}
        </p>
      </div>
    {/if}

    {#if targetOutputs.length > 0 || loadingOutputs}
      <div class="border-l-4 border-primary pl-4">
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
    
    {#if target.location}
      <div>
        <h4 class="text-sm font-medium text-muted-foreground mb-1">Location</h4>
        <div class="flex items-center gap-2">
          <p class="font-mono {compact ? 'text-sm' : ''}">{target.location}</p>
          {#if getBuildFilePath(target) && showNavigation}
            <button
              on:click={navigateToBuildFile}
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

    {#if isExecutableTarget(target) && showActions}
      <div>
        <button
          on:click={runTarget}
          class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center gap-2 transition-colors"
        >
          {#if (target.ruleType || target.type || '').includes('test')}
            <TestTube class="w-4 h-4" />
            Test Target
          {:else}
            <Play class="w-4 h-4" />
            Run Target
          {/if}
        </button>
      </div>
    {/if}

    {#if target.attributes && Object.keys(target.attributes).length > 0}
      <div>
        <h4 class="text-sm font-medium text-muted-foreground mb-1">Attributes</h4>
        <div class="space-y-1 max-h-40 overflow-y-auto">
          {#each Object.entries(target.attributes) as [key, value]}
            <div class="text-sm">
              <span class="font-mono text-muted-foreground">{key}:</span>
              <span class="font-mono ml-2">
                {#if Array.isArray(value)}
                  [{value.length} items]
                {:else if typeof value === 'object'}
                  {JSON.stringify(value)}
                {:else}
                  {value}
                {/if}
              </span>
            </div>
          {/each}
        </div>
      </div>
    {/if}
    
    {#if targetDependencies.length > 0 || loadingDeps}
      <div>
        <h4 class="text-sm font-medium text-muted-foreground mb-1">
          Direct Dependencies {#if !loadingDeps}({targetDependencies.length}){/if}
        </h4>
        {#if loadingDeps}
          <div class="text-sm text-muted-foreground">Loading...</div>
        {:else if targetDependencies.length > 0}
          <div class="space-y-1 max-h-40 overflow-y-auto">
            {#each targetDependencies as dep}
              <button
                on:click={() => navigateToTarget(dep)}
                class="w-full text-left font-mono text-sm text-muted-foreground hover:text-foreground hover:bg-muted p-1 rounded transition-colors flex items-center gap-2"
              >
                <ChevronRight class="w-3 h-3" />
                {dep.full || dep.name}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    {#if targetReverseDependencies.length > 0 || loadingReverseDeps}
      <div>
        <h4 class="text-sm font-medium text-muted-foreground mb-1">
          Used By {#if !loadingReverseDeps}({targetReverseDependencies.length}){/if}
        </h4>
        {#if loadingReverseDeps}
          <div class="text-sm text-muted-foreground">Loading...</div>
        {:else if targetReverseDependencies.length > 0}
          <div class="space-y-1 max-h-40 overflow-y-auto">
            {#each targetReverseDependencies as rdep}
              <button
                on:click={() => navigateToTarget(rdep)}
                class="w-full text-left font-mono text-sm text-muted-foreground hover:text-foreground hover:bg-muted p-1 rounded transition-colors flex items-center gap-2"
              >
                <ChevronRight class="w-3 h-3" />
                {rdep.full || rdep.name}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
{:else}
  <p class="text-muted-foreground">Select a target to view details</p>
{/if}

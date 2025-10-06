<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Target, ChevronRight, FileCode, ExternalLink, Play, GitBranch, Terminal, TestTube } from 'lucide-svelte';
  import CopyButton from './CopyButton.svelte';
  import AttributesDisplay from './AttributesDisplay.svelte';
  import { api } from '../client.js';
  import type { BazelTarget } from 'proto/gazel_pb.js';
  import { toFull } from './target-util.js';

  const dispatch = createEventDispatcher();

  export let target: BazelTarget | null = null;
  export let showActions = true;
  export let showNavigation = false; // Default to false to hide navigation
  export let compact = false;

  let fullTarget: BazelTarget | null = null;
  let targetDependencies: BazelTarget[] = [];
  let targetReverseDependencies: BazelTarget[] = [];
  let targetOutputs: string[] = [];
  let loadingTarget = false;
  let loadingOutputs = false;
  let loadingReverseDeps = false;
  let loadingDeps = false;

  $: loadTargetDetails(`${target.package}:${target.name}`);
  

  async function loadTargetDetails(targetName: string) {
    // Reset state
    targetDependencies = [];
    targetReverseDependencies = [];
    targetOutputs = [];
    fullTarget = target;

    // Load full target details with attributes
    loadingTarget = true;
    try {
      fullTarget = (await api.getTarget({target: targetName})).target;
    } catch (err) {
      console.error('Failed to load target details:', err);
      fullTarget = target;
    } finally {
      loadingTarget = false;
    }

    // Load direct dependencies
    loadingDeps = true;
    try {
      const deps = await api.getTargetDependencies({target: toFull(target), depth:1});
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
      const rdeps = await api.getReverseDependencies({target: toFull(target)});
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
      targetOutputs = (await api.getTargetOutputs({target: toFull(target)})).outputs || [];
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

    const ruleType = target.kind
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
    if (target.package) {
      const match = target.package.match(/^([^:]+)/);
      if (match) {
        return match[1].replace('//', '') + '/BUILD';
      }
    }

    return target.package+'/BUILD';
  }

  function navigateToBuildFile() {

        dispatch('navigate-to-file', { path: toFull(target) });
      
    
  }



  function runTarget() {
    if (target) {
      dispatch('run-target', { target: toFull(target) });
    }
  }

  function navigateToTarget(dep: BazelTarget) {
    dispatch('navigate-to-target', { target: toFull(dep) });
  }
</script>

{#if target}
  <div class="space-y-4 {compact ? 'text-sm' : ''}">
    <div>
      <h4 class="text-sm font-medium text-muted-foreground mb-1">Name</h4>
      <div class="flex items-center gap-2">
        <p class="font-mono {compact ? 'text-sm' : ''}">{toFull(target)}</p>
        <CopyButton text={ '//'+toFull(target) } size="sm" />
      </div>
    </div>
    
    {#if target.kind}
      <div>
        <h4 class="text-sm font-medium text-muted-foreground mb-1">Type</h4>
        <p class="font-mono {compact ? 'text-sm' : ''}">{target.kind}</p>
        <p class="text-xs text-muted-foreground mt-1">
          Expected: {getExpectedOutputs(target.kind || '')}
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
                <span class="font-mono text-sm truncate" title={output}>
                  {output}
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

    <div class="border-l-4 border-purple-500 pl-4">
      {#if loadingTarget}
        <div class="text-sm text-muted-foreground">Loading attributes...</div>
      {:else if fullTarget?.attributes && fullTarget.attributes.length > 0}
        <AttributesDisplay
          attributes={fullTarget.attributes}
          collapsible={false}
          initiallyExpanded={true}
        />
      {:else}
        <div class="text-sm text-muted-foreground">No attributes found</div>
      {/if}
    </div>
    
    <div class="border-l-4 border-blue-500 pl-4">
      <h4 class="text-sm font-medium text-blue-600 mb-1">
        Direct Dependencies {#if !loadingDeps}({targetDependencies.length}){/if}
      </h4>
      {#if loadingDeps}
        <div class="text-sm text-muted-foreground">Loading...</div>
      {:else if targetDependencies.length > 0}
        <div class="space-y-1 max-h-40 overflow-y-auto bg-muted/30 p-2 rounded">
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
      {:else}
        <div class="text-sm text-muted-foreground">No dependencies</div>
      {/if}
    </div>

    <div class="border-l-4 border-green-500 pl-4">
      <h4 class="text-sm font-medium text-green-600 mb-1">
        Reverse Dependencies (Used By) {#if !loadingReverseDeps}({targetReverseDependencies.length}){/if}
      </h4>
      {#if loadingReverseDeps}
        <div class="text-sm text-muted-foreground">Loading...</div>
      {:else if targetReverseDependencies.length > 0}
        <div class="space-y-1 max-h-40 overflow-y-auto bg-muted/30 p-2 rounded">
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
      {:else}
        <div class="text-sm text-muted-foreground">No reverse dependencies</div>
      {/if}
    </div>
  </div>
{:else}
  <p class="text-muted-foreground">Select a target to view details</p>
{/if}

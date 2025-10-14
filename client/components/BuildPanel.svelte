<!-- Build Panel Component - Execute builds and show progress -->
<script lang="ts">
  import { Play, Square, Loader2, CheckCircle, XCircle, Terminal } from 'lucide-svelte';
  import { build, buildStatus, connectionStatus } from '../lib/bazel-service';
  
  export let targets: string[] = [];
  
  let buildOutput = '';
  let isBuilding = false;
  
  async function startBuild() {
    if (targets.length === 0) {
      alert('Please select targets to build');
      return;
    }
    
    isBuilding = true;
    buildOutput = '';
    
    try {
      const result = await build(targets);
      
      buildOutput = result.output || 'Build completed successfully';
      
      if (!result.success) {
        console.error('Build failed:', result.errors);
      }
    } catch (error: any) {
      buildOutput = `Build failed: ${error.message}`;
      console.error('Build error:', error);
    } finally {
      isBuilding = false;
    }
  }
  
  function stopBuild() {
    // TODO: Implement build cancellation
    console.log('Stopping build...');
    isBuilding = false;
  }
  
  function getProgressColor(progress: number): string {
    if (progress === 0) return 'bg-gray-200';
    if (progress < 50) return 'bg-blue-500';
    if (progress < 100) return 'bg-yellow-500';
    return 'bg-green-500';
  }
</script>

<div class="bg-card border rounded-lg p-4 space-y-4">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <h3 class="text-lg font-semibold flex items-center gap-2">
      <Terminal class="w-5 h-5" />
      Build Panel
    </h3>
    
    <div class="flex items-center gap-2">
      {#if !isBuilding}
        <button
         onclick={startBuild}
          disabled={$connectionStatus !== 'connected' || targets.length === 0}
          class="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Play class="w-4 h-4" />
          Build
        </button>
      {:else}
        <button
         onclick={stopBuild}
          class="flex items-center gap-2 px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600"
        >
          <Square class="w-4 h-4" />
          Stop
        </button>
      {/if}
    </div>
  </div>
  
  <!-- Targets -->
  {#if targets.length > 0}
    <div class="text-sm">
      <span class="text-muted-foreground">Targets:</span>
      <div class="flex flex-wrap gap-1 mt-1">
        {#each targets as target}
          <span class="px-2 py-0.5 bg-muted rounded-md font-mono text-xs">
            {target}
          </span>
        {/each}
      </div>
    </div>
  {:else}
    <div class="text-sm text-muted-foreground">
      No targets selected
    </div>
  {/if}
  
  <!-- Progress Bar -->
  {#if $buildStatus.building || $buildStatus.progress > 0}
    <div class="space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span class="text-muted-foreground">{$buildStatus.message}</span>
        <span class="font-mono">{$buildStatus.progress}%</span>
      </div>
      <div class="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div
          class="h-full transition-all duration-300 {getProgressColor($buildStatus.progress)}"
          style="width: {$buildStatus.progress}%"
        />
      </div>
    </div>
  {/if}
  
  <!-- Status Icon -->
  {#if !$buildStatus.building && $buildStatus.message}
    <div class="flex items-center gap-2 text-sm">
      {#if $buildStatus.errors.length === 0}
        <CheckCircle class="w-4 h-4 text-green-500" />
        <span class="text-green-600">{$buildStatus.message}</span>
      {:else}
        <XCircle class="w-4 h-4 text-red-500" />
        <span class="text-red-600">{$buildStatus.message}</span>
      {/if}
    </div>
  {/if}
  
  <!-- Errors -->
  {#if $buildStatus.errors.length > 0}
    <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-3">
      <h4 class="text-sm font-semibold text-red-600 dark:text-red-400 mb-2">Errors:</h4>
      <ul class="space-y-1">
        {#each $buildStatus.errors as error}
          <li class="text-sm text-red-600 dark:text-red-400 font-mono">
            {error}
          </li>
        {/each}
      </ul>
    </div>
  {/if}
  
  <!-- Output -->
  {#if buildOutput}
    <div class="bg-muted rounded-md p-3">
      <h4 class="text-sm font-semibold mb-2">Output:</h4>
      <pre class="text-xs font-mono whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
{buildOutput}
      </pre>
    </div>
  {/if}
  
  <!-- Loading Indicator -->
  {#if isBuilding && !$buildStatus.progress}
    <div class="flex items-center justify-center py-4">
      <Loader2 class="w-6 h-6 animate-spin text-primary" />
    </div>
  {/if}
</div>

<style>
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  
  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style>

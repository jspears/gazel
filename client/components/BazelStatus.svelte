<!-- Bazel Status Component - Shows connection status and current workspace -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { Wifi, WifiOff, Loader2, AlertCircle, Zap, Globe } from 'lucide-svelte';
  import {
    connectionStatus,
    connectionError,
    currentWorkspace,
    isElectron,
    version,
    initializeBazelService
  } from '../lib/bazel-service';
  
  let bazelVersion = '';
  let retrying = false;
  
  onMount(async () => {
    // Get Bazel version if connected
    connectionStatus.subscribe(async (status) => {
      if (status === 'connected') {
        try {
          bazelVersion = await version();
        } catch (error) {
          console.error('Failed to get Bazel version:', error);
        }
      }
    });
  });
  
  async function retry() {
    retrying = true;
    try {
      await initializeBazelService();
    } finally {
      retrying = false;
    }
  }
  
  function getStatusIcon(status: string) {
    switch (status) {
      case 'connected':
        return Wifi;
      case 'connecting':
        return Loader2;
      case 'error':
        return AlertCircle;
      default:
        return WifiOff;
    }
  }
  
  function getStatusColor(status: string) {
    switch (status) {
      case 'connected':
        return 'text-green-500';
      case 'connecting':
        return 'text-blue-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  }
</script>

<div class="flex items-center gap-4 p-2 bg-muted/50 rounded-lg">
  <!-- Connection Status -->
  <div class="flex items-center gap-2">
    <svelte:component
      this={getStatusIcon($connectionStatus)}
      class="w-4 h-4 {getStatusColor($connectionStatus)} {$connectionStatus === 'connecting' ? 'animate-spin' : ''}"
    />
    <span class="text-sm font-medium">
      {#if $connectionStatus === 'connected'}
        Connected
      {:else if $connectionStatus === 'connecting'}
        Connecting...
      {:else if $connectionStatus === 'error'}
        Connection Error
      {:else}
        Disconnected
      {/if}
    </span>
  </div>
  
  <!-- Connection Type -->
  {#if $connectionStatus === 'connected'}
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      {#if $isElectron}
        <Zap class="w-4 h-4" />
        <span>Electron IPC</span>
      {:else}
        <Globe class="w-4 h-4" />
        <span>Web API</span>
      {/if}
    </div>
  {/if}
  
  <!-- Workspace -->
  {#if $currentWorkspace}
    <div class="flex items-center gap-2 text-sm">
      <span class="text-muted-foreground">Workspace:</span>
      <span class="font-mono">{$currentWorkspace.split('/').pop()}</span>
    </div>
  {/if}
  
  <!-- Bazel Version -->
  {#if bazelVersion}
    <div class="flex items-center gap-2 text-sm text-muted-foreground">
      <span>Bazel {bazelVersion}</span>
    </div>
  {/if}
  
  <!-- Error Message -->
  {#if $connectionError}
    <div class="flex-1 text-sm text-red-500">
      {$connectionError}
    </div>
  {/if}
  
  <!-- Retry Button -->
  {#if $connectionStatus === 'error'}
    <button
      on:click={retry}
      disabled={retrying}
      class="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
    >
      {#if retrying}
        <Loader2 class="w-4 h-4 animate-spin" />
      {:else}
        Retry
      {/if}
    </button>
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

<script lang="ts">
  import { onMount } from 'svelte';
  import { Folder, Search, Check, AlertCircle, FolderOpen, Home, ChevronUp, Clock, X, Trash2 } from 'lucide-svelte';
  import { api } from '$lib/api/client';
  import { storage, type WorkspaceHistoryEntry } from '$lib/storage';

  export let onWorkspaceSelected: (workspace: string) => void;
  export let currentWorkspace: string | null = null;

  let scanning = true;
  let switching = false;
  let error: string | null = null;
  let workspaces: Array<{
    path: string;
    name: string;
    type: 'current' | 'parent' | 'home' | 'discovered';
  }> = [];
  let workspaceHistory: WorkspaceHistoryEntry[] = [];
  let customPath = '';
  let selectedWorkspace: string | null = null;

  onMount(async () => {
    // Load workspace history
    workspaceHistory = storage.getWorkspaceHistory();

    // Pre-select current workspace if it exists in history
    if (currentWorkspace) {
      selectedWorkspace = currentWorkspace;
    } else if (workspaceHistory.length > 0) {
      // Pre-select the most recently used workspace
      selectedWorkspace = workspaceHistory[0].path;
    }

    await scanForWorkspaces();
  });

  async function scanForWorkspaces() {
    try {
      scanning = true;
      error = null;
      const result = await api.scanWorkspaces();
      workspaces = result.workspaces;
      
      // Pre-select current workspace if it exists
      if (currentWorkspace && workspaces.some(w => w.path === currentWorkspace)) {
        selectedWorkspace = currentWorkspace;
      } else if (workspaces.length === 1) {
        // Auto-select if only one workspace found
        selectedWorkspace = workspaces[0].path;
      }
    } catch (err: any) {
      error = err.message || 'Failed to scan for workspaces';
    } finally {
      scanning = false;
    }
  }

  async function selectWorkspace() {
    if (!selectedWorkspace && !customPath) {
      error = 'Please select a workspace or enter a custom path';
      return;
    }

    const workspaceToUse = customPath || selectedWorkspace;
    if (!workspaceToUse) return;

    try {
      switching = true;
      error = null;

      const result = await api.switchWorkspace(workspaceToUse);

      if (result.success) {
        // Find the workspace name if available
        let workspaceName: string | undefined;
        const discoveredWorkspace = workspaces.find(w => w.path === workspaceToUse);
        if (discoveredWorkspace) {
          workspaceName = discoveredWorkspace.name;
        } else {
          // Check if it's in history
          const historyWorkspace = workspaceHistory.find(w => w.path === workspaceToUse);
          if (historyWorkspace) {
            workspaceName = historyWorkspace.name;
          } else {
            // Extract name from path (last directory name)
            const parts = workspaceToUse.split('/').filter(p => p);
            workspaceName = parts[parts.length - 1];
          }
        }

        // Store the selected workspace with its name
        storage.setPreference('lastWorkspace', workspaceToUse);
        storage.setCurrentWorkspace(workspaceToUse, workspaceName);

        // Notify parent component
        onWorkspaceSelected(workspaceToUse);
      } else {
        error = 'Failed to switch workspace';
      }
    } catch (err: any) {
      error = err.message || 'Failed to switch workspace';
    } finally {
      switching = false;
    }
  }

  function handleCustomPathInput() {
    // Clear selection when typing custom path
    if (customPath) {
      selectedWorkspace = null;
    }
  }

  function selectWorkspaceFromList(path: string) {
    selectedWorkspace = path;
    customPath = '';
  }

  function deleteWorkspaceFromHistory(path: string) {
    storage.removeWorkspaceFromHistory(path);
    workspaceHistory = storage.getWorkspaceHistory();

    // If we deleted the selected workspace, clear selection
    if (selectedWorkspace === path) {
      selectedWorkspace = null;
    }
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return `${diffDays} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  }

  function getWorkspaceIcon(type: string) {
    switch (type) {
      case 'current':
        return Folder;
      case 'parent':
        return ChevronUp;
      case 'home':
        return Home;
      default:
        return FolderOpen;
    }
  }

  function getWorkspaceLabel(type: string) {
    switch (type) {
      case 'current':
        return 'Current Directory';
      case 'parent':
        return 'Parent Directory';
      case 'home':
        return 'Home Projects';
      default:
        return 'Discovered';
    }
  }
</script>

<div class="workspace-picker">
  <div class="header">
    <h2 class="text-2xl font-bold mb-2">Select Bazel Workspace</h2>
    <p class="text-muted-foreground">
      Choose a Bazel workspace to explore, or enter a custom path.
    </p>
  </div>

  {#if error}
    <div class="bg-destructive/10 text-destructive p-4 rounded-md mb-4 flex items-center gap-2">
      <AlertCircle class="w-5 h-5" />
      {error}
    </div>
  {/if}

  {#if scanning}
    <div class="flex items-center justify-center py-12">
      <div class="text-muted-foreground">Scanning for Bazel workspaces...</div>
    </div>
  {:else}
    <div class="space-y-6">
      <!-- Workspace History Section -->
      {#if workspaceHistory.length > 0}
        <div>
          <h3 class="text-lg font-semibold mb-3 flex items-center gap-2">
            <Clock class="w-5 h-5" />
            Recent Workspaces
          </h3>
          <div class="space-y-2">
            {#each workspaceHistory as historyItem}
              <div class="w-full p-4 border rounded-lg hover:bg-muted/50 transition-colors
                         {selectedWorkspace === historyItem.path ? 'border-primary bg-muted' : ''}"
              >
                <div class="flex items-start gap-3">
                  <button
                    on:click={() => selectWorkspaceFromList(historyItem.path)}
                    class="flex-1 text-left flex items-start gap-3"
                  >
                    <div class="mt-1">
                      {#if selectedWorkspace === historyItem.path}
                        <Check class="w-5 h-5 text-primary" />
                      {:else if currentWorkspace === historyItem.path}
                        <Folder class="w-5 h-5 text-primary" />
                      {:else}
                        <Clock class="w-5 h-5 text-muted-foreground" />
                      {/if}
                    </div>
                    <div class="flex-1">
                      <div class="font-semibold flex items-center gap-2">
                        {historyItem.name || 'Unnamed Workspace'}
                        {#if currentWorkspace === historyItem.path}
                          <span class="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Current</span>
                        {/if}
                      </div>
                      <div class="text-sm text-muted-foreground font-mono">{historyItem.path}</div>
                      <div class="text-xs text-muted-foreground mt-1">Last used: {formatDate(historyItem.lastUsed)}</div>
                    </div>
                  </button>
                  <button
                    on:click={() => deleteWorkspaceFromHistory(historyItem.path)}
                    class="p-2 hover:bg-destructive/10 rounded-md transition-colors group"
                    title="Remove from history"
                  >
                    <Trash2 class="w-4 h-4 text-muted-foreground group-hover:text-destructive" />
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- Discovered Workspaces Section -->
      {#if workspaces.length > 0}
        <div>
          <h3 class="text-lg font-semibold mb-3">Discovered Workspaces</h3>
          <div class="space-y-2">
            {#each workspaces as workspace}
              <button
                on:click={() => selectWorkspaceFromList(workspace.path)}
                class="w-full p-4 border rounded-lg hover:bg-muted/50 transition-colors text-left
                       {selectedWorkspace === workspace.path ? 'border-primary bg-muted' : ''}"
              >
                <div class="flex items-start gap-3">
                  <div class="mt-1">
                    {#if selectedWorkspace === workspace.path}
                      <Check class="w-5 h-5 text-primary" />
                    {:else}
                      <svelte:component this={getWorkspaceIcon(workspace.type)} class="w-5 h-5 text-muted-foreground" />
                    {/if}
                  </div>
                  <div class="flex-1">
                    <div class="font-semibold">{workspace.name}</div>
                    <div class="text-sm text-muted-foreground font-mono">{workspace.path}</div>
                    <div class="text-xs text-muted-foreground mt-1">{getWorkspaceLabel(workspace.type)}</div>
                  </div>
                </div>
              </button>
            {/each}
          </div>
        </div>
      {:else}
        <div class="bg-muted/50 p-6 rounded-lg text-center">
          <Folder class="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p class="text-muted-foreground">No Bazel workspaces found automatically.</p>
          <p class="text-sm text-muted-foreground mt-1">Enter a custom path below.</p>
        </div>
      {/if}

      <div>
        <h3 class="text-lg font-semibold mb-3">Custom Path</h3>
        <div class="flex gap-2">
          <input
            type="text"
            bind:value={customPath}
            on:input={handleCustomPathInput}
            placeholder="/path/to/your/bazel/workspace"
            class="flex-1 px-3 py-2 border rounded-md bg-background"
            disabled={switching}
          />
        </div>
        <p class="text-xs text-muted-foreground mt-1">
          Enter the full path to a directory containing a MODULE.bazel file.
        </p>
      </div>

      <div class="flex justify-end gap-3">
        <button
          on:click={scanForWorkspaces}
          disabled={scanning || switching}
          class="px-4 py-2 border rounded-md hover:bg-muted transition-colors flex items-center gap-2"
        >
          <Search class="w-4 h-4" />
          Rescan
        </button>
        <button
          on:click={selectWorkspace}
          disabled={(!selectedWorkspace && !customPath) || switching}
          class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 
                 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {switching ? 'Switching...' : 'Select Workspace'}
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .workspace-picker {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
  }

  .header {
    margin-bottom: 2rem;
  }
</style>

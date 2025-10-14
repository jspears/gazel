<script lang="ts">
  import { onMount } from 'svelte';
  import { Folder, Check, AlertCircle, Clock, Trash2, FileText } from 'lucide-svelte';
  import { api } from '../client.js';
  import { storage, type WorkspaceHistoryEntry } from '../lib/storage.js';

  export let onWorkspaceSelected: (workspace: string) => void;
  export let currentWorkspace: string | null = null;

  let switching = false;
  let error: string | null = null;
  let workspaceHistory: WorkspaceHistoryEntry[] = [];
  let customPath = '';
  let selectedWorkspace: string | null = null;
  let isDragging = false;

  // Detect if we're in Electron
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

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
  });

  async function selectWorkspace() {
    if (!selectedWorkspace && !customPath) {
      error = 'Please select a workspace or enter a path';
      return;
    }

    const workspaceToUse = customPath || selectedWorkspace;
    if (!workspaceToUse) return;

    try {
      switching = true;
      error = null;

      const result = await api.switchWorkspace({ workspace: workspaceToUse});

      if (result.success) {
        // Find the workspace name if available
        let workspaceName: string | undefined;

        // Check if it's in history
        const historyWorkspace = workspaceHistory.find(w => w.path === workspaceToUse);
        if (historyWorkspace) {
          workspaceName = historyWorkspace.name;
        } else {
          // Extract name from path (last directory name)
          const parts = workspaceToUse.split('/').filter(p => p);
          workspaceName = parts[parts.length - 1];
        }

        // Store the selected workspace with its name
        storage.setPreference('lastWorkspace', workspaceToUse);
        storage.setCurrentWorkspace(workspaceToUse, workspaceName);

        // Notify parent component
        onWorkspaceSelected(workspaceToUse);
      } else {
        error = result.message || 'Failed to switch workspace';
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

  // Electron file picker
  async function selectWorkspaceFile() {
    if (!isElectron || !window.electronAPI) return;

    try {
      const dirPath = await window.electronAPI.selectWorkspaceFile();
      if (dirPath) {
        customPath = dirPath;
        selectedWorkspace = null;
        error = null;
      }
    } catch (err: any) {
      error = err.message || 'Failed to select workspace file';
    }
  }

  // Drag-and-drop handlers for Electron
  function handleDragOver(event: DragEvent) {
    if (!isElectron) return;
    event.preventDefault();
    event.stopPropagation();
    isDragging = true;
  }

  function handleDragLeave(event: DragEvent) {
    if (!isElectron) return;
    event.preventDefault();
    event.stopPropagation();
    isDragging = false;
  }

  async function handleDrop(event: DragEvent) {
    if (!isElectron) return;
    event.preventDefault();
    event.stopPropagation();
    isDragging = false;

    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // In Electron, files have a path property
    const filePath = (file as any).path;
    if (!filePath) {
      error = 'Unable to get file path';
      return;
    }

    // Validate file name
    const validFileNames = ['BUILD.bazel', 'BUILD', 'MODULE.bazel', 'MODULE', 'WORKSPACE.bazel', 'WORKSPACE'];
    if (!validFileNames.includes(file.name)) {
      error = `Invalid file. Please drop one of: ${validFileNames.join(', ')}`;
      return;
    }

    // Extract directory path
    const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
    if (!dirPath) {
      error = 'Unable to determine workspace directory from file path.';
      return;
    }

    // Automatically switch to this workspace
    try {
      switching = true;
      error = null;

      const result = await api.switchWorkspace({ workspace: dirPath });

      if (result.success) {
        // Extract workspace name from path
        const parts = dirPath.split('/').filter(p => p);
        const workspaceName = parts[parts.length - 1];

        // Store the workspace
        storage.setPreference('lastWorkspace', dirPath);
        storage.setCurrentWorkspace(dirPath, workspaceName);

        // Notify parent component
        onWorkspaceSelected(dirPath);
      } else {
        error = result.message || 'Failed to switch workspace';
      }
    } catch (err: any) {
      error = err.message || 'Failed to switch workspace';
    } finally {
      switching = false;
    }
  }
</script>

<div
  class="workspace-picker {isDragging && isElectron ? 'dragging' : ''}"
  role="region"
  aria-label="Workspace selection"
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  ondrop={handleDrop}
>
  {#if isDragging && isElectron}
    <div class="drop-overlay">
      <div class="drop-overlay-content">
        <FileText class="w-16 h-16 mb-4" />
        <p class="text-xl font-semibold">Drop workspace file here</p>
        <p class="text-sm mt-2">BUILD.bazel, MODULE.bazel, or WORKSPACE.bazel</p>
      </div>
    </div>
  {/if}

  <div class="header">
    <h2 class="text-2xl font-bold mb-2">Select Bazel Workspace</h2>
    <p class="text-muted-foreground">
      Choose a Bazel workspace to explore{isElectron ? ', drop a workspace file,' : ''} or enter a custom path.
    </p>
  </div>

  {#if error}
    <div class="bg-destructive/10 text-destructive p-4 rounded-md mb-4 flex items-center gap-2">
      <AlertCircle class="w-5 h-5" />
      {error}
    </div>
  {/if}

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
                 onclick={() => selectWorkspaceFromList(historyItem.path)}
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
                 onclick={() => deleteWorkspaceFromHistory(historyItem.path)}
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

      {#if isElectron}
        <!-- Electron: File Picker Button -->
        <div>
          <h3 class="text-lg font-semibold mb-3">Select Workspace File</h3>
          <button
            onclick={selectWorkspaceFile}
            disabled={switching}
            class="w-full p-6 border-2 border-dashed rounded-lg hover:bg-muted/50 transition-colors text-center"
          >
            <FileText class="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p class="text-muted-foreground mb-2">
              Click to select a workspace file
            </p>
            <p class="text-xs text-muted-foreground">
              Supported files: BUILD.bazel, BUILD, MODULE.bazel, MODULE, WORKSPACE.bazel, WORKSPACE
            </p>
          </button>
        </div>
      {/if}

      <div>
        <h3 class="text-lg font-semibold mb-3">{isElectron ? 'Or Enter' : 'Enter'} Workspace Path</h3>
        <div class="flex gap-2">
          <input
            type="text"
            bind:value={customPath}
           oninput={handleCustomPathInput}
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
         onclick={selectWorkspace}
          disabled={(!selectedWorkspace && !customPath) || switching}
          class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90
                 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {switching ? 'Switching...' : 'Select Workspace'}
        </button>
      </div>
    </div>
</div>

<style>
  .workspace-picker {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    position: relative;
  }

  .workspace-picker.dragging {
    pointer-events: none;
  }

  .drop-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: hsl(var(--primary) / 0.1);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    pointer-events: all;
  }

  .drop-overlay-content {
    background: hsl(var(--background));
    border: 3px dashed hsl(var(--primary));
    border-radius: 1rem;
    padding: 3rem;
    text-align: center;
    color: hsl(var(--primary));
  }

  .header {
    margin-bottom: 2rem;
  }
</style>

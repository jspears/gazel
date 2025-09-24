<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Home,
    Target,
    FileText,
    Search,
    Terminal,
    Settings,
    GitBranch
  } from 'lucide-svelte';
  import './default.min.css';
  import Workspace from './routes/Workspace.svelte';
  import Targets from './routes/Targets.svelte';
  import Files from './routes/Files.svelte';
  import Query from './routes/Query.svelte';
  import Commands from './routes/Commands.svelte';
  import DependencyGraph from './routes/DependencyGraph.svelte';
  import WorkspacePicker from './components/WorkspacePicker.svelte';
  import { api } from '$lib/api/client';
  import { storage } from '$lib/storage';

  let activeTab = 'workspace';
  let fileToOpen: string | null = null;
  let targetToOpen: string | null = null;
  let graphTarget: string | null = null;
  let showWorkspacePicker = false;
  let currentWorkspace: string | null = null;
  let checkingWorkspace = true;

  onMount(async () => {
    await checkWorkspace();
  });

  async function checkWorkspace() {
    try {
      checkingWorkspace = true;

      // First check if we have a stored workspace preference
      const storedWorkspace = storage.getPreference('lastWorkspace');

      // Check current server configuration
      const result = await api.getCurrentWorkspace();

      // If server has no workspace but we have one stored, try to switch to it
      if (!result.configured && storedWorkspace) {
        try {
          const switchResult = await api.switchWorkspace(storedWorkspace);
          if (switchResult.success) {
            currentWorkspace = storedWorkspace;
            showWorkspacePicker = false;

            // Get workspace name from history if available
            const workspaceHistory = storage.getWorkspaceHistory();
            const historyEntry = workspaceHistory.find(w => w.path === storedWorkspace);
            const workspaceName = historyEntry?.name;

            // Set the current workspace for workspace-specific data
            storage.setCurrentWorkspace(storedWorkspace, workspaceName);
            // Reload to ensure all components use the new workspace
            window.location.reload();
            return;
          }
        } catch (err) {
          console.error('Failed to switch to stored workspace:', err);
          // Clear invalid stored workspace
          storage.setPreference('lastWorkspace', undefined);
        }
      }

      if (!result.configured || !result.workspace || !result.valid) {
        // No workspace configured or invalid, show picker
        showWorkspacePicker = true;
      } else {
        currentWorkspace = result.workspace;
        showWorkspacePicker = false;
        // Store the current workspace if not already stored
        if (result.workspace !== storedWorkspace) {
          storage.setPreference('lastWorkspace', result.workspace);
        }

        // Get workspace name from history if available
        const workspaceHistory = storage.getWorkspaceHistory();
        const historyEntry = workspaceHistory.find(w => w.path === result.workspace);
        let workspaceName = historyEntry?.name;

        // If not in history, extract from path
        if (!workspaceName) {
          const parts = result.workspace.split('/').filter(p => p);
          workspaceName = parts[parts.length - 1];
        }

        // Set the current workspace for workspace-specific data
        storage.setCurrentWorkspace(result.workspace, workspaceName);
      }
    } catch (err) {
      console.error('Failed to check workspace:', err);
      showWorkspacePicker = true;
    } finally {
      checkingWorkspace = false;
    }
  }

  function handleNavigateToFile(event: CustomEvent<{path: string}>) {
    fileToOpen = event.detail.path;
    activeTab = 'files';
  }

  function handleNavigateToTargets(event: CustomEvent<{target: string}>) {
    targetToOpen = event.detail.target;
    activeTab = 'targets';
    // Reset after a short delay to allow the component to use it
    setTimeout(() => {
      targetToOpen = null;
    }, 100);
  }

  function handleNavigateToGraph(event: CustomEvent<{target: string}>) {
    graphTarget = event.detail.target;
    activeTab = 'graph';
  }

  function handleOpenWorkspacePicker() {
    showWorkspacePicker = true;
  }

  async function handleWorkspaceSelected(workspace: string) {
    currentWorkspace = workspace;
    showWorkspacePicker = false;
    // Set the current workspace for workspace-specific data
    storage.setCurrentWorkspace(workspace);
    // Reload the page to refresh all components with new workspace
    window.location.reload();
  }
</script>

{#if checkingWorkspace}
  <div class="min-h-screen bg-background flex items-center justify-center">
    <div class="text-muted-foreground">Checking workspace configuration...</div>
  </div>
{:else if showWorkspacePicker}
  <div class="min-h-screen bg-background">
    <header class="border-b">
      <div class="container mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold">Gazel - Bazel Explorer</h1>
        </div>
      </div>
    </header>
    <main class="container mx-auto px-4 py-6">
      <WorkspacePicker
        onWorkspaceSelected={handleWorkspaceSelected}
        {currentWorkspace}
      />
    </main>
  </div>
{:else}
  <div class="min-h-screen bg-background">
    <header class="border-b">
      <div class="container mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <h1 class="text-2xl font-bold">Gazel - Bazel Explorer</h1>
          <div class="flex items-center gap-4">
            <button class="p-2 hover:bg-muted rounded-md">
              <Settings class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>

    <main class="container mx-auto px-4 py-6">
      <div class="w-full">
        <div class="grid w-full grid-cols-7 mb-6 bg-muted p-1 rounded-md">
          <button
            on:click={() => activeTab = 'workspace'}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'workspace' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <Home class="w-4 h-4" />
            Workspace
          </button>
          <button
            on:click={() => activeTab = 'targets'}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'targets' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <Target class="w-4 h-4" />
            Targets
          </button>
          <button
            on:click={() => activeTab = 'files'}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'files' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <FileText class="w-4 h-4" />
            Files
          </button>
          <button
            on:click={() => activeTab = 'query'}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'query' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <Search class="w-4 h-4" />
            Query
          </button>
          <button
            on:click={() => activeTab = 'graph'}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'graph' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <GitBranch class="w-4 h-4" />
            Graph
          </button>
          <button
            on:click={() => activeTab = 'commands'}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'commands' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <Terminal class="w-4 h-4" />
            Commands
          </button>
        </div>

        <div class="mt-2">
          {#if activeTab === 'workspace'}
            <Workspace
              on:navigate-to-file={handleNavigateToFile}
              on:navigate-to-targets={handleNavigateToTargets}
              on:open-workspace-picker={handleOpenWorkspacePicker}
            />
          {:else if activeTab === 'targets'}
            <Targets
              initialTarget={targetToOpen}
              on:navigate-to-file={handleNavigateToFile}
              on:navigate-to-graph={handleNavigateToGraph}
            />
          {:else if activeTab === 'files'}
            <Files bind:fileToOpen />
          {:else if activeTab === 'query'}
            <Query />
          {:else if activeTab === 'graph'}
            <DependencyGraph bind:initialTarget={graphTarget} />
          {:else if activeTab === 'commands'}
            <Commands />
          
          {/if}
        </div>
      </div>
    </main>
  </div>
{/if}



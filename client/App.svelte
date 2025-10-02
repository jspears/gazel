<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Home,
    Target,
    FileText,
    Search,
    Terminal,
    Settings,
    GitBranch,
    Share2,
    Check,
    Package,
    FolderOpen
  } from 'lucide-svelte';
  import './default.min.css';
  import Workspace from './routes/Workspace.svelte';
  import Targets from './routes/Targets.svelte';
  import Files from './routes/Files.svelte';
  import Query from './routes/Query.svelte';
  import Commands from './routes/Commands.svelte';
  import DependencyGraph from './routes/DependencyGraph.svelte';
  import Modules from './routes/Modules.svelte';
  import WorkspacePicker from './components/WorkspacePicker.svelte';
  import { api } from '$lib/api/client';
  import { storage } from '$lib/storage';
  import { initNavigation, navigateToTab, updateParam, type AppState, copyUrlToClipboard } from '$lib/navigation';

  let activeTab = 'workspace';
  let fileToOpen: string | null = null;
  let targetToOpen: string | null = null;
  let graphTarget: string | null = null;
  let commandTarget: string | null = null;
  let showWorkspacePicker = false;
  let currentWorkspace: string | null = null;
  let currentWorkspaceName: string | null = null;
  let checkingWorkspace = true;
  let showCopied = false;

  async function shareUrl() {
    const success = await copyUrlToClipboard();
    if (success) {
      showCopied = true;
      setTimeout(() => {
        showCopied = false;
      }, 2000);
    }
  }

  async function detectBazelWorkspace(): Promise<string | null> {
    // When running from Bazel, we know the workspace is the gazel repository
    // Check if we're running on localhost/127.0.0.1 which indicates local development
    const isLocalDev = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

    if (isLocalDev) {
      // When running from Bazel, prioritize the known workspace path
      const knownBazelWorkspace = '/Users/justinspears/Documents/augment-projects/gazel';

      // Try the known Bazel workspace first
      try {
        const result = await api.switchWorkspace(knownBazelWorkspace);
        if (result.success) {
          console.log('Auto-set Bazel workspace:', knownBazelWorkspace);
          return knownBazelWorkspace;
        }
      } catch (err) {
        console.debug('Known Bazel workspace not valid:', knownBazelWorkspace);
      }

      // Fall back to stored workspace if the known one doesn't work
      const storedWorkspace = storage.getPreference('lastWorkspace');
      if (storedWorkspace && storedWorkspace !== knownBazelWorkspace) {
        try {
          const result = await api.switchWorkspace(storedWorkspace);
          if (result.success) {
            console.log('Auto-set stored workspace:', storedWorkspace);
            return storedWorkspace;
          }
        } catch (err) {
          console.debug('Stored workspace not valid:', storedWorkspace);
        }
      }
    }

    return null;
  }

  onMount(async () => {
    await checkWorkspace();

    // Initialize navigation and restore state from URL
    const initialState = initNavigation(handleStateChange);
    if (initialState.tab) {
      activeTab = initialState.tab;
    }
    if (initialState.target) {
      targetToOpen = initialState.target;
    }
    if (initialState.graphTarget) {
      graphTarget = initialState.graphTarget;
    }
    if (initialState.file) {
      fileToOpen = initialState.file;
    }
  });

  // Handle state changes from browser navigation (back/forward)
  function handleStateChange(state: AppState) {
    if (state.tab) {
      activeTab = state.tab;
    }
    if (state.target) {
      targetToOpen = state.target;
    }
    if (state.graphTarget) {
      graphTarget = state.graphTarget;
    }
    if (state.file) {
      fileToOpen = state.file;
    }
  }

  async function checkWorkspace() {
    console.log('[App] checkWorkspace called');
    try {
      checkingWorkspace = true;

      // First check if we have a stored workspace preference
      const storedWorkspace = storage.getPreference('lastWorkspace');

      // Check if we're running from Bazel (localhost/127.0.0.1)
      const isBazelRun = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

      // When running from Bazel, try to auto-detect and set the workspace
      if (isBazelRun) {
        const bazelWorkspace = await detectBazelWorkspace();
        if (bazelWorkspace) {
          currentWorkspace = bazelWorkspace;
          showWorkspacePicker = false;
          const workspaceName = bazelWorkspace.split('/').filter((p: string) => p).pop() || 'Gazel';
          currentWorkspaceName = workspaceName;
          storage.setCurrentWorkspace(bazelWorkspace, workspaceName);
          checkingWorkspace = false;
          return;
        }
      }

      // Check current server configuration
      console.log('[App] Checking current workspace...');
      const result = await api.getCurrentWorkspace();
      console.log('[App] Current workspace result:', result);

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
            const workspaceName = historyEntry?.name || storedWorkspace.split('/').filter(p => p).pop() || 'Unknown';
            currentWorkspaceName = workspaceName;

            // Set the current workspace for workspace-specific data
            storage.setCurrentWorkspace(storedWorkspace, workspaceName);
            // Don't reload - let the reactive updates handle it
            checkingWorkspace = false;
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

        currentWorkspaceName = workspaceName || 'Unknown';

        // Set the current workspace for workspace-specific data
        storage.setCurrentWorkspace(result.workspace, workspaceName);
      }
    } catch (err) {
      console.error('[App] Failed to check workspace:', err);
      console.error('[App] Error details:', {
        message: err.message,
        stack: err.stack,
        error: err
      });
      showWorkspacePicker = true;
    } finally {
      checkingWorkspace = false;
    }
  }

  function handleNavigateToFile(event: CustomEvent<{path: string}>) {
    fileToOpen = event.detail.path;
    activeTab = 'files';
    navigateToTab('files', { file: event.detail.path });
  }

  function handleNavigateToTargets(event: CustomEvent<{target: string}>) {
    targetToOpen = event.detail.target;
    activeTab = 'targets';
    navigateToTab('targets', { target: event.detail.target });
    // Reset after a short delay to allow the component to use it
    setTimeout(() => {
      targetToOpen = null;
    }, 100);
  }

  function handleNavigateToGraph(event: CustomEvent<{target: string}>) {
    graphTarget = event.detail.target;
    activeTab = 'graph';
    navigateToTab('graph', { graphTarget: event.detail.target });
  }

  function handleNavigateToCommands(event: CustomEvent<{target: string}>) {
    commandTarget = event.detail.target;
    activeTab = 'commands';
    navigateToTab('commands', { commandTarget: event.detail.target });
    // Reset after a short delay to allow the component to use it
    setTimeout(() => {
      commandTarget = null;
    }, 100);
  }

  function switchTab(tab: string) {
    activeTab = tab;
    navigateToTab(tab);
  }

  function handleOpenWorkspacePicker() {
    // Cancel any pending API requests before showing workspace picker
    api.cancelPendingRequests();
    showWorkspacePicker = true;
  }

  async function handleWorkspaceSelected(workspace: string) {
    currentWorkspace = workspace;
    // Extract workspace name from path
    const workspaceName = workspace.split('/').filter(p => p).pop() || 'Unknown';
    currentWorkspaceName = workspaceName;
    showWorkspacePicker = false;
    // Set the current workspace for workspace-specific data
    storage.setCurrentWorkspace(workspace, workspaceName);
    // Don't reload - the reactive components will update automatically
    // since currentWorkspace is a reactive variable
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
          <h1 class="text-2xl font-bold">Gazel</h1>
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
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-bold">Gazel</h1>
            {#if currentWorkspaceName}
              <button
                class="flex items-center gap-2 px-3 py-1 bg-muted hover:bg-muted/80 rounded-md transition-colors"
                title={`${currentWorkspace}\n\nClick to change workspace`}
                on:click={handleOpenWorkspacePicker}
              >
                <span class="text-sm text-muted-foreground">Workspace:</span>
                <span class="text-sm font-medium">{currentWorkspaceName}</span>
              </button>
            {/if}
          </div>
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
        <div class="flex items-center gap-2 mb-6">
          <div class="grid w-full grid-cols-7 bg-muted p-1 rounded-md flex-1">
          <button
            on:click={() => switchTab('workspace')}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'workspace' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <Home class="w-4 h-4" />
            Workspace
          </button>
          <button
            on:click={() => switchTab('targets')}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'targets' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <Target class="w-4 h-4" />
            Targets
          </button>
          <button
            on:click={() => switchTab('files')}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'files' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <FileText class="w-4 h-4" />
            Files
          </button>
          <button
            on:click={() => switchTab('modules')}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'modules' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <Package class="w-4 h-4" />
            Modules
          </button>
          <button
            on:click={() => switchTab('query')}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'query' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <Search class="w-4 h-4" />
            Query
          </button>
          <button
            on:click={() => switchTab('graph')}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'graph' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <GitBranch class="w-4 h-4" />
            Graph
          </button>
          <button
            on:click={() => switchTab('commands')}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'commands' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <Terminal class="w-4 h-4" />
            Commands
          </button>
          </div>

          <button
            on:click={shareUrl}
            class="px-3 py-2 rounded-md text-sm font-medium transition-colors bg-muted hover:bg-muted/80 flex items-center gap-2"
            title="Copy shareable URL"
          >
            {#if showCopied}
              <Check class="w-4 h-4 text-green-600" />
              <span>Copied!</span>
            {:else}
              <Share2 class="w-4 h-4" />
              <span>Share</span>
            {/if}
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
              on:navigate-to-commands={handleNavigateToCommands}
            />
          {:else if activeTab === 'files'}
            <Files
              bind:fileToOpen
              on:navigate-to-graph={handleNavigateToGraph}
              on:navigate-to-commands={handleNavigateToCommands}
              on:navigate-to-targets={handleNavigateToTargets}
            />
          {:else if activeTab === 'modules'}
            <Modules />
          {:else if activeTab === 'query'}
            <Query />
          {:else if activeTab === 'graph'}
            <DependencyGraph bind:initialTarget={graphTarget} />
          {:else if activeTab === 'commands'}
            <Commands initialTarget={commandTarget} />

          {/if}
        </div>
      </div>
    </main>
  </div>
{/if}



<script lang="ts" module>
  import Workspace from './routes/Workspace.svelte';
  import Targets from './routes/Targets.svelte';
  import Files from './routes/Files.svelte';
  import Query from './routes/Query.svelte';
  import Commands from './routes/Commands.svelte';
  import DependencyGraph from './routes/DependencyGraph.svelte';
  import Modules from './routes/Modules.svelte';

const Routes = {
  workspace: Workspace,
  targets: Targets,
  files: Files,
  modules: Modules,
  query: Query,
  commands: Commands,
  graph: DependencyGraph,
} as const;
const RouteKeys = Object.keys(Routes) as Array<keyof typeof Routes>;

</script>

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
  import WorkspacePicker from './components/WorkspacePicker.svelte';
  import SettingsModal from './components/Settings.svelte';
  import { api } from './client.js';
  import { storage } from './lib/storage.js';
  import { navigation as nav, initNavigation, navigateToTab, updateParam, type AppState, copyUrlToClipboard } from './lib/navigation.js';

  let activeTab: keyof typeof Routes = $derived(nav.tab || 'workspace');
  let TabComponent = $derived(Routes[activeTab] || Routes.workspace);
  let showWorkspacePicker = $state(false);
  let showSettings = $state(false);
  let currentWorkspace: string | null = $state('');
  let currentWorkspaceName: string | null = $state('');
  let checkingWorkspace = $state(false);
  let showCopied = $state(false);


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
      const knownBazelWorkspace = '';

      // Try the known Bazel workspace first
      try {
        const result = await api.switchWorkspace({workspace:knownBazelWorkspace});
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
          const result = await api.switchWorkspace({workspace:storedWorkspace});
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
    // Send Bazel executable configuration to server on startup
    await initializeBazelExecutable();

    await checkWorkspace();

    // Initialize navigation and restore state from URL
     initNavigation(handleStateChange);

  });

  async function initializeBazelExecutable() {
    try {
      const storedExecutable = storage.getPreference('bazelExecutable');
      console.log('[App] Initializing Bazel executable:', storedExecutable || '(auto-detect)');

      const result = await api.updateBazelExecutable({
        executable: storedExecutable || ''
      });

      if (result.success) {
        console.log('[App] Bazel executable initialized:', result.detectedPath);

        // If we didn't have a stored value, save the detected one
        if (!storedExecutable && result.detectedPath) {
          storage.setPreference('bazelExecutable', result.detectedPath);
        }
      } else {
        console.warn('[App] Bazel executable verification failed:', result.message);

        // Show settings modal if Bazel is not found
        if (result.message.includes('command not found') || result.message.includes('not found')) {
          console.error('[App] Bazel executable not found. Please configure it in Settings.');
          // Delay showing settings to let the UI render first
          setTimeout(() => {
            showSettings = true;
          }, 1000);
        }
      }
    } catch (error) {
      console.error('[App] Failed to initialize Bazel executable:', error);
    }
  }

  // Handle state changes from browser navigation (back/forward)
  function handleStateChange(state: Record<string,string>) {
    activeTab =  RouteKeys.includes(state.tab) ? state.tab  as keyof typeof Routes: 'workspace';
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
      const workspace = storedWorkspace || (await api.getCurrentWorkspace({})).workspace;
      console.log('[App] Current workspace result:', workspace);

      // If server has no workspace but we have one stored, try to switch to it
      if (workspace) {
        try {
          const switchResult = await api.switchWorkspace({workspace});
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

      if (!workspace) {
        // No workspace configured or invalid, show picker
        showWorkspacePicker = true;
      } else {
        currentWorkspace = workspace;
        showWorkspacePicker = false;
        // Store the current workspace if not already stored
        if (workspace !== storedWorkspace) {
          storage.setPreference('lastWorkspace', workspace);
        }

        // Get workspace name from history if available
        const workspaceHistory = storage.getWorkspaceHistory();
        const historyEntry = workspaceHistory.find(w => w.path === workspace);
        let workspaceName = historyEntry?.name;

        // If not in history, extract from path
        if (!workspaceName) {
          const parts = workspace.split('/').filter(p => p);
          workspaceName = parts[parts.length - 1];
        }

        currentWorkspaceName = workspaceName || 'Unknown';

        // Set the current workspace for workspace-specific data
        storage.setCurrentWorkspace(workspace, workspaceName);
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



  function switchTab(tab: keyof typeof Routes) {
    activeTab = tab;
    navigateToTab(tab);
  }

  function handleOpenWorkspacePicker() {
    // Cancel any pending API requests before showing workspace picker
   // api.cancelPendingRequests();
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

  // Navigation handlers for child components
  function handleNavigateToFile(path: string) {
    navigateToTab('files', { file: path });
  }

  function handleNavigateToTargets(target: string) {
    navigateToTab('targets', { target });
  }

  // Props to pass to route components
  let routeProps = $derived({
    ...$nav,
    onNavigateToFile: handleNavigateToFile,
    onNavigateToTargets: handleNavigateToTargets,
    onOpenWorkspacePicker: handleOpenWorkspacePicker,
  });
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
                onclick={handleOpenWorkspacePicker}
              >
                <span class="text-sm text-muted-foreground">Workspace:</span>
                <span class="text-sm font-medium">{currentWorkspaceName}</span>
              </button>
            {/if}
          </div>
          <div class="flex items-center gap-4">
            <button
              class="p-2 hover:bg-muted rounded-md transition-colors"
              onclick={() => showSettings = true}
              aria-label="Open settings"
            >
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
            onclick={() => switchTab('workspace')}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'workspace' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <Home class="w-4 h-4" />
            Workspace
          </button>
          <button
            onclick={() => switchTab('targets')}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'targets' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <Target class="w-4 h-4" />
            Targets
          </button>
          <button
            onclick={() => switchTab('files')}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'files' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <FileText class="w-4 h-4" />
            Files
          </button>
          <button
            onclick={() => switchTab('modules')}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'modules' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <Package class="w-4 h-4" />
            Modules
          </button>
          <button
            onclick={() => switchTab('query')}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'query' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <Search class="w-4 h-4" />
            Query
          </button>
          <button
            onclick={() => switchTab('graph')}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'graph' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <GitBranch class="w-4 h-4" />
            Graph
          </button>
          <button
            onclick={() => switchTab('commands')}
            class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'commands' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
          >
            <Terminal class="w-4 h-4" />
            Commands
          </button>
          </div>

          <button
            onclick={shareUrl}
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
         <TabComponent {...routeProps} />
        </div>
      </div>
    </main>
  </div>
{/if}

<!-- Settings Modal -->
{#if showSettings}
  <SettingsModal onClose={() => showSettings = false} />
{/if}

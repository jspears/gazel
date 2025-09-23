<script lang="ts">
  import {
    Home,
    Target,
    FileText,
    Search,
    Terminal,
    Settings
  } from 'lucide-svelte';

  import Workspace from './routes/Workspace.svelte';
  import Targets from './routes/Targets.svelte';
  import Files from './routes/Files.svelte';
  import Query from './routes/Query.svelte';
  import Commands from './routes/Commands.svelte';

  let activeTab = 'workspace';
  let fileToOpen: string | null = null;

  function handleNavigateToFile(event: CustomEvent<{path: string}>) {
    fileToOpen = event.detail.path;
    activeTab = 'files';
  }
</script>

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
      <div class="grid w-full grid-cols-5 mb-6 bg-muted p-1 rounded-md">
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
          on:click={() => activeTab = 'commands'}
          class="flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition-colors {activeTab === 'commands' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
        >
          <Terminal class="w-4 h-4" />
          Commands
        </button>
      </div>

      <div class="mt-2">
        {#if activeTab === 'workspace'}
          <Workspace />
        {:else if activeTab === 'targets'}
          <Targets on:navigate-to-file={handleNavigateToFile} />
        {:else if activeTab === 'files'}
          <Files bind:fileToOpen />
        {:else if activeTab === 'query'}
          <Query />
        {:else if activeTab === 'commands'}
          <Commands />
        {/if}
      </div>
    </div>
  </main>
</div>



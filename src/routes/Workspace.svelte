<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { Folder, FileCode, Settings, Package, ExternalLink, Target, Clock, ChevronDown, ChevronRight } from 'lucide-svelte';
  import { api } from '$lib/api/client';
  import type { WorkspaceInfo, BuildFile } from '$lib/types';
  import { storage } from '$lib/storage';

  const dispatch = createEventDispatcher();

  let workspaceInfo: WorkspaceInfo | null = null;
  let buildFiles: BuildFile[] = [];
  let bazelConfig: Record<string, string[]> = {};
  let loading = true;
  let error: string | null = null;
  let recentTargets = storage.getRecentTargets();
  let recentFilesExpanded = true;
  let recentTargetsExpanded = true;

  onMount(async () => {
    try {
      loading = true;
      const [info, files, config] = await Promise.all([
        api.getWorkspaceInfo(),
        api.getWorkspaceFiles(),
        api.getWorkspaceConfig()
      ]);

      workspaceInfo = info;
      buildFiles = files.files;
      bazelConfig = config.configurations;
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  });

  function openFile(path: string) {
    dispatch('navigate-to-file', { path });
  }

  function viewWorkspaceFile() {
    // Find the WORKSPACE file and navigate to it
    const workspaceFile = buildFiles.find(f => f.type === 'workspace');
    if (workspaceFile) {
      dispatch('navigate-to-file', { path: workspaceFile.path });
    }
  }
</script>

<div class="space-y-6">
  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="text-muted-foreground">Loading workspace information...</div>
    </div>
  {:else if error}
    <div class="bg-destructive/10 text-destructive p-4 rounded-md">
      Error: {error}
    </div>
  {:else if workspaceInfo}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div class="bg-card p-6 rounded-lg border">
        <div class="flex items-center gap-3 mb-4">
          <Folder class="w-5 h-5 text-primary" />
          <h3 class="font-semibold">Workspace</h3>
        </div>
        <dl class="space-y-2 text-sm">
          <div>
            <dt class="text-muted-foreground">Name</dt>
            <dd class="font-mono">{workspaceInfo.workspace_name}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground">Path</dt>
            <dd class="font-mono text-xs break-all">{workspaceInfo.workspace_path}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground">Bazel Version</dt>
            <dd class="font-mono">{workspaceInfo.bazel_version}</dd>
          </div>
        </dl>
        {#if buildFiles.some(f => f.type === 'workspace')}
          <button
            on:click={viewWorkspaceFile}
            class="mt-4 w-full px-3 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 hover:text-foreground text-sm transition-colors"
          >
            View WORKSPACE File
          </button>
        {/if}
      </div>

      <div class="bg-card p-6 rounded-lg border">
        <div class="flex items-center gap-3 mb-4">
          <FileCode class="w-5 h-5 text-primary" />
          <h3 class="font-semibold">Build Files</h3>
        </div>
        <dl class="space-y-2 text-sm">
          <div>
            <dt class="text-muted-foreground">Total BUILD files</dt>
            <dd class="text-2xl font-bold">{buildFiles.filter(f => f.type === 'build').length}</dd>
          </div>
          <div>
            <dt class="text-muted-foreground">WORKSPACE files</dt>
            <dd class="text-2xl font-bold">{buildFiles.filter(f => f.type === 'workspace').length}</dd>
          </div>
        </dl>
      </div>

      <div class="bg-card p-6 rounded-lg border">
        <div class="flex items-center gap-3 mb-4">
          <Settings class="w-5 h-5 text-primary" />
          <h3 class="font-semibold">Configuration</h3>
        </div>
        <dl class="space-y-2 text-sm">
          {#each Object.entries(bazelConfig) as [key, values]}
            <div>
              <dt class="text-muted-foreground">{key}</dt>
              <dd class="font-mono">{values.length} options</dd>
            </div>
          {/each}
          {#if Object.keys(bazelConfig).length === 0}
            <div class="text-muted-foreground">No .bazelrc configuration found</div>
          {/if}
        </dl>
      </div>
    </div>

    <div class="bg-card p-6 rounded-lg border">
      <button
        on:click={() => recentFilesExpanded = !recentFilesExpanded}
        class="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
      >
        <div class="flex items-center gap-3">
          <Package class="w-5 h-5 text-primary" />
          <h3 class="font-semibold">Recent Build Files</h3>
        </div>
        {#if recentFilesExpanded}
          <ChevronDown class="w-4 h-4 text-muted-foreground" />
        {:else}
          <ChevronRight class="w-4 h-4 text-muted-foreground" />
        {/if}
      </button>
      {#if recentFilesExpanded}
        <div class="space-y-2">
        {#each buildFiles.slice(0, 10) as file}
          <button
            on:click={() => openFile(file.path)}
            class="w-full flex items-center justify-between py-2 px-3 hover:bg-muted rounded-md transition-colors cursor-pointer group"
            title="Click to view {file.path}"
          >
            <div class="flex items-center gap-2">
              <FileCode class="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span class="font-mono text-sm group-hover:text-primary transition-colors">{file.path}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground">
                {file.type === 'workspace' ? 'WORKSPACE' : 'BUILD'}
              </span>
              <ExternalLink class="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        {/each}
        {#if buildFiles.length === 0}
          <div class="text-sm text-muted-foreground py-2">No BUILD files found</div>
        {/if}
      </div>
      {/if}
    </div>

    <!-- Recent Targets Section -->
    {#if recentTargets.length > 0}
      <div class="bg-card p-6 rounded-lg border">
        <button
          on:click={() => recentTargetsExpanded = !recentTargetsExpanded}
          class="w-full flex items-center justify-between mb-4 hover:opacity-80 transition-opacity"
        >
          <div class="flex items-center gap-3">
            <Clock class="w-5 h-5 text-primary" />
            <h3 class="font-semibold">Recent Targets</h3>
          </div>
          {#if recentTargetsExpanded}
            <ChevronDown class="w-4 h-4 text-muted-foreground" />
          {:else}
            <ChevronRight class="w-4 h-4 text-muted-foreground" />
          {/if}
        </button>
        {#if recentTargetsExpanded}
          <div class="space-y-2">
          {#each recentTargets.slice(0, 10) as target}
            <button
              on:click={() => dispatch('navigate-to-targets', { target: target.name })}
              class="w-full flex items-center justify-between py-2 px-3 hover:bg-muted rounded-md transition-colors cursor-pointer group"
              title="Click to view {target.name}"
            >
              <div class="flex items-center gap-2">
                <Target class="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span class="font-mono text-sm group-hover:text-primary transition-colors truncate">{target.name}</span>
              </div>
              <div class="flex items-center gap-2">
                {#if target.type}
                  <span class="text-xs text-muted-foreground">
                    {target.type}
                  </span>
                {/if}
                <ExternalLink class="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          {/each}
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

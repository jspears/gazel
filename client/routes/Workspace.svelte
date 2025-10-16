<script lang="ts">
  import { Folder, FileCode, Package, ExternalLink, Target, Clock, ChevronDown, ChevronRight, RefreshCw, Info } from 'lucide-svelte';
  import { api } from '../client.js';
  import { storage } from '../lib/storage.js';
  import type { WorkspaceInfo, BazelInfo, GetWorkspaceFilesResponse_WorkspaceFile } from '@speajus/gazel-proto';
  import { onMount } from 'svelte';

  interface Props {
    onNavigateToFile?: (path: string) => void;
    onNavigateToTargets?: (target: string) => void;
    onOpenWorkspacePicker?: () => void;
  }

  let {
    onNavigateToFile,
    onNavigateToTargets,
    onOpenWorkspacePicker
  }: Props = $props();

  let workspaceInfo = $state<WorkspaceInfo | null>(null);
  let bazelInfo = $state<BazelInfo | null>(null);
  let buildFiles = $state<GetWorkspaceFilesResponse_WorkspaceFile[]>([]);
  let loading = $state(true); 
  let error = $state<string | null>(null);
  let recentTargets = $state(storage.getRecentTargets());
  let recentFilesExpanded = $state(true);
  let recentTargetsExpanded = $state(true);

  onMount(() => {
    (async () => {
      try {
        loading = true;
        const [info, files, bzlInfo] = await Promise.all([
          api.getWorkspaceInfo({}),
          api.getWorkspaceFiles({}),
          api.getBazelInfo({})
        ]);

        workspaceInfo = info.info;
        buildFiles = files.files ?? [];
        bazelInfo = bzlInfo.info;
      } catch (err: unknown) {
        // Don't show error if request was aborted due to page reload (workspace switching)
        if (err && typeof err === 'object' && 'isAborted' in err && !err.isAborted) {
          error = err && typeof err === 'object' && 'message' in err ? String(err.message) : 'Unknown error';
        }
      } finally {
        loading = false;
      }
    })();
  });

  function openFile(path: string) {
    onNavigateToFile?.(path);
  }


  function handleOpenWorkspacePicker() {
    onOpenWorkspacePicker?.();
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
            <dd class="font-mono">{workspaceInfo.name}</dd>
          </div>
          {#if workspaceInfo.workspaceVersion}
          <div>
            <dt class="text-muted-foreground">Version</dt>
            <dd class="font-mono">{workspaceInfo.workspaceVersion}</dd>
          </div>
          {/if}
          <div>
            <dt class="text-muted-foreground">Path</dt>
            <dd class="font-mono text-xs break-all">
              <button
                onclick={handleOpenWorkspacePicker}
                class="text-left hover:text-primary transition-colors cursor-pointer group flex items-center gap-1"
                title="Click to switch workspace"
              >
                <span>{workspaceInfo.path}</span>
                <RefreshCw class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </dd>
          </div>
        </dl>
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
        
        </dl>
      </div>

      {#if bazelInfo}
      <div class="bg-card p-6 rounded-lg border">
        <div class="flex items-center gap-3 mb-4">
          <Info class="w-5 h-5 text-primary" />
          <h3 class="font-semibold">Bazel Info</h3>
        </div>
        <dl class="space-y-2 text-sm">
          <div>
            <dt class="text-muted-foreground">Version</dt>
            <dd class="font-mono text-xs">{bazelInfo.version}</dd>
          </div>
          {#if bazelInfo.serverPid}
          <div>
            <dt class="text-muted-foreground">Server PID</dt>
            <dd class="font-mono text-xs">{bazelInfo.serverPid}</dd>
          </div>
          {/if}
          {#if bazelInfo.outputBase}
          <div>
            <dt class="text-muted-foreground">Output Base</dt>
            <dd class="font-mono text-xs break-all" title={bazelInfo.outputBase}>
              {bazelInfo.outputBase.split('/').slice(-2).join('/')}
            </dd>
          </div>
          {/if}
        </dl>
      </div>
      {/if}
    </div>

    <div class="bg-card p-6 rounded-lg border">
      <button
        onclick={() => recentFilesExpanded = !recentFilesExpanded}
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
            onclick={() => openFile(file.path)}
            class="w-full flex items-center justify-between py-2 px-3 hover:bg-muted rounded-md transition-colors cursor-pointer group"
            title="Click to view {file.path}"
          >
            <div class="flex items-center gap-2">
              <FileCode class="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              <span class="font-mono text-sm group-hover:text-primary transition-colors">{file.path}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-muted-foreground">
                {file.type === 'module' ? 'MODULE' : file.type === 'workspace' ? 'WORKSPACE' : 'BUILD'}
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
          onclick={() => recentTargetsExpanded = !recentTargetsExpanded}
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
              onclick={() => onNavigateToTargets?.(target.name)}
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

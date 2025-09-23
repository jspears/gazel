<script lang="ts">
  import { onMount } from 'svelte';
  import { Folder, FileCode, Settings, Package } from 'lucide-svelte';
  import { api } from '$lib/api/client';
  import type { WorkspaceInfo, BuildFile } from '$lib/types';
  
  let workspaceInfo: WorkspaceInfo | null = null;
  let buildFiles: BuildFile[] = [];
  let bazelConfig: Record<string, string[]> = {};
  let loading = true;
  let error: string | null = null;

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
      <div class="flex items-center gap-3 mb-4">
        <Package class="w-5 h-5 text-primary" />
        <h3 class="font-semibold">Recent Build Files</h3>
      </div>
      <div class="space-y-2">
        {#each buildFiles.slice(0, 10) as file}
          <div class="flex items-center justify-between py-2 px-3 hover:bg-muted rounded-md">
            <div class="flex items-center gap-2">
              <FileCode class="w-4 h-4 text-muted-foreground" />
              <span class="font-mono text-sm">{file.path}</span>
            </div>
            <span class="text-xs text-muted-foreground">
              {file.type === 'workspace' ? 'WORKSPACE' : 'BUILD'}
            </span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

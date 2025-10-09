<script lang="ts">
  import { onMount } from 'svelte';
  import { api } from '../client.js';
  import { Package, GitBranch, Tag, AlertCircle, ChevronRight, ChevronDown, ExternalLink, Layers, Code } from 'lucide-svelte';
  import ElkModuleGraph from '../components/ElkModuleGraph.svelte';
  import type {  GetModuleGraphResponse } from '@speajus/gazel-proto';
  import { Graphviz } from '@hpcc-js/wasm/graphviz';

  let loading = true;
  let error: string | null = null;
  let moduleGraph: GetModuleGraphResponse | null = null;
  let selectedModule: GetModuleGraphResponse['modules'][0] | null = null;
  let expandedModules = new Set<string>();
  let viewMode: 'list' | 'graph' | 'graphviz' = 'list';
  let searchQuery = '';
  let layoutDirection: 'DOWN' | 'RIGHT' = 'DOWN';
  let dotGraph = '';
  let graphSvg = '';
  let loadingGraph = false;

  onMount(async () => {
    await loadModuleGraph();
  });


  async function loadModuleGraph() {
    try {
      loading = true;
      error = null;
      console.log('Calling api.getModuleGraph...');
      moduleGraph = (await api.getModuleGraph({}));
      console.log('Module graph loaded:', moduleGraph);
      console.log('Module count:', moduleGraph?.modules?.length);
      console.log('Root:', moduleGraph?.root);
      console.log('Statistics:', moduleGraph?.statistics);

    } catch (err: any) {
      console.error('Failed to load module graph:', err);
      console.error('Error details:', err.message, err.stack);
      // Check if it's a bazel command error
      if (err.message?.includes('bazel') || err.message?.includes('command')) {
        error = 'Unable to load module graph. Make sure Bazel is installed and the workspace has a MODULE.bazel file with bzlmod enabled.';
      } else {
        error = err.message || 'Failed to load module graph';
      }


    } finally {
      loading = false;
    }
  }

  async function selectModule(module: GetModuleGraphResponse['modules'][0]) {
      selectedModule = (await api.getModuleInfo({ moduleName: module.name })).module;
  }

  async function loadDotGraph() {
    try {
      loadingGraph = true;
      console.log('Loading DOT graph...');
      const result = await api.getModuleGraphDot({ options: [] });
      dotGraph = result.dot;
      console.log('DOT graph loaded, length:', dotGraph.length);

      // Render the DOT graph to SVG
      await renderDotGraph(dotGraph);
    } catch (err: any) {
      console.error('Failed to load DOT graph:', err);
      error = err.message || 'Failed to load DOT graph';
    } finally {
      loadingGraph = false;
    }
  }

  async function renderDotGraph(dot: string) {
    try {
      console.log('Rendering DOT graph...');
      const graphviz = await Graphviz.load();
      const svg = graphviz.dot(dot);
      graphSvg = svg;
      console.log('DOT graph rendered, SVG length:', svg.length);
    } catch (err) {
      console.error('Failed to render DOT graph:', err);
      graphSvg = '';
    }
  }

  // Load DOT graph when switching to graphviz view
  $: if (viewMode === 'graphviz' && !dotGraph && !loadingGraph) {
    loadDotGraph();
  }

  function toggleModule(moduleKey: string) {
    if (expandedModules.has(moduleKey)) {
      expandedModules.delete(moduleKey);
    } else {
      expandedModules.add(moduleKey);
    }
    expandedModules = new Set(expandedModules);
  }

  function handleModuleActivation(event: KeyboardEvent, moduleKey: string) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleModule(moduleKey);
    }
  }


  function getModuleIcon(module: any) {
    if (module.isRoot) {
      return 'root';
    } else if (module.extension_usages?.length > 0) {
      return 'extension';
    } else {
      return 'module';
    }
  }

  function formatVersion(version: string) {
    if (!version || version === '_') return 'local';
    return version;
  }

  function formatModuleName(module: any) {
    // Use apparentName if different from name
    if (module.apparentName && module.apparentName !== module.name) {
      return `${module.apparentName} (${module.name})`;
    }
    return module.name;
  }

  $: filteredModules = moduleGraph?.modules?.filter((module: any) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return module.name.toLowerCase().includes(query) ||
           module.apparentName?.toLowerCase().includes(query) ||
           module.version?.toLowerCase().includes(query) ||
           module.key.toLowerCase().includes(query);
  }) || [];

  $: rootModule = moduleGraph?.modules?.find((m: any) => m.key === moduleGraph?.root);
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h2 class="text-2xl font-bold">Bazel Modules</h2>
      <p class="text-muted-foreground mt-1">
        Explore and manage Bazel module dependencies
      </p>
    </div>
    <div class="flex items-center gap-2">
      <button
        on:click={() => viewMode = 'list'}
        class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors {viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}"
      >
        List View
      </button>
      <button
        on:click={() => viewMode = 'graph'}
        class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors {viewMode === 'graph' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}"
      >
        ELK Graph
      </button>
      <button
        on:click={() => viewMode = 'graphviz'}
        class="px-3 py-1.5 rounded-md text-sm font-medium transition-colors {viewMode === 'graphviz' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}"
      >
        Graphviz
      </button>
    </div>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="text-muted-foreground">Loading module graph...</div>
    </div>
  {:else if error}
    <div class="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
      <div class="flex items-start gap-3">
        <AlertCircle class="w-5 h-5 text-destructive mt-0.5" />
        <div>
          <h3 class="font-semibold text-destructive">Error loading modules</h3>
          <p class="text-sm text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    </div>
  {:else if moduleGraph}
    {#if viewMode === 'list'}
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Module List -->
        <div class="lg:col-span-2 space-y-4">
        <!-- Search -->
        <div class="relative">
          <input
            type="text"
            bind:value={searchQuery}
            placeholder="Search modules..."
            class="w-full px-4 py-2 pr-10 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <Package class="absolute right-3 top-2.5 w-5 h-5 text-muted-foreground" />
        </div>

        <!-- Statistics -->
        <div class="grid grid-cols-4 gap-4">
          <div class="bg-muted/50 rounded-lg p-3">
            <div class="text-2xl font-bold">{moduleGraph.statistics?.totalModules || 0}</div>
            <div class="text-sm text-muted-foreground">Total Modules</div>
          </div>
          <div class="bg-muted/50 rounded-lg p-3">
            <div class="text-2xl font-bold">{moduleGraph.statistics?.directDependencies || 0}</div>
            <div class="text-sm text-muted-foreground">Direct Deps</div>
          </div>
          <div class="bg-muted/50 rounded-lg p-3">
            <div class="text-2xl font-bold">{moduleGraph.statistics?.devDependencies || 0}</div>
            <div class="text-sm text-muted-foreground">Dev Deps</div>
          </div>
          <div class="bg-muted/50 rounded-lg p-3">
            <div class="text-2xl font-bold">{moduleGraph.statistics?.indirectDependencies || 0}</div>
            <div class="text-sm text-muted-foreground">Indirect Deps</div>
          </div>
        </div>

        <!-- Root Module -->
        {#if rootModule}
          <div class="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <div class="flex items-start justify-between">
              <div class="flex items-start gap-3">
                <div class="p-2 bg-primary/20 rounded-lg">
                  <Package class="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 class="font-semibold flex items-center gap-2">
                    {formatModuleName(rootModule)}
                    <span class="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded">ROOT</span>
                  </h3>
                  <p class="text-sm text-muted-foreground mt-1">
                    Version: {formatVersion(rootModule.version)}
                  </p>
                  {#if rootModule.repoName !== rootModule.name}
                    <p class="text-sm text-muted-foreground">
                      Module: {rootModule.name}
                    </p>
                  {/if}
                </div>
              </div>
              <button
                on:click={() => selectModule(rootModule)}
                class="text-primary hover:text-primary/80"
              >
                <ChevronRight class="w-5 h-5" />
              </button>
            </div>
          </div>
        {/if}

        <!-- Module List -->
        <div class="space-y-2">
          {#each filteredModules as module}
              <div class="bg-card border rounded-lg">
                <div
                  role="button"
                  tabindex={0}
                  on:click={() => toggleModule(module.key)}
                  on:keydown={(event) => handleModuleActivation(event, module.key)}
                  class="w-full p-4 flex items-start justify-between hover:bg-muted/50 transition-colors"
                >
                  <div class="flex items-start gap-3">
                    <div class="p-2 bg-muted rounded-lg">
                      {#if module.extensionUsages?.length > 0}
                        <Code class="w-5 h-5 text-muted-foreground" />
                      {:else}
                        <Package class="w-5 h-5 text-muted-foreground" />
                      {/if}
                    </div>
                    <div class="text-left">
                      <h3 class="font-semibold">{formatModuleName(module)}</h3>
                      <p class="text-sm text-muted-foreground mt-1">
                        Version: {formatVersion(module.version)}
                      </p>
                      <div class="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {#if module.dependencyCount > 0}
                          <span class="flex items-center gap-1">
                            <GitBranch class="w-3 h-3" />
                            {module.dependencyCount} deps
                          </span>
                        {/if}
                      
                        {#if module.tags?.length > 0}
                          <span class="flex items-center gap-1">
                            <Tag class="w-3 h-3" />
                            {module.tags.length} tags
                          </span>
                        {/if}
                      </div>
                    </div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      on:click|stopPropagation={() => selectModule(module)}
                      class="text-primary hover:text-primary/80"
                    >
                      <ExternalLink class="w-4 h-4" />
                    </button>
                    {#if expandedModules.has(module.key)}
                      <ChevronDown class="w-5 h-5 text-muted-foreground" />
                    {:else}
                      <ChevronRight class="w-5 h-5 text-muted-foreground" />
                    {/if}
                  </div>
                </div>

                {#if expandedModules.has(module.key)}
                  <div class="px-4 pb-4 border-t">
                    <div class="pt-4 space-y-3">
                      {#if module.dependencies?.length > 0}
                        <div>
                          <h4 class="text-sm font-semibold mb-2">Dependencies</h4>
                          <div class="space-y-1">
                            {#each module.dependencies as dep}
                              <div class="text-sm flex items-center justify-between py-1">
                                <span class="text-muted-foreground">
                                  {dep.name}@{formatVersion(dep.version)}
                                </span>
                                {#if dep.devDependency}
                                  <span class="text-xs bg-muted px-2 py-0.5 rounded">dev</span>
                                {/if}
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}

                      {#if module.extensionUsages?.length}
                        <div>
                          <h4 class="text-sm font-semibold mb-2">Extensions</h4>
                          <div class="space-y-1">
                            {#each module.extensionUsages as ext}
                              <div class="text-sm text-muted-foreground py-1">
                                {ext.extensionName} from {ext.extensionBzlFile}
                              </div>
                            {/each}
                          </div>
                        </div>
                      {/if}
                    </div>
                  </div>
                {/if}
              </div>
          {/each}
        </div>
      </div>

      <!-- Module Details Panel -->
      <div class="lg:col-span-1">
        {#if selectedModule}
          <div class="bg-card border rounded-lg p-4 sticky top-4">
            <h3 class="font-semibold text-lg mb-4">{selectedModule.name}</h3>
            <div class="space-y-4">
              <div>
                <h4 class="text-sm font-semibold text-muted-foreground mb-1">Version</h4>
                <p class="text-sm">{formatVersion(selectedModule.version)}</p>
              </div>

              {#if selectedModule.location?.file}
                <div>
                  <h4 class="text-sm font-semibold text-muted-foreground mb-1">Location</h4>
                  <p class="text-sm font-mono">{selectedModule.location.file}:{selectedModule.location.line}</p>
                </div>
              {/if}

              {#if selectedModule.dependencies?.length > 0}
                <div>
                  <h4 class="text-sm font-semibold text-muted-foreground mb-1">Used By</h4>
                  <div class="space-y-1">
                    {#each selectedModule.dependencies as dep}
                      <div class="text-sm">{dep.name}</div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
    {:else if viewMode === 'graph'}
      <!-- ELK Graph View -->
      <div class="space-y-4">
        <!-- Controls -->
        <div class="flex items-center justify-between">
          <div class="relative flex-1 max-w-md">
            <input
              type="text"
              bind:value={searchQuery}
              placeholder="Filter modules in graph..."
              class="w-full px-4 py-2 pr-10 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Package class="absolute right-3 top-2.5 w-5 h-5 text-muted-foreground" />
          </div>
          <div class="flex items-center gap-2">
            <button
              on:click={() => layoutDirection = layoutDirection === 'DOWN' ? 'RIGHT' : 'DOWN'}
              class="px-3 py-2 bg-muted hover:bg-muted/80 rounded-md text-sm font-medium transition-colors"
              title="Toggle layout direction"
            >
              <GitBranch class="w-4 h-4 {layoutDirection === 'RIGHT' ? 'rotate-90' : ''}" />
            </button>
          </div>
        </div>

        <!-- Graph Container -->
        <div class="bg-card border rounded-lg overflow-hidden" style="height: 600px;">
          <ElkModuleGraph
            {moduleGraph}
            filter={searchQuery}
            {layoutDirection}
            onNodeClick={selectModule}
          />
        </div>

        <!-- Selected Module Details -->
        {#if selectedModule}
          <div class="bg-card border rounded-lg p-4">
            <h3 class="font-semibold text-lg mb-4">
              {formatModuleName(selectedModule)}
     
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 class="text-sm font-semibold text-muted-foreground mb-1">Version</h4>
                <p class="text-sm">{formatVersion(selectedModule.version)}</p>
              </div>
              {#if selectedModule.key}
                <div>
                  <h4 class="text-sm font-semibold text-muted-foreground mb-1">Key</h4>
                  <p class="text-sm font-mono">{selectedModule.key}</p>
                </div>
              {/if}
             
            </div>

            {#if selectedModule.dependencies?.length > 0}
              <div class="mt-4">
                <h4 class="text-sm font-semibold text-muted-foreground mb-2">Direct Dependencies ({selectedModule.dependencies.length})</h4>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {#each selectedModule.dependencies.slice(0, 6) as dep}
                    <div class="text-sm bg-muted/50 px-2 py-1 rounded">
                      {dep.name}@{formatVersion(dep.version)}
                    </div>
                  {/each}
                  {#if selectedModule.dependencies.length > 6}
                    <div class="text-sm text-muted-foreground px-2 py-1">
                      +{selectedModule.dependencies.length - 6} more
                     </div>
                  {/if}
                </div>
              </div>
            {/if}

            {#if selectedModule.resolvedDependencies?.length}
              <div class="mt-4">
                <h4 class="text-sm font-semibold text-muted-foreground mb-2">Used By ({selectedModule.resolvedDependencies.length})</h4>
                <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {#each selectedModule.resolvedDependencies.slice(0, 6) as dep}
                    <div class="text-sm bg-muted/50 px-2 py-1 rounded">
                      {dep.name}
                    </div>
                  {/each}
                  {#if selectedModule.dependencies.length > 6}
                    <div class="text-sm text-muted-foreground px-2 py-1">
                      +{selectedModule.resolvedDependencies.length - 6} more
                    </div>
                  {/if}
                </div>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {:else if viewMode === 'graphviz'}
      <!-- Graphviz View -->
      <div class="space-y-4">
        {#if loadingGraph}
          <div class="flex items-center justify-center py-12">
            <div class="text-muted-foreground">Loading graph...</div>
          </div>
        {:else if graphSvg}
          <div class="bg-card border rounded-lg p-4 overflow-auto" style="max-height: 800px;">
            {@html graphSvg}
          </div>
        {:else if dotGraph}
          <div class="bg-card border rounded-lg p-4">
            <pre class="text-xs overflow-auto max-h-96">{dotGraph}</pre>
          </div>
        {:else}
          <div class="bg-card border rounded-lg p-4">
            <p class="text-muted-foreground">No graph data available</p>
          </div>
        {/if}
      </div>
    {/if}
  {/if}
</div>

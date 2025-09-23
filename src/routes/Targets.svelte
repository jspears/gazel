<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { Search, Filter, Target, ChevronRight, FileCode, ExternalLink, Play, X, Clock, ChevronDown } from 'lucide-svelte';
  import { api } from '$lib/api/client';
  import type { BazelTarget } from '$lib/types';
  import { createEventDispatcher } from 'svelte';
  import { storage } from '$lib/storage';

  const dispatch = createEventDispatcher();
  
  let targets: BazelTarget[] = [];
  let filteredTargets: BazelTarget[] = [];
  let byPackage: Record<string, BazelTarget[]> = {};
  let loading = false;
  let error: string | null = null;
  let searchQuery = '';
  let selectedType = '';
  let selectedTarget: BazelTarget | null = null;
  let targetDependencies: BazelTarget[] = [];
  let targetOutputs: Array<{path: string; filename: string; type: string}> = [];
  let loadingOutputs = false;
  let usingFallbackSearch = false;

  // Run modal state
  let showRunModal = false;
  let runOutput: string[] = [];
  let runCommand = '';
  let runStatus: 'idle' | 'running' | 'success' | 'error' = 'idle';
  let runCleanup: (() => void) | null = null;
  let outputContainer: HTMLDivElement;

  // Show hidden targets state
  let showHiddenTargets = false;

  // Infinite scrolling state
  let displayLimit = 100;
  let loadingMore = false;
  let loadMoreElement: HTMLDivElement;

  // Search history state
  let searchHistory: string[] = [];
  let showSearchHistory = false;

  onMount(() => {
    loadTargets();

    // Load search history
    searchHistory = storage.getSearchHistory();

    // Load saved preferences
    const savedShowHidden = storage.getPreference('showHiddenTargets');
    if (savedShowHidden !== undefined) {
      showHiddenTargets = savedShowHidden;
    }

    // Close search history dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-container')) {
        showSearchHistory = false;
      }
    };

    document.addEventListener('click', handleClickOutside);

    // Set up intersection observer for infinite scrolling
    if (typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting && !loadingMore && displayLimit < visibleTargets.length) {
              loadMoreTargets();
            }
          });
        },
        { threshold: 0.1 }
      );

      // Observe the load more element when it's available
      const checkElement = setInterval(() => {
        if (loadMoreElement) {
          observer.observe(loadMoreElement);
          clearInterval(checkElement);
        }
      }, 100);

      return () => {
        observer.disconnect();
        clearInterval(checkElement);
        document.removeEventListener('click', handleClickOutside);
      };
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  async function loadTargets() {
    try {
      loading = true;
      error = null;
      displayLimit = 100; // Reset display limit when loading new targets
      const result = await api.listTargets();
      targets = result.targets;
      filteredTargets = targets;
      byPackage = result.byPackage;
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function loadMoreTargets() {
    if (loadingMore || displayLimit >= visibleTargets.length) return;

    loadingMore = true;
    // Simulate loading delay for better UX
    setTimeout(() => {
      displayLimit = Math.min(displayLimit + 100, visibleTargets.length);
      loadingMore = false;
    }, 300);
  }

  function selectSearchFromHistory(query: string) {
    searchQuery = query;
    showSearchHistory = false;
    searchTargets(false); // Don't save to history when selecting from history
  }

  function clearSearchHistory() {
    storage.clearSearchHistory();
    searchHistory = [];
    showSearchHistory = false;
  }

  async function searchTargets(saveToHistory = true) {
    displayLimit = 100; // Reset display limit when searching

    if (!searchQuery.trim()) {
      filteredTargets = targets;
      usingFallbackSearch = false;
      error = null;
      return;
    }

    // Save to history if it's a user-initiated search
    if (saveToHistory) {
      storage.addSearchQuery(searchQuery);
      searchHistory = storage.getSearchHistory();
    }

    try {
      loading = true;
      error = null;
      usingFallbackSearch = false;
      const result = await api.searchTargets(searchQuery, selectedType);
      filteredTargets = result.targets;
    } catch (err: any) {
      // If the Bazel query fails, fall back to string search
      console.log('Bazel query failed, falling back to string search:', err.message);
      performStringSearch();
      usingFallbackSearch = true;
      // Don't show error for fallback search, just indicate we're using text search
      error = null;
    } finally {
      loading = false;
    }
  }

  function performStringSearch() {
    const query = searchQuery.toLowerCase().trim();

    filteredTargets = targets.filter(target => {
      // Search in target name
      if (target.name.toLowerCase().includes(query)) {
        return true;
      }

      // Search in target label
      if (target.label && target.label.toLowerCase().includes(query)) {
        return true;
      }

      // Search in package name
      if (target.package && target.package.toLowerCase().includes(query)) {
        return true;
      }

      // Search in rule type
      if (target.type && target.type.toLowerCase().includes(query)) {
        return true;
      }

      // Search in visibility
      if (target.visibility && target.visibility.some(v => v.toLowerCase().includes(query))) {
        return true;
      }

      // Search in tags
      if (target.tags && target.tags.some(tag => tag.toLowerCase().includes(query))) {
        return true;
      }

      // Search in attributes (srcs, deps, etc.)
      if (target.srcs && target.srcs.some(src => src.toLowerCase().includes(query))) {
        return true;
      }

      if (target.deps && target.deps.some(dep => dep.toLowerCase().includes(query))) {
        return true;
      }

      return false;
    });

    // Apply type filter if selected
    if (selectedType) {
      filteredTargets = filteredTargets.filter(t => t.type === selectedType);
    }
  }

  async function selectTarget(target: BazelTarget) {
    selectedTarget = target;
    targetOutputs = [];

    if (target.full) {
      try {
        const deps = await api.getTargetDependencies(target.full, 1);
        targetDependencies = deps.dependencies;
      } catch (err) {
        console.error('Failed to load dependencies:', err);
        targetDependencies = [];
      }

      // Load outputs for the selected target
      loadingOutputs = true;
      try {
        const outputResult = await api.getTargetOutputs(target.full);
        targetOutputs = outputResult.outputs || [];
      } catch (err) {
        console.error('Failed to load outputs:', err);
        targetOutputs = [];
      } finally {
        loadingOutputs = false;
      }
    }
  }

  function filterByType(type: string) {
    selectedType = type;
    usingFallbackSearch = false;
    error = null;
    displayLimit = 100; // Reset display limit when filtering

    // If there's a search query, re-run the search with the new type filter
    if (searchQuery.trim()) {
      searchTargets();
    } else {
      // No search query, just filter by type
      if (!type) {
        filteredTargets = targets;
      } else {
        filteredTargets = targets.filter(t => t.ruleType === type);
      }
    }
  }

  function navigateToBuildFile(target: BazelTarget) {
    if (target.location) {
      // Extract the BUILD file path from the location (format: //package:target:line:column)
      const match = target.location.match(/^([^:]+)/);
      if (match) {
        const buildPath = match[1].replace('//', '') + '/BUILD';
        // Dispatch event to parent to switch to Files tab with this file
        dispatch('navigate-to-file', { path: buildPath });
      }
    }
  }

  function getBuildFilePath(target: BazelTarget): string | null {
    if (target.location) {
      const match = target.location.match(/^([^:]+)/);
      if (match) {
        return match[1].replace('//', '') + '/BUILD';
      }
    }
    if (target.package) {
      return target.package.replace('//', '') + '/BUILD';
    }
    return null;
  }

  function getExpectedOutputs(ruleType: string): string {
    const outputPatterns: Record<string, string> = {
      'cc_binary': 'Executable binary file',
      'cc_library': 'Static library (.a) and/or shared library (.so)',
      'cc_test': 'Test executable',
      'py_binary': 'Python executable or .pex file',
      'py_library': 'Python source files and compiled .pyc files',
      'py_test': 'Python test executable',
      'java_binary': 'JAR file and/or executable wrapper',
      'java_library': 'JAR file with compiled classes',
      'java_test': 'Test JAR and test runner',
      'go_binary': 'Go executable',
      'go_library': 'Go archive file (.a)',
      'go_test': 'Go test executable',
      'rust_binary': 'Rust executable',
      'rust_library': 'Rust library (.rlib)',
      'proto_library': 'Protocol buffer descriptor sets',
      'filegroup': 'Collection of files',
      'genrule': 'Custom generated files defined by the rule'
    };

    return outputPatterns[ruleType] || 'Target outputs';
  }

  function isExecutableTarget(target: BazelTarget): boolean {
    if (!target.ruleType) return false;

    const executableTypes = [
      'cc_binary',
      'cc_test',
      'py_binary',
      'py_test',
      'java_binary',
      'java_test',
      'go_binary',
      'go_test',
      'rust_binary',
      'sh_binary',
      'sh_test'
    ];

    return executableTypes.includes(target.ruleType);
  }

  function isHiddenTarget(target: BazelTarget): boolean {
    // Check if the target name starts with a dot
    const name = target.name || target.full || '';
    const lastPart = name.split(':').pop() || '';
    return lastPart.startsWith('.');
  }

  async function runTarget(target: BazelTarget) {
    if (!target.full && !target.name) return;

    const targetName = target.full || target.name;
    runCommand = `bazel run ${targetName}`;
    runOutput = [];
    runStatus = 'running';
    showRunModal = true;

    try {
      runCleanup = await api.streamRun(
        targetName,
        [],
        (data) => {
          if (data.type === 'stdout' || data.type === 'stderr') {
            runOutput = [...runOutput, data.data];
            // Auto-scroll to bottom
            if (outputContainer) {
              setTimeout(() => {
                outputContainer.scrollTop = outputContainer.scrollHeight;
              }, 0);
            }
          } else if (data.type === 'exit') {
            if (data.code === 0) {
              runStatus = 'success';
              runOutput = [...runOutput, '\n✅ Command completed successfully'];
            } else if (data.code === null) {
              // Process was killed or terminated abnormally
              runStatus = 'error';
              runOutput = [...runOutput, '\n⚠️ Command was terminated'];
            } else {
              runStatus = 'error';
              runOutput = [...runOutput, `\n❌ Command failed with exit code ${data.code}`];
            }
          } else if (data.type === 'error') {
            // Handle stream errors
            runStatus = 'error';
            runOutput = [...runOutput, `\n❌ Error: ${data.data}`];
          }
        }
      );
    } catch (error: any) {
      runStatus = 'error';
      runOutput = [...runOutput, `\n❌ Error: ${error.message}`];
    }
  }

  function closeRunModal() {
    if (runCleanup) {
      // If still running, add a message that we're stopping
      if (runStatus === 'running') {
        runOutput = [...runOutput, '\n⚠️ Stopping command...'];
      }
      runCleanup();
      runCleanup = null;
    }
    showRunModal = false;
    runStatus = 'idle';
    runOutput = [];
    runCommand = '';
  }

  onDestroy(() => {
    if (runCleanup) {
      runCleanup();
    }
  });

  $: uniqueTypes = [...new Set(targets.map(t => t.ruleType).filter(Boolean))];

  // Filter targets based on hidden state
  $: visibleTargets = showHiddenTargets
    ? filteredTargets
    : filteredTargets.filter(t => !isHiddenTarget(t));

  $: hiddenCount = filteredTargets.filter(t => isHiddenTarget(t)).length;

  // Save preference when showHiddenTargets changes
  $: if (typeof showHiddenTargets !== 'undefined') {
    storage.setPreference('showHiddenTargets', showHiddenTargets);
  }
</script>

<div class="space-y-6">
  <div class="flex gap-4">
    <div class="flex-1">
      <div class="relative search-container">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          bind:value={searchQuery}
          on:input={() => searchTargets()}
          on:focus={() => showSearchHistory = searchHistory.length > 0}
          placeholder="Search targets (Bazel query or text)..."
          class="w-full pl-10 pr-10 py-2 border rounded-md bg-background"
          title="Enter a Bazel query expression or plain text to search. Falls back to text search if query syntax is invalid."
        />
        {#if searchHistory.length > 0}
          <button
            on:click={() => showSearchHistory = !showSearchHistory}
            class="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 hover:bg-muted rounded"
            title="Search history"
          >
            <ChevronDown class={`w-4 h-4 text-muted-foreground transition-transform ${showSearchHistory ? 'rotate-180' : ''}`} />
          </button>
        {/if}

        {#if showSearchHistory && searchHistory.length > 0}
          <div class="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-10 max-h-64 overflow-y-auto">
            <div class="p-2 border-b flex items-center justify-between">
              <span class="text-xs text-muted-foreground font-medium">Recent Searches</span>
              <button
                on:click={clearSearchHistory}
                class="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
            {#each searchHistory as query}
              <button
                on:click={() => selectSearchFromHistory(query)}
                class="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 group"
              >
                <Clock class="w-3 h-3 text-muted-foreground" />
                <span class="text-sm truncate">{query}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
    <select
      bind:value={selectedType}
      on:change={() => filterByType(selectedType)}
      class="px-4 py-2 border rounded-md bg-background"
    >
      <option value="">All types</option>
      {#each uniqueTypes as type}
        <option value={type}>{type}</option>
      {/each}
    </select>
    <button
      on:click={loadTargets}
      class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
    >
      Refresh
    </button>
  </div>

  <div class="flex items-center gap-4">
    <label class="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        bind:checked={showHiddenTargets}
        class="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
      />
      <span class="text-sm">Show hidden targets</span>
      {#if hiddenCount > 0 && !showHiddenTargets}
        <span class="text-xs text-muted-foreground">({hiddenCount} hidden)</span>
      {/if}
    </label>
  </div>

  {#if usingFallbackSearch && searchQuery}
    <div class="bg-amber-500/10 text-amber-700 dark:text-amber-400 p-3 rounded-md flex items-center gap-2">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
      </svg>
      <span>Using text search (Bazel query syntax not recognized). Showing targets matching "{searchQuery}"</span>
    </div>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <div class="text-muted-foreground">Loading targets...</div>
    </div>
  {:else if error}
    <div class="bg-destructive/10 text-destructive p-4 rounded-md">
      Error: {error}
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-card rounded-lg border">
        <div class="p-4 border-b flex items-center justify-between">
          <h3 class="font-semibold">
            Targets ({visibleTargets.length})
            {#if hiddenCount > 0 && !showHiddenTargets}
              <span class="text-xs text-muted-foreground ml-1">(+{hiddenCount} hidden)</span>
            {/if}
          </h3>
          {#if usingFallbackSearch}
            <span class="text-xs text-amber-600 dark:text-amber-400">Text Search</span>
          {/if}
        </div>
        <div class="max-h-[600px] overflow-y-auto">
          {#each visibleTargets.slice(0, displayLimit) as target}
            <button
              on:click={() => selectTarget(target)}
              class="w-full text-left px-4 py-3 hover:bg-muted border-b last:border-b-0 flex items-center justify-between group"
              class:bg-muted={selectedTarget === target}
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <Target class="w-4 h-4 text-muted-foreground" />
                  <span class="font-mono text-sm truncate">{target.full || target.name}</span>
                </div>
                {#if target.ruleType}
                  <span class="text-xs text-muted-foreground">{target.ruleType}</span>
                {/if}
              </div>
              <ChevronRight class="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
            </button>
          {/each}
          {#if visibleTargets.length > displayLimit}
            <div bind:this={loadMoreElement} class="p-4 text-center text-sm">
              {#if loadingMore}
                <div class="flex items-center justify-center gap-2">
                  <div class="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                  <span class="text-muted-foreground">Loading more targets...</span>
                </div>
              {:else}
                <span class="text-muted-foreground">
                  Showing {displayLimit} of {visibleTargets.length} targets
                </span>
              {/if}
            </div>
          {/if}
        </div>
      </div>

      <div class="bg-card rounded-lg border">
        <div class="p-4 border-b">
          <h3 class="font-semibold">Target Details</h3>
        </div>
        <div class="p-4">
          {#if selectedTarget}
            <div class="space-y-4">
              <div>
                <h4 class="text-sm font-medium text-muted-foreground mb-1">Name</h4>
                <p class="font-mono text-sm">{selectedTarget.name || selectedTarget.full}</p>
              </div>
              
              {#if selectedTarget.ruleType}
                <div>
                  <h4 class="text-sm font-medium text-muted-foreground mb-1">Type</h4>
                  <p class="font-mono text-sm">{selectedTarget.ruleType}</p>
                  <p class="text-xs text-muted-foreground mt-1">
                    Expected: {getExpectedOutputs(selectedTarget.ruleType)}
                  </p>
                </div>
              {/if}

              {#if targetOutputs.length > 0 || loadingOutputs}
                <div class="col-span-2 border-l-4 border-primary pl-4">
                  <h4 class="text-sm font-medium text-primary mb-2 flex items-center gap-2">
                    <span class="font-semibold">Returns / Outputs</span>
                    {#if !loadingOutputs}
                      <span class="text-xs text-muted-foreground">({targetOutputs.length} files)</span>
                    {/if}
                  </h4>
                  {#if loadingOutputs}
                    <p class="text-sm text-muted-foreground">Loading outputs...</p>
                  {:else if targetOutputs.length > 0}
                    <div class="space-y-1 max-h-32 overflow-y-auto bg-muted/30 p-2 rounded">
                      {#each targetOutputs as output}
                        <div class="flex items-center gap-2 text-sm">
                          <span class="font-mono text-xs px-1 py-0.5 bg-primary/10 text-primary rounded">
                            .{output.type}
                          </span>
                          <span class="font-mono text-sm truncate" title={output.path}>
                            {output.filename}
                          </span>
                        </div>
                      {/each}
                    </div>
                  {:else}
                    <p class="text-sm text-muted-foreground">No outputs detected</p>
                  {/if}
                </div>
              {/if}
              
              {#if selectedTarget.location}
                <div>
                  <h4 class="text-sm font-medium text-muted-foreground mb-1">Location</h4>
                  <div class="flex items-center gap-2">
                    <p class="font-mono text-sm">{selectedTarget.location}</p>
                    {#if getBuildFilePath(selectedTarget)}
                      <button
                        on:click={() => selectedTarget && navigateToBuildFile(selectedTarget)}
                        class="p-1 hover:bg-muted rounded flex items-center gap-1 text-xs text-primary"
                        title="View in BUILD file"
                      >
                        <FileCode class="w-3 h-3" />
                        <ExternalLink class="w-3 h-3" />
                      </button>
                    {/if}
                  </div>
                </div>
              {/if}

              {#if isExecutableTarget(selectedTarget)}
                <div>
                  <button
                    on:click={() => selectedTarget && runTarget(selectedTarget)}
                    class="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md flex items-center gap-2 transition-colors"
                    disabled={runStatus === 'running'}
                  >
                    <Play class="w-4 h-4" />
                    Run Target
                  </button>
                </div>
              {/if}

              {#if selectedTarget.attributes && Object.keys(selectedTarget.attributes).length > 0}
                <div>
                  <h4 class="text-sm font-medium text-muted-foreground mb-1">Attributes</h4>
                  <div class="space-y-1">
                    {#each Object.entries(selectedTarget.attributes) as [key, value]}
                      <div class="text-sm">
                        <span class="font-mono text-muted-foreground">{key}:</span>
                        <span class="font-mono ml-2">
                          {typeof value === 'object' ? JSON.stringify(value) : value}
                        </span>
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
              
              {#if targetDependencies.length > 0}
                <div>
                  <h4 class="text-sm font-medium text-muted-foreground mb-1">
                    Direct Dependencies ({targetDependencies.length})
                  </h4>
                  <div class="space-y-1 max-h-40 overflow-y-auto">
                    {#each targetDependencies as dep}
                      <div class="font-mono text-sm text-muted-foreground">
                        {dep.full || dep.name}
                      </div>
                    {/each}
                  </div>
                </div>
              {/if}
            </div>
          {:else}
            <p class="text-muted-foreground">Select a target to view details</p>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<!-- Run Modal -->
{#if showRunModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-background border rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
      <!-- Modal Header -->
      <div class="p-4 border-b flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">Running Target</h2>
          <p class="text-sm text-muted-foreground font-mono mt-1">{runCommand}</p>
        </div>
        <button
          on:click={closeRunModal}
          class="p-2 hover:bg-muted rounded-md transition-colors"
          title="Close"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Modal Body - Output Log -->
      <div bind:this={outputContainer} class="flex-1 overflow-y-auto p-4 bg-muted/20">
        <pre class="font-mono text-sm whitespace-pre-wrap">{runOutput.join('')}</pre>
        {#if runStatus === 'running'}
          <div class="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
            <span>Running...</span>
          </div>
        {/if}
      </div>

      <!-- Modal Footer -->
      <div class="p-4 border-t flex items-center justify-between">
        <div class="flex items-center gap-2">
          {#if runStatus === 'success'}
            <span class="text-green-600 dark:text-green-400 text-sm font-medium">✅ Success</span>
          {:else if runStatus === 'error'}
            <span class="text-red-600 dark:text-red-400 text-sm font-medium">❌ Failed</span>
          {:else if runStatus === 'running'}
            <span class="text-blue-600 dark:text-blue-400 text-sm font-medium">⏳ Running</span>
          {/if}
        </div>
        <button
          on:click={closeRunModal}
          class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}

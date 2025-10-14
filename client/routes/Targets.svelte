<script lang="ts">
  import { onMount } from 'svelte';
  import { Search, Target, ChevronRight, Clock, ChevronDown, List, Network } from 'lucide-svelte';
  import { api } from '../client.js';
  import type { BazelTarget } from '@speajus/gazel-proto';
  import { storage } from '../lib/storage.js';
  import TypeSelector from '../components/TypeSelector.svelte';
  import TargetTreeView from '../components/TargetTreeView.svelte';
  import { navigateToTab, updateParam } from '../lib/navigation.js';
  import TargetActions from '../components/TargetActions.svelte';
  import { toFull } from '../components/target-util.js';
  import TargetDetails from '../components/TargetDetails.svelte';

  interface Props {
    initialTarget?: string | null;
  }

  let {
    initialTarget = $bindable(null)
  }: Props = $props();

  let targets = $state<BazelTarget[]>([]);
  let filteredTargets = $state<BazelTarget[]>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let selectedType = $state('');
  let selectedTarget = $state<BazelTarget | null>(null);
  let usingFallbackSearch = $state(false);

  // Show hidden targets state
  let showHiddenTargets = $state(false);

  // Infinite scrolling state
  let displayLimit = $state(100);
  let loadingMore = $state(false);
  let loadMoreElement = $state<HTMLDivElement>();

  // Search history state
  let searchHistory = $state<string[]>([]);
  let showSearchHistory = $state(false);

  // Navigation breadcrumb state
  let navigationHistory = $state<BazelTarget[]>([]);

  // View mode state
  let viewMode = $state<'list' | 'tree'>('tree');

 
  onMount(async () => {
    console.log('loading targets...');
    try {
    await loadTargets();
    }catch(err){
      console.trace(err)
      console.error('Failed to load targets:', err);
    }
    // Load search history
    searchHistory = storage.getSearchHistory();

    // If there's an initial target, find and select it
    if (initialTarget) {
      const target = targets.find(t => {
        const fullPath = toFull(t);
        // Match against full path or just the name for backwards compatibility
        return fullPath === initialTarget ||
               t.name === initialTarget ||
               (t.name && t.name.includes(initialTarget));
      });

      if (target) {
        selectTarget(target);
        // Optionally scroll to the target in the list
        setTimeout(() => {
          const targetElement = document.querySelector(`[data-target="${toFull(target)}"]`);
          if (targetElement) {
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
      }

      // Clear the initial target after using it
      initialTarget = null;
    }

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


    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });

  async function loadTargets() {
      loading = true;
      error = null;
      displayLimit = 100; // Reset display limit when loading new targets
      targets = [];
      filteredTargets = [];
      try {

      // Stream targets as they load
      for await (const response of api.searchTargets({query: '//...'})) {
        if (response.data.case === 'target') {
          // Convert protobuf message to plain object to avoid cloning issues with Svelte reactivity
          const plainTarget: BazelTarget =  response.data.value as BazelTarget;
          // Add target to the list as it arrives
          filteredTargets = [...filteredTargets, plainTarget];
        } else if (response.data.case === 'complete') {
          // All targets loaded
          console.log(`Loaded ${response.data.value.total} targets`);
          loading = false;
        } else if (response.data.case === 'error') {
          console.error('Error loading targets:', response.data.value);
          error = response.data.value;
          loading = false;
        }
      }

      // Store the final list in targets for filtering
      targets = filteredTargets;

    } catch (err: any) {
      console.trace(err)
      // Don't show error if request was aborted due to page reload (workspace switching)
      if (!err.isAborted) {
        error = err.message;
      }
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
      updateParam('searchQuery', undefined);
      return;
    }

    // Update URL with search query
    updateParam('searchQuery', searchQuery);

    // Save to history if it's a user-initiated search
    if (saveToHistory) {
      storage.addSearchQuery(searchQuery);
      searchHistory = storage.getSearchHistory();
    }

    try {
      loading = true;
      error = null;
      usingFallbackSearch = false;
      filteredTargets = [];

      // Stream search results as they arrive
      for await (const response of api.searchTargets({query: searchQuery, type: selectedType})) {
        if (response.data.case === 'target') {
          // Add target to the list as it arrives
          filteredTargets = [...filteredTargets, response.data.value];
        } else if (response.data.case === 'complete') {
          // Search complete
          console.log(`Found ${response.data.value.total} targets matching "${response.data.value.query}"`);
        } else if (response.data.case === 'error') {
          error = response.data.value;
        }
      }
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
      if (target.label?.toLowerCase().includes(query)) {
        return true;
      }

      // Search in package name
      if (target?.package.toLowerCase().includes(query)) {
        return true;
      }

      // Search in rule type
      if (target.type?.toLowerCase().includes(query)) {
        return true;
      }

      // Search in visibility
      if (target.visibility?.some(v => v.toLowerCase().includes(query))) {
        return true;
      }

      // Search in tags
      if (target.tags?.some(tag => tag.toLowerCase().includes(query))) {
        return true;
      }

      // Search in attributes (srcs, deps, etc.)
      if (target.srcs?.some(src => src.toLowerCase().includes(query))) {
        return true;
      }

      if (target.deps?.some(dep => dep.toLowerCase().includes(query))) {
        return true;
      }

      return false;
    });

    // Apply type filter if selected
    if (selectedType) {
      filteredTargets = filteredTargets.filter(t => t.kind === selectedType);
    }
  }

  async function selectTarget(target: BazelTarget, addToHistory = true) {
    selectedTarget = target;
    
    // Update URL with selected target (use full path)
    const fullTargetPath = toFull(target);
        console.log('selectTarget:',fullTargetPath);

    updateParam('target', fullTargetPath);

    // Save to recent targets (use full path)
    storage.addRecentTarget(fullTargetPath);
    

    // Add to navigation history if not navigating back
    if (addToHistory && selectedTarget) {
      // Remove any items after the current position if we're not at the end
      const currentIndex = navigationHistory.findIndex(t =>
        t.name === selectedTarget?.name
      );
      if (currentIndex !== -1) {
        navigationHistory = navigationHistory.slice(0, currentIndex);
      } else {
        navigationHistory = [...navigationHistory, target];
      }
    }

  }

  function handleTargetActivation(event: KeyboardEvent, target: BazelTarget) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      selectTarget(target);
    }
  }

  async function navigateToTarget(target: BazelTarget) {
    // If the target doesn't have full details, try to find it in the current list
    const fullTarget = targets.find(t =>
      (t.name === target.name) && (t.package === target.package)
    );

    if (fullTarget) {
      selectTarget(fullTarget, true);
    } else {
      // If not found, select it anyway (it will load its dependencies)
      selectTarget(target, true);
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
        filteredTargets = targets.filter(t => t.kind === type);
      }
    }
  }

  function navigateToBuildFile(target: BazelTarget) {
    if (target.package) {
      // Extract the BUILD file path from the location (format: //package:target:line:column)
      const match = target.package.match(/^([^:]+)/);
      if (match) {
        const buildPath = match[1].replace('//', '') + '/BUILD';
        navigateToTab('files', { file: buildPath });
      }
    }
  }

  function navigateToGraph(target: BazelTarget) {
    const targetName = target.name;
    if (targetName) {
      // Dispatch event to parent to switch to Graph tab with this target
       navigateToTab('graph', { file: toFull(target) });

    }
  }

  function navigateToCommands(target: BazelTarget) {
     navigateToTab('commands', { target: toFull(target) });
  }

  function getBuildFilePath(target: BazelTarget): string | null {
    if (target.package) {
      const match = target.package.match(/^([^:]+)/);
      if (match) {
        return match[1].replace('//', '') + '/BUILD';
      }
    }
    if (target.package) {
      return target.package.replace('//', '') + '/BUILD';
    }
    return null;
  }

  function isHiddenTarget(target: BazelTarget): boolean {
    // Check if the target name starts with a dot
    const name = target.name || '';
    const lastPart = name.split(':').pop() || '';
    return lastPart.startsWith('.');
  }

  let uniqueTypes = $derived([...new Set(targets.map(t => t.kind).filter(Boolean))]);

  // Filter targets based on hidden state
  let visibleTargets = $derived(showHiddenTargets
    ? filteredTargets
    : filteredTargets.filter(t => !isHiddenTarget(t)));

  let hiddenCount = $derived(filteredTargets.filter(t => isHiddenTarget(t)).length);

  // Save preference when showHiddenTargets changes
  $effect(() => {
    if (typeof showHiddenTargets !== 'undefined') {
      storage.setPreference('showHiddenTargets', showHiddenTargets);
    }
  });
</script>

<div class="space-y-6">
  <div class="flex gap-4">
    <div class="flex-1">
      <div class="relative search-container">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          bind:value={searchQuery}
          oninput={() => searchTargets()}
          onfocus={() => showSearchHistory = searchHistory.length > 0}
          placeholder="Search targets (Bazel query or text)..."
          class="w-full pl-10 pr-10 py-2 border rounded-md bg-background"
          title="Enter a Bazel query expression or plain text to search. Falls back to text search if query syntax is invalid."
        />
        {#if searchHistory.length > 0}
          <button
            onclick={() => showSearchHistory = !showSearchHistory}
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
                onclick={clearSearchHistory}
                class="text-xs text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
            {#each searchHistory as query}
              <button
                onclick={() => selectSearchFromHistory(query)}
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
    <TypeSelector
      bind:value={selectedType}
      types={uniqueTypes}
      onchange={() => filterByType(selectedType)}
    />
    <button
      onclick={loadTargets}
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
      <span class="text -sm">Show hidden targets</span>
  
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

  {#if loading && filteredTargets.length === 0}
    <div class="flex items-center justify-center py-12">
      <div class="flex items-center gap-2">
        <div class="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
        <span class="text-muted-foreground">Loading targets...</span>
      </div>
    </div>
  {:else if error}
    <div class="bg-destructive/10 text-destructive p-4 rounded-md">
      Error: {error}
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div class="bg-card rounded-lg border">
        <div class="p-4 border-b flex items-center justify-between">
          <h3 class="font-semibold flex items-center gap-2">
            Targets ({visibleTargets.length})
            {#if hiddenCount > 0 && !showHiddenTargets}
              <span class="text-xs text-muted-foreground ml-1">(+{hiddenCount} hidden)</span>
            {/if}
            {#if loading}
              <div class="flex items-center gap-1 text-xs text-muted-foreground font-normal">
                <div class="animate-spin rounded-full h-3 w-3 border-2 border-primary border-t-transparent"></div>
                <span>Loading...</span>
              </div>
            {/if}
          </h3>
          <div class="flex items-center gap-2">
            {#if usingFallbackSearch}
              <span class="text-xs text-amber-600 dark:text-amber-400">Text Search</span>
            {/if}
            <div class="flex items-center gap-1 border rounded-md p-1">
              <button
                onclick={() => viewMode = 'list'}
                class="p-1 rounded transition-colors"
                class:bg-muted={viewMode === 'list'}
                class:text-primary={viewMode === 'list'}
                title="List view"
              >
                <List class="w-4 h-4" />
              </button>
              <button
                onclick={() => viewMode = 'tree'}
                class="p-1 rounded transition-colors"
                class:bg-muted={viewMode === 'tree'}
                class:text-primary={viewMode === 'tree'}
                title="Tree view"
              >
                <Network class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        {#if loading}
          <div class="text-muted-foreground">Loading targets...</div>
        {:else if filteredTargets.length === 0}
          <div class="text-muted-foreground">No targets found</div>
        {:else}
        {#if viewMode === 'list'}
          <div class="max-h-[600px] overflow-y-auto">
            {#each visibleTargets.slice(0, displayLimit) as target}
              <div
                role="button"
                tabindex={0}
                onclick={() => selectTarget(target)}
                onkeydown={(event) => handleTargetActivation(event, target)}
                data-target={toFull(target)}
                class="w-full text-left px-4 py-3 hover:bg-muted border-b last:border-b-0 flex items-center justify-between group"
                class:bg-muted={selectedTarget === target}
              >
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <Target class="w-4 h-4 text-muted-foreground" />
                    <span class="font-mono text-sm truncate">{target.name}</span>
                  </div>
                  {#if target.kind}
                    <span class="text-xs text-muted-foreground">{target.kind}</span>
                  {/if}
                </div>
               <TargetActions {target}>
                    <ChevronRight class="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
               </TargetActions>
              </div>
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
        {:else}
          <TargetTreeView
            targets={visibleTargets}
            {selectedTarget}
            {displayLimit}
            onSelectTarget={(e) => selectTarget(e.detail.target)}
            onNavigateToGraph={(e) => navigateToGraph(e.detail.target)}
            onNavigateToCommands={(e) => navigateToCommands(e.detail.target)}
          />
        {/if}
        {/if}
      </div>

      {#if selectedTarget}
       <TargetDetails target={selectedTarget} />
      {:else}
        <p class="text-muted-foreground">Select a target to view details</p>
      {/if}
    </div>
  {/if}
</div>



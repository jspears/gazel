<script lang="ts">
  import { ChevronRight, FileCode, ExternalLink, Play, TestTube } from 'lucide-svelte';
  import CopyButton from './CopyButton.svelte';
  import AttributesDisplay from './AttributesDisplay.svelte';
  import { api } from '../client.js';
  import type { BazelTarget } from '@speajus/gazel-proto';
  import { toFull, isExecutableTarget, isTest, getExpectedOutputs } from './target-util.js';
  import { getRuleDocumentationUrl, getRuleSourceName } from '../lib/rules-registry.js';
  import RunModal from './RunModal.svelte';
  import Loader from './Loader.svelte';

  interface Props {
    target?: BazelTarget | null;
    showActions?: boolean;
    showNavigation?: boolean;
    compact?: boolean;
    onNavigateToFile?: (event: CustomEvent<{ path: string }>) => void;
    onNavigateToTarget?: (event: CustomEvent<{ target: string }>) => void;
  }

  let {
    target = null,
    showActions = true,
    showNavigation = false,
    compact = false,
    onNavigateToFile,
    onNavigateToTarget
  }: Props = $props();

  let fullTarget = $state<BazelTarget | null>(null);
  let targetDependencies = $state<BazelTarget[]>([]);
  let targetReverseDependencies = $state<BazelTarget[]>([]);
  let targetOutputs = $state<string[]>([]);
  let outputConsumers = $state<Map<string, BazelTarget[]>>(new Map());
  let loadingConsumers = $state<Set<string>>(false);
  let loading = $state(true);
  let showRunModal = $state(false);
  let error = $state<string | null>(null);

  $effect(() => {
    if (target) {
      loadTargetDetails(toFull(target));
    }
  });
  

  function niceName(target: BazelTarget): string {
    return target.label || toFull(target);
  }

  async function loadTargetDetails(targetName: string) {
    // Reset state
    targetDependencies = [];
    targetReverseDependencies = [];
    targetOutputs = [];
    outputConsumers = new Map();
 // Load direct dependencies
    loading = true;
      error = null;
    try {
      const [ ftarget, deps, rdeps, outputs ] = await Promise.all([
        api.getTarget({target: targetName}),
        api.getTargetDependencies({target: targetName, depth:1}),
        api.getReverseDependencies({target: targetName}),
        api.getTargetOutputs({target: targetName})
      ]);
      targetDependencies = deps.dependencies ?? [];
      targetReverseDependencies = rdeps.dependencies ?? [];
      targetOutputs = outputs.outputs;
      fullTarget = ftarget.target;
      loading = false;

      // Load consumers for each output in parallel
      if (targetOutputs.length > 0) {
        void loadOutputConsumers(targetOutputs);
      }
    } catch (err) {
      console.error('Failed to load dependencies:', err);
      error = err?.message;
    } finally {
      loading = false;
    }
  }

  async function loadOutputConsumers(outputs: string[]) {
    loadingConsumers = true;
    // Get the current target label to pass as the producing target
    const producingTarget = fullTarget ? toFull(fullTarget) : '';
    if (!producingTarget) {
      console.warn('Cannot load output consumers: no producing target');
      return;
    }
    // Load consumers for all outputs in parallel
    const outputConsumers = new Map( await outputs.map(async (output) => {

      try {
        const result = await api.getOutputConsumers({
          output,
          producingTarget
        });
        return [output, result.consumers ?? []];
      } catch (err) {
        console.error(`Failed to load consumers for ${output}:`, err);
      } finally {
        loadingConsumers = false;        
      }

    }));

  }




  function getBuildFilePath(target: BazelTarget): string | null {
    if (target.package) {
      const match = target.package.match(/^([^:]+)/);
      if (match) {
        return match[1].replace('//', '') + '/BUILD';
      }
    }

    return target.package+'/BUILD';
  }

  function navigateToBuildFile() {
    if (target) {
      onNavigateToFile?.(new CustomEvent('navigate-to-file', { detail: { path: toFull(target) } }));
    }
  }

  function runTarget() {
    showRunModal = true;
  }

  function navigateToTarget(dep: BazelTarget) {
    onNavigateToTarget?.(new CustomEvent('navigate-to-target', { detail: { target: toFull(dep) } }));
  }
</script>

{#if loading}
  <Loader/>
{:else if (target && !error)}
  <div class="space-y-4 {compact ? 'text-sm' : ''}">
    <div>
      <h4 class="text-sm font-medium text-muted-foreground mb-1">Name</h4>
      <div class="flex items-center gap-2">
        <p class="font-mono {compact ? 'text-sm' : ''}">{toFull(target)}</p>
        <CopyButton text={ '//'+toFull(target) } size="sm" />
        {#if isExecutableTarget(fullTarget || target) && showActions}
         <button
         onclick={runTarget}
          class="p-1 hover:bg-muted rounded transition-all"
        >
          {#if isTest(fullTarget || target)}
            <TestTube class="w-4 h-4  text-green-600 dark:text-green-400" />
          {:else}
            <Play class="w-4 h-4  text-green-600 dark:text-green-400" />
          {/if}
        </button>
        {/if}
      </div>
    </div>
    
    {#if target.kind}
      {@const ruleDoc = getRuleDocumentationUrl(target.kind)}
      <div>
        <h4 class="text-sm font-medium text-muted-foreground mb-1">Type</h4>
        <div class="flex items-center gap-2">
          {#if ruleDoc}
            <a
              href={ruleDoc.url}
              target="_blank"
              rel="noopener noreferrer"
              class="font-mono {compact ? 'text-sm' : ''} text-primary hover:underline flex items-center gap-1"
              title="View {target.kind} documentation"
            >
              {target.kind}
              <ExternalLink class="w-3 h-3" />
            </a>
            <span class="text-xs text-muted-foreground">
              ({getRuleSourceName(ruleDoc.source)})
            </span>
          {:else}
            <p class="font-mono {compact ? 'text-sm' : ''}">{target.kind}</p>
          {/if}
        </div>
        <p class="text-xs text-muted-foreground mt-1">
          Expected: {getExpectedOutputs(fullTarget?.ruleType ?? target.kind )}
        </p>
      </div>
    {/if}

    {#if targetOutputs?.length}
      <div class="border-l-4 border-primary pl-4">
        <h4 class="text-sm font-medium text-primary mb-2 flex items-center gap-2">
          <span class="font-semibold">Returns / Outputs</span>
           <span class="text-xs text-muted-foreground">({targetOutputs.length} files)</span>
        </h4>
        {#if targetOutputs.length > 0}
          <div class="space-y-3 max-h-96 overflow-y-auto bg-muted/30 p-2 rounded">
            {#each targetOutputs as output}
              <div class="space-y-1">
                <div class="flex items-center gap-2 text-sm">
                  <FileCode class="w-3 h-3 text-primary flex-shrink-0" />
                  <span class="font-mono text-sm truncate" title={output}>
                    {output}
                  </span>
                </div>

                {#if loadingConsumers}
                  <Loader message="Loading consumers..." size="sm" inline={true} class="text-xs text-muted-foreground italic" />
                {:else if outputConsumers.has(output)}
                  {@const consumers = outputConsumers.get(output) ?? []}
                  {#if consumers.length > 0}
                    <div class="ml-5 space-y-1">
                      <div class="text-xs text-muted-foreground mb-1">
                        Consumed by ({consumers.length}):
                      </div>
                      {#each consumers as consumer}
                        <button
                          onclick={() => navigateToTarget(consumer)}
                          class="w-full text-left font-mono text-xs text-muted-foreground hover:text-foreground hover:bg-muted p-1 rounded transition-colors flex items-center gap-2"
                        >
                          <ChevronRight class="w-3 h-3" />
                          {niceName(consumer)}
                        </button>
                      {/each}
                    </div>
                  {:else}
                    <div class="ml-5 text-xs text-muted-foreground italic">
                      No consumers
                    </div>
                  {/if}
                {/if}
              </div>
            {/each}
          </div>
        {:else}
          <p class="text-sm text-muted-foreground">No outputs detected</p>
        {/if}
      </div>
    {/if}
    
    {#if target.location}
      <div>
        <h4 class="text-sm font-medium text-muted-foreground mb-1">Location</h4>
        <div class="flex items-center gap-2">
          <p class="font-mono {compact ? 'text-sm' : ''}">{target.location}</p>
          {#if getBuildFilePath(target) && showNavigation}
            <button
             onclick={navigateToBuildFile}
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


    <div class="border-l-4 border-purple-500 pl-4">
      {#if fullTarget?.attributes?.length}
        <AttributesDisplay
          attributes={fullTarget.attributes}
          collapsible={false}
          initiallyExpanded={true}
        />
      {:else}
        <div class="text-sm text-muted-foreground">No attributes found</div>
      {/if}
    </div>
    
    <div class="border-l-4 border-blue-500 pl-4">
      <h4 class="text-sm font-medium text-blue-600 mb-1">
        Direct Dependencies ({targetDependencies.length})
      </h4>
      {#if targetDependencies?.length}
        <div class="space-y-1 max-h-40 overflow-y-auto bg-muted/30 p-2 rounded">
          {#each targetDependencies as dep}
            <button
             onclick={() => navigateToTarget(dep)}
              class="w-full text-left font-mono text-sm text-muted-foreground hover:text-foreground hover:bg-muted p-1 rounded transition-colors flex items-center gap-2"
            >
              <ChevronRight class="w-3 h-3" />
              {niceName(dep)}
            </button>
          {/each}
        </div>
      {:else}
        <div class="text-sm text-muted-foreground">No dependencies</div>
      {/if}
    </div>

    <div class="border-l-4 border-green-500 pl-4">
      <h4 class="text-sm font-medium text-green-600 mb-1">
        Reverse Dependencies (Used By) ({targetReverseDependencies.length})
      </h4>
      {#if targetReverseDependencies?.length}
        <div class="space-y-1 max-h-40 overflow-y-auto bg-muted/30 p-2 rounded">
          {#each targetReverseDependencies as rdep}
            <button
             onclick={() => navigateToTarget(rdep)}
              class="w-full text-left font-mono text-sm text-muted-foreground hover:text-foreground hover:bg-muted p-1 rounded transition-colors flex items-center gap-2"
            >
              <ChevronRight class="w-3 h-3" />
              {niceName(rdep)}
            </button>
          {/each}
        </div>
      {:else}
        <div class="text-sm text-muted-foreground">No reverse dependencies</div>
      {/if}
    </div>
  </div>
{:else if error}
  <div class="text-destructive">Error: {error}</div>
{:else}
  <p class="text-muted-foreground">Select a target to view details</p>
{/if}
<RunModal {target} bind:open={showRunModal} />

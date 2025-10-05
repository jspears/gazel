<script lang="ts">
  import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-svelte';
  import type { BazelAttribute } from 'proto/gazel_pb.js';

  export let attributes: BazelAttribute[] = [];
  export let collapsible = true;
  export let initiallyExpanded = false;

  let expanded = initiallyExpanded;
  let copiedKey: string | null = null;
  let hideEmpty = true;

  // Filter out empty attributes if hideEmpty is true
  $: filteredAttributes = hideEmpty
    ? attributes.filter((attr) => {
        // Check if attribute has any value
        const hasValue = attr.stringValue ||
                        (attr.stringListValue && attr.stringListValue.length > 0) ||
                        attr.intValue !== undefined ||
                        attr.booleanValue !== undefined ||
                        (attr.stringDictValue && attr.stringDictValue.length > 0);

        if (!hasValue) return false;

        // Hide internal false flags
        if (attr.booleanValue === false && (attr.name.startsWith('$') || attr.name.startsWith(':'))) {
          return false;
        }

        return true;
      })
    : attributes;

  $: sortedAttributes = filteredAttributes.sort((a, b) => {
    // Sort by: explicitly specified first, then alphabetically
    const aInternal = a.name.startsWith('$') || a.name.startsWith(':');
    const bInternal = b.name.startsWith('$') || b.name.startsWith(':');

    if (aInternal && !bInternal) return 1;
    if (!aInternal && bInternal) return -1;
    return a.name.localeCompare(b.name);
  });
  
  function formatAttribute(attr: BazelAttribute): { formatted: string; type: 'string' | 'boolean' | 'number' | 'array' | 'object' | 'label' | 'dict' } {
    // Handle string list values (like deps, srcs, tags)
    if (attr.stringListValue && attr.stringListValue.length > 0) {
      const isLabels = attr.stringListValue.every(item =>
        item.startsWith('//') || item.startsWith('@')
      );
      if (isLabels) {
        return { formatted: attr.stringListValue.join('\n'), type: 'label' };
      }
      return { formatted: JSON.stringify(attr.stringListValue, null, 2), type: 'array' };
    }

    // Handle string dict values
    if (attr.stringDictValue && attr.stringDictValue.length > 0) {
      const dictObj = attr.stringDictValue.reduce((acc, entry) => {
        acc[entry.key] = entry.value;
        return acc;
      }, {} as Record<string, string>);
      return { formatted: JSON.stringify(dictObj, null, 2), type: 'dict' };
    }

    // Handle boolean values
    if (attr.booleanValue !== undefined) {
      return { formatted: String(attr.booleanValue), type: 'boolean' };
    }

    // Handle integer values
    if (attr.intValue !== undefined && attr.intValue !== null) {
      return { formatted: String(attr.intValue), type: 'number' };
    }

    // Handle string values
    if (attr.stringValue) {
      // Check if it's a label
      if (attr.stringValue.startsWith('//') || attr.stringValue.startsWith('@')) {
        return { formatted: attr.stringValue, type: 'label' };
      }
      return { formatted: attr.stringValue, type: 'string' };
    }

    return { formatted: '', type: 'string' };
  }
  
  function getAttributeDisplayName(attr: BazelAttribute): string {
    // Remove leading $ or : for internal attributes
    if (attr.name.startsWith('$') || attr.name.startsWith(':')) {
      return attr.name.substring(1);
    }
    return attr.name;
  }

  function isInternalAttribute(attr: BazelAttribute): boolean {
    return attr.name.startsWith('$') || attr.name.startsWith(':');
  }

  function getAttributeValue(attr: BazelAttribute): string {
    if (attr.stringValue) return attr.stringValue;
    if (attr.stringListValue) return JSON.stringify(attr.stringListValue);
    if (attr.booleanValue !== undefined) return String(attr.booleanValue);
    if (attr.intValue !== undefined) return String(attr.intValue);
    if (attr.stringDictValue) return JSON.stringify(attr.stringDictValue);
    return '';
  }

  async function copyValue(attr: BazelAttribute) {
    try {
      const value = getAttributeValue(attr);
      await navigator.clipboard.writeText(value);
      copiedKey = attr.name;
      setTimeout(() => {
        copiedKey = null;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }
  
  function toggleExpanded() {
    if (collapsible) {
      expanded = !expanded;
    }
  }
</script>

<div class="attributes-display">
  {#if collapsible}
    <div class="flex items-center justify-between mb-2">
      <button
        onclick={toggleExpanded}
        class="flex items-center gap-2 p-2 hover:bg-muted rounded-md transition-colors flex-1"
      >
        <div class="flex items-center gap-2">
          <h4 class="text-sm font-medium text-muted-foreground">
            Attributes
          </h4>
          <span class="text-xs text-muted-foreground">
            ({sortedAttributes.length} {#if hideEmpty && filteredAttributes.length < attributes.length}of {attributes.length}{/if})
          </span>
        </div>
        {#if expanded}
          <ChevronDown class="w-4 h-4 text-muted-foreground" />
        {:else}
          <ChevronRight class="w-4 h-4 text-muted-foreground" />
        {/if}
      </button>
      <button
        onclick={() => hideEmpty = !hideEmpty}
        class="p-2 hover:bg-muted rounded-md transition-colors"
        title={hideEmpty ? 'Show all attributes' : 'Hide empty attributes'}
      >
        <span class="text-xs font-medium" class:text-primary={hideEmpty} class:text-muted-foreground={!hideEmpty}>
          {hideEmpty ? 'Hide Empty' : 'Show All'}
        </span>
      </button>
    </div>
  {:else}
    <div class="flex items-center justify-between mb-2">
      <div class="flex items-center gap-2">
        <h4 class="text-sm font-medium text-muted-foreground">
          Attributes
        </h4>
        <span class="text-xs text-muted-foreground">
          ({sortedAttributes.length}{#if hideEmpty && filteredAttributes.length < attributes.length} of {attributes.length}{/if})
        </span>
      </div>
      <button
        onclick={() => hideEmpty = !hideEmpty}
        class="p-2 hover:bg-muted rounded-md transition-colors"
        title={hideEmpty ? 'Show all attributes' : 'Hide empty attributes'}
      >
        <span class="text-xs font-medium" class:text-primary={hideEmpty} class:text-muted-foreground={!hideEmpty}>
          {hideEmpty ? 'Hide Empty' : 'Show All'}
        </span>
      </button>
    </div>
  {/if}
  
  {#if expanded || !collapsible}
    {#if sortedAttributes.length === 0}
      <p class="text-sm text-muted-foreground italic">No attributes to display</p>
    {:else}
      <div class="space-y-3 max-h-96 overflow-y-auto">
        {#each sortedAttributes as attr}
          {@const { formatted, type } = formatAttribute(attr)}
          <div
            class="attribute-item p-2 rounded-md border transition-colors"
            class:bg-muted={isInternalAttribute(attr)}
          >
            <div class="flex items-start justify-between gap-2 mb-1">
              <div class="flex items-center gap-2 min-w-0 flex-1">
                <span
                  class="font-mono text-xs font-medium"
                  class:text-muted-foreground={isInternalAttribute(attr)}
                  class:text-foreground={!isInternalAttribute(attr)}
                >
                  {getAttributeDisplayName(attr)}
                </span>
                {#if isInternalAttribute(attr)}
                  <span class="text-xs px-1 py-0.5 bg-muted text-muted-foreground rounded">
                    internal
                  </span>
                {/if}
                {#if !attr.explicitlySpecified}
                  <span class="text-xs px-1 py-0.5 bg-blue-500/10 text-blue-600 rounded">
                    default
                  </span>
                {/if}
                <span class="text-xs px-1 py-0.5 bg-purple-500/10 text-purple-600 rounded font-mono">
                  {attr.type}
                </span>
              </div>
              <button
                onclick={() => copyValue(attr)}
                class="p-1 hover:bg-muted rounded transition-colors flex-shrink-0"
                title="Copy value"
              >
                {#if copiedKey === attr.name}
                  <Check class="w-3 h-3 text-green-600" />
                {:else}
                  <Copy class="w-3 h-3 text-muted-foreground" />
                {/if}
              </button>
            </div>

            <div class="attribute-value">
              {#if type === 'label'}
                <div class="space-y-0.5">
                  {#each formatted.split('\n') as label}
                    <div class="font-mono text-xs px-2 py-1 bg-primary/10 text-primary rounded inline-block">
                      {label}
                    </div>
                  {/each}
                </div>
              {:else if type === 'boolean'}
                <span
                  class="font-mono text-xs px-2 py-1 rounded inline-block"
                  class:bg-green-500={formatted === 'true'}
                  class:text-green-700={formatted === 'true'}
                  class:dark:text-green-400={formatted === 'true'}
                  class:bg-gray-500={formatted === 'false'}
                  class:text-gray-900={formatted === 'false'}
                  class:dark:text-red-400={formatted === 'false'}
                >
                  {formatted}
                </span>
              {:else if type === 'number'}
                <span class="font-mono text-xs px-2 py-1 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded inline-block">
                  {formatted}
                </span>
              {:else if type === 'array' || type === 'object' || type === 'dict'}
                <pre class="font-mono text-xs bg-muted/50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-all">{formatted}</pre>
              {:else}
                <span class="font-mono text-xs text-foreground break-all">
                  {formatted}
                </span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .attribute-item {
    transition: all 0.2s ease;
  }
  
  .attribute-item:hover {
    border-color: hsl(var(--primary) / 0.3);
  }
  
  .attribute-value {
    word-break: break-word;
  }
</style>


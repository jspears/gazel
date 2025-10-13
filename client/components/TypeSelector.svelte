<script lang="ts">
  import { Select } from 'bits-ui';
  import { ChevronDown, Check, Search } from 'lucide-svelte';
  import { createEventDispatcher } from 'svelte';
  import { fly } from 'svelte/transition';
  import {stopPropagation} from './util.js';
  
  export let value: string = '';
  export let types: string[] = [];
  export let placeholder: string = 'All types';

  const dispatch = createEventDispatcher();

  let open = false;
  let searchValue = '';
  let searchInput: HTMLInputElement;

  // Filter types based on search
  $: filteredTypes = searchValue
    ? types.filter(type =>
        type.toLowerCase().includes(searchValue.toLowerCase())
      )
    : types;

  // Handle selection change
  function handleValueChange(selected: { value: string; label?: string } | undefined) {
    value = selected?.value || '';
    dispatch('change', value);
    searchValue = ''; // Reset search when selection is made
  }

  // Get display label for selected value
  $: displayLabel = value || placeholder;

  // Focus search input when dropdown opens
  function handleOpenChange(isOpen: boolean) {
    open = isOpen;
    if (isOpen && searchInput) {
      setTimeout(() => searchInput?.focus(), 50);
    }
  }
</script>

<Select.Root
  bind:open
  selected={{ value, label: value || '' }}
  onSelectedChange={(selected) => handleValueChange(selected)}
  onOpenChange={handleOpenChange}
>
  <Select.Trigger class="flex items-center justify-between px-4 py-2 border rounded-md bg-background hover:bg-muted/50 transition-colors min-w-[200px]">
    <Select.Value placeholder={placeholder}>
      <span class="text-sm">{displayLabel}</span>
    </Select.Value>
    <ChevronDown class="w-4 h-4 text-muted-foreground transition-transform {open ? 'rotate-180' : ''}" />
  </Select.Trigger>

  <Select.Content
    class="w-[var(--bits-select-trigger-width)] max-h-[300px] overflow-hidden rounded-md border bg-background shadow-lg z-50"
    sideOffset={4}
    transition={fly}
    transitionConfig={{ duration: 150, y: -5 }}
  >
    <div class="flex items-center gap-2 p-2 border-b sticky top-0 bg-background">
      <input
        bind:this={searchInput}
        bind:value={searchValue}
        class="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        placeholder="Search types..."
        aria-label="Search types"
       onclick={stopPropagation()}
       onkeydown={stopPropagation()}
      />
    </div>

    <div class="max-h-[250px] overflow-y-auto p-1">
      {#if value}
        <Select.Item
          value=""
          label={placeholder}
          class="flex items-center justify-between px-3 py-2 text-sm rounded cursor-pointer hover:bg-muted data-[highlighted]:bg-muted outline-none"
        >
          <span class="text-muted-foreground">{placeholder}</span>
          <Select.ItemIndicator>
            <Check class="w-4 h-4 text-primary" />
          </Select.ItemIndicator>
        </Select.Item>
      {/if}

      {#each filteredTypes as type}
        <Select.Item
          value={type}
          label={type}
          class="flex items-center justify-between px-3 py-2 text-sm rounded cursor-pointer hover:bg-muted data-[highlighted]:bg-muted outline-none"
        >
          <span>{type}</span>
          <Select.ItemIndicator>
            <Check class="w-4 h-4 text-primary" />
          </Select.ItemIndicator>
        </Select.Item>
      {:else}
        {#if searchValue}
          <div class="px-3 py-2 text-sm text-muted-foreground">
            No types found
          </div>
        {/if}
      {/each}
    </div>
  </Select.Content>
</Select.Root>

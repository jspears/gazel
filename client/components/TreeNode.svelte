<script lang="ts" module>
  import type { BazelTarget } from '@speajus/gazel-proto';

  export interface TreeNodeData<T> {
    name: string;
    fullPath: string;
    children: Map<string, TreeNodeData<T>>;
    node: T;
    isExpanded: boolean;
    level: number;
  }
</script>

<script lang="ts" generics="T">
  import { ChevronRight, ChevronDown, Folder, FolderOpen } from 'lucide-svelte';
  import { slide } from 'svelte/transition';
  import type { Snippet } from 'svelte';
  import TreeNode from './TreeNode.svelte';

  interface Props {
    node: TreeNodeData<T>;
    selectedTarget?: T | null;
    onSelectTarget?: (event: CustomEvent) => void;
    onNavigateToGraph?: (event: CustomEvent) => void;
    onNavigateToCommands?: (event: CustomEvent) => void;
    leafItem?: Snippet<[TreeNodeData<T>]>;
    children?: Snippet;
    isExpanded?: boolean;
  }

  let {
    node = $bindable(),
    selectedTarget = null,
    onSelectTarget,
    onNavigateToGraph,
    onNavigateToCommands,
    leafItem,
    children: childrenSnippetm,
    expanded = false,
  }: Props = $props();

  function toggleExpand() {
     node.isExpanded = isExpanded = !isExpanded;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpand();
    } else if (e.key === 'ArrowRight' && !node.isExpanded) {
      e.preventDefault();
      toggleExpand();
    } else if (e.key === 'ArrowLeft' && node.isExpanded) {
      e.preventDefault();
      toggleExpand();
    }
  }

  function handleSelectTarget(event: CustomEvent) {
    onSelectTarget?.(event);
  }

  function handleNavigateToGraph(event: CustomEvent) {
    onNavigateToGraph?.(event);
  }

  function handleNavigateToCommands(event: CustomEvent) {
    onNavigateToCommands?.(event);
  }

  // // Cache the target count calculation
  // function countAllTargets(n: TreeNodeData): number {
  //   let count = n.targets.length;
  //   for (const child of n.children.values()) {
  //     count += countAllTargets(child);
  //   }
  //   return count;
  // }

  let hasChildren = $derived(node.children.size > 0);
  let childNodes = $state(Array.from(node.children.values()));
  let isExpanded = $state(expanded || node.isExpanded);
</script>

  <!-- Directory node -->
  <button
    onclick={toggleExpand}
    onkeydown={handleKeydown}
    class="folder-node"
    aria-expanded={isExpanded}
    aria-label="{isExpanded ? 'Collapse' : 'Expand'} folder {node.name}"
  >
    <div class="folder-content">
      <div class="folder-icon-wrapper">
        {#if node.isExpanded}
          <ChevronDown class="chevron-icon" />
        {:else}
          <ChevronRight class="chevron-icon" />
        {/if}
      </div>

      {#if node.isExpanded}
        <FolderOpen class="folder-icon open" />
      {:else}
        <Folder class="folder-icon" />
      {/if}

      <span class="folder-name">{node.name}</span>
    </div>
  </button>

  {#if isExpanded}
    <div class="folder-children" transition:slide={{ duration: 200 }}>
      <!-- Recursively render children -->
      {#each childNodes as childNode, index}
        <TreeNode
          bind:node={childNodes[index]}
          {selectedTarget}
          {onSelectTarget}
          {onNavigateToGraph}
          {onNavigateToCommands}
          {leafItem}
        >
            {@render childrenSnippet?.()}
        </TreeNode>
      {/each}
      {@render leafItem?.(node)}
    </div>
  {/if}

<style>
  .folder-node {
    display: flex;
    align-items: center;
    width: 100%;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    padding-right: 1rem;
    border-bottom: 1px solid hsl(var(--border));
    background: none;
    border-left: none;
    border-right: none;
    border-top: none;
    cursor: pointer;
    transition: background-color 0.15s ease;
    text-align: left;
  }

  .folder-node:hover {
    background-color: hsl(var(--muted));
  }

  .folder-node:focus-visible {
    outline: 2px solid hsl(var(--ring));
    outline-offset: -2px;
  }

  .folder-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .folder-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1rem;
    height: 1rem;
  }

  .folder-name {
    font-weight: 500;
    font-size: 0.875rem;
    color: hsl(var(--foreground));
  }

  .folder-count {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    font-weight: normal;
  }

  .folder-children {
    overflow: hidden;
    padding-left: 1rem;
  }
</style>

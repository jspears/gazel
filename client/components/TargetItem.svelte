<script lang="ts">
  import { Target, GitBranch, Terminal, ChevronRight } from 'lucide-svelte';
  import type { BazelTarget } from 'proto/gazel_pb';
  import CopyButton from './CopyButton.svelte';

  interface Props {
    target: BazelTarget;
    selected?: boolean;
    level?: number;
    onSelectTarget?: (event: CustomEvent) => void;
    onNavigateToGraph?: (event: CustomEvent) => void;
    onNavigateToCommands?: (event: CustomEvent) => void;
  }

  let {
    target,
    selected = false,
    level = 0,
    onSelectTarget,
    onNavigateToGraph,
    onNavigateToCommands
  }: Props = $props();

  function handleClick() {
    onSelectTarget?.(new CustomEvent('select', { detail: { target } }));
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  }

  function navigateToGraph(e: Event) {
    e.stopPropagation();
    onNavigateToGraph?.(new CustomEvent('navigate-to-graph', { detail: { target } }));
  }

  function navigateToCommands(e: Event) {
    e.stopPropagation();
    onNavigateToCommands?.(new CustomEvent('navigate-to-commands', { detail: { target } }));
  }

  let indentation = $derived(`${level * 1.5}rem`);
</script>

<div
  role="button"
  tabindex={0}
  onclick={handleClick}
  onkeydown={handleKeydown}
  data-target={target.label || target.name}
  class="target-item group"
  class:selected
  style="padding-left: {indentation}"
>
  <div class="target-content">
    <Target class="target-icon" />
    <div class="target-info">
      <span class="target-name">{target.name}</span>
      {#if target.kind}
        <span class="target-kind">{target.kind}</span>
      {/if}
    </div>
  </div>
  
  <div class="target-actions">
    <button
      onclick={navigateToGraph}
      class="action-btn"
      title="View in dependency graph"
      aria-label="View {target.name} in dependency graph"
    >
      <GitBranch class="w-4 h-4" />
    </button>
    <button
      onclick={navigateToCommands}
      class="action-btn"
      title="Open in Commands tab"
      aria-label="Open {target.name} in Commands tab"
    >
      <Terminal class="w-4 h-4" />
    </button>
    <CopyButton 
      text={target.label || target.name || ''} 
      size="sm" 
      className="action-btn-copy"
    />
    <ChevronRight class="chevron-icon" />
  </div>
</div>

<style>
  .target-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding-top: 0.5rem;
    padding-bottom: 0.5rem;
    padding-right: 1rem;
    border-bottom: 1px solid hsl(var(--border));
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .target-item:hover {
    background-color: hsl(var(--muted));
  }

  .target-item.selected {
    background-color: hsl(var(--muted));
  }

  .target-item:last-child {
    border-bottom: none;
  }

  .target-content {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .target-icon {
    width: 1rem;
    height: 1rem;
    color: hsl(var(--muted-foreground));
    flex-shrink: 0;
  }

  .target-info {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .target-name {
    font-family: ui-monospace, monospace;
    font-size: 0.875rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .target-kind {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    margin-top: 0.125rem;
  }

  .target-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .action-btn,
  :global(.action-btn-copy) {
    padding: 0.25rem;
    border-radius: 0.25rem;
    opacity: 0;
    transition: opacity 0.15s ease, background-color 0.15s ease;
  }

  .group:hover .action-btn,
  .group:hover :global(.action-btn-copy) {
    opacity: 1;
  }

  .action-btn:hover {
    background-color: hsl(var(--muted));
  }

  .action-btn :global(svg) {
    color: hsl(var(--muted-foreground));
  }

  .action-btn:hover :global(svg) {
    color: hsl(var(--primary));
  }

  .chevron-icon {
    width: 1rem;
    height: 1rem;
    color: hsl(var(--muted-foreground));
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .group:hover .chevron-icon {
    opacity: 1;
  }
</style>


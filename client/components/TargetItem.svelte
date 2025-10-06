<script lang="ts">
  import type { BazelTarget } from 'proto/gazel_pb.js';
  import { Target } from 'lucide-svelte';
  import TargetActions from './TargetActions.svelte';

  interface Props {
    target: BazelTarget;
    selected?: boolean;
    onSelectTarget?: (event: CustomEvent) => void;
  }

  let {
    target,
    selected = false,
    onSelectTarget
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

</script>

<div
  role="button"
  tabindex={0}
  onclick={handleClick}
  onkeydown={handleKeydown}
  data-target={target.label || target.name}
  class="target-item group"
  class:selected
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
    <TargetActions  {target}    />
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
    padding-left: 1rem;
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
</style>


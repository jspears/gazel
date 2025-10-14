<script lang="ts">
  import type { BazelTarget } from '@speajus/gazel-proto';
  import { Target, ExternalLink } from 'lucide-svelte';
  import TargetActions from './TargetActions.svelte';
  import { getRuleDocumentationUrl } from '../lib/rules-registry.js';
  import { toFull } from './target-util.js';

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

  function handleKindClick(e: MouseEvent) {
    // Prevent the target item from being selected when clicking the kind link
    e.stopPropagation();
  }

  let ruleDoc = $derived(target.kind ? getRuleDocumentationUrl(target.kind) : null);
</script>

<div
  role="button"
  tabindex={0}
  onclick={handleClick}
  onkeydown={handleKeydown}
  data-target={toFull(target)}
  class="target-item group"
  class:selected
>
  <div class="target-content">
    <Target class="w-4 h-4 text-muted-foreground flex-shrink-0" />
    <div class="target-info">
      <span class="target-name">{target.name}</span>
      {#if target.kind}
        {#if ruleDoc}
          <a
            href={ruleDoc.url}
            target="_blank"
            rel="noopener noreferrer"
            onclick={handleKindClick}
            class="target-kind-link"
            title="View {target.kind} documentation"
          >
            {target.kind}
            <ExternalLink class="w-2.5 h-2.5 inline ml-0.5" />
          </a>
        {:else}
          <span class="target-kind">{target.kind}</span>
        {/if}
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

  .target-kind-link {
    font-size: 0.75rem;
    color: hsl(var(--primary));
    margin-top: 0.125rem;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    transition: text-decoration 0.15s ease;
  }

  .target-kind-link:hover {
    text-decoration: underline;
  }

  .target-actions {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
</style>


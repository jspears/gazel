<script lang="ts">
  import { GitBranch, Terminal } from 'lucide-svelte';
  import CopyButton from './CopyButton.svelte';
  import { navigateToTab } from '../lib/navigation.js';
  import type { BazelTarget } from '@speajus/gazel-proto';
  import { toFull } from './target-util.js';
  import type { Snippet } from 'svelte';
  import {stopPropagation} from './util.js';
  
  type Props = { target: BazelTarget, children?:Snippet };

  let {
    target,
    children,
  }:Props = $props();

  let fullTarget = $derived(toFull(target));

  function navigateToGraph() {
    navigateToTab('graph', {target: fullTarget});
  }

  function navigateToCommands() {
    navigateToTab('commands', {target: fullTarget});
  }
</script>

<div class="flex items-center gap-1">
  <button
    onclick={stopPropagation(navigateToGraph)}
    class="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
    title="View in dependency graph"
  >
    <GitBranch class="w-4 h-4 text-muted-foreground hover:text-primary" />
  </button>
  <button
    onclick={stopPropagation(navigateToCommands)}
    class="p-1 hover:bg-muted rounded opacity-0 group-hover:opacity-100 transition-opacity"
    title="Open in Commands tab"
  >
    <Terminal class="w-4 h-4 text-muted-foreground hover:text-primary" />
  </button>
  <CopyButton text={fullTarget} size="sm" className="opacity-0 group-hover:opacity-100" />
  {@render children?.()}
</div>


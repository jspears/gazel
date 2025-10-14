<script lang="ts">
  import type { BazelTarget } from '@speajus/gazel-proto';
  import TreeNode, { type TreeNodeData } from './TreeNode.svelte';
  import TargetItem from './TargetItem.svelte';

  interface Props {
    targets: BazelTarget[];
    selectedTarget?: BazelTarget | null;
    displayLimit?: number;
    onSelectTarget?: (event: CustomEvent) => void;
    onNavigateToGraph?: (event: CustomEvent) => void;
    onNavigateToCommands?: (event: CustomEvent) => void;
  }

  let {
    targets,
    selectedTarget = null,
    displayLimit = 100,
    onSelectTarget,
    onNavigateToGraph,
    onNavigateToCommands
  }: Props = $props();

  function handleSelectTarget(event: CustomEvent) {
    onSelectTarget?.(event);
  }

  function handleNavigateToGraph(event: CustomEvent) {
    onNavigateToGraph?.(event);
  }

  function handleNavigateToCommands(event: CustomEvent) {
    onNavigateToCommands?.(event);
  }

  function buildTree(targetList: BazelTarget[]): TreeNodeData {
    const root: TreeNodeData = {
      name: '',
      fullPath: '',
      children: new Map(),
      targets: [],
      isExpanded: true,
      level: 0
    };

    for (const target of targetList) {
      let currentNode = root;
      let fullPath = '';
      const parts = target.package.replace(/^\/\//, '').split('/').filter(Boolean);
      // Build the tree structure for the package path
      for (let i = 0; i < parts.length; i++) {
        const name = parts[i];
        fullPath = fullPath ? `${fullPath}/${name}` : name;

        let existingNode = currentNode.children.get(name);
        if (!existingNode) {
          existingNode = {
            name,
            fullPath,
            children: new Map(),
            targets: [],
            isExpanded: false,
            level: currentNode.level + 1
          };
          currentNode.children.set(name, existingNode);
        } 
        currentNode = existingNode;
      }

      // Add the target to the leaf node
      currentNode.targets.push(target);
    }

    return root;
  }

  let treeRoot = $state(buildTree(targets));
</script>

<div class="max-h-[600px] overflow-y-auto">
  {#if treeRoot.children.size === 0 && treeRoot.targets.length === 0}
    <div class="p-4 text-center text-sm text-muted-foreground">
      No targets found
    </div>
  {:else}
    <TreeNode
      bind:node={treeRoot}
      {selectedTarget}
      {onSelectTarget}
      {onNavigateToGraph}
      {onNavigateToCommands}
    >
      {#snippet leafItem(node: TreeNodeData)}
        {#each node.targets as target}
          <TargetItem
            {target}
            selected={selectedTarget === target}
            level={node.level}
            {onSelectTarget}
            {onNavigateToGraph}
            {onNavigateToCommands}
          />
        {/each}
      {/snippet}
    </TreeNode>
  {/if}
</div>

<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import type { NodeProps } from '@xyflow/svelte';
  
  type $$Props = NodeProps;
  
  export let data: any;
  export let targetPosition: Position = Position.Top;
  export let sourcePosition: Position = Position.Bottom;
  
  $: Icon = data?.icon;
  $: color = data?.color || '#6b7280';
  $: label = data?.label || '';
  $: type = data?.type || '';
  $: fullName = data?.fullName || '';
  $: location = data?.location || '';
</script>

<div 
  class="custom-node"
  style="background-color: {color}; border-color: {color};"
  title="{fullName}{location ? '\n' + location : ''}"
>
  <Handle type="target" position={targetPosition} />
  
  <div class="node-content">
    {#if Icon}
      <div class="node-icon">
        <svelte:component this={Icon} size={16} />
      </div>
    {/if}
    
    <div class="node-label">
      {label}
    </div>
    
    {#if type}
      <div class="node-type">
        {type}
      </div>
    {/if}
  </div>
  
  <Handle type="source" position={sourcePosition} />
</div>

<style>
  .custom-node {
    /* background color is set via inline style */
    border: 2px solid;
    border-radius: 8px;
    padding: 8px 12px;
    min-width: 120px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    transition: all 0.2s;
  }
  
  .custom-node:hover {
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    transform: translateY(-1px);
  }
  
  .node-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  
  .node-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 50%;
    width: 24px;
    height: 24px;
  }
  
  .node-label {
    font-size: 12px;
    font-weight: 600;
    color: white;
    text-align: center;
    word-break: break-word;
    max-width: 150px;
  }
  
  .node-type {
    font-size: 10px;
    color: rgba(255, 255, 255, 0.8);
    text-align: center;
  }
  
  :global(.svelte-flow__handle) {
    background: white;
    border: 2px solid currentColor;
    width: 8px;
    height: 8px;
  }
  
  :global(.svelte-flow__handle.connecting) {
    background: #ff6b6b;
  }
</style>

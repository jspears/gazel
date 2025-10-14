<script lang="ts">
  import { Clipboard, Check } from 'lucide-svelte';
  import {stopPropagation} from './util.js';
  
  export let text: string;
  export let size: 'sm' | 'md' | 'lg' = 'sm';
  export let className = '';
  
  let copied = false;
  let timeout: NodeJS.Timeout;
  
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };
  
  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      
      // Clear any existing timeout
      if (timeout) {
        clearTimeout(timeout);
      }
      
      // Reset after 2 seconds
      timeout = setTimeout(() => {
        copied = false;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  }
  
  // Cleanup on destroy
  import { onDestroy } from 'svelte';
  onDestroy(() => {
    if (timeout) {
      clearTimeout(timeout);
    }
  });
</script>

<button
 onclick={stopPropagation(copyToClipboard)}
  class="p-1 hover:bg-muted rounded transition-all {className}"
  title={copied ? 'Copied!' : 'Copy to clipboard'}
  type="button"
>
  {#if copied}
    <Check class="{sizeClasses[size]} text-green-600 dark:text-green-400" />
  {:else}
    <Clipboard class="{sizeClasses[size]} text-muted-foreground hover:text-foreground" />
  {/if}
</button>

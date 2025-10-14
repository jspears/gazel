<script lang="ts">
    import { LoaderCircle } from 'lucide-svelte';
    type Props = {
        message?: string;
        size?: 'sm' | 'md' | 'lg';
        class?: string;
        inline?: boolean;
    }
    let {
        message = 'Loading...',
        size = 'md',
        class:className = '',
        inline = false
    }: Props = $props();
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-6 h-6',
        lg: 'w-8 h-8'
    };
</script>

<div class="flex items-center gap-2 {className} {inline ? 'inline-flex' : ''}">
    <LoaderCircle class="w-4 h-4 inline-block animate-spin {sizeClasses[size]}" />
    {#if message}<span class="text-sm">{message}</span>{/if}
</div>

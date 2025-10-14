<script lang="ts">
  import { X, RotateCw } from 'lucide-svelte';
  import { api } from '../client.js';
  import type { StreamRunResponse } from '@speajus/gazel-proto';
  import { toFull } from './target-util.js';

  interface Props {
    target: string | null;
    open?: boolean;
  }

  let {
    target = $bindable(null),
    open = $bindable(false)
  }: Props = $props();

  let runOutput = $state<string[]>([]);
  let runCommand = $state('');
  let runStatus = $state<'idle' | 'running' | 'success' | 'error'>('idle');
  let outputContainer = $state<HTMLDivElement>();

  // Watch for target changes and run when modal opens
  $effect(() => {
    if (open && target) {
      runTarget(toFull(target));
    }
  });

  async function runTarget(targetPath: string) {
    if (!targetPath) return;

    runCommand = `bazel run ${targetPath}`;
    runOutput = [];
    runStatus = 'running';

    try {
      // Use EventSource for streaming
      for await (const message of api.streamRun({ target: targetPath })) {
        const data = message.event;
        if (data.case === 'output') {
          runOutput = [...runOutput, data.value];
          // Auto-scroll to bottom
          if (outputContainer) {
            setTimeout(() => {
              outputContainer.scrollTop = outputContainer.scrollHeight;
            }, 0);
          }
        } else if (data.case === 'progress') {
          runOutput = [...runOutput, `ℹ️ ${data.value.currentAction}\n`];
          // Auto-scroll for info messages too
          if (outputContainer) {
            setTimeout(() => {
              outputContainer.scrollTop = outputContainer.scrollHeight;
            }, 0);
          }
        } else if (data.case === 'complete') {
          if (data.value.exitCode === 0) {
            runStatus = 'success';
            const duration = data.value.durationMs ? ` in ${data.value.durationMs}ms` : '';
            runOutput = [...runOutput, `\n✅ Command completed successfully${duration}`];
          } else if (data.value.exitCode === null) {
            // Process was killed or terminated abnormally
            runStatus = 'error';
            runOutput = [...runOutput, '\n⚠️ Command was terminated'];
          } else {
            runStatus = 'error';
            runOutput = [...runOutput, `\n❌ Command failed with exit code ${data.value.exitCode}`];
          }
        } else if (data.case === 'error') {
          // Handle stream errors
          runStatus = 'error';
          runOutput = [...runOutput, `\n❌ Error: ${data.value}`];
        }
      }
    } catch (error) {
      runStatus = 'error';
      runOutput = [...runOutput, `\n❌ Error: ${error}`];
    }
  }

  function closeModal() {
    // If still running, add a message that we're stopping
    if (runStatus === 'running') {
      runOutput = [...runOutput, '\n⚠️ Stopping command...'];
    }
    open = false;
    runStatus = 'idle';
    runOutput = [];
    runCommand = '';
  }

  function runAgain() {
    if (target) {
      runTarget(toFull(target));
    }
  }
</script>

<!-- Run Modal -->
{#if open}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-background border rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
      <!-- Modal Header -->
      <div class="p-4 border-b flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">Running Target</h2>
          <p class="text-sm text-muted-foreground font-mono mt-1">{runCommand}</p>
        </div>
        <button
          onclick={closeModal}
          class="p-2 hover:bg-muted rounded-md transition-colors"
          title="Close"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Modal Body - Output Log -->
      <div bind:this={outputContainer} class="flex-1 overflow-y-auto p-4 bg-muted/20 run-modal__output">
        {#each runOutput as line}
        <pre class="font-mono text-sm whitespace-pre-wrap">{line}</pre>
        {/each}
        {#if runStatus === 'running'}
          <div class="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
            <span>Running...</span>
          </div>
        {/if}
      </div>

      <!-- Modal Footer -->
      <div class="p-4 border-t flex items-center justify-between">
        <div class="flex items-center gap-2">
          {#if runStatus === 'success'}
            <span class="text-green-600 dark:text-green-400 text-sm font-medium">✅ Success</span>
          {:else if runStatus === 'error'}
            <span class="text-red-600 dark:text-red-400 text-sm font-medium">❌ Failed</span>
          {:else if runStatus === 'running'}
            <span class="text-blue-600 dark:text-blue-400 text-sm font-medium">⏳ Running</span>
          {/if}
        </div>
        <div class="flex items-center gap-2">
          <button
            onclick={runAgain}
            disabled={runStatus === 'running'}
            class="px-4 py-2 border rounded-md hover:bg-muted transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Run again"
          >
            <RotateCw class="w-4 h-4" />
            Run Again
          </button>
          <button
            onclick={closeModal}
            class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .run-modal__output {
     min-height: 30vh;
     max-height: 30vh;
     overflow-y: scroll;
  }
</style>
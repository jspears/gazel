<script lang="ts">
  import { onMount } from 'svelte';
  import { Play, TestTube, Trash2, Clock, CheckCircle, XCircle, Terminal } from 'lucide-svelte';
  import { api } from '$lib/api/client';
  import type { CommandHistory } from '$lib/types';

  let target = '';
  let commandType: 'build' | 'test' | 'run' = 'build';
  let options = '';
  let output = '';
  let isStreaming = false;
  let history: CommandHistory[] = [];
  let loading = false;
  let error: string | null = null;
  let cancelStreamRun: (() => void) | null = null;

  onMount(() => {
    loadHistory();
  });

  async function loadHistory() {
    try {
      const result = await api.getCommandHistory();
      history = result.history;
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  }

  async function executeCommand() {
    if (!target.trim()) return;

    try {
      loading = true;
      error = null;
      output = '';
      
      const optionsArray = options.trim() ? options.trim().split(' ') : [];
      
      if (commandType === 'build') {
        const result = await api.buildTarget(target, optionsArray);
        output = result.output + (result.stderr ? `\n\nErrors:\n${result.stderr}` : '');
        if (!result.success) {
          error = result.error || 'Build failed';
          if (result.command) {
            error += `\n\nFailed command: ${result.command}`;
          }
        }
      } else {
        const result = await api.testTarget(target, optionsArray);
        output = result.output + (result.stderr ? `\n\nErrors:\n${result.stderr}` : '');
        if (!result.success) {
          error = result.error || 'Test failed';
          if (result.command) {
            error += `\n\nFailed command: ${result.command}`;
          }
        }
      }
      
      await loadHistory();
    } catch (err: any) {
      error = err.message;
      if (err.command) {
        error += `\n\nFailed command: ${err.command}`;
      }
      if (err.data?.details) {
        error += `\n\nDetails: ${err.data.details}`;
      }
    } finally {
      loading = false;
    }
  }

  function streamBuild() {
    if (!target.trim() || isStreaming) return;

    isStreaming = true;
    output = '';
    error = null;

    const optionsArray = options.trim() ? options.trim().split(' ') : [];
    const eventSource = api.streamBuild(target, optionsArray, (data) => {
      if (data.type === 'stdout') {
        output += data.data;
      } else if (data.type === 'stderr') {
        output += `\n[ERROR] ${data.data}`;
      } else if (data.type === 'exit') {
        isStreaming = false;
        if (data.code !== 0) {
          error = `Process exited with code ${data.code}`;
        }
        loadHistory();
      }
    });

    // Clean up on component destroy
    return () => {
      eventSource.close();
    };
  }

  function streamRun() {
    if (!target.trim() || isStreaming) return;

    isStreaming = true;
    output = '';
    error = null;

    const optionsArray = options.trim() ? options.trim().split(' ') : [];

    // Use EventSource for streaming
    const eventSource = api.streamRun(target, optionsArray, (data) => {
      if (data.type === 'stdout') {
        output += data.data;
      } else if (data.type === 'stderr') {
        output += `\n[ERROR] ${data.data}`;
      } else if (data.type === 'info') {
        output += `\n[INFO] ${data.data}\n`;
      } else if (data.type === 'exit') {
        isStreaming = false;
        if (data.code !== 0) {
          error = `Process exited with code ${data.code}`;
        }
        loadHistory();
        eventSource.close();
      } else if (data.type === 'error') {
        isStreaming = false;
        error = data.data;
        eventSource.close();
      }
    });

    // Store the EventSource for cleanup
    cancelStreamRun = () => {
      eventSource.close();
      isStreaming = false;
    };
  }

  function stopStreaming() {
    if (cancelStreamRun) {
      cancelStreamRun();
      cancelStreamRun = null;
    }
    isStreaming = false;
  }

  async function clearHistory() {
    try {
      await api.clearCommandHistory();
      history = [];
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }

  async function cleanBazel(expunge = false) {
    try {
      loading = true;
      const result = await api.cleanBazel(expunge);
      output = result.output;
      if (!result.success) {
        error = result.error || 'Clean failed';
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function useHistoryCommand(cmd: CommandHistory) {
    target = cmd.target;
    options = cmd.options.join(' ');
    commandType = cmd.command as 'build' | 'test';
  }
</script>

<div class="space-y-6">
  <div class="bg-card rounded-lg border p-6">
    <div class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="target" class="block text-sm font-medium mb-2">Target</label>
          <input
            id="target"
            type="text"
            bind:value={target}
            placeholder="//path/to:target"
            class="w-full px-3 py-2 border rounded-md bg-background font-mono"
          />
        </div>
        <div>
          <label for="options" class="block text-sm font-medium mb-2">Options</label>
          <input
            id="options"
            type="text"
            bind:value={options}
            placeholder="--config=debug --verbose"
            class="w-full px-3 py-2 border rounded-md bg-background font-mono"
          />
        </div>
      </div>

      <div class="flex gap-2">
        <button
          on:click={() => { commandType = 'build'; executeCommand(); }}
          disabled={loading || !target.trim()}
          class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          <Play class="w-4 h-4" />
          Build
        </button>
        <button
          on:click={() => { commandType = 'test'; executeCommand(); }}
          disabled={loading || !target.trim()}
          class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
        >
          <TestTube class="w-4 h-4" />
          Test
        </button>
        <button
          on:click={streamBuild}
          disabled={loading || isStreaming || !target.trim()}
          class="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90 disabled:opacity-50 flex items-center gap-2"
        >
          <Play class="w-4 h-4" />
          Stream Build
        </button>
        <button
          on:click={streamRun}
          disabled={loading || isStreaming || !target.trim()}
          class="px-4 py-2 bg-accent text-accent-foreground rounded-md hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2"
        >
          <Terminal class="w-4 h-4" />
          Run Target
        </button>
        {#if isStreaming}
          <button
            on:click={stopStreaming}
            class="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 flex items-center gap-2"
          >
            <XCircle class="w-4 h-4" />
            Stop
          </button>
        {/if}
        <div class="ml-auto flex gap-2">
          <button
            on:click={() => cleanBazel(false)}
            disabled={loading}
            class="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
          >
            Clean
          </button>
          <button
            on:click={() => cleanBazel(true)}
            disabled={loading}
            class="px-4 py-2 border rounded-md hover:bg-muted disabled:opacity-50"
          >
            Clean --expunge
          </button>
        </div>
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="bg-card rounded-lg border">
      <div class="p-4 border-b flex items-center justify-between">
        <h3 class="font-semibold flex items-center gap-2">
          <Clock class="w-4 h-4" />
          Command History
        </h3>
        <button
          on:click={clearHistory}
          class="p-1 hover:bg-destructive/10 rounded"
        >
          <Trash2 class="w-4 h-4 text-destructive" />
        </button>
      </div>
      <div class="max-h-[500px] overflow-y-auto">
        {#if history.length === 0}
          <div class="p-4 text-sm text-muted-foreground">No command history</div>
        {/if}
        {#each history as cmd}
          <button
            on:click={() => useHistoryCommand(cmd)}
            class="w-full text-left px-4 py-3 hover:bg-muted border-b last:border-b-0"
          >
            <div class="flex items-center justify-between mb-1">
              <div class="flex items-center gap-2">
                {#if cmd.success}
                  <CheckCircle class="w-4 h-4 text-green-500" />
                {:else}
                  <XCircle class="w-4 h-4 text-destructive" />
                {/if}
                <span class="font-medium text-sm">{cmd.command}</span>
              </div>
              <span class="text-xs text-muted-foreground">
                {new Date(cmd.timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div class="font-mono text-xs text-muted-foreground truncate">
              {cmd.target}
            </div>
          </button>
        {/each}
      </div>
    </div>

    <div class="lg:col-span-2 bg-card rounded-lg border">
      <div class="p-4 border-b">
        <h3 class="font-semibold">Output</h3>
      </div>
      <div class="p-4 max-h-[500px] overflow-auto">
        {#if loading}
          <div class="text-muted-foreground">Executing command...</div>
        {:else if isStreaming}
          <div class="text-muted-foreground mb-2">Streaming output...</div>
          <pre class="font-mono text-xs whitespace-pre-wrap">{output}</pre>
        {:else if error}
          <div class="bg-destructive/10 text-destructive p-4 rounded-md mb-4">
            {error}
          </div>
          {#if output}
            <pre class="font-mono text-xs whitespace-pre-wrap">{output}</pre>
          {/if}
        {:else if output}
          <pre class="font-mono text-xs whitespace-pre-wrap">{output}</pre>
        {:else}
          <p class="text-muted-foreground">Execute a command to see output</p>
        {/if}
      </div>
    </div>
  </div>
</div>

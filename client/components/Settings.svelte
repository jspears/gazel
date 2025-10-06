<script lang="ts">
  import { X, Save, RotateCcw } from 'lucide-svelte';
  import { api } from '../client.js';
  import { storage } from '../lib/storage.js';

  interface Props {
    onClose: () => void;
  }

  let { onClose }: Props = $props();

  // Settings state
  let bazelExecutable = $state('');
  let detectedPath = $state('');
  let saving = $state(false);
  let verifying = $state(false);
  let saveSuccess = $state(false);
  let saveError = $state('');
  let verifySuccess = $state(false);
  let verifyError = $state('');

  // Load settings from localStorage on mount
  $effect(() => {
    const stored = storage.getPreference('bazelExecutable');
    bazelExecutable = stored || '';
  });

  async function verifyBazelExecutable() {
    verifying = true;
    verifyError = '';
    verifySuccess = false;

    try {
      const result = await api.updateBazelExecutable({ executable: bazelExecutable });

      if (result.success) {
        detectedPath = result.detectedPath;
        verifySuccess = true;
        setTimeout(() => {
          verifySuccess = false;
        }, 3000);
      } else {
        verifyError = result.message;
      }
    } catch (error: any) {
      console.error('Failed to verify Bazel executable:', error);
      verifyError = error.message || 'Failed to verify Bazel executable';
    } finally {
      verifying = false;
    }
  }

  async function saveSettings() {
    saving = true;
    saveError = '';
    saveSuccess = false;

    try {
      // Save to localStorage
      storage.setPreference('bazelExecutable', bazelExecutable);

      // Send to server and verify
      const result = await api.updateBazelExecutable({ executable: bazelExecutable });

      if (result.success) {
        detectedPath = result.detectedPath;
        saveSuccess = true;
        setTimeout(() => {
          saveSuccess = false;
        }, 2000);
      } else {
        saveError = result.message;
      }
    } catch (error: any) {
      console.error('Failed to save settings:', error);
      saveError = error.message || 'Failed to save settings';
    } finally {
      saving = false;
    }
  }

  function resetToDefault() {
    bazelExecutable = '';
    storage.setPreference('bazelExecutable', '');
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Modal backdrop -->
<div
  class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
  onclick={onClose}
  role="button"
  tabindex="-1"
>
  <!-- Modal content -->
  <div
    class="bg-background border border-border rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    aria-labelledby="settings-title"
  >
    <!-- Header -->
    <div class="flex items-center justify-between p-6 border-b border-border">
      <h2 id="settings-title" class="text-2xl font-semibold">Settings</h2>
      <button
        onclick={onClose}
        class="p-2 hover:bg-muted rounded-md transition-colors"
        aria-label="Close settings"
      >
        <X class="w-5 h-5" />
      </button>
    </div>

    <!-- Content -->
    <div class="p-6 space-y-6">
      <!-- Bazel Configuration Section -->
      <section>
        <h3 class="text-lg font-semibold mb-4">Bazel Configuration</h3>
        
        <div class="space-y-4">
          <!-- Bazel Executable Path -->
          <div>
            <label for="bazel-executable" class="block text-sm font-medium mb-2">
              Bazel Executable Path
            </label>
            <div class="flex gap-2">
              <input
                id="bazel-executable"
                type="text"
                bind:value={bazelExecutable}
                placeholder="bazelisk or /usr/local/bin/bazel"
                class="flex-1 px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                onclick={verifyBazelExecutable}
                class="px-4 py-2 text-sm font-medium border border-input rounded-md hover:bg-muted transition-colors disabled:opacity-50"
                disabled={verifying}
              >
                {#if verifying}
                  <div class="w-4 h-4 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin"></div>
                {:else}
                  Verify
                {/if}
              </button>
            </div>
            <p class="mt-2 text-sm text-muted-foreground">
              Specify the path to your Bazel or Bazelisk executable. Leave empty to auto-detect.
              Examples: <code class="px-1 py-0.5 bg-muted rounded">bazelisk</code>,
              <code class="px-1 py-0.5 bg-muted rounded">bazel</code>, or
              <code class="px-1 py-0.5 bg-muted rounded">/usr/local/bin/bazel</code>
            </p>

            <!-- Detected path display -->
            {#if detectedPath}
              <div class="mt-2 p-3 bg-green-500/10 border border-green-500/30 rounded-md">
                <p class="text-sm text-green-600 dark:text-green-400">
                  ✓ Detected path: <code class="px-1 py-0.5 bg-background rounded font-mono">{detectedPath}</code>
                </p>
              </div>
            {/if}
          </div>

          <!-- Info box -->
          <div class="p-4 bg-muted rounded-md border border-border">
            <h4 class="font-medium mb-2">Auto-detection behavior:</h4>
            <ul class="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>If empty, Gazel will try to find <code class="px-1 py-0.5 bg-background rounded">bazelisk</code> first</li>
              <li>If bazelisk is not found, it will fall back to <code class="px-1 py-0.5 bg-background rounded">bazel</code></li>
              <li>You can specify a full path if Bazel is not in your PATH</li>
              <li>Click "Verify" to test if the executable works</li>
              <li>Changes take effect immediately after saving</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Verify error message -->
      {#if verifyError}
        <div class="p-4 bg-destructive/10 border border-destructive rounded-md">
          <p class="text-sm font-medium text-destructive mb-1">Verification Failed</p>
          <p class="text-sm text-destructive">{verifyError}</p>
        </div>
      {/if}

      <!-- Verify success message -->
      {#if verifySuccess}
        <div class="p-4 bg-green-500/10 border border-green-500 rounded-md">
          <p class="text-sm text-green-600 dark:text-green-400">✓ Bazel executable verified successfully!</p>
        </div>
      {/if}

      <!-- Save error message -->
      {#if saveError}
        <div class="p-4 bg-destructive/10 border border-destructive rounded-md">
          <p class="text-sm text-destructive">{saveError}</p>
        </div>
      {/if}

      <!-- Save success message -->
      {#if saveSuccess}
        <div class="p-4 bg-green-500/10 border border-green-500 rounded-md">
          <p class="text-sm text-green-600 dark:text-green-400">Settings saved successfully!</p>
        </div>
      {/if}
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between p-6 border-t border-border">
      <button
        onclick={resetToDefault}
        class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        disabled={saving}
      >
        <RotateCcw class="w-4 h-4" />
        Reset to Default
      </button>

      <div class="flex gap-3">
        <button
          onclick={onClose}
          class="px-4 py-2 text-sm font-medium border border-input rounded-md hover:bg-muted transition-colors"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          onclick={saveSettings}
          class="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
          disabled={saving}
        >
          {#if saving}
            <div class="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin"></div>
            Saving...
          {:else}
            <Save class="w-4 h-4" />
            Save Settings
          {/if}
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }
</style>


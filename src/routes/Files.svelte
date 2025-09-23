<script lang="ts">
  import { onMount, afterUpdate, createEventDispatcher } from 'svelte';
  import { FileCode, Search, File, FolderOpen, Target, ChevronRight, Play, TestTube, ExternalLink } from 'lucide-svelte';
  import { api } from '$lib/api/client';
  import type { BuildFile, BazelTarget } from '$lib/types';
  import CopyButton from '$lib/components/CopyButton.svelte';
  import hljs from 'highlight.js/lib/core';
  import python from 'highlight.js/lib/languages/python';
  import bash from 'highlight.js/lib/languages/bash';
  import 'highlight.js/styles/atom-one-dark.css';

  // Register languages for syntax highlighting
  hljs.registerLanguage('python', python);
  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('starlark', python); // Use Python highlighting for Starlark
  hljs.registerLanguage('bazel', python); // Use Python highlighting for Bazel

  export let fileToOpen: string | null = null;

  const dispatch = createEventDispatcher();

  let buildFiles: BuildFile[] = [];
  let selectedFile: string | null = null;
  let fileContent = '';
  let highlightedContent = '';
  let fileTargets: Array<{ruleType: string; name: string; line: number}> = [];
  let searchQuery = '';
  let searchResults: Array<{file: string; line: number; content: string}> = [];
  let loading = false;
  let error: string | null = null;
  let activeTab: 'files' | 'workspace' | 'search' | 'actions' | 'targets' = 'files';
  let selectedTarget: BazelTarget | null = null;
  let targetDetails: BazelTarget | null = null;
  let highlightedLine: number | null = null;
  let fileActions: BazelTarget[] = [];
  let loadingActions = false;

  onMount(() => {
    loadBuildFiles();
  });

  // Watch for fileToOpen changes from parent component
  $: if (fileToOpen) {
    selectFile(fileToOpen);
    fileToOpen = null; // Reset after handling
  }

  // Re-apply highlighting when content changes
  $: if (fileContent && (activeTab === 'files' || activeTab === 'workspace')) {
    applyHighlighting();
  }

  async function loadBuildFiles() {
    try {
      loading = true;
      const result = await api.listBuildFiles();
      buildFiles = result.files;
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function selectFile(path: string) {
    try {
      loading = true;
      selectedFile = path;
      const result = await api.getBuildFile(path);
      fileContent = result.content;
      fileTargets = result.targets;
      activeTab = 'files';

      // Apply syntax highlighting
      applyHighlighting();

      // Only load actions for non-BUILD/WORKSPACE files
      const fileName = path.split('/').pop();
      if (fileName && !fileName.startsWith('BUILD') && !fileName.startsWith('WORKSPACE')) {
        loadFileActions(path);
      } else {
        fileActions = [];
      }
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function loadFileActions(filePath: string) {
    if (!filePath) return;

    try {
      loadingActions = true;
      // Get the filename from the path
      const fileName = filePath.split('/').pop();
      if (!fileName) return;

      const result = await api.getTargetsByFile(fileName);
      fileActions = result.targets;
    } catch (err) {
      console.error('Failed to load file actions:', err);
      fileActions = [];
    } finally {
      loadingActions = false;
    }
  }

  function applyHighlighting() {
    if (!fileContent) {
      highlightedContent = '';
      return;
    }

    // Determine the language based on file type
    const language = getLanguageForFile(selectedFile || '');

    try {
      // Apply highlighting
      const result = hljs.highlight(fileContent, { language });
      highlightedContent = result.value;
    } catch (err) {
      // Fallback to plain text if highlighting fails
      console.warn('Highlighting failed:', err);
      highlightedContent = escapeHtml(fileContent);
    }
  }

  function getLanguageForFile(filename: string): string {
    if (filename.includes('BUILD') || filename.includes('WORKSPACE')) {
      return 'python'; // Use Python syntax for Bazel/Starlark files
    }
    if (filename.endsWith('.bzl')) {
      return 'python'; // .bzl files are also Starlark
    }
    if (filename.endsWith('.bazelrc')) {
      return 'bash'; // .bazelrc files are similar to shell scripts
    }
    return 'plaintext';
  }

  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function getHighlightedLine(index: number): string {
    if (!highlightedContent) {
      // If no highlighting available, return escaped plain text
      const lines = fileContent.split('\n');
      return escapeHtml(lines[index] || '');
    }

    // Split the highlighted content by lines
    const highlightedLines = highlightedContent.split('\n');
    return highlightedLines[index] || '';
  }

  async function loadWorkspaceFile() {
    try {
      loading = true;
      const result = await api.getWorkspaceFile();
      fileContent = result.content;
      selectedFile = result.path;
      fileTargets = [];
      activeTab = 'workspace';

      // Apply syntax highlighting
      applyHighlighting();
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  async function searchFiles() {
    if (!searchQuery.trim()) {
      searchResults = [];
      return;
    }

    try {
      loading = true;
      const result = await api.searchInFiles(searchQuery);
      searchResults = result.results;
      activeTab = 'search';
    } catch (err: any) {
      error = err.message;
    } finally {
      loading = false;
    }
  }

  function highlightLine(lineNumber: number) {
    const lines = fileContent.split('\n');
    return lines.map((line, index) => ({
      number: index + 1,
      content: line,
      highlighted: index + 1 === lineNumber
    }));
  }

  async function selectTargetFromFile(target: {ruleType: string; name: string; line: number}) {
    highlightedLine = target.line;

    // Construct the full target path from the file path and target name
    if (selectedFile) {
      const packagePath = selectedFile.replace(/\/BUILD(\.bazel)?$/, '');
      const fullTargetPath = packagePath ? `//${packagePath}:${target.name}` : `//:${target.name}`;

      try {
        targetDetails = await api.getTarget(fullTargetPath);
        selectedTarget = targetDetails;
      } catch (err) {
        console.error('Failed to load target details:', err);
        // Try without the full path
        try {
          targetDetails = await api.getTarget(target.name);
          selectedTarget = targetDetails;
        } catch (err2) {
          console.error('Failed to load target with name only:', err2);
          targetDetails = null;
        }
      }
    }

    // Scroll to the line in the code view
    const lineElement = document.getElementById(`line-${target.line}`);
    if (lineElement) {
      lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function getTargetPath(targetName: string): string {
    if (!selectedFile) return targetName;
    const packagePath = selectedFile.replace(/\/BUILD(\.bazel)?$/, '');
    return packagePath ? `//${packagePath}:${targetName}` : `//:${targetName}`;
  }
</script>

<div class="space-y-6">
  <div class="flex gap-4">
    <div class="flex-1">
      <div class="relative">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          bind:value={searchQuery}
          on:keydown={(e) => e.key === 'Enter' && searchFiles()}
          placeholder="Search in BUILD files..."
          class="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
        />
      </div>
    </div>
    <button
      on:click={searchFiles}
      class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
    >
      Search
    </button>

  </div>

  <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
    <div class="bg-card rounded-lg border">
      <div class="p-4 border-b">
        <h3 class="font-semibold flex items-center gap-2">
          <FolderOpen class="w-4 h-4" />
          BUILD Files ({buildFiles.length})
        </h3>
      </div>
      <div class="max-h-[600px] overflow-y-auto">
        {#each buildFiles as file}
          <button
            on:click={() => selectFile(file.path)}
            class="w-full text-left px-4 py-2 hover:bg-muted border-b last:border-b-0"
            class:bg-muted={selectedFile === file.path}
          >
            <div class="flex items-center gap-2">
              <FileCode class="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div class="flex-1 min-w-0">
                <div class="font-mono text-sm truncate">{file.path}</div>
                {#if file.lastModified}
                  <div class="text-xs text-muted-foreground">
                    {new Date(file.lastModified).toLocaleDateString()}
                  </div>
                {/if}
              </div>
            </div>
          </button>
        {/each}
      </div>
    </div>

    {#if fileTargets.length > 0 && activeTab === 'files'}
      <div class="bg-card rounded-lg border">
        <div class="p-4 border-b">
          <h3 class="font-semibold flex items-center gap-2">
            <Target class="w-4 h-4" />
            Targets ({fileTargets.length})
          </h3>
        </div>
        <div class="max-h-[600px] overflow-y-auto">
          {#each fileTargets as target}
            <button
              on:click={() => selectTargetFromFile(target)}
              class="w-full text-left px-4 py-3 hover:bg-muted border-b last:border-b-0 group"
              class:bg-muted={highlightedLine === target.line}
            >
              <div class="flex items-center justify-between">
                <div class="flex-1 min-w-0">
                  <div class="font-mono text-sm truncate">{target.name}</div>
                  <div class="text-xs text-muted-foreground">
                    {target.ruleType} • Line {target.line}
                  </div>
                </div>
                <ChevronRight class="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </div>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="{fileTargets.length > 0 && activeTab === 'files' ? 'lg:col-span-2' : 'lg:col-span-3'} bg-card rounded-lg border">
      <div class="p-4 border-b">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold">
            {#if activeTab === 'workspace'}
              WORKSPACE File
            {:else if activeTab === 'search'}
              Search Results ({searchResults.length})
            {:else if activeTab === 'actions'}
              File Actions ({fileActions.length})
            {:else if activeTab === 'targets'}
              Targets ({fileTargets.length})
            {:else if selectedFile}
              {selectedFile}
            {:else}
              File Content
            {/if}
          </h3>
          {#if targetDetails}
            <div class="text-sm">
              <span class="font-mono">{targetDetails.name}</span>
              <span class="text-muted-foreground ml-2">({targetDetails.ruleType || targetDetails.type})</span>
            </div>
          {/if}
        </div>

        {#if selectedFile && (activeTab === 'files' || activeTab === 'actions' || activeTab === 'targets')}
          {@const fileName = selectedFile.split('/').pop()}
          {@const isBuildFile = fileName && (fileName.startsWith('BUILD') || fileName.startsWith('WORKSPACE'))}
          <div class="flex gap-2">
            <button
              on:click={() => activeTab = 'files'}
              class="px-3 py-1 text-sm rounded-md transition-colors {activeTab === 'files' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}"
            >
              Content
            </button>
            {#if isBuildFile && fileTargets.length > 0}
              <button
                on:click={() => activeTab = 'targets'}
                class="px-3 py-1 text-sm rounded-md transition-colors {activeTab === 'targets' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}"
              >
                Targets ({fileTargets.length})
              </button>
            {/if}
            {#if !isBuildFile}
              <button
                on:click={() => activeTab = 'actions'}
                class="px-3 py-1 text-sm rounded-md transition-colors {activeTab === 'actions' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}"
              >
                Actions ({fileActions.length})
              </button>
            {/if}
          </div>
        {/if}
      </div>

      <div class="p-4 max-h-[600px] overflow-auto">
        {#if loading}
          <div class="text-muted-foreground">Loading...</div>
        {:else if error}
          <div class="text-destructive">Error: {error}</div>
        {:else if activeTab === 'actions'}
          {#if loadingActions}
            <div class="text-muted-foreground">Loading actions...</div>
          {:else if fileActions.length === 0}
            <div class="text-muted-foreground">No targets use this file</div>
          {:else}
            <div class="space-y-2">
              {#each fileActions as action}
                <div class="p-3 border rounded-md hover:bg-muted/50 transition-colors">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="font-mono text-sm font-medium">{action.name || action.full}</div>
                      {#if action.ruleType || action.type}
                        <div class="text-xs text-muted-foreground mt-1">
                          Type: {action.ruleType || action.type}
                        </div>
                      {/if}
                      {#if action.package}
                        <div class="text-xs text-muted-foreground">
                          Package: {action.package}
                        </div>
                      {/if}
                    </div>
                    <Target class="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        {:else if activeTab === 'targets' && fileTargets.length > 0}
          <div class="space-y-2">
            {#each fileTargets as target}
              <div class="flex items-center justify-between p-3 hover:bg-muted rounded-md transition-colors group">
                <div class="flex items-center gap-3">
                  <Target class="w-4 h-4 text-muted-foreground" />
                  <div>
                    <button
                      on:click={() => dispatch('navigate-to-targets', { target: target.name })}
                      class="font-mono text-sm hover:text-primary transition-colors"
                    >
                      {target.name}
                    </button>
                    <div class="text-xs text-muted-foreground">
                      {target.ruleType} • Line {target.line}
                    </div>
                  </div>
                </div>
                <div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <CopyButton text={target.name} />
                  {#if target.ruleType && (target.ruleType.includes('binary') || target.ruleType.includes('test'))}
                    <button
                      on:click={() => dispatch('run-target', { target: target.name })}
                      class="p-1 hover:bg-primary/10 rounded transition-colors"
                      title="Run {target.name}"
                    >
                      {#if target.ruleType.includes('test')}
                        <TestTube class="w-4 h-4 text-primary" />
                      {:else}
                        <Play class="w-4 h-4 text-primary" />
                      {/if}
                    </button>
                  {/if}
                  <ExternalLink class="w-3 h-3 text-muted-foreground" />
                </div>
              </div>
            {/each}
          </div>
        {:else if activeTab === 'search' && searchResults.length > 0}
          <div class="space-y-4">
            {#each searchResults as result}
              <div class="border-l-2 border-primary pl-4">
                <div class="flex items-center gap-2 mb-1">
                  <File class="w-4 h-4 text-muted-foreground" />
                  <span class="font-mono text-sm">{result.file}</span>
                  <span class="text-xs text-muted-foreground">Line {result.line}</span>
                </div>
                <pre class="font-mono text-sm bg-muted p-2 rounded overflow-x-auto">{result.content}</pre>
              </div>
            {/each}
          </div>
        {:else if fileContent}
          <div class="relative">
            <div class="font-mono text-sm hljs-container">
              {#each fileContent.split('\n') as line, index}
                <div
                  id="line-{index + 1}"
                  class="code-line hover:bg-muted/50 {highlightedLine === index + 1 ? 'bg-accent/20 border-l-2 border-accent pl-2' : ''}"
                >
                  <span class="line-number inline-block w-12 text-right text-muted-foreground mr-4 select-none">{index + 1}</span>
                  <span class="line-content">{@html getHighlightedLine(index)}</span>
                </div>
              {/each}
            </div>
          </div>
        {:else}
          <p class="text-muted-foreground">Select a file to view its content</p>
        {/if}
      </div>
    </div>
  </div>

  {#if targetDetails && activeTab === 'files'}
    <div class="mt-6 bg-card rounded-lg border p-6">
      <h3 class="font-semibold mb-4 flex items-center gap-2">
        <Target class="w-4 h-4" />
        Target Details: {targetDetails.name}
      </h3>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 class="text-sm font-medium text-muted-foreground mb-2">Basic Information</h4>
          <dl class="space-y-2 text-sm">
            <div>
              <dt class="text-muted-foreground">Full Path</dt>
              <dd class="font-mono">{getTargetPath(targetDetails.name)}</dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Type</dt>
              <dd class="font-mono">{targetDetails.ruleType || targetDetails.type || targetDetails.class}</dd>
            </div>
            {#if targetDetails.location}
              <div>
                <dt class="text-muted-foreground">Location</dt>
                <dd class="font-mono text-xs">{targetDetails.location}</dd>
              </div>
            {/if}
          </dl>
        </div>

        {#if targetDetails.attributes && Object.keys(targetDetails.attributes).length > 0}
          <div>
            <h4 class="text-sm font-medium text-muted-foreground mb-2">Attributes</h4>
            <dl class="space-y-1 text-sm max-h-40 overflow-y-auto">
              {#each Object.entries(targetDetails.attributes).slice(0, 10) as [key, value]}
                <div>
                  <dt class="text-muted-foreground inline">{key}:</dt>
                  <dd class="font-mono inline ml-2">
                    {#if Array.isArray(value)}
                      [{value.length} items]
                    {:else if typeof value === 'object'}
                      {JSON.stringify(value)}
                    {:else}
                      {value}
                    {/if}
                  </dd>
                </div>
              {/each}
            </dl>
          </div>
        {/if}
      </div>

      {#if targetDetails.inputs || targetDetails.outputs}
        <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {#if targetDetails.inputs && targetDetails.inputs.length > 0}
            <div>
              <h4 class="text-sm font-medium text-muted-foreground mb-2">Inputs ({targetDetails.inputs.length})</h4>
              <div class="space-y-1 max-h-32 overflow-y-auto">
                {#each targetDetails.inputs.slice(0, 10) as input}
                  <div class="font-mono text-xs text-muted-foreground">{input}</div>
                {/each}
              </div>
            </div>
          {/if}

          {#if targetDetails.outputs && targetDetails.outputs.length > 0}
            <div>
              <h4 class="text-sm font-medium text-muted-foreground mb-2">Outputs ({targetDetails.outputs.length})</h4>
              <div class="space-y-1 max-h-32 overflow-y-auto">
                {#each targetDetails.outputs.slice(0, 10) as output}
                  <div class="font-mono text-xs text-muted-foreground">{output}</div>
                {/each}
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

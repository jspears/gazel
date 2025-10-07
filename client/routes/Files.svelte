<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import { FileCode, Search, File, FolderOpen, Target, ChevronRight, Play, TestTube, ExternalLink, X } from 'lucide-svelte';
  import { api } from '../client.js';
  import CopyButton from '../components/CopyButton.svelte';
  import TargetDetails from '../components/TargetDetails.svelte';
  import hljs from 'highlight.js/lib/core';
  import python from 'highlight.js/lib/languages/python';
  import bash from 'highlight.js/lib/languages/bash';
  import 'highlight.js/styles/atom-one-dark.css';
  import type { BazelTarget, BuildFile, GetWorkspaceFilesResponse } from 'proto/gazel_pb.js';

  // Register languages for syntax highlighting
  hljs.registerLanguage('python', python);
  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('starlark', python); // Use Python highlighting for Starlark
  hljs.registerLanguage('bazel', python); // Use Python highlighting for Bazel

  export let file: string | null = null;

  const dispatch = createEventDispatcher();

  let buildFiles: GetWorkspaceFilesResponse['files'] = [];
  let selectedFile: string | null = null;
  let fileContent = '';
  let highlightedContent = '';
  let fileTargets: Array<{ruleType: string; name: string; line: number}> = [];
  let searchQuery = file ?? '';
  let searchResults: Array<{file: string; line: number; content: string}> = [];
  let loading = false;
  let error: string | null = null;
  let activeTab: 'files' | 'workspace' | 'search' | 'actions' | 'targets' = 'files';
  let selectedTarget: BazelTarget | null = null;
  let highlightedLine: number | null = null;
  let fileActions: BazelTarget[] = [];
  let loadingActions = false;
  let fileContentTab: 'content' | 'targets' = 'content';
  let buildFileTargets: BazelTarget[] = [];
  let loadingBuildTargets = false;

  // Run modal state
  let showRunModal = false;
  let runOutput: string[] = [];
  let runCommand = '';
  let runStatus: 'idle' | 'running' | 'success' | 'error' = 'idle';
  let runEventSource: EventSource | null = null;
  let outputContainer: HTMLDivElement;

  onMount(() => {
    loadBuildFiles();
  });

  // Watch for fileToOpen changes from parent component
  $: if (file) {
    selectFile(file);
  }

  // Re-apply highlighting when content changes
  $: if (fileContent && (activeTab === 'files' || activeTab === 'workspace')) {
    applyHighlighting();
  }

  async function loadBuildFiles() {
    try {
      loading = true;
      const result = (await api.getWorkspaceFiles({}));
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
      const result = await api.getBuildFile({path});
      fileContent = result.content;
      fileTargets = result.targets;
      activeTab = 'files';
      fileContentTab = 'content'; // Reset to content tab when selecting a new file

      // Apply syntax highlighting
      applyHighlighting();

      // Check if this is a BUILD file
      const fileName = path.split('/').pop();
      if (fileName && (fileName.startsWith('BUILD') || fileName.includes('BUILD'))) {
        // Load targets for BUILD file
        loadBuildFileTargets();
        fileActions = [];
      } else if (fileName && !fileName.startsWith('WORKSPACE')) {
        // Load actions for non-BUILD/WORKSPACE files
        loadFileActions(path);
      } else {
        fileActions = [];
        buildFileTargets = [];
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

      const result = await api.getTargetsByFile({file: fileName});
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

  async function selectTargetFromFile(target: {ruleType: string; name: string; line: number}) {
    highlightedLine = target.line;

    // Construct the full target path from the file path and target name
    if (selectedFile) {
      const packagePath = selectedFile.replace(/\/BUILD(\.bazel)?$/, '');
      const fullTargetPath = packagePath ? `//${packagePath}:${target.name}` : `//:${target.name}`;

      try {
        const targetData = await api.getTarget({target: fullTargetPath});
        selectedTarget = targetData.target;
      } catch (err) {
        console.error('Failed to load target details:', err);
        // Try without the full path
        try {
          const targetData = await api.getTarget({target: target.name});
          selectedTarget = targetData.target;
        } catch (err2) {
          console.error('Failed to load target with name only:', err2);
          selectedTarget = null;
        }
      }
    }

    // Scroll to the line in the code view
    const lineElement = document.getElementById(`line-${target.line}`);
    if (lineElement) {
      lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  async function loadBuildFileTargets() {
    if (!selectedFile) return;

    // Extract package path from the BUILD file path
    const packagePath = selectedFile.replace(/\/BUILD(\.bazel)?$/, '');
    const queryPath = packagePath ? `//${packagePath}:all` : '//:all';

    try {
      loadingBuildTargets = true;
      buildFileTargets = [];

      // Execute a bazel query to get all targets in this BUILD file
      const result = await api.executeQuery({
        query: queryPath,
        outputFormat: 'label_kind',
        
        queryType: 'query'
      });

        buildFileTargets = result?.result?.targets ?? []
    } catch (err) {
      console.error('Failed to load BUILD file targets:', err);
      buildFileTargets = [];
    } finally {
      loadingBuildTargets = false;
    }
  }

  // Event handlers for TargetDetails component navigation
  function handleTargetNavigation(event: CustomEvent) {
    fileContentTab = event.detail
  }

  function handleRunTarget(event: CustomEvent) {
    const { target } = event.detail;
    if (target) {
      // Instead of dispatching, handle the run locally
      runTargetByName(target);
    }
  }

async function runTargetByName(targetName: string) {
    if (!targetName) return;

    runCommand = `bazel run ${targetName}`;
    runOutput = [];
    runStatus = 'running';
    showRunModal = true;

    // Use EventSource for streaming
    for await (const {event:data} of api.streamRun({target: targetName})){
      if (data.case === 'progress'){
        runOutput = [...runOutput, data.value.currentAction];
        // Auto-scroll to bottom
        if (outputContainer) {
          setTimeout(() => {
            outputContainer.scrollTop = outputContainer.scrollHeight;
          }, 0);
        }
    
      } else if (data.case === 'complete') {
        if (data.value.exitCode === 0) {
          runStatus = 'success';
          runOutput = [...runOutput, `\n✅ Command completed successfully in (${data.value.durationMs}ms)`];
        } else if (data.value.exitCode === null) {
          // Process was killed or terminated abnormally
          runStatus = 'error';
          runOutput = [...runOutput, '\n⚠️ Command was terminated'];
        } else {
          runStatus = 'error';
          runOutput = [...runOutput, `\n❌ Command failed with exit code ${data.value.exitCode}`];
        }
        // Close the EventSource when process exits
        if (runEventSource) {
          runEventSource.close();
          runEventSource = null;
        }
      } else if (data.case === 'error') {
        // Handle stream errors
        runStatus = 'error';
        runOutput = [...runOutput, `\n❌ Error: ${data.value}`];
        // Close the EventSource on error
        if (runEventSource) {
          runEventSource.close();
          runEventSource = null;
        }
      }
    }
  }

  function closeRunModal() {
    if (runEventSource) {
      // If still running, add a message that we're stopping
      if (runStatus === 'running') {
        runOutput = [...runOutput, '\n⚠️ Stopping command...'];
      }
      runEventSource.close();
      runEventSource = null;
    }
    showRunModal = false;
    runStatus = 'idle';
    runOutput = [];
    runCommand = '';
  }

  function handleNavigateToFile(event: CustomEvent) {
    const { path } = event.detail;
    if (path) {
      selectFile(path);
    }
  }

  function handleNavigateToGraph(event: CustomEvent) {
    // Pass the event up to the parent component
    dispatch('navigate-to-graph', event.detail);
  }

  function handleNavigateToCommands(event: CustomEvent) {
    // Pass the event up to the parent component
    dispatch('navigate-to-commands', event.detail);
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
                    {new Date(Number(file.lastModified)).toLocaleDateString()}
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
        </div>

        {#if selectedFile && activeTab === 'files'}
          {@const file = selectedFile.split('/').pop()}
          {@const isBuildFile = file && (file.startsWith('BUILD'))}
          {#if isBuildFile}
            <div class="flex gap-2">
              <button
                on:click={() => fileContentTab = 'content'}
                class="px-3 py-1 text-sm rounded-md transition-colors {fileContentTab === 'content' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}"
              >
                Content
              </button>
              <button
                on:click={() => { fileContentTab = 'targets'; loadBuildFileTargets(); }}
                class="px-3 py-1 text-sm rounded-md transition-colors {fileContentTab === 'targets' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}"
              >
                Targets {#if buildFileTargets.length > 0}({buildFileTargets.length}){/if}
              </button>
            </div>
          {/if}
        {/if}
      </div>

      <div class="p-4 max-h-[600px] overflow-auto">
        {#if loading}
          <div class="text-muted-foreground">Loading...</div>
        {:else if error}
          <div class="text-destructive">Error: {error}</div>
        {:else if activeTab === 'files' && fileContentTab === 'targets'}
          {#if loadingBuildTargets}
            <div class="text-muted-foreground">Loading targets...</div>
          {:else if buildFileTargets.length === 0}
            <div class="text-muted-foreground">No targets found in this BUILD file</div>
          {:else}
            <div class="space-y-4">
              {#each buildFileTargets as target}
                <div class="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <TargetDetails
                    {target}
                    compact={true}
                    showActions={true}
                    showNavigation={false}
                    on:navigate-to-file={handleNavigateToFile}
                    on:navigate-to-graph={handleNavigateToGraph}
                    on:navigate-to-commands={handleNavigateToCommands}
                    on:navigate-to-target={handleTargetNavigation}
                    on:run-target={handleRunTarget}
                  />
                </div>
              {/each}
            </div>
          {/if}
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
                      <div class="font-mono text-sm font-medium">{action.label}</div>
                      {#if action.kind }
                        <div class="text-xs text-muted-foreground mt-1">
                          Type: {action.kind }
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
                 111 <CopyButton text={target.name} />
                  {#if target.ruleType && (target.ruleType.includes('binary') || target.ruleType.includes('test'))}
                    <button
                      on:click={() => runTargetByName(target.name)}
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
</div>

<!-- Run Modal -->
{#if showRunModal}
  <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div class="bg-background border rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
      <!-- Modal Header -->
      <div class="p-4 border-b flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">Running Target</h2>
          <p class="text-sm text-muted-foreground font-mono mt-1">{runCommand}</p>
        </div>
        <button
          on:click={closeRunModal}
          class="p-2 hover:bg-muted rounded-md transition-colors"
          title="Close"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Modal Body - Output Log -->
      <div bind:this={outputContainer} class="flex-1 overflow-y-auto p-4 bg-muted/20">
        <pre class="font-mono text-sm whitespace-pre-wrap">{runOutput.join('')}</pre>
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
        <button
          on:click={closeRunModal}
          class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  </div>
{/if}
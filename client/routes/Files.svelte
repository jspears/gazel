<script lang="ts">
  import { onMount } from 'svelte';
  import { FileCode, Search, File, FolderOpen, Folder, Target, ChevronRight, ChevronDown, Play, TestTube, ExternalLink, List, Network, X } from 'lucide-svelte';
  import { api } from '../client.js';
  import CopyButton from '../components/CopyButton.svelte';
  import TargetDetails from '../components/TargetDetails.svelte';
  import RunModal from '../components/RunModal.svelte';
  import hljs from 'highlight.js/lib/core';
  import python from 'highlight.js/lib/languages/python';
  import bash from 'highlight.js/lib/languages/bash';
  import 'highlight.js/styles/atom-one-dark.css';
  import type { BazelTarget, BuildFile, GetWorkspaceFilesResponse } from '@speajus/gazel-proto';
  import TreeNode, { type TreeNodeData } from '../components/TreeNode.svelte';

  // Register languages for syntax highlighting
  hljs.registerLanguage('python', python);
  hljs.registerLanguage('bash', bash);
  hljs.registerLanguage('starlark', python); // Use Python highlighting for Starlark
  hljs.registerLanguage('bazel', python); // Use Python highlighting for Bazel

  interface Props {
    file?: string | null;
    onNavigateToGraph?: (detail: any) => void;
    onNavigateToCommands?: (detail: any) => void;
    onNavigateToTargets?: (detail: any) => void;
  }

  let {
    file = $bindable(null),
    onNavigateToGraph,
    onNavigateToCommands,
    onNavigateToTargets
  }: Props = $props();

  interface FileTreeNode extends TreeNodeData {
    files: Array<{path: string; lastModified?: string}>;
  }

  let buildFiles = $state<GetWorkspaceFilesResponse['files']>([]);
  let selectedFile = $state<string | null>(null);
  let fileContent = $state('');
  let highlightedContent = $state('');
  let fileTargets = $state<Array<{ruleType: string; name: string; line: number}>>([]);
  let searchQuery = $state(file ?? '');
  let searchResults = $state<Array<{file: string; line: number; content: string}>>([]);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let activeTab = $state<'files' | 'workspace' | 'search' | 'actions' | 'targets'>('files');
  let selectedTarget = $state<BazelTarget | null>(null);
  let highlightedLine = $state<number | null>(null);
  let fileRules = $state<Array<{name: string; ruleClass?: string; location?: string}>>([]);
  let loadingActions = $state(false);
  let fileContentTab = $state<'content' | 'targets'>('content');
  let buildFileTargets = $state<BazelTarget[]>([]);
  let loadingBuildTargets = $state(false);

  // Run modal state
  let showRunModal = $state(false);
  let targetToRun = $state<string | null>(null);

  onMount(() => {
    loadBuildFiles();
  });

  // Watch for file changes from parent component
  $effect(() => {
    if (file) {
      selectFile(file);
    }
  });

  // Re-apply highlighting when content changes
  $effect(() => {
    if (fileContent && (activeTab === 'files' || activeTab === 'workspace')) {
      applyHighlighting();
    }
  });

  function buildTree(files: GetWorkspaceFilesResponse['files']): FileTreeNode {
    console.dir(files);
    const root: FileTreeNode = {
      name: '',
      fullPath: '',
      children: new Map(),
      node: [] as GetWorkspaceFilesResponse['files'],
      isExpanded: true,
      level: 0
    };

    for (const file of files) {
      let currentNode = root;
      let fullPath = '';
      const parts = file.path.split('/').filter(Boolean);

      // Build the tree structure for the directory path
      for (let i = 0; i < parts.length - 1; i++) {
        const name = parts[i];
        fullPath = fullPath ? `${fullPath}/${name}` : name;

        let existingNode = currentNode.children.get(name);
        if (!existingNode) {
          existingNode = {
            name,
            fullPath,
            children: new Map(),
            node: [],
            isExpanded: false,
            level: currentNode.level + 1
          };
          currentNode.children.set(name, existingNode);
        }
        currentNode = existingNode;
      }
      
      // Add file as a leaf node
      currentNode.node.push(file);

    }
    console.log(root);

    return root;
  }

  let fileTree = $derived(buildTree(buildFiles ?? []));

  async function loadBuildFiles() {
    try {
      loading = true;
      const result = (await api.getWorkspaceFiles({}));
      buildFiles = result.files ?? [];
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
        fileRules = [];
      } else if (fileName && !fileName.startsWith('WORKSPACE')) {
        // Load actions for non-BUILD/WORKSPACE files
        loadFileActions(path);
      } else {
        fileRules = [];
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

      const result = await api.getRulesByFile({file: fileName});
      fileRules = result.rules;
    } catch (err) {
      console.error('Failed to load file actions:', err);
      fileRules = [];
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

  function runTargetByName(targetName: string) {
    if (!targetName) return;
    targetToRun = targetName;
    showRunModal = true;
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
  let tree = $derived(fileTree.children.values());
  let viewMode: 'list' | 'tree' = $state('list');
</script>

<div class="space-y-6">
  <div class="flex gap-4">
    <div class="flex-1">
      <div class="relative">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          bind:value={searchQuery}
          onkeydown={(e) => e.key === 'Enter' && searchFiles()}
          placeholder="Search in BUILD files..."
          class="w-full pl-10 pr-4 py-2 border rounded-md bg-background"
        />
      </div>
    </div>
    <button
      onclick={searchFiles}
      class="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
    >
      Search
    </button>
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
    <div class="bg-card rounded-lg border">
      <div class="p-4 border-b flex flex-1 justify-between">
        <h3 class="font-semibold flex items-center gap-2">
          <FolderOpen class="w-4 h-4" />
          BUILD  ({buildFiles.length})
        </h3>
         <div class="flex no-wrap items-center gap-1 border rounded-md p-1">
              <button
                onclick={() => viewMode = 'list'}
                class="p-1 rounded transition-colors"
                class:bg-muted={viewMode === 'list'}
                class:text-primary={viewMode === 'list'}
                title="List view"
              >
                <List class="w-4 h-4" />
              </button>
              <button
                onclick={() => viewMode = 'tree'}
                class="p-1 rounded transition-colors"
                class:bg-muted={viewMode === 'tree'}
                class:text-primary={viewMode === 'tree'}
                title="Tree view"
              >
                <Network class="w-4 h-4" />
              </button>
            </div>
      </div>
      <div class="max-h-[600px] overflow-y-auto">
        {#if viewMode === 'tree'}
        {#each tree as node}
          <TreeNode {node} >
            {#snippet leafItem(node: FileTreeNode)}
              {#each node.node as file}
                
                <button
                  onclick={() => selectFile(file.path)}
                  class="w-full text-left px-4 py-2 hover:bg-muted border-b last:border-b-0 transition-colors"
                  class:bg-muted={selectedFile === file.path}
                >
                  <div class="flex items-center gap-2">
                    <FileCode class="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="font-mono text-sm truncate">{file.name}</div>
                      {#if file.lastModified}
                        <div class="text-xs text-muted-foreground">
                          {new Date(Number(file.lastModified)).toLocaleDateString()}
                        </div>
                      {/if}
                    </div>
                  </div>
                </button>
              {/each}
            {/snippet}
          </TreeNode>
        {/each}
        {:else if viewMode === 'list'}
          {#each buildFiles as file}
            <button
              onclick={() => selectFile(file.path)}
              class="w-full text-left px-4 py-2 hover:bg-muted border-b last:border-b-0 transition-colors"
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
        {/if}
      </div>
    </div>



    <div class="lg:col-span-3 bg-card rounded-lg border">
      <div class="p-4 border-b">
        <div class="flex items-center justify-between mb-2">
          <h3 class="font-semibold">
            {#if activeTab === 'workspace'}
              WORKSPACE File
            {:else if activeTab === 'search'}
              Search Results ({searchResults.length})
            {:else if activeTab === 'actions'}
              Rules Using This File ({fileRules.length})
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
                onclick={() => fileContentTab = 'content'}
                class="px-3 py-1 text-sm rounded-md transition-colors {fileContentTab === 'content' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}"
              >
                Content
              </button>
              <button
                onclick={() => { fileContentTab = 'targets'; loadBuildFileTargets(); }}
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
                   onnavigate-to-file={handleNavigateToFile}
                   onnavigate-to-graph={handleNavigateToGraph}
                   onnavigate-to-commands={handleNavigateToCommands}
                   onnavigate-to-target={handleTargetNavigation}
                   onrun-target={handleRunTarget}
                  />
                </div>
              {/each}
            </div>
          {/if}
        {:else if activeTab === 'actions'}
          {#if loadingActions}
            <div class="text-muted-foreground">Loading rules...</div>
          {:else if fileRules.length === 0}
            <div class="text-muted-foreground">No rules use this file</div>
          {:else}
            <div class="space-y-2">
              {#each fileRules as rule}
                <div class="p-3 border rounded-md hover:bg-muted/50 transition-colors">
                  <div class="flex items-center justify-between">
                    <div>
                      <div class="font-mono text-sm font-medium">{rule.name}</div>
                      {#if rule.ruleClass }
                        <div class="text-xs text-muted-foreground mt-1">
                          Type: {rule.ruleClass }
                        </div>
                      {/if}
                      {#if rule.location}
                        <div class="text-xs text-muted-foreground">
                          Location: {rule.location}
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
                      onclick={() => onNavigateToTargets?.(target)}
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
                      onclick={() => runTargetByName(toFull(target))}
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
<RunModal target={targetToRun} bind:open={showRunModal} />
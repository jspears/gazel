<script lang="ts">
  import { onMount } from 'svelte';
  import ELK from 'elkjs/lib/elk.bundled.js';
  import { writable } from 'svelte/store';
  import {
    SvelteFlow,
    SvelteFlowProvider,
    Background,
    Controls,
    MiniMap,
    Panel,
    Position,
    ConnectionLineType,
    type Node,
    type Edge,
    MarkerType,
    BackgroundVariant
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';
  import CustomNode from './CustomNode.svelte';

  // Import Lucide icons for different node types
  import { 
    Package,       // For modules
    Home,          // For root module
    GitBranch,     // For dependencies
    Layers,        // For transitive deps
    Code,          // For extensions
    Tag,           // For dev dependencies
    Box            // For default/unknown
  } from 'lucide-svelte';

  export let moduleGraph: any = null;
  export let filter: string = '';
  export let layoutDirection: 'DOWN' | 'RIGHT' = 'DOWN';
  export let onNodeClick: (node: any) => void = () => {};

  const nodes = writable<Node[]>([]);
  const edges = writable<Edge[]>([]);

  const nodeTypes = {
    custom: CustomNode
  };

  const elk = new ELK();

  // ELK layout options
  const elkOptions = {
    'elk.algorithm': 'layered',
    'elk.layered.spacing.nodeNodeBetweenLayers': layoutDirection === 'DOWN' ? '120' : '150',
    'elk.spacing.nodeNode': '80',
    'elk.layered.considerModelOrder': 'NODES_AND_EDGES',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
    'elk.direction': layoutDirection
  };

  // Color scheme for different module types
  const nodeColors = {
    root: '#10b981',           // Green for root module
    direct: '#3b82f6',         // Blue for direct dependencies
    transitive: '#94a3b8',     // Gray for transitive dependencies
    dev: '#f59e0b',           // Orange for dev dependencies
    extension: '#8b5cf6',      // Purple for extensions
    default: '#6b7280'         // Gray default
  };

  // Get node type based on module properties
  function getNodeType(module: any): string {
    if (module.isRoot) return 'root';
    if (module.depth === 1) return 'direct';
    if (module.depth > 1) return 'transitive';
    return 'default';
  }

  // Get icon for module type
  function getModuleIcon(module: any): any {
    if (module.isRoot) return Home;
    if (module.extensionCount > 0) return Code;
    if (module.depth > 1) return Layers;
    return Package;
  }

  // Create node data with icon and styling
  function createNodeData(module: any) {
    const type = getNodeType(module);
    const Icon = getModuleIcon(module);
    const color = nodeColors[type] || nodeColors.default;
    
    // Format label
    let label = module.name;
    if (module.apparentName && module.apparentName !== module.name) {
      label = module.apparentName;
    }
    
    return {
      label,
      sublabel: module.version,
      icon: Icon,
      color,
      type,
      fullName: module.key,
      module: module,
      stats: {
        deps: module.dependencyCount || 0,
        depth: module.depth || 0
      }
    };
  }

  async function layoutGraph() {
    if (!moduleGraph || !moduleGraph.modules) return;

    const nodeMap = new Map<string, any>();
    const edgeList: any[] = [];
    
    // Filter modules based on search
    const filteredModules = moduleGraph.modules.filter((module: any) => {
      if (!filter) return true;
      const searchTerm = filter.toLowerCase();
      return module.name.toLowerCase().includes(searchTerm) ||
             module.apparentName?.toLowerCase().includes(searchTerm) ||
             module.version?.toLowerCase().includes(searchTerm) ||
             module.key.toLowerCase().includes(searchTerm);
    });

    // Create nodes for each module
    filteredModules.forEach((module: any) => {
      const nodeId = module.key;
      
      nodeMap.set(nodeId, {
        id: nodeId,
        data: createNodeData(module),
        type: 'custom',
        width: module.isRoot ? 220 : 180,
        height: module.isRoot ? 80 : 70
      });
    });

    // Create edges from dependencies
    if (moduleGraph.dependencies) {
      moduleGraph.dependencies.forEach((dep: any) => {
        // Only include edge if both nodes are in filtered set
        if (nodeMap.has(dep.from) && nodeMap.has(dep.to)) {
          const edgeType = dep.type || 'direct';
          const edgeColor = edgeType === 'dev' ? '#f59e0b' : '#3b82f6';
          
          edgeList.push({
            id: `${dep.from}->${dep.to}`,
            source: dep.from,
            target: dep.to,
            type: 'smoothstep',
            animated: edgeType === 'dev',
            label: dep.version ? `v${dep.version}` : undefined,
            labelStyle: { fontSize: 10, fill: '#6b7280' },
            style: {
              stroke: edgeColor,
              strokeWidth: 2,
              strokeDasharray: edgeType === 'dev' ? '5 5' : undefined
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: edgeColor
            }
          });
        }
      });
    }

    // Prepare ELK graph
    const elkGraph = {
      id: 'root',
      layoutOptions: elkOptions,
      children: Array.from(nodeMap.values()).map(node => ({
        id: node.id,
        width: node.width,
        height: node.height
      })),
      edges: edgeList.map(edge => ({
        id: edge.id,
        sources: [edge.source],
        targets: [edge.target]
      }))
    };

    try {
      // Run ELK layout
      const layoutedGraph = await elk.layout(elkGraph);
      
      // Apply layout to nodes
      const layoutedNodes = layoutedGraph.children?.map(elkNode => {
        const originalNode = nodeMap.get(elkNode.id);
        return {
          ...originalNode,
          position: { x: elkNode.x || 0, y: elkNode.y || 0 }
        };
      }) || [];

      // Update stores
      nodes.set(layoutedNodes);
      edges.set(edgeList);
    } catch (error) {
      console.error('Layout error:', error);
    }
  }

  // Handle node click
  function handleNodeClick(event: CustomEvent) {
    const node = event.detail;
    if (node.data?.module) {
      onNodeClick(node.data.module);
    }
  }

  // React to changes
  $: if (moduleGraph) {
    layoutGraph();
  }

  $: if (filter !== undefined) {
    layoutGraph();
  }

  onMount(() => {
    layoutGraph();
  });
</script>

<div class="w-full h-full">
  <SvelteFlowProvider>
    <SvelteFlow
      {nodes}
      {edges}
      {nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={2}
      connectionLineType={ConnectionLineType.SmoothStep}
      defaultEdgeOptions={{
        type: 'smoothstep',
        animated: false
      }}
     onnodeclick={handleNodeClick}
    >
      <Background variant={BackgroundVariant.Dots} />
      <Controls />
      <MiniMap 
        style="background: rgb(243, 244, 246); border: 1px solid rgb(209, 213, 219);"
        nodeColor={(node) => node.data?.color || '#6b7280'}
      />
      
      <!-- Legend Panel -->
      <Panel position="top-left" class="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 m-2">
        <div class="text-xs font-semibold mb-2">Module Types</div>
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded" style="background-color: {nodeColors.root}"></div>
            <span class="text-xs">Root Module</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded" style="background-color: {nodeColors.direct}"></div>
            <span class="text-xs">Direct Dependency</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded" style="background-color: {nodeColors.transitive}"></div>
            <span class="text-xs">Transitive Dependency</span>
          </div>
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded" style="background-color: {nodeColors.dev}"></div>
            <span class="text-xs">Dev Dependency</span>
          </div>
        </div>
      </Panel>

      <!-- Stats Panel -->
      {#if moduleGraph?.statistics}
        <Panel position="top-right" class="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-3 m-2">
          <div class="text-xs font-semibold mb-2">Statistics</div>
          <div class="space-y-1 text-xs">
            <div>Total Modules: <span class="font-semibold">{moduleGraph.statistics.totalModules}</span></div>
            <div>Direct Deps: <span class="font-semibold">{moduleGraph.statistics.directDependencies}</span></div>
            <div>Indirect Deps: <span class="font-semibold">{moduleGraph.statistics.indirectDependencies}</span></div>
          </div>
        </Panel>
      {/if}
    </SvelteFlow>
  </SvelteFlowProvider>
</div>

<style>
  :global(.svelte-flow) {
    background-color: #f9fafb;
  }
  
  :global(.svelte-flow__node) {
    cursor: pointer;
  }
  
  :global(.svelte-flow__edge-path) {
    stroke-linecap: round;
  }
</style>

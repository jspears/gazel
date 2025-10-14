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
    Target,        // For build targets
    FileCode,      // For source files
    FileText,      // For header files
    Package,       // For libraries
    TestTube,      // For test targets
    Binary,        // For binary targets
    Cog,           // For genrule
    FolderOpen,    // For filegroup
    FileType,      // For proto files
    Box            // For default/unknown
  } from 'lucide-svelte';

  export let xmlData: string = '';
  export let filter: string = '';
  export let layoutDirection: 'DOWN' | 'RIGHT' = 'DOWN';

  const nodes = writable<Node[]>([]);
  const edges = writable<Edge[]>([]);

  const nodeTypes = {
    custom: CustomNode
  };

  const elk = new ELK();

  // ELK layout options
  const elkOptions = {
    'elk.algorithm': 'layered',
    'elk.layered.spacing.nodeNodeBetweenLayers': '100',
    'elk.spacing.nodeNode': '80',
    'elk.layered.considerModelOrder': 'NODES_AND_EDGES',
    'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
    'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX'
  };

  // Icon mapping for different rule types
  const iconMap = {
    // C++ rules
    cc_library: Package,
    cc_binary: Binary,
    cc_test: TestTube,
    
    // Java rules
    java_library: Package,
    java_binary: Binary,
    java_test: TestTube,
    
    // Python rules
    py_library: Package,
    py_binary: Binary,
    py_test: TestTube,
    
    // Proto rules
    proto_library: FileType,
    
    // General rules
    genrule: Cog,
    filegroup: FolderOpen,
    
    // File types
    source_file: FileCode,
    header_file: FileText,
    target: Target,
    
    // Default
    default: Box
  };

  // Color scheme for different node types
  const nodeColors = {
    cc_library: '#3b82f6',      // Blue
    cc_binary: '#10b981',       // Green
    cc_test: '#f59e0b',         // Orange
    java_library: '#8b5cf6',    // Purple
    java_binary: '#ec4899',     // Pink
    java_test: '#f97316',       // Orange
    py_library: '#06b6d4',      // Cyan
    py_binary: '#84cc16',       // Lime
    py_test: '#eab308',         // Yellow
    proto_library: '#6366f1',   // Indigo
    filegroup: '#94a3b8',       // Gray
    genrule: '#e11d48',         // Red
    source_file: '#22c55e',     // Green
    header_file: '#3b82f6',     // Blue
    output: '#f59e0b',          // Orange
    file: '#6b7280',            // Gray
    target: '#8b5cf6',          // Purple
    default: '#6b7280'          // Gray
  };

  // Custom node component with icon
  function createNodeData(label: string, type: string, fullName: string, location?: string) {
    const Icon = iconMap[type] || iconMap.default;
    const color = nodeColors[type] || nodeColors.default;
    
    return {
      label,
      icon: Icon,
      color,
      type,
      fullName,
      location
    };
  }

  async function parseAndLayoutXml(xml: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    
    const rules = doc.querySelectorAll('rule');
    const nodeMap = new Map<string, any>();
    const edgeList: any[] = [];
    
    // Process rules
    rules.forEach((rule) => {
      const name = rule.getAttribute('name') || '';
      const ruleClass = rule.getAttribute('class') || '';
      const location = rule.getAttribute('location') || '';
      
      if (!filter || name.toLowerCase().includes(filter.toLowerCase())) {
        const nodeId = name;
        const label = name.split(':').pop() || name;
        
        nodeMap.set(nodeId, {
          id: nodeId,
          data: createNodeData(label, ruleClass, name, location),
          type: 'custom',
          width: 180,
          height: 60
        });
        
        // Process deps list
        const depsList = rule.querySelector('list[name="deps"]');
        if (depsList) {
          depsList.querySelectorAll('label').forEach(label => {
            const depName = label.getAttribute('value');
            if (depName && (!filter || depName.toLowerCase().includes(filter.toLowerCase()))) {
              if (!nodeMap.has(depName)) {
                const depLabel = depName.split(':').pop() || depName;
                nodeMap.set(depName, {
                  id: depName,
                  data: createNodeData(depLabel, 'target', depName),
                  type: 'custom',
                  width: 150,
                  height: 50
                });
              }
              
              edgeList.push({
                id: `${depName}->${name}-deps`,
                source: depName,
                target: name,
                type: 'smoothstep',
                animated: false,
                style: {
                  stroke: '#3b82f6',
                  strokeWidth: 2
                },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: '#3b82f6'
                }
              });
            }
          });
        }
        
        // Process srcs list
        const srcsList = rule.querySelector('list[name="srcs"]');
        if (srcsList) {
          srcsList.querySelectorAll('label').forEach(label => {
            const srcName = label.getAttribute('value');
            if (srcName && (!filter || srcName.toLowerCase().includes(filter.toLowerCase()))) {
              if (!nodeMap.has(srcName)) {
                const srcLabel = srcName.split(':').pop() || srcName;
                const fileType = srcName.endsWith('.cc') || srcName.endsWith('.cpp') ? 'source_file' : 'file';
                nodeMap.set(srcName, {
                  id: srcName,
                  data: createNodeData(srcLabel, fileType, srcName),
                  type: 'custom',
                  width: 120,
                  height: 40
                });
              }
              
              edgeList.push({
                id: `${srcName}->${name}-srcs`,
                source: srcName,
                target: name,
                type: 'smoothstep',
                animated: false,
                style: {
                  stroke: '#22c55e',
                  strokeWidth: 1.5,
                  strokeDasharray: '5,5'
                },
                markerEnd: {
                  type: MarkerType.Arrow,
                  color: '#22c55e'
                }
              });
            }
          });
        }
        
        // Process hdrs list
        const hdrsList = rule.querySelector('list[name="hdrs"]');
        if (hdrsList) {
          hdrsList.querySelectorAll('label').forEach(label => {
            const hdrName = label.getAttribute('value');
            if (hdrName && (!filter || hdrName.toLowerCase().includes(filter.toLowerCase()))) {
              if (!nodeMap.has(hdrName)) {
                const hdrLabel = hdrName.split(':').pop() || hdrName;
                nodeMap.set(hdrName, {
                  id: hdrName,
                  data: createNodeData(hdrLabel, 'header_file', hdrName),
                  type: 'custom',
                  width: 120,
                  height: 40
                });
              }
              
              edgeList.push({
                id: `${hdrName}->${name}-hdrs`,
                source: hdrName,
                target: name,
                type: 'smoothstep',
                animated: false,
                style: {
                  stroke: '#06b6d4',
                  strokeWidth: 1.5,
                  strokeDasharray: '3,3'
                },
                markerEnd: {
                  type: MarkerType.Arrow,
                  color: '#06b6d4'
                }
              });
            }
          });
        }
      }
    });
    
    // Apply ELK layout
    await applyElkLayout(Array.from(nodeMap.values()), edgeList);
  }

  async function applyElkLayout(nodeList: any[], edgeList: any[]) {
    const isHorizontal = layoutDirection === 'RIGHT';
    const opts = { 
      'elk.direction': layoutDirection,
      ...elkOptions 
    };
    
    const graph = {
      id: 'root',
      layoutOptions: opts,
      children: nodeList.map(node => ({
        ...node,
        targetPosition: isHorizontal ? Position.Left : Position.Top,
        sourcePosition: isHorizontal ? Position.Right : Position.Bottom
      })),
      edges: edgeList
    };
    
    try {
      const layoutedGraph = await elk.layout(graph);
      
      const layoutedNodes = layoutedGraph.children?.map(node => ({
        ...node,
        position: { x: node.x || 0, y: node.y || 0 }
      })) || [];
      
      nodes.set(layoutedNodes);
      edges.set(layoutedGraph.edges || []);
    } catch (error) {
      console.error('ELK layout error:', error);
    }
  }

  onMount(() => {
    if (xmlData) {
      parseAndLayoutXml(xmlData);
    }
  });

  $: if (xmlData) {
    parseAndLayoutXml(xmlData);
  }
  
  $: if (layoutDirection) {
    parseAndLayoutXml(xmlData);
  }
</script>

<div class="w-full h-full" style="height: 600px;">
  <SvelteFlowProvider>
    <SvelteFlow
      {nodes}
      {edges}
      {nodeTypes}
      fitView
      connectionLineType={ConnectionLineType.SmoothStep}
      defaultEdgeOptions={{ type: 'smoothstep', animated: false }}
    >
      <Panel position="top-left">
        <div class="flex gap-2">
          <button
           onclick={() => layoutDirection = 'DOWN'}
            class="px-3 py-1 text-sm border rounded-md hover:bg-muted {layoutDirection === 'DOWN' ? 'bg-primary text-primary-foreground' : ''}"
          >
            Vertical
          </button>
          <button
           onclick={() => layoutDirection = 'RIGHT'}
            class="px-3 py-1 text-sm border rounded-md hover:bg-muted {layoutDirection === 'RIGHT' ? 'bg-primary text-primary-foreground' : ''}"
          >
            Horizontal
          </button>
        </div>
      </Panel>
      <Background variant={BackgroundVariant.Dots} />
      <Controls />
      <MiniMap />
    </SvelteFlow>
  </SvelteFlowProvider>
</div>

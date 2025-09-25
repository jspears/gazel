<script lang="ts">
  import { onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { 
    SvelteFlow, 
    Background, 
    Controls, 
    MiniMap,
    type Node,
    type Edge,
    MarkerType,
    BackgroundVariant
  } from '@xyflow/svelte';
  import '@xyflow/svelte/dist/style.css';

  export let xmlData: string = '';
  export let filter: string = '';

  const nodes = writable<Node[]>([]);
  const edges = writable<Edge[]>([]);

  // Color scheme for different node types
  const nodeColors = {
    // Rule types
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
    
    // File types
    source_file: '#22c55e',     // Green
    header_file: '#3b82f6',     // Blue
    output: '#f59e0b',          // Orange
    file: '#6b7280',            // Gray
    target: '#8b5cf6',          // Purple
    
    // Default
    default: '#6b7280'          // Gray
  };

  // Edge styles for different dependency types
  const edgeStyles = {
    deps: { 
      stroke: '#3b82f6', 
      strokeWidth: 2,
      animated: false,
      label: 'depends on'
    },
    srcs: { 
      stroke: '#22c55e', 
      strokeWidth: 1.5,
      strokeDasharray: '5,5',
      label: 'source'
    },
    hdrs: { 
      stroke: '#06b6d4', 
      strokeWidth: 1.5,
      strokeDasharray: '3,3',
      label: 'header'
    },
    input: { 
      stroke: '#6b7280', 
      strokeWidth: 1,
      label: 'input'
    },
    output: { 
      stroke: '#f59e0b', 
      strokeWidth: 2,
      animated: true,
      label: 'produces'
    }
  };

  async function parseEnhancedXml(xml: string) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');
    
    const rules = doc.querySelectorAll('rule');
    const nodeMap = new Map<string, Node>();
    const edgeList: Edge[] = [];
    
    // Process rules
    rules.forEach((rule) => {
      const name = rule.getAttribute('name') || '';
      const ruleClass = rule.getAttribute('class') || '';
      const location = rule.getAttribute('location') || '';
      
      if (!filter || name.toLowerCase().includes(filter.toLowerCase())) {
        // Create rule node
        const nodeId = name;
        const label = name.split(':').pop() || name;
        
        nodeMap.set(nodeId, {
          id: nodeId,
          data: { 
            label,
            class: ruleClass,
            location,
            type: 'rule'
          },
          position: { x: 0, y: 0 },
          style: {
            background: nodeColors[ruleClass] || nodeColors.default,
            color: 'white',
            border: '1px solid #374151',
            borderRadius: '8px',
            fontSize: '12px',
            padding: '10px',
            width: 150,
            minHeight: 40
          }
        });
        
        // Process deps list
        const depsList = rule.querySelector('list[name="deps"]');
        if (depsList) {
          depsList.querySelectorAll('label').forEach(label => {
            const depName = label.getAttribute('value');
            if (depName && (!filter || depName.toLowerCase().includes(filter.toLowerCase()))) {
              // Create dep node if it doesn't exist
              if (!nodeMap.has(depName)) {
                const depLabel = depName.split(':').pop() || depName;
                nodeMap.set(depName, {
                  id: depName,
                  data: { 
                    label: depLabel,
                    type: 'target'
                  },
                  position: { x: 0, y: 0 },
                  style: {
                    background: nodeColors.target,
                    color: 'white',
                    border: '1px solid #374151',
                    borderRadius: '4px',
                    fontSize: '11px',
                    padding: '8px',
                    width: 120,
                    minHeight: 35
                  }
                });
              }
              
              // Create edge
              edgeList.push({
                id: `${depName}->${name}-deps`,
                source: depName,
                target: name,
                type: 'smoothstep',
                animated: edgeStyles.deps.animated,
                style: {
                  stroke: edgeStyles.deps.stroke,
                  strokeWidth: edgeStyles.deps.strokeWidth
                },
                markerEnd: {
                  type: MarkerType.ArrowClosed,
                  color: edgeStyles.deps.stroke
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
              // Create source file node
              if (!nodeMap.has(srcName)) {
                const srcLabel = srcName.split(':').pop() || srcName;
                nodeMap.set(srcName, {
                  id: srcName,
                  data: { 
                    label: srcLabel,
                    type: 'source'
                  },
                  position: { x: 0, y: 0 },
                  style: {
                    background: nodeColors.source_file,
                    color: 'white',
                    border: '1px solid #374151',
                    borderRadius: '20px',
                    fontSize: '10px',
                    padding: '6px 12px',
                    width: 100,
                    minHeight: 30
                  }
                });
              }
              
              // Create edge
              edgeList.push({
                id: `${srcName}->${name}-srcs`,
                source: srcName,
                target: name,
                type: 'smoothstep',
                animated: false,
                style: {
                  stroke: edgeStyles.srcs.stroke,
                  strokeWidth: edgeStyles.srcs.strokeWidth,
                  strokeDasharray: edgeStyles.srcs.strokeDasharray
                },
                markerEnd: {
                  type: MarkerType.Arrow,
                  color: edgeStyles.srcs.stroke
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
              // Create header file node
              if (!nodeMap.has(hdrName)) {
                const hdrLabel = hdrName.split(':').pop() || hdrName;
                nodeMap.set(hdrName, {
                  id: hdrName,
                  data: { 
                    label: hdrLabel,
                    type: 'header'
                  },
                  position: { x: 0, y: 0 },
                  style: {
                    background: nodeColors.header_file,
                    color: 'white',
                    border: '1px solid #374151',
                    borderRadius: '20px',
                    fontSize: '10px',
                    padding: '6px 12px',
                    width: 100,
                    minHeight: 30
                  }
                });
              }
              
              // Create edge
              edgeList.push({
                id: `${hdrName}->${name}-hdrs`,
                source: hdrName,
                target: name,
                type: 'smoothstep',
                animated: false,
                style: {
                  stroke: edgeStyles.hdrs.stroke,
                  strokeWidth: edgeStyles.hdrs.strokeWidth,
                  strokeDasharray: edgeStyles.hdrs.strokeDasharray
                },
                markerEnd: {
                  type: MarkerType.Arrow,
                  color: edgeStyles.hdrs.stroke
                }
              });
            }
          });
        }
      }
    });
    
    // Apply hierarchical layout
    const nodeArray = Array.from(nodeMap.values());
    applyHierarchicalLayout(nodeArray, edgeList);
    
    nodes.set(nodeArray);
    edges.set(edgeList);
  }

  function applyHierarchicalLayout(nodeList: Node[], edgeList: Edge[]) {
    // Create adjacency list
    const graph = new Map<string, string[]>();
    const reverseGraph = new Map<string, string[]>();
    
    edgeList.forEach(edge => {
      if (!graph.has(edge.source)) graph.set(edge.source, []);
      if (!reverseGraph.has(edge.target)) reverseGraph.set(edge.target, []);
      graph.get(edge.source)!.push(edge.target);
      reverseGraph.get(edge.target)!.push(edge.source);
    });
    
    // Find root nodes (nodes with no incoming edges)
    const roots = nodeList.filter(node => !reverseGraph.has(node.id));
    
    // BFS to assign levels
    const levels = new Map<string, number>();
    const queue = roots.map(r => ({ id: r.id, level: 0 }));
    
    while (queue.length > 0) {
      const { id, level } = queue.shift()!;
      
      if (!levels.has(id)) {
        levels.set(id, level);
        
        const children = graph.get(id) || [];
        children.forEach(child => {
          queue.push({ id: child, level: level + 1 });
        });
      }
    }
    
    // Group nodes by level
    const levelGroups = new Map<number, Node[]>();
    nodeList.forEach(node => {
      const level = levels.get(node.id) || 0;
      if (!levelGroups.has(level)) levelGroups.set(level, []);
      levelGroups.get(level)!.push(node);
    });
    
    // Position nodes
    const horizontalSpacing = 200;
    const verticalSpacing = 150;
    
    levelGroups.forEach((nodesInLevel, level) => {
      const totalWidth = nodesInLevel.length * horizontalSpacing;
      const startX = -totalWidth / 2;
      
      nodesInLevel.forEach((node, index) => {
        node.position = {
          x: startX + index * horizontalSpacing,
          y: level * verticalSpacing
        };
      });
    });
  }

  onMount(() => {
    if (xmlData) {
      parseEnhancedXml(xmlData);
    }
  });

  $: if (xmlData) {
    parseEnhancedXml(xmlData);
  }
</script>

<div class="w-full h-full" style="height: 600px;">
  <SvelteFlow {nodes} {edges} fitView>
    <Background variant={BackgroundVariant.Dots} />
    <Controls />
    <MiniMap />
  </SvelteFlow>
</div>

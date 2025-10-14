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
  import { parseXmlString } from '../lib/utils/xmlParser.js';
  
  export let xmlData: string = '';
  export let targetFilter: string = '';
  
  // Stores for nodes and edges
  const nodes = writable<Node[]>([]);
  const edges = writable<Edge[]>([]);
  
  // Layout configuration
  const nodeWidth = 200;
  const nodeHeight = 50;
  const horizontalSpacing = 250;
  const verticalSpacing = 100;
  
  interface BazelRule {
    name: string;
    class?: string;
    location?: string;
    deps?: string[];
    srcs?: string[];
  }
  
  interface ParsedXml {
    query?: {
      rule?: BazelRule | BazelRule[];
      sourcefile?: any;
      generatedfile?: any;
    };
  }
  
  // Parse XML and create graph data
  async function parseAndCreateGraph(xml: string) {
    if (!xml) return;
    
    try {
      const parsed = await parseXmlString(xml) as ParsedXml;
      
      if (!parsed.query) {
        console.warn('No query element found in XML');
        return;
      }
      
      const rules = Array.isArray(parsed.query.rule) 
        ? parsed.query.rule 
        : parsed.query.rule 
        ? [parsed.query.rule]
        : [];
      
      const nodeMap = new Map<string, Node>();
      const edgeList: Edge[] = [];
      const levelMap = new Map<string, number>();
      
      // First pass: create nodes
      rules.forEach((rule, index) => {
        if (!rule.name) return;
        
        const nodeId = rule.name;
        
        // Apply filter if specified
        if (targetFilter && !nodeId.includes(targetFilter)) {
          return;
        }
        
        nodeMap.set(nodeId, {
          id: nodeId,
          data: { 
            label: formatLabel(rule.name),
            fullName: rule.name,
            ruleClass: rule.class || 'unknown',
            location: rule.location || ''
          },
          position: { x: 0, y: 0 }, // Will be calculated later
          type: 'default',
          style: {
            background: getNodeColor(rule.class),
            color: '#fff',
            border: '1px solid #222',
            borderRadius: '8px',
            fontSize: '12px',
            padding: '10px',
            cursor: 'pointer'
          }
        });
      });
      
      // Second pass: create edges and determine dependencies
      rules.forEach(rule => {
        if (!rule.name || !nodeMap.has(rule.name)) return;
        
        // Extract dependencies
        const deps = extractDependencies(rule);
        
        deps.forEach(dep => {
          // Only create edge if both nodes exist (respecting filter)
          if (nodeMap.has(dep)) {
            const edgeId = `${rule.name}->${dep}`;
            edgeList.push({
              id: edgeId,
              source: rule.name,
              target: dep,
              type: 'smoothstep',
              animated: false,
              markerEnd: {
                type: MarkerType.ArrowClosed,
                width: 20,
                height: 20
              },
              style: {
                stroke: '#888',
                strokeWidth: 2
              }
            });
          }
        });
      });
      
      // Calculate node positions using hierarchical layout
      const positioned = calculateHierarchicalLayout(nodeMap, edgeList);
      
      // Update stores
      nodes.set(Array.from(positioned.values()));
      edges.set(edgeList);
      
    } catch (error) {
      console.error('Failed to parse XML:', error);
    }
  }
  
  // Extract dependencies from a rule
  function extractDependencies(rule: any): string[] {
    const deps: string[] = [];
    
    // Check for deps attribute
    if (rule.list) {
      const lists = Array.isArray(rule.list) ? rule.list : [rule.list];
      lists.forEach((list: any) => {
        if (list.name === 'deps' && list.label) {
          const labels = Array.isArray(list.label) ? list.label : [list.label];
          labels.forEach((label: any) => {
            const value = label.value || label;
            if (typeof value === 'string') {
              deps.push(value);
            }
          });
        }
      });
    }
    
    // Check for srcs that might be other targets
    if (rule.list) {
      const lists = Array.isArray(rule.list) ? rule.list : [rule.list];
      lists.forEach((list: any) => {
        if (list.name === 'srcs' && list.label) {
          const labels = Array.isArray(list.label) ? list.label : [list.label];
          labels.forEach((label: any) => {
            const value = label.value || label;
            if (typeof value === 'string' && value.startsWith('//')) {
              deps.push(value);
            }
          });
        }
      });
    }
    
    return deps;
  }
  
  // Calculate hierarchical layout for nodes
  function calculateHierarchicalLayout(
    nodeMap: Map<string, Node>, 
    edges: Edge[]
  ): Map<string, Node> {
    const levels = new Map<string, number>();
    const visited = new Set<string>();
    
    // Build adjacency list
    const graph = new Map<string, string[]>();
    const reverseGraph = new Map<string, string[]>();
    
    nodeMap.forEach((_, nodeId) => {
      graph.set(nodeId, []);
      reverseGraph.set(nodeId, []);
    });
    
    edges.forEach(edge => {
      graph.get(edge.source)?.push(edge.target);
      reverseGraph.get(edge.target)?.push(edge.source);
    });
    
    // Find root nodes (nodes with no incoming edges)
    const roots: string[] = [];
    nodeMap.forEach((_, nodeId) => {
      if (!reverseGraph.get(nodeId)?.length) {
        roots.push(nodeId);
        levels.set(nodeId, 0);
      }
    });
    
    // BFS to assign levels
    const queue = [...roots];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentLevel = levels.get(current) || 0;
      
      graph.get(current)?.forEach(child => {
        const childLevel = levels.get(child);
        if (childLevel === undefined || childLevel < currentLevel + 1) {
          levels.set(child, currentLevel + 1);
          if (!queue.includes(child)) {
            queue.push(child);
          }
        }
      });
    }
    
    // Group nodes by level
    const levelGroups = new Map<number, string[]>();
    levels.forEach((level, nodeId) => {
      if (!levelGroups.has(level)) {
        levelGroups.set(level, []);
      }
      levelGroups.get(level)?.push(nodeId);
    });
    
    // Position nodes
    levelGroups.forEach((nodesInLevel, level) => {
      nodesInLevel.forEach((nodeId, index) => {
        const node = nodeMap.get(nodeId);
        if (node) {
          node.position = {
            x: index * horizontalSpacing,
            y: level * verticalSpacing
          };
        }
      });
    });
    
    return nodeMap;
  }
  
  // Format label for display
  function formatLabel(fullName: string): string {
    // Remove leading // and package path for brevity
    const parts = fullName.split(':');
    if (parts.length > 1) {
      return parts[parts.length - 1];
    }
    return fullName.replace(/^\/\//, '');
  }
  
  // Get node color based on rule class
  function getNodeColor(ruleClass?: string): string {
    if (!ruleClass) return '#6b7280';
    
    const colorMap: Record<string, string> = {
      'cc_library': '#3b82f6',
      'cc_binary': '#10b981',
      'cc_test': '#f59e0b',
      'java_library': '#8b5cf6',
      'java_binary': '#ec4899',
      'java_test': '#f97316',
      'py_library': '#06b6d4',
      'py_binary': '#84cc16',
      'py_test': '#eab308',
      'proto_library': '#6366f1',
      'filegroup': '#94a3b8',
      'genrule': '#e11d48'
    };
    
    return colorMap[ruleClass] || '#6b7280';
  }
  
  // Handle node click
  function handleNodeClick(event: CustomEvent) {
    const node = event.detail.node;
    if (node?.data?.fullName) {
      // Create a temporary link element to make it clickable
      const link = document.createElement('a');
      link.href = `#${node.data.fullName}`;
      link.target = '_blank';
      link.textContent = node.data.fullName;
      
      // Show node details in a tooltip or modal
      console.log('Node clicked:', node.data);
      
      // You could emit an event here for parent component to handle
      // dispatch('nodeClick', node.data);
    }
  }
  
  // React to XML data changes
  $: if (xmlData) {
    parseAndCreateGraph(xmlData);
  }
  
  onMount(() => {
    if (xmlData) {
      parseAndCreateGraph(xmlData);
    }
  });
</script>

<div class="w-full h-full" style="height: 600px;">
  <SvelteFlow 
    {nodes} 
    {edges}
    fitView
   onnodeclick={handleNodeClick}
  >
    <Background variant={BackgroundVariant.Dots} />
    <Controls />
    <MiniMap />
  </SvelteFlow>
</div>

<style>
  :global(.svelte-flow__node) {
    font-family: 'Monaco', 'Menlo', monospace;
  }
  
  :global(.svelte-flow__edge-path) {
    stroke-width: 2;
  }
</style>

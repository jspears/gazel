import { parseEnhancedXmlToJson } from './enhancedXmlParser.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function testEnhancedParser() {
  console.log('Testing Enhanced XML Parser with samples/graph-deps.xml\n');
  console.log('='.repeat(60));
  
  try {
    // Read the sample XML file
    const xmlPath = join(__dirname, '..', '..', 'samples', 'graph-deps.xml');
    const xmlContent = readFileSync(xmlPath, 'utf-8');
    
    // Parse with enhanced parser
    const result = await parseEnhancedXmlToJson(xmlContent);
    
    console.log('\n📦 PARSED RULES:');
    console.log('='.repeat(60));
    
    result.rules.forEach((rule, index) => {
      console.log(`\n${index + 1}. ${rule.name} (${rule.class})`);
      console.log(`   Location: ${rule.location || 'N/A'}`);
      
      if (rule.deps && rule.deps.length > 0) {
        console.log(`   Dependencies (${rule.deps.length}):`);
        rule.deps.forEach(dep => console.log(`     → ${dep}`));
      }
      
      if (rule.srcs && rule.srcs.length > 0) {
        console.log(`   Sources (${rule.srcs.length}):`);
        rule.srcs.forEach(src => console.log(`     • ${src}`));
      }
      
      if (rule.hdrs && rule.hdrs.length > 0) {
        console.log(`   Headers (${rule.hdrs.length}):`);
        rule.hdrs.forEach(hdr => console.log(`     • ${hdr}`));
      }
      
      if (rule.inputs && rule.inputs.length > 0) {
        const filteredInputs = rule.inputs.filter(
          input => !input.startsWith('@bazel_tools') && !input.startsWith('@@platforms')
        );
        if (filteredInputs.length > 0) {
          console.log(`   Inputs (${filteredInputs.length} of ${rule.inputs.length} total):`);
          filteredInputs.forEach(input => console.log(`     ← ${input}`));
        }
      }
      
      if (rule.outputs && rule.outputs.length > 0) {
        console.log(`   Outputs (${rule.outputs.length}):`);
        rule.outputs.forEach(output => console.log(`     ⇒ ${output}`));
      }
      
      if (rule.attributes && Object.keys(rule.attributes).length > 0) {
        console.log(`   Attributes:`);
        Object.entries(rule.attributes).forEach(([key, value]) => {
          if (typeof value === 'string') {
            console.log(`     ${key}: "${value}"`);
          }
        });
      }
    });
    
    console.log('\n\n🔗 DEPENDENCY EDGES:');
    console.log('='.repeat(60));
    
    // Group edges by type
    const edgesByType = result.edges.reduce((acc, edge) => {
      if (!acc[edge.type]) acc[edge.type] = [];
      acc[edge.type].push(edge);
      return acc;
    }, {} as Record<string, typeof result.edges>);
    
    Object.entries(edgesByType).forEach(([type, edges]) => {
      console.log(`\n${type.toUpperCase()} edges (${edges.length}):`);
      edges.forEach(edge => {
        const arrow = type === 'output' ? '→' : '←';
        console.log(`  ${edge.source} ${arrow} ${edge.target}`);
      });
    });
    
    console.log('\n\n📊 SUMMARY:');
    console.log('='.repeat(60));
    console.log(`Total rules: ${result.rules.length}`);
    console.log(`Total edges: ${result.edges.length}`);
    
    // Count edges by type
    Object.entries(edgesByType).forEach(([type, edges]) => {
      console.log(`  - ${type}: ${edges.length}`);
    });
    
    // Create a dependency graph visualization data
    console.log('\n\n🎨 GRAPH VISUALIZATION DATA:');
    console.log('='.repeat(60));
    
    // Create nodes for visualization
    const nodes = new Map<string, { id: string; label: string; type: string }>();
    
    // Add rule nodes
    result.rules.forEach(rule => {
      nodes.set(rule.name, {
        id: rule.name,
        label: rule.name.split(':').pop() || rule.name,
        type: rule.class
      });
    });
    
    // Add file nodes from edges
    result.edges.forEach(edge => {
      if (!nodes.has(edge.source) && !edge.source.startsWith('@')) {
        nodes.set(edge.source, {
          id: edge.source,
          label: edge.source.split(':').pop() || edge.source,
          type: edge.source.endsWith('.cc') ? 'source_file' : 
                edge.source.endsWith('.h') ? 'header_file' : 
                edge.source.includes('//') ? 'target' : 'file'
        });
      }
      if (!nodes.has(edge.target) && !edge.target.startsWith('@')) {
        nodes.set(edge.target, {
          id: edge.target,
          label: edge.target.split(':').pop() || edge.target,
          type: edge.target.endsWith('.stripped') || edge.target.endsWith('.dwp') ? 'output' : 'target'
        });
      }
    });
    
    console.log(`\nNodes (${nodes.size}):`);
    const nodesByType = Array.from(nodes.values()).reduce((acc, node) => {
      if (!acc[node.type]) acc[node.type] = [];
      acc[node.type].push(node);
      return acc;
    }, {} as Record<string, any[]>);
    
    Object.entries(nodesByType).forEach(([type, typeNodes]) => {
      console.log(`  ${type}: ${typeNodes.length}`);
      typeNodes.forEach(node => console.log(`    - ${node.label}`));
    });
    
    // Filter meaningful edges for visualization
    const visualEdges = result.edges.filter(edge => 
      !edge.source.startsWith('@') && 
      !edge.target.startsWith('@') &&
      (edge.type === 'deps' || edge.type === 'input' || edge.type === 'output')
    );
    
    console.log(`\nFiltered edges for visualization: ${visualEdges.length}`);
    
  } catch (error) {
    console.error('Error testing enhanced parser:', error);
  }
}

// Run the test
testEnhancedParser();

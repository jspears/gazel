/**
 * Example: Query and graph operations with bzl-ts
 */

import { BazelClient } from '../src/index.js';

async function main() {
  const bazel = new BazelClient({
    workspace: process.env.BAZEL_WORKSPACE || process.cwd()
  });

  console.log('Starting query and graph example...\n');

  try {
    // Basic query
    console.log('1. Finding all test targets:');
    const tests = await bazel.query('kind("test", //...)');
    console.log('   Found tests:', tests);
    console.log();

    // Query dependencies
    console.log('2. Finding dependencies of //app:main:');
    const deps = await bazel.query('deps(//app:main)');
    console.log(`   Found ${deps.length} dependencies`);
    console.log('   First 5:', deps.slice(0, 5));
    console.log();

    // Reverse dependencies - using a target that exists in Gazel
    console.log('3. Finding targets that depend on //server:server_ts:');
    const rdeps = await bazel.query('rdeps(//..., //server:server_ts)');
    console.log(`   Found ${rdeps.length} reverse dependencies`);
    console.log();

    // Configured query (cquery) - using default config
    console.log('4. Running configured query:');
    const configured = await bazel.cquery('//app:main', {
      output: 'proto'
    });
    console.log('   Configured target info:', typeof configured === 'string' ?
      configured.substring(0, 200) + '...' : configured);
    console.log();

    // Action query (aquery)
    console.log('5. Analyzing actions for //app:main:');
    const actions = await bazel.aquery('//app:main', {
      includeCommandline: true,
      includeArtifacts: true
    });
    console.log('   Actions:', actions);
    console.log();

    // Get dependency graph
    console.log('6. Building dependency graph:');
    const graph = await bazel.getDependencyGraph('//app:main');
    console.log(`   Graph has ${graph.nodes.length} nodes and ${graph.edges.length} edges`);
    
    // Print first few nodes
    console.log('   Sample nodes:');
    graph.nodes.slice(0, 3).forEach(node => {
      console.log(`     - ${node.label} (${node.ruleClass || 'source'})`);
    });
    console.log();

    // Get action graph
    console.log('7. Building action graph:');
    const actionGraph = await bazel.getActionGraph('//app:main');
    console.log(`   Found ${actionGraph.actions.length} actions and ${actionGraph.artifacts.length} artifacts`);
    
    // Print action summary
    const mnemonics = new Map<string, number>();
    actionGraph.actions.forEach(action => {
      mnemonics.set(action.mnemonic, (mnemonics.get(action.mnemonic) || 0) + 1);
    });
    console.log('   Action types:');
    mnemonics.forEach((count, mnemonic) => {
      console.log(`     - ${mnemonic}: ${count}`);
    });
    console.log();

    // Query builder example - using TypeScript targets which exist in Gazel
    console.log('8. Using query builder:');
    const tsProjects = await bazel.queryBuilder()
      .kind('ts_project')
      .deps('//app:main')
      .except('//node_modules/...')
      .execute();
    console.log(`   Found ${tsProjects.length} TypeScript projects`);
    console.log();

    // Complex query
    console.log('9. Complex query - finding all binaries and their direct deps:');
    const binaries = await bazel.query('kind(".*_binary", //...)');
    for (const binary of binaries.slice(0, 3)) {
      const directDeps = await bazel.query(`deps(${binary}, 1)`);
      console.log(`   ${binary}: ${directDeps.length} direct deps`);
    }

  } catch (error) {
    console.error('Query failed:', error);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);

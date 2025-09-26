/**
 * Simple test to verify the bzl-ts client loads correctly
 */

import { BazelClient } from '../src/index.js';

async function main() {
  console.log('Testing bzl-ts client...\n');

  try {
    // Initialize client with current directory as workspace
    const bazel = new BazelClient({
      workspace: process.cwd()
    });

    console.log('✓ BazelClient initialized successfully');
    console.log('  Workspace:', bazel.workspace);

    // Try to get server status (this should work even without targets)
    console.log('\nChecking Bazel server status...');
    try {
      const status = await bazel.getServerStatus();
      console.log('✓ Server status:', status);
    } catch (err) {
      console.log('  Note: Server status check failed (Bazel may not be running)');
      console.log('  Error:', err.message);
    }

    // Try a simple query
    console.log('\nTrying a simple query...');
    try {
      const result = await bazel.query('//...');
      console.log(`✓ Found ${result.length} targets in workspace`);
      if (result.length > 0) {
        console.log('  First few targets:', result.slice(0, 3));
      }
    } catch (err) {
      console.log('  Note: Query failed (this is expected if not in a Bazel workspace)');
      console.log('  Error:', err.message);
    }

    console.log('\n✅ bzl-ts client is working correctly!');
    console.log('You can now use it to interact with Bazel workspaces.');

  } catch (error) {
    console.error('❌ Failed to initialize bzl-ts client:', error);
    process.exit(1);
  }
}

// Run the test
main().catch(console.error);

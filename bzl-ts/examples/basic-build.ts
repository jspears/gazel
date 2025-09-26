/**
 * Example: Basic build operations with bzl-ts
 */

import { BazelClient } from '../src/index.js';

async function main() {
  // Initialize client
  const bazel = new BazelClient({
    workspace: process.env.BAZEL_WORKSPACE || process.cwd()
  });

  console.log('Starting basic build example...\n');

  try {
    // Simple build
    console.log('Building //app:main...');
    await bazel.build('//app:main', {
      config: 'release',
      jobs: 4
    });
    console.log('✓ Build completed successfully\n');

    // Build multiple targets
    console.log('Building multiple targets...');
    await bazel.build(['//app:main', '//app:test'], {
      keepGoing: true
    });
    console.log('✓ Multiple targets built\n');

    // Run tests
    console.log('Running tests...');
    const testResults = await bazel.test('//tests/...', {
      testOutput: 'errors',
      nocache: true
    });
    console.log('✓ Tests completed\n');

    // Run a binary
    console.log('Running binary...');
    await bazel.run('//app:cli', ['--help']);
    console.log('✓ Binary executed\n');

    // Clean build outputs
    console.log('Cleaning build outputs...');
    await bazel.clean();
    console.log('✓ Clean completed\n');

  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);

/**
 * Example: Build event streaming with bzl-ts
 */

import { BazelClient, BuildStream } from '../src/index.js';

async function main() {
  const bazel = new BazelClient({
    workspace: process.env.BAZEL_WORKSPACE || process.cwd()
  });

  console.log('Starting build event streaming example...\n');

  // Create build stream
  const stream: BuildStream = bazel.buildStream('//app:main', {
    config: 'debug',
    verbose: true
  });

  // Track build progress
  let targetsCompleted = 0;
  let testsRun = 0;

  // Subscribe to events
  stream.on('started', (event) => {
    console.log('🚀 Build started:', {
      uuid: event.started?.uuid,
      command: event.started?.command
    });
  });

  stream.on('progress', (event) => {
    if (event.message) {
      console.log('📊 Progress:', event.message);
    }
  });

  stream.on('targetComplete', (event) => {
    targetsCompleted++;
    const status = event.success ? '✅' : '❌';
    console.log(`${status} Target completed: ${event.label}`);
    
    if (event.outputs && event.outputs.length > 0) {
      console.log('   Outputs:', event.outputs);
    }
  });

  stream.on('testResult', (event) => {
    testsRun++;
    const statusEmoji = {
      'PASSED': '✅',
      'FAILED': '❌',
      'TIMEOUT': '⏱️',
      'INCOMPLETE': '⚠️',
      'REMOTE_FAILURE': '🌐',
      'FAILED_TO_BUILD': '🔨',
      'TOOL_HALTED_BEFORE_TESTING': '🛑'
    };
    
    const emoji = statusEmoji[event.status as keyof typeof statusEmoji] || '❓';
    console.log(`${emoji} Test ${event.label}: ${event.status}${event.cached ? ' (cached)' : ''}`);
  });

  stream.on('finished', (event) => {
    console.log('\n🏁 Build finished:', {
      success: event.success,
      exitCode: event.exitCode,
      targetsCompleted,
      testsRun
    });
  });

  // Handle raw build events for detailed analysis
  stream.on('buildEvent', (event) => {
    // You can process raw build events here
    // This gives you access to all event types and fields
    if (event.id?.actionCompleted) {
      // Track action execution
    }
  });

  // Handle errors
  stream.on('stderr', (data) => {
    console.error('stderr:', data);
  });

  try {
    // Start the build
    await stream.start();
    
    // Wait for completion
    await stream.wait();
    
    console.log('\n✨ Build completed successfully!');
  } catch (error) {
    console.error('\n💥 Build failed:', error);
    process.exit(1);
  }
}

// Run the example
main().catch(console.error);

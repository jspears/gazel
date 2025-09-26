/**
 * Command Server Example
 * Demonstrates direct communication with the Bazel daemon via the command server protocol
 */

import { BazelClient, CommandServer } from '../src/index.js';
import * as path from 'path';
import * as fs from 'fs/promises';

async function main() {
  console.log('Command Server Example\n');
  console.log('======================\n');

  const workspace = process.env.BAZEL_WORKSPACE || process.cwd();
  console.log(`Workspace: ${workspace}\n`);

  // Initialize the Bazel client
  const bazel = new BazelClient({
    workspace: workspace
  });

  try {
    // Note: The actual Bazel command server uses gRPC protocol over TCP
    // For this example, we'll demonstrate the concept using command execution
    console.log('Note: This example demonstrates the command server concept.');
    console.log('The actual Bazel command server uses gRPC over TCP (not Unix sockets).\n');

    // 1. Create a command server connection (simplified version)
    console.log('1. Creating Command Server connection...');
    const commandServer = new CommandServer(workspace);

    // For this demo, we'll use a simplified approach
    console.log('   Using simplified command execution approach');
    console.log('   (Real implementation would use gRPC protocol)\n');

    // 2. Get server info
    console.log('2. Getting server information...');
    const serverInfo = await commandServer.sendCommand('info');
    console.log('   Server info:');
    if (typeof serverInfo === 'string') {
      const lines = serverInfo.split('\n').slice(0, 5);
      lines.forEach(line => console.log(`     ${line}`));
      console.log('     ...\n');
    }

    // 3. Run a simple query via command server
    console.log('3. Running query via command server...');
    const queryResult = await commandServer.sendCommand('query', [
      '//...',
      '--output=label_kind',
      '--keep_going'
    ]);
    
    if (typeof queryResult === 'string') {
      const targets = queryResult.split('\n').filter(line => line.trim());
      console.log(`   Found ${targets.length} targets`);
      console.log('   First few targets:');
      targets.slice(0, 3).forEach(target => {
        console.log(`     ${target}`);
      });
      console.log();
    }

    // 4. Get build configuration
    console.log('4. Getting build configuration...');
    const configResult = await commandServer.sendCommand('config');
    console.log('   Configuration info received');
    if (typeof configResult === 'string') {
      const configLines = configResult.split('\n').slice(0, 3);
      configLines.forEach(line => console.log(`     ${line}`));
      console.log('     ...\n');
    }

    // 5. Check server PID
    console.log('5. Checking server PID...');
    const serverPid = await commandServer.sendCommand('info', ['server_pid']);
    console.log(`   Server PID: ${serverPid.trim()}\n`);

    // 6. Get workspace status
    console.log('6. Getting workspace status...');
    const statusResult = await commandServer.sendCommand('info', ['workspace']);
    console.log(`   Workspace: ${statusResult}\n`);

    // 7. Run a version check
    console.log('7. Checking Bazel version...');
    const versionResult = await commandServer.sendCommand('version');
    console.log('   Version info:');
    if (typeof versionResult === 'string') {
      const versionLines = versionResult.split('\n').filter(line => line.trim());
      versionLines.forEach(line => console.log(`     ${line}`));
      console.log();
    }

    // 8. Test command batching
    console.log('8. Testing command batching...');
    console.log('   Sending multiple commands in sequence...');
    
    const commands = [
      { cmd: 'info', args: ['release'] },
      { cmd: 'info', args: ['server_pid'] },
      { cmd: 'info', args: ['command_log'] }
    ];
    
    for (const { cmd, args } of commands) {
      const result = await commandServer.sendCommand(cmd, args);
      console.log(`     ${args?.[0] || cmd}: ${result}`);
    }
    console.log();

    // 9. Handle events from the command server
    console.log('9. Setting up event listeners...');
    
    commandServer.on('output', (data) => {
      console.log(`   [Output Event]: ${data}`);
    });
    
    commandServer.on('error', (error) => {
      console.log(`   [Error Event]: ${error.message}`);
    });
    
    commandServer.on('progress', (progress) => {
      console.log(`   [Progress Event]: ${JSON.stringify(progress)}`);
    });
    
    console.log('   Event listeners registered\n');

    // 10. Test error handling
    console.log('10. Testing error handling...');
    try {
      await commandServer.sendCommand('invalid_command');
    } catch (error) {
      console.log(`   ✅ Error caught as expected: ${error.message}\n`);
    }

    // 11. Get memory usage
    console.log('11. Getting memory usage...');
    const memoryInfo = await commandServer.sendCommand('info', ['used-heap-size-after-gc']);
    console.log(`   Heap usage: ${memoryInfo || 'N/A'}\n`);

    // 12. Clean shutdown
    console.log('12. Performing clean shutdown...');
    await commandServer.disconnect();
    console.log('   ✅ Disconnected from command server\n');

    // Additional examples using the BazelClient wrapper
    console.log('Additional Examples using BazelClient wrapper:');
    console.log('===============================================\n');

    // 13. Using the high-level API
    console.log('13. Using high-level BazelClient API...');
    const status = await bazel.getServerStatus();
    console.log('   Server status via BazelClient:');
    console.log(`     PID: ${status.pid}`);
    console.log(`     Running: ${status.running}`);
    console.log(`     Log: ${status.logPath}\n`);

    // 14. Advanced command server usage
    console.log('14. Advanced command server features:');
    console.log('   The command server protocol supports:');
    console.log('     - Bidirectional streaming');
    console.log('     - Progress updates during builds');
    console.log('     - Cancellation of running commands');
    console.log('     - Multiple concurrent connections');
    console.log('     - Custom output formats\n');

    console.log('✅ Command Server example completed successfully!\n');

    // Show additional information
    console.log('Command Server Protocol Details:');
    console.log('================================\n');
    
    console.log('The Bazel command server protocol provides:');
    console.log('1. Direct daemon communication without spawning new processes');
    console.log('2. Lower latency for repeated commands');
    console.log('3. Persistent connection for long-running operations');
    console.log('4. Real-time progress and event streaming');
    console.log('5. Better resource utilization\n');

    console.log('Common Use Cases:');
    console.log('- IDE integrations (fast queries and builds)');
    console.log('- Build monitoring dashboards');
    console.log('- CI/CD systems with many Bazel invocations');
    console.log('- Development tools requiring real-time feedback\n');

    console.log('Socket Locations:');
    console.log(`- Unix domain socket: ${await getSocketPath(workspace)}`);
    console.log('- Named pipe on Windows: \\\\.\\pipe\\bazel-<hash>\n');

  } catch (error) {
    console.error('❌ Error in command server example:', error);
    console.error('\nTroubleshooting:');
    console.error('1. Make sure Bazel is installed and in PATH');
    console.error('2. Ensure you are in a valid Bazel workspace');
    console.error('3. Check if the Bazel daemon is running: bazel info');
    console.error('4. Try restarting the daemon: bazel shutdown && bazel info');
  }
}

/**
 * Helper function to get the socket path for the command server
 */
async function getSocketPath(workspace: string): Promise<string> {
  // Get the output base where Bazel stores its data
  const outputBase = await getOutputBase(workspace);
  
  // The command server socket is typically at:
  // <output_base>/server/command.socket
  return path.join(outputBase, 'server', 'command.socket');
}

/**
 * Get the Bazel output base directory
 */
async function getOutputBase(workspace: string): Promise<string> {
  // Try to read from .bazelrc or use default
  const homeDir = process.env.HOME || process.env.USERPROFILE || '';
  const defaultBase = path.join(homeDir, '.cache', 'bazel');
  
  // In a real implementation, this would parse .bazelrc and compute the hash
  // For now, return a placeholder
  return path.join(defaultBase, '_bazel_' + process.env.USER, 'hash_of_workspace');
}

/**
 * Demo: Mock command server for testing without a real Bazel installation
 */
class MockCommandServer {
  async connect(): Promise<void> {
    console.log('   [Mock] Connected to mock command server');
  }

  async sendCommand(command: string, args?: string[]): Promise<any> {
    console.log(`   [Mock] Command: ${command} ${args?.join(' ') || ''}`);
    
    switch (command) {
      case 'info':
        if (args?.[0] === 'server_pid') return '12345';
        if (args?.[0] === 'release') return 'release 7.0.0';
        if (args?.[0] === 'workspace') return '/mock/workspace';
        return 'bazel-bin: /mock/bazel-bin\nbazel-genfiles: /mock/bazel-genfiles';
      
      case 'version':
        return 'Build label: 7.0.0\nBuild target: bazel-out/darwin-opt/bin/src/main/java/com/google/devtools/build/lib/bazel/BazelServer_deploy.jar';
      
      case 'query':
        return '//app:main\n//app:test\n//lib:core';
      
      case 'config':
        return 'Available configurations:\n  --config=debug\n  --config=release';
      
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  }

  async disconnect(): Promise<void> {
    console.log('   [Mock] Disconnected from mock command server');
  }

  on(event: string, handler: Function): void {
    console.log(`   [Mock] Registered handler for event: ${event}`);
  }
}

/**
 * Demo function to show mock behavior when Bazel is not available
 */
async function runMockDemo() {
  console.log('\n🔧 Running with mock command server (Bazel not available)\n');
  
  const mockServer = new MockCommandServer();
  
  await mockServer.connect();
  
  const info = await mockServer.sendCommand('info');
  console.log('Mock server info:', info);
  
  const version = await mockServer.sendCommand('version');
  console.log('Mock version:', version);
  
  await mockServer.disconnect();
  
  console.log('\nTo use the real command server, ensure Bazel is installed and you are in a Bazel workspace.');
}

// Run the example
main().catch(async (error) => {
  console.error('Failed to run with real Bazel:', error.message);
  await runMockDemo();
});

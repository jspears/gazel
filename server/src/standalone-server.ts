#!/usr/bin/env node
/**
 * Standalone Bazel Web Server
 * Provides HTTP/WebSocket API for Bazel operations
 */

import { BazelWebAdapter } from './bazel-web-adapter.js';
import { program } from 'commander';

// Parse command line arguments
program
  .name('bazel-web-server')
  .description('Web server for Bazel operations')
  .option('-p, --port <port>', 'Server port', '8080')
  .option('-w, --workspace <path>', 'Initial workspace path')
  .parse();

const options = program.opts();

async function main() {
  const port = parseInt(options.port, 10);
  const adapter = new BazelWebAdapter(port);
  
  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.log('\n[Server] Shutting down...');
    await adapter.stop();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\n[Server] Shutting down...');
    await adapter.stop();
    process.exit(0);
  });
  
  // Start the server
  await adapter.start();
  
  console.log(`
╔════════════════════════════════════════╗
║     Bazel Web Server Started           ║
╠════════════════════════════════════════╣
║  HTTP API:  http://localhost:${port}    ║
║  WebSocket: ws://localhost:${port}/ws   ║
║                                        ║
║  Press Ctrl+C to stop                  ║
╚════════════════════════════════════════╝
  `);
  
  // If initial workspace provided, set it
  if (options.workspace) {
    console.log(`[Server] Setting initial workspace: ${options.workspace}`);
    // This would need to be done via the API
  }
}

main().catch((error) => {
  console.error('[Server] Fatal error:', error);
  process.exit(1);
});

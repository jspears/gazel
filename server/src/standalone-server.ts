#!/usr/bin/env node
/**
 * Standalone Bazel Web Server
 * Provides HTTP/WebSocket API for Bazel operations
 * Now with gRPC-web support for browser compatibility
 */

import GrpcWebServer from './grpc-web-server.js';
import { program } from 'commander';

// Parse command line arguments
program
  .name('bazel-web-server')
  .description('Web server for Bazel operations with gRPC-web support')
  .option('-p, --port <port>', 'Server port', '8080')
  .option('-w, --workspace <path>', 'Initial workspace path')
  .option('--grpc', 'Use gRPC-web server (default)', true)
  .option('--legacy', 'Use legacy HTTP/WebSocket server', false)
  .parse();

const options = program.opts();

async function main() {
  const port = parseInt(options.port, 10);

  // Use gRPC-web server by default
  const server = new GrpcWebServer(port);

  // Handle shutdown gracefully
  process.on('SIGINT', async () => {
    console.log('\n[Server] Shutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[Server] Shutting down...');
    await server.stop();
    process.exit(0);
  });

  // Start the server
  await server.start();

  console.log(`
╔════════════════════════════════════════╗
║   Bazel gRPC-Web Server Started        ║
╠════════════════════════════════════════╣
║  HTTP API:  http://localhost:${port}/api ║
║  Health:    http://localhost:${port}/health ║
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

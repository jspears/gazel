#!/usr/bin/env node
/**
 * Main gRPC server using Connect protocol
 */
import './loader.js';
import { connectNodeAdapter } from "@connectrpc/connect-node";
import { createServer } from "node:http";
import { GazelServiceImpl } from "./server.js";
import { GazelService } from "@speajus/gazel-proto/index.js";
import config from "./config.js";
import { printStartupBanner, printShutdownMessage } from "./utils/console-styles.js";
import { loggingInterceptor } from './logging.js';
import { metadataInterceptor } from './metadata-interceptor.js';

// Create the service implementation
const serviceImpl = new GazelServiceImpl();

// Create the Node.js HTTP server with the Connect adapter
const server = createServer(
  connectNodeAdapter({
    requestPathPrefix: "/api",
    // Metadata interceptor runs first to configure workspace/executable,
    // then logging interceptor logs the request
    interceptors: [metadataInterceptor, loggingInterceptor],
    routes(router) {
      router.service(GazelService, serviceImpl);
    },
  })
);

// Start the server
server.listen(config.port, () => {
  // Only print banner if not running in Electron
  if (!process.env.ELECTRON_APP) {
    printStartupBanner(
      config.port,
      config.bazelWorkspace,
      process.env.NODE_ENV || 'development'
    );
    console.log('\n📡 gRPC server ready using Connect protocol');
    console.log(`   Available at: http://localhost:${config.port}`);
    console.log('   Protocol: Connect (gRPC-Web compatible)\n');
  } else {
    console.log(`gRPC server running on port ${config.port}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  printShutdownMessage();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  printShutdownMessage();
  server.close(() => {
    process.exit(0);
  });
});

export { server };

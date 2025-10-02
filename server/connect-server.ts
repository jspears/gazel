/**
 * Connect-ES Server Setup for Gazel API
 * This integrates Connect-ES with Express following the pattern from:
 * https://connectrpc.com/docs/node/getting-started/
 */

import { fastify } from "fastify";
import { fastifyConnectPlugin } from "@connectrpc/connect-fastify";
import { expressConnectMiddleware } from "@connectrpc/connect-express";
import { createConnectRouter } from "@connectrpc/connect";
import express from "express";
import cors from "cors";
import routes from "./connect-service.js";

/**
 * Create a Fastify server with Connect-ES support
 * This is the recommended approach from the Connect documentation
 */
export async function createFastifyServer(port = 8080) {
  const server = fastify({
    http2: false, // Use HTTP/1.1 for now (can enable HTTP/2 with TLS)
  });

  // Register the Connect plugin with our routes
  await server.register(fastifyConnectPlugin, {
    routes,
  });

  // Add a health check endpoint
  server.get("/health", (_, reply) => {
    reply.type("application/json");
    reply.send({ status: "ok", service: "gazel-connect" });
  });

  // Start the server
  await server.listen({ host: "localhost", port });
  console.log(`[Connect] Server is listening at`, server.addresses());
  
  return server;
}

/**
 * Create an Express server with Connect-ES support
 * Alternative approach using Express middleware
 */
export function createExpressServer(port = 8080) {
  const app = express();

  // Enable CORS for web clients
  app.use(cors({
    origin: true,
    credentials: true,
  }));

  // Add the Connect middleware
  app.use(expressConnectMiddleware({
    routes,
  }));

  // Health check endpoint
  app.get("/health", (req, res) => {
    res.json({ status: "ok", service: "gazel-connect" });
  });

  // Start the server
  const server = app.listen(port, () => {
    console.log(`[Connect] Express server listening on port ${port}`);
  });

  return server;
}

/**
 * Integrate Connect routes with an existing Express app
 * This is useful when you want to add Connect to an existing Express server
 */
export function addConnectToExpress(app: express.Application) {
  // Add the Connect middleware to the existing app
  app.use(expressConnectMiddleware({
    routes,
  }));

  console.log("[Connect] Added Connect-ES routes to Express app");
}

/**
 * Create a standalone Connect server
 * This creates a minimal server just for Connect services
 */
export async function createConnectServer(options: {
  port?: number;
  useFastify?: boolean;
  useHttp2?: boolean;
} = {}) {
  const { port = 8080, useFastify = true, useHttp2 = false } = options;

  if (useFastify) {
    // Use Fastify (recommended)
    const server = fastify({
      http2: useHttp2,
    });

    await server.register(fastifyConnectPlugin, {
      routes,
    });

    await server.listen({ host: "0.0.0.0", port });
    console.log(`[Connect] Fastify server listening on port ${port} (HTTP${useHttp2 ? '/2' : '/1.1'})`);
    
    return server;
  } else {
    // Use Express
    return createExpressServer(port);
  }
}

// Export the service routes for use in other servers
export { routes as connectRoutes };

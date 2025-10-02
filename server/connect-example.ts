#!/usr/bin/env node
/**
 * Example showing how to create a Connect server using GazelServiceImpl
 */

import { createConnectRouter } from "@connectrpc/connect";
import { createServer } from "http";
import { GazelServiceImpl } from "./server.js";
import { GazelService } from "../proto/index.js";

// Create the Connect router with our service implementation
const router = createConnectRouter();
router.service(GazelService, new GazelServiceImpl());

// Create an HTTP server
const server = createServer((req, res) => {
  // Handle CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Connect-Protocol-Version");
  
  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Let the Connect router handle the request
  router(req, res);
});

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`🚀 Connect server running on http://localhost:${PORT}`);
  console.log(`\nAvailable RPC methods:`);
  console.log(`  - getWorkspaceInfo`);
  console.log(`  - getCurrentWorkspace`);
  console.log(`  - scanWorkspaces`);
  console.log(`  - switchWorkspace`);
  console.log(`  - listTargets`);
  console.log(`  - getTarget`);
  console.log(`  - getTargetDependencies`);
  console.log(`  - getTargetOutputs`);
  console.log(`  - getReverseDependencies`);
  console.log(`  - searchTargets`);
  console.log(`  - executeQuery`);
  console.log(`  - streamQuery (server streaming)`);
  console.log(`  - buildTarget`);
  console.log(`  - streamBuild (server streaming)`);
  console.log(`  - getModuleGraph`);
  console.log(`\nExample usage with curl:`);
  console.log(`  curl -X POST http://localhost:${PORT}/gazel.api.v1.GazelService/GetWorkspaceInfo \\`);
  console.log(`    -H "Content-Type: application/json" \\`);
  console.log(`    -d '{}'`);
});

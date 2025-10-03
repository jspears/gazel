#!/usr/bin/env node
/**
 * Test script to verify GazelServiceImpl works correctly
 */

import { GazelServiceImpl } from "./server.js";
import { create } from "@bufbuild/protobuf";
import {
  GetWorkspaceInfoRequestSchema,
  GetCurrentWorkspaceRequestSchema,
  ListTargetsRequestSchema,
  ExecuteQueryRequestSchema,
} from "proto/index.js";

async function testService() {
  const service = new GazelServiceImpl();

  console.log("Testing GazelServiceImpl...\n");

  try {
    // Test getWorkspaceInfo
    console.log("1. Testing getWorkspaceInfo:");
    const workspaceInfoReq = create(GetWorkspaceInfoRequestSchema, {});
    const workspaceInfo = await service.getWorkspaceInfo(workspaceInfoReq);
    console.log("   ✓ Workspace path:", workspaceInfo.info?.path);
    console.log("   ✓ Workspace name:", workspaceInfo.info?.name);
    console.log("   ✓ Valid:", workspaceInfo.info?.valid);
    console.log();

    // Test getCurrentWorkspace
    console.log("2. Testing getCurrentWorkspace:");
    const currentWorkspaceReq = create(GetCurrentWorkspaceRequestSchema, {});
    const currentWorkspace = await service.getCurrentWorkspace(currentWorkspaceReq);
    console.log("   ✓ Configured:", currentWorkspace.configured);
    console.log("   ✓ Workspace:", currentWorkspace.workspace);
    console.log("   ✓ Valid:", currentWorkspace.valid);
    console.log();

    // Test listTargets
    console.log("3. Testing listTargets:");
    const listTargetsReq = create(ListTargetsRequestSchema, {
      pattern: "//...",
      format: "label",
    });
    const targets = await service.listTargets(listTargetsReq);
    console.log("   ✓ Total targets:", targets.total);
    console.log("   ✓ Packages found:", Object.keys(targets.byPackage).length);
    console.log();

    // Test executeQuery
    console.log("4. Testing executeQuery:");
    const queryReq = create(ExecuteQueryRequestSchema, {
      query: "//...",
      outputFormat: "label",
    });
    const queryResult = await service.executeQuery(queryReq);
    console.log("   ✓ Query executed:", queryResult.query);
    console.log("   ✓ Results found:", queryResult.result?.targets?.length || 0);
    console.log();

    console.log("✅ All tests passed!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// // Run tests if this file is executed directly
// if (import.meta.url === `file://${process.argv[1]}`) {
//   testService().catch(console.error);
// }

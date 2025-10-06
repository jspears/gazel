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
    console.log("3. Testing listTargets (streaming):");
    const listTargetsReq = create(ListTargetsRequestSchema, {
      pattern: "//...",
      format: "label",
    });
    let targetCount = 0;
    const packages = new Set<string>();
    for await (const response of service.listTargets(listTargetsReq)) {
      if (response.data.case === 'target') {
        targetCount++;
        if (response.data.value.package) {
          packages.add(response.data.value.package);
        }
      } else if (response.data.case === 'complete') {
        console.log("   ✓ Total targets:", response.data.value.total);
      }
    }
    console.log("   ✓ Packages found:", packages.size);
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

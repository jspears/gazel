/**
 * Connect Routes for Gazel API
 * Implements the Connect protocol endpoints for the Gazel service
 */

import type { ConnectRouter } from "@connectrpc/connect";
import { Code, ConnectError } from "@connectrpc/connect";
import bazelService from "./services/bazel.js";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

// Store current workspace in memory (single server instance)
let currentWorkspace = process.cwd();

// Helper to check if a directory is a valid Bazel workspace
async function isValidBazelWorkspace(dir: string): Promise<boolean> {
  try {
    const possibleFiles = ["MODULE.bazel", "WORKSPACE", "WORKSPACE.bazel"];
    for (const file of possibleFiles) {
      const filePath = path.join(dir, file);
      try {
        await fs.access(filePath);
        return true;
      } catch {
        // Continue checking other files
      }
    }
    return false;
  } catch {
    return false;
  }
}

// Helper to scan for Bazel workspaces
async function scanForWorkspaces(startPath?: string): Promise<Array<{ path: string; name: string; type: string }>> {
  const workspaces: Array<{ path: string; name: string; type: string }> = [];
  const searchPaths = [];

  // Add current directory
  const cwd = startPath || process.cwd();
  searchPaths.push({ path: cwd, type: "current" });

  // Add parent directories
  let parent = path.dirname(cwd);
  let depth = 0;
  while (parent !== path.dirname(parent) && depth < 5) {
    searchPaths.push({ path: parent, type: "parent" });
    parent = path.dirname(parent);
    depth++;
  }

  // Add home directory subdirectories
  const homeDir = os.homedir();
  try {
    const homeDirs = await fs.readdir(homeDir);
    for (const dir of homeDirs) {
      if (!dir.startsWith(".") && dir !== "node_modules") {
        searchPaths.push({ path: path.join(homeDir, dir), type: "home" });
      }
    }
  } catch {
    // Ignore errors reading home directory
  }

  // Check each path for Bazel workspace
  for (const { path: searchPath, type } of searchPaths) {
    if (await isValidBazelWorkspace(searchPath)) {
      workspaces.push({
        path: searchPath,
        name: path.basename(searchPath),
        type,
      });
    }
  }

  return workspaces;
}

/**
 * Define the Connect routes for the Gazel service
 * This creates the actual RPC endpoints
 */
export default (router: ConnectRouter) => {
  // Define each RPC method manually since we don't have the generated Connect service
  
  // GetWorkspaceInfo
  router.rpc(
    "gazel.api.v1.GazelService",
    "GetWorkspaceInfo",
    async (req: any) => {
      try {
        const workspace = req.path || currentWorkspace;
        const info = await bazelService.getWorkspaceInfo();
        
        return {
          info: {
            path: workspace,
            name: path.basename(workspace),
            valid: await isValidBazelWorkspace(workspace),
            error: "",
            packages: info?.packages || [],
            targetCount: info?.targetCount || 0,
            fileCount: info?.fileCount || 0,
          },
        };
      } catch (error: any) {
        throw new ConnectError(
          `Failed to get workspace info: ${error.message}`,
          Code.Internal
        );
      }
    }
  );

  // GetCurrentWorkspace
  router.rpc(
    "gazel.api.v1.GazelService",
    "GetCurrentWorkspace",
    async () => {
      try {
        const valid = await isValidBazelWorkspace(currentWorkspace);
        
        return {
          configured: true,
          workspace: currentWorkspace,
          valid,
          error: valid ? "" : "Not a valid Bazel workspace",
        };
      } catch (error: any) {
        return {
          configured: false,
          workspace: "",
          valid: false,
          error: error.message,
        };
      }
    }
  );

  // ScanWorkspaces
  router.rpc(
    "gazel.api.v1.GazelService",
    "ScanWorkspaces",
    async (req: any) => {
      try {
        const workspaces = await scanForWorkspaces(req.path);
        
        return {
          workspaces: workspaces.map((w) => ({
            path: w.path,
            name: w.name,
            type: w.type,
          })),
        };
      } catch (error: any) {
        throw new ConnectError(
          `Failed to scan workspaces: ${error.message}`,
          Code.Internal
        );
      }
    }
  );

  // SwitchWorkspace
  router.rpc(
    "gazel.api.v1.GazelService",
    "SwitchWorkspace",
    async (req: any) => {
      try {
        const { workspace } = req;
        
        // Validate the workspace
        const valid = await isValidBazelWorkspace(workspace);
        if (!valid) {
          return {
            success: false,
            workspace: currentWorkspace,
            message: "Not a valid Bazel workspace",
          };
        }
        
        // Update the current workspace
        currentWorkspace = workspace;
        process.chdir(workspace);
        
        return {
          success: true,
          workspace: currentWorkspace,
          message: "Workspace switched successfully",
        };
      } catch (error: any) {
        return {
          success: false,
          workspace: currentWorkspace,
          message: error.message,
        };
      }
    }
  );

  // ListTargets
  router.rpc(
    "gazel.api.v1.GazelService",
    "ListTargets",
    async (req: any) => {
      try {
        const { pattern = "//...", format } = req;
        const targets = await bazelService.listTargets(pattern, format);
        
        // Group targets by package
        const byPackage: Record<string, any> = {};
        for (const target of targets) {
          const pkg = target.package || "";
          if (!byPackage[pkg]) {
            byPackage[pkg] = { targets: [] };
          }
          byPackage[pkg].targets.push(target);
        }
        
        return {
          total: targets.length,
          targets,
          byPackage,
        };
      } catch (error: any) {
        throw new ConnectError(
          `Failed to list targets: ${error.message}`,
          Code.Internal
        );
      }
    }
  );

  // Add more RPC methods as needed...
  
  // For now, let's add placeholders for the remaining methods
  const unimplementedMethods = [
    "GetTarget",
    "GetTargetDependencies",
    "GetTargetOutputs",
    "GetReverseDependencies",
    "SearchTargets",
    "ExecuteQuery",
    "StreamQuery",
    "BuildTarget",
    "StreamBuild",
    "GetModuleGraph",
  ];

  for (const method of unimplementedMethods) {
    router.rpc(
      "gazel.api.v1.GazelService",
      method,
      async () => {
        throw new ConnectError(
          `${method} not yet implemented`,
          Code.Unimplemented
        );
      }
    );
  }
};

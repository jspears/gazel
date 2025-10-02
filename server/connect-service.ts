/**
 * Connect-ES Service Implementation for Gazel API
 * Following the Connect protocol specification from https://connectrpc.com/docs/node/getting-started/
 * Uses Bazel-generated types from bazel-bin/proto
 */

import type { ConnectRouter } from "@connectrpc/connect";
import bazelService from "./services/bazel.js";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";

// For now, we'll define a simple service implementation
// The actual service definition will come from the generated code

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
 * Connect service implementation for Gazel
 * This follows the Connect-ES pattern for implementing services
 */
export default (router: ConnectRouter) =>
  router.service(GazelService, {
    // Workspace operations
    async getWorkspaceInfo(req) {
      try {
        const workspace = req.path || currentWorkspace;
        const info = await bazelService.getWorkspaceInfo(workspace);
        
        return {
          info: {
            path: info.path,
            name: info.name,
            valid: info.valid,
            error: info.error || "",
            packages: info.packages || [],
            targetCount: info.targetCount || 0,
            fileCount: info.fileCount || 0,
          },
        };
      } catch (error: any) {
        throw new Error(`Failed to get workspace info: ${error.message}`);
      }
    },

    async getCurrentWorkspace() {
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
    },

    async scanWorkspaces(req) {
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
        throw new Error(`Failed to scan workspaces: ${error.message}`);
      }
    },

    async switchWorkspace(req) {
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
    },

    // Target operations
    async listTargets(req) {
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
        throw new Error(`Failed to list targets: ${error.message}`);
      }
    },

    async getTarget(req) {
      try {
        const target = await bazelService.getTarget(req.target);
        return { target };
      } catch (error: any) {
        throw new Error(`Failed to get target: ${error.message}`);
      }
    },

    async getTargetDependencies(req) {
      try {
        const { target, depth = 1 } = req;
        const dependencies = await bazelService.getTargetDependencies(target, depth);
        
        return {
          target,
          depth,
          total: dependencies.length,
          dependencies,
        };
      } catch (error: any) {
        throw new Error(`Failed to get target dependencies: ${error.message}`);
      }
    },

    async getTargetOutputs(req) {
      try {
        const outputs = await bazelService.getTargetOutputs(req.target);
        
        return {
          target: req.target,
          outputs,
          count: outputs.length,
        };
      } catch (error: any) {
        throw new Error(`Failed to get target outputs: ${error.message}`);
      }
    },

    async getReverseDependencies(req) {
      try {
        const dependencies = await bazelService.getReverseDependencies(req.target);
        
        return {
          target: req.target,
          total: dependencies.length,
          dependencies,
        };
      } catch (error: any) {
        throw new Error(`Failed to get reverse dependencies: ${error.message}`);
      }
    },

    async searchTargets(req) {
      try {
        const { query, type, package: pkg } = req;
        const targets = await bazelService.searchTargets(query, type, pkg);
        
        return {
          query,
          total: targets.length,
          targets,
        };
      } catch (error: any) {
        throw new Error(`Failed to search targets: ${error.message}`);
      }
    },

    // Query operations
    async executeQuery(req) {
      try {
        const { query, outputFormat = "label" } = req;
        const result = await bazelService.executeQuery(query, outputFormat);
        
        return {
          query,
          outputFormat,
          result: {
            targets: result.targets || [],
          },
          raw: result.raw || "",
        };
      } catch (error: any) {
        throw new Error(`Failed to execute query: ${error.message}`);
      }
    },

    // Streaming operations would need special handling
    // For now, implementing as regular unary calls
    async *streamQuery(req) {
      // This would need to be implemented with proper streaming
      throw new Error("Streaming not yet implemented in this service");
    },

    async buildTarget(req) {
      try {
        const { target, options = [] } = req;
        const result = await bazelService.buildTarget(target, options);
        
        return {
          success: result.success,
          output: result.output || "",
          stderr: result.stderr || "",
          error: result.error || "",
        };
      } catch (error: any) {
        throw new Error(`Failed to build target: ${error.message}`);
      }
    },

    async *streamBuild(req) {
      // This would need to be implemented with proper streaming
      throw new Error("Streaming not yet implemented in this service");
    },

    // Module operations
    async getModuleGraph() {
      try {
        const graph = await bazelService.getModuleGraph();
        
        return {
          root: graph.root || "",
          modules: graph.modules || [],
          dependencies: graph.dependencies || [],
          statistics: graph.statistics || {
            totalModules: 0,
            directDependencies: 0,
            devDependencies: 0,
            indirectDependencies: 0,
          },
        };
      } catch (error: any) {
        throw new Error(`Failed to get module graph: ${error.message}`);
      }
    },
  });

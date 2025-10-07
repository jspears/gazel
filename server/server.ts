import { type ServiceImpl } from "@connectrpc/connect";
import { create } from "@bufbuild/protobuf";
import {
  GazelService,
  type GetWorkspaceInfoRequest,
  type GetWorkspaceInfoResponse,
  GetWorkspaceInfoResponseSchema,
  WorkspaceInfoSchema,
  type GetCurrentWorkspaceRequest,
  type GetCurrentWorkspaceResponse,
  GetCurrentWorkspaceResponseSchema,
  type ScanWorkspacesRequest,
  type ScanWorkspacesResponse,
  ScanWorkspacesResponseSchema,
  ScanWorkspacesResponse_WorkspaceSchema,
  type SwitchWorkspaceRequest,
  type SwitchWorkspaceResponse,
  SwitchWorkspaceResponseSchema,
  type GetWorkspaceFilesRequest,
  type GetWorkspaceFilesResponse,
  GetWorkspaceFilesResponseSchema,
  GetWorkspaceFilesResponse_WorkspaceFileSchema,
  type GetBazelInfoRequest,
  type GetBazelInfoResponse,
  GetBazelInfoResponseSchema,
  BazelInfoSchema,
  type ListTargetsRequest,
  type ListTargetsResponse,
  ListTargetsResponseSchema,
  ListTargetsCompleteSchema,
  BazelTargetSchema,
  BazelAttributeSchema,
  TargetListSchema,
  type GetTargetRequest,
  type GetTargetResponse,
  GetTargetResponseSchema,
  type GetTargetDependenciesRequest,
  type GetTargetDependenciesResponse,
  GetTargetDependenciesResponseSchema,
  type GetTargetOutputsRequest,
  type GetTargetOutputsResponse,
  GetTargetOutputsResponseSchema,
  type GetReverseDependenciesRequest,
  type GetReverseDependenciesResponse,
  GetReverseDependenciesResponseSchema,
  type SearchTargetsRequest,
  type SearchTargetsResponse,
  SearchTargetsResponseSchema,
  type ExecuteQueryRequest,
  type ExecuteQueryResponse,
  ExecuteQueryResponseSchema,
  QueryResultSchema,
  type StreamQueryRequest,
  type StreamQueryResponse,
  StreamQueryResponseSchema,
  type BuildTargetRequest,
  type BuildTargetResponse,
  BuildTargetResponseSchema,
  type StreamBuildRequest,
  type StreamBuildResponse,
  StreamBuildResponseSchema,
  BuildCompleteSchema,
  type GetModuleGraphRequest,
  type GetModuleGraphResponse,
  GetModuleGraphResponseSchema,
  ModuleSchema,
  DependencySchema,
  ExtensionUsageSchema,
  LocationSchema,
  ModuleStatisticsSchema,
  type GetModuleInfoRequest,
  type GetModuleInfoResponse,
  GetModuleInfoResponseSchema,
  type GetModuleGraphDotRequest,
  type GetModuleGraphDotResponse,
  GetModuleGraphDotResponseSchema,
  type GetQueryTemplatesRequest,
  type GetQueryTemplatesResponse,
  GetQueryTemplatesResponseSchema,
  QueryTemplateSchema,
  type GetSavedQueriesRequest,
  type GetSavedQueriesResponse,
  GetSavedQueriesResponseSchema,
  SavedQuerySchema,
  type SaveQueryRequest,
  type SaveQueryResponse,
  SaveQueryResponseSchema,
  type DeleteQueryRequest,
  type DeleteQueryResponse,
  DeleteQueryResponseSchema,
  type StreamRunRequest,
  type StreamRunResponse,
  StreamRunResponseSchema,
  RunCompleteSchema,
  type GetBuildFileRequest,
  type GetBuildFileResponse,
  GetBuildFileResponseSchema,
  BuildFileTargetSchema,
  type GetTargetsByFileRequest,
  type GetTargetsByFileResponse,
  GetTargetsByFileResponseSchema,
  type SearchInFilesRequest,
  type SearchInFilesResponse,
  SearchInFilesResponseSchema,
  SearchResultSchema,
  type GetCommandHistoryRequest,
  type GetCommandHistoryResponse,
  GetCommandHistoryResponseSchema,
  CommandHistoryItemSchema,
  type UpdateBazelExecutableRequest,
  type UpdateBazelExecutableResponse,
  UpdateBazelExecutableResponseSchema,
} from "proto/gazel_pb.js";
import bazelService from "./services/bazel.js";
import parserService from "./services/parser.js";
import config, { setWorkspace, setBazelExecutable } from "./config.js";
import * as fs from "fs/promises";
import * as fsSync from "node:fs";
import * as path from "path";

export class GazelServiceImpl implements ServiceImpl<typeof GazelService> {
  /**
   * Helper function to convert attributes to BazelAttribute array
   * Handles both array format (from streamed_jsonproto) and object format (from XML)
   */
  private convertAttributesToProto(attributes: any): any[] {
    if (!attributes) {
      return [];
    }

    const protoAttributes: any[] = [];

    // Handle array format from streamed_jsonproto
    if (Array.isArray(attributes)) {
      for (const attr of attributes) {
        const name = attr.name;
        if (!name) continue;

        const protoAttr: any = {
          name: name,
          type: attr.type || '',
          explicitlySpecified: attr.explicitlySpecified || false,
          nodep: attr.nodep || false,
        };

        // Add values based on what's present
        if (attr.stringValue !== undefined && attr.stringValue !== null) {
          protoAttr.stringValue = attr.stringValue;
        }
        if (attr.stringListValue !== undefined && attr.stringListValue !== null) {
          protoAttr.stringListValue = attr.stringListValue;
        }
        if (attr.intValue !== undefined && attr.intValue !== null) {
          protoAttr.intValue = attr.intValue;
        }
        if (attr.booleanValue !== undefined && attr.booleanValue !== null) {
          protoAttr.booleanValue = attr.booleanValue;
        }
        if (attr.stringDictValue !== undefined && attr.stringDictValue !== null) {
          protoAttr.stringDictValue = attr.stringDictValue;
        }

        protoAttributes.push(create(BazelAttributeSchema, protoAttr));
      }
    }
    // Handle object format from XML or other sources - convert to proto format
    else if (typeof attributes === 'object') {
      for (const [key, value] of Object.entries(attributes)) {
        const protoAttr: any = {
          name: key,
          type: 'UNKNOWN',
          explicitlySpecified: true,
          nodep: false,
        };

        if (value === null || value === undefined) {
          protoAttr.stringValue = '';
        } else if (typeof value === 'string') {
          protoAttr.type = 'STRING';
          protoAttr.stringValue = value;
        } else if (typeof value === 'boolean') {
          protoAttr.type = 'BOOLEAN';
          protoAttr.booleanValue = value;
        } else if (typeof value === 'number') {
          protoAttr.type = 'INTEGER';
          protoAttr.intValue = value;
        } else if (Array.isArray(value)) {
          protoAttr.type = 'STRING_LIST';
          protoAttr.stringListValue = value.map(String);
        } else if (typeof value === 'object') {
          protoAttr.type = 'STRING_DICT';
          protoAttr.stringValue = JSON.stringify(value);
        }

        protoAttributes.push(create(BazelAttributeSchema, protoAttr));
      }
    }

    return protoAttributes;
  }

  /**
   * Get workspace information
   */
  async getWorkspaceInfo(
    _request: GetWorkspaceInfoRequest
  ): Promise<GetWorkspaceInfoResponse> {
    try {
      const  info = await bazelService.getWorkspaceInfo();
      

      // Add additional workspace info
      const moduleFile = path.join(config.bazelWorkspace, "MODULE.bazel");

      let workspaceExists = false;
      let workspaceContent = "";

      try {
        // Only check for MODULE.bazel
        workspaceContent = await fs.readFile(moduleFile, "utf-8");
        workspaceExists = true;
      } catch (error) {
        console.log("No MODULE.bazel file found");
      }

      // Extract module name and version from content
      let workspaceName = "unknown";
      let workspaceVersion = "";
      if (workspaceContent) {
        // Look for module name in MODULE.bazel
        const moduleMatch = workspaceContent.match(
          /module\s*\(\s*name\s*=\s*["']([^"']+)["']/
        );
        if (moduleMatch) {
          workspaceName = moduleMatch[1];
        }

        // Look for version in MODULE.bazel
        const versionMatch = workspaceContent.match(
          /version\s*=\s*["']([^"']+)["']/
        );
        if (versionMatch) {
          workspaceVersion = versionMatch[1];
        }
      }

      const workspaceInfo = create(WorkspaceInfoSchema, {
        path: config.bazelWorkspace,
        name: info.workspace_name,
        valid: workspaceExists,
        error: workspaceExists ? "" : "No MODULE.bazel file found",
        packages: Array.isArray(info.packages) ? info.packages : [],
        targetCount: typeof info.target_count === 'number' ? info.target_count : 0,
        fileCount: typeof info.file_count === 'number' ? info.file_count : 0,
        workspaceVersion,
      });

      return create(GetWorkspaceInfoResponseSchema, {
        info: workspaceInfo,
      });
    } catch (error: any) {
      throw new Error(`Failed to get workspace info: ${error.message}`);
    }
  }

  /**
   * Get current workspace
   */
  async getCurrentWorkspace(
    _request: GetCurrentWorkspaceRequest
  ): Promise<GetCurrentWorkspaceResponse> {
    if (!config.bazelWorkspace) {
      return create(GetCurrentWorkspaceResponseSchema, {
        configured: false,
        workspace: "",
        valid: false,
        error: "No workspace configured",
      });
    }

    // Check if the workspace still exists and is valid
    try {
      const moduleFile = path.join(config.bazelWorkspace, "MODULE.bazel");
      const exists = fsSync.existsSync(moduleFile);

      if (!exists) {
        return create(GetCurrentWorkspaceResponseSchema, {
          configured: true,
          workspace: config.bazelWorkspace,
          valid: false,
          error: "No MODULE.bazel file found",
        });
      }

      return create(GetCurrentWorkspaceResponseSchema, {
        configured: true,
        workspace: config.bazelWorkspace,
        valid: true,
        error: "",
      });
    } catch (error: any) {
      return create(GetCurrentWorkspaceResponseSchema, {
        configured: true,
        workspace: config.bazelWorkspace,
        valid: false,
        error: `Cannot access workspace directory: ${error.message}`,
      });
    }
  }

  /**
   * Scan for available Bazel workspaces
   */
  async scanWorkspaces(
    _request: ScanWorkspacesRequest
  ): Promise<ScanWorkspacesResponse> {
    const workspaces: Array<{
      path: string;
      name: string;
      type: "current" | "parent" | "home" | "discovered";
    }> = [];

    const seen = new Set<string>();

    // Helper function to check if a directory is a Bazel workspace
    async function checkWorkspace(
      dir: string,
      type: "current" | "parent" | "home" | "discovered"
    ): Promise<void> {
      try {
        const normalized = path.resolve(dir);
        if (seen.has(normalized)) return;
        seen.add(normalized);

        const moduleFile = path.join(normalized, "MODULE.bazel");

        // Check for MODULE.bazel only
        if (fsSync.existsSync(moduleFile)) {
          // Try to extract module name
          let workspaceName = path.basename(normalized);
          try {
            const content = await fs.readFile(moduleFile, "utf-8");
            // Look for module name in MODULE.bazel
            const moduleMatch = content.match(
              /module\s*\(\s*name\s*=\s*["']([^"']+)["']/
            );
            if (moduleMatch) {
              workspaceName = moduleMatch[1];
            }
          } catch {
            // Ignore errors reading files
          }

          workspaces.push({
            path: normalized,
            name: workspaceName,
            type,
          });
        }
      } catch {
        // Ignore errors accessing directories
      }
    }

    // Add currently configured workspace if it exists
    if (config.bazelWorkspace) {
      await checkWorkspace(config.bazelWorkspace, "current");
    }

    // Convert to proto format
    const protoWorkspaces = workspaces.map((ws) =>
      create(ScanWorkspacesResponse_WorkspaceSchema, {
        path: ws.path,
        name: ws.name,
        type: ws.type,
      })
    );

    return create(ScanWorkspacesResponseSchema, {
      workspaces: protoWorkspaces,
    });
  }

  /**
   * Switch to a different workspace
   */
  async switchWorkspace(
    request: SwitchWorkspaceRequest
  ): Promise<SwitchWorkspaceResponse> {
    const { workspace } = request;

    console.log(`[switchWorkspace] Attempting to switch to: ${workspace}`);

    if (!workspace) {
      const msg = "Workspace path is required";
      console.error(`[switchWorkspace] Error: ${msg}`);
      return create(SwitchWorkspaceResponseSchema, {
        success: false,
        workspace: "",
        message: msg,
      });
    }

    // Validate the workspace path
    const normalized = path.resolve(workspace);
    console.log(`[switchWorkspace] Normalized path: ${normalized}`);

    if (!fsSync.existsSync(normalized)) {
      const msg = `Workspace directory does not exist: ${normalized}`;
      console.error(`[switchWorkspace] Error: ${msg}`);
      return create(SwitchWorkspaceResponseSchema, {
        success: false,
        workspace: "",
        message: msg,
      });
    }
 
    const moduleFile = ["MODULE","MODULE.bazel", "WORKSPACE.bazel", "WORKSPACE"].find(f => fsSync.existsSync(path.join(normalized, f)));
    console.log(`[switchWorkspace] Checking for MODULE.bazel at: ${moduleFile}`);

    if (!moduleFile) {
      const msg = `Not a valid Bazel workspace (no MODULE.bazel file found at ${moduleFile})`;
      console.error(`[switchWorkspace] Error: ${msg}`);
      return create(SwitchWorkspaceResponseSchema, {
        success: false,
        workspace: "",
        message: msg,
      });
    }

    // Update the configuration
    setWorkspace(normalized);

    // Update the bazel service workspace
    bazelService.setWorkspace(normalized);

    // Clear any caches
    bazelService.clearCache();

    // Log the workspace update
    console.log(`✅ Workspace updated to: ${normalized}`);

    return create(SwitchWorkspaceResponseSchema, {
      success: true,
      workspace: normalized,
      message: "Workspace switched successfully",
    });
  }

  /**
   * Get workspace files (BUILD.bazel, MODULE.bazel, etc.)
   */
  async getWorkspaceFiles(
    _request: GetWorkspaceFilesRequest
  ): Promise<GetWorkspaceFilesResponse> {
    try {
      const workspaceRoot = config.bazelWorkspace;
      const files: Array<{
        path: string;
        name: string;
        type: string;
        targets: number;
        lastModified: bigint;
      }> = [];

      // Helper function to recursively find BUILD files
      async function findBuildFiles(dir: string, relativePath = ""): Promise<void> {
        try {
          const entries = await fs.readdir(dir, { withFileTypes: true });

          for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relPath = relativePath ? path.join(relativePath, entry.name) : entry.name;

            // Skip common directories that shouldn't be scanned
            if (entry.isDirectory()) {
              if (
                entry.name === "node_modules" ||
                entry.name === ".git" ||
                entry.name === "bazel-out" ||
                entry.name === "bazel-bin" ||
                entry.name === "bazel-testlogs" ||
                entry.name.startsWith("bazel-")
              ) {
                continue;
              }
              await findBuildFiles(fullPath, relPath);
            } else if (entry.isFile()) {
              // Check for BUILD files
              if (
                entry.name === "BUILD" ||
                entry.name === "BUILD.bazel" ||
                entry.name === "MODULE.bazel" ||
                entry.name === "WORKSPACE" ||
                entry.name === "WORKSPACE.bazel"
              ) {
                const stats = await fs.stat(fullPath);
                let fileType = "build";
                if (entry.name === "MODULE.bazel") {
                  fileType = "module";
                } else if (entry.name === "WORKSPACE" || entry.name === "WORKSPACE.bazel") {
                  fileType = "workspace";
                }

                files.push({
                  path: relPath,
                  name: entry.name,
                  type: fileType,
                  targets: 0, // We could parse the file to count targets, but that's expensive
                  lastModified: BigInt(Math.floor(stats.mtimeMs)),
                });
              }
            }
          }
        } catch (error: any) {
          // Skip directories we can't read
          console.warn(`Cannot read directory ${dir}: ${error.message}`);
        }
      }

      await findBuildFiles(workspaceRoot);

      // Sort files by path
      files.sort((a, b) => a.path.localeCompare(b.path));

      // Convert to proto messages
      const protoFiles = files.map((file) =>
        create(GetWorkspaceFilesResponse_WorkspaceFileSchema, {
          path: file.path,
          name: file.name,
          type: file.type,
          targets: file.targets,
          lastModified: file.lastModified,
        })
      );

      return create(GetWorkspaceFilesResponseSchema, {
        files: protoFiles,
      });
    } catch (error: any) {
      throw new Error(`Failed to get workspace files: ${error.message}`);
    }
  }

  /**
   * Get Bazel information
   */
  async getBazelInfo(
    _request: GetBazelInfoRequest
  ): Promise<GetBazelInfoResponse> {
    try {
      // Execute `bazel info` to get all Bazel information
      const result = await bazelService.execute(['info']);

      // Parse the output into key-value pairs
      const infoMap: Record<string, string> = {};
      const lines = result.stdout.split('\n');

      for (const line of lines) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          infoMap[key] = value;
        }
      }

      const bazelInfo = create(BazelInfoSchema, {
        version: infoMap['release'] || '',
        release: infoMap['release'] || '',
        workspace: infoMap['workspace'] || config.bazelWorkspace,
        executionRoot: infoMap['execution_root'] || '',
        outputBase: infoMap['output_base'] || '',
        outputPath: infoMap['output_path'] || '',
        serverPid: infoMap['server_pid'] || '',
        serverLog: infoMap['server_log'] || '',
        commandLog: infoMap['command_log'] || '',
        usedHeapSizeAfterGc: false, // This is a boolean in proto but string in output
        maxHeapSize: infoMap['max-heap-size'] || '',
        committedHeapSize: infoMap['committed-heap-size'] || '',
      });

      return create(GetBazelInfoResponseSchema, {
        info: bazelInfo,
      });
    } catch (error: any) {
      throw new Error(`Failed to get Bazel info: ${error.message}`);
    }
  }

  /**
   * List all targets (streaming)
   */
  async *listTargets(request: ListTargetsRequest): AsyncGenerator<ListTargetsResponse> {
    try {
      // Ensure we have valid defaults for pattern and format
      const pattern = request.pattern || "//...";
      const format = request.format || "streamed_jsonproto";

      const result = await bazelService.query(pattern, format);

      let targets: any[];
      if (format === "xml") {
        const parsed = await parserService.parseXmlOutput(result.stdout);
        targets = parsed.targets;
      } else if (format === "streamed_jsonproto") {
        targets = parserService.parseStreamedJsonProto(result.stdout);
      } else if (format === "label_kind") {
        targets = parserService.parseLabelKindOutput(result.stdout);
      } else {
        targets = parserService.parseLabelOutput(result.stdout);
      }

      // Stream each target individually
      let count = 0;
      for (const target of targets) {
        const label = target.full || target.label || "";
        const kind = target.ruleType || target.kind || "";

        // Extract package and name
        let pkg = target.package || "";
        let name = target.name || target.target || "";

        // If package starts with //, remove it
        if (pkg.startsWith("//")) {
          pkg = pkg.substring(2);
        }

        // If we still don't have package/name, try parsing from label
        if (!pkg || !name) {
          const match = label.match(/^\/\/([^:]*):(.+)$/);
          if (match) {
            pkg = match[1];
            name = match[2];
          }
        }

        const protoTarget = create(BazelTargetSchema, {
          label: label,
          kind: kind,
          package: pkg,
          name: name,
          tags: target.tags || [],
          deps: target.deps || [],
          srcs: target.srcs || [],
          attributes: target.attributes,
        });

        // Yield each target
        yield create(ListTargetsResponseSchema, {
          data: {
            case: "target",
            value: protoTarget,
          },
        });
        count++;
      }

      // Send completion message with total count
      yield create(ListTargetsResponseSchema, {
        data: {
          case: "complete",
          value: create(ListTargetsCompleteSchema, {
            total: count,
          }),
        },
      });
    } catch (error: any) {
      // Send error message
      yield create(ListTargetsResponseSchema, {
        data: {
          case: "error",
          value: `Failed to list targets: ${error.message}`,
        },
      });
    }
  }

  /**
   * Get a specific target
   */
  async getTarget(request: GetTargetRequest): Promise<GetTargetResponse> {
    try {
      const { target } = request;
      if (!target) {
        throw new Error("Target is required");
      }

      // Ensure target starts with //
      const fullTarget = target.startsWith("//") ? target : `//${target}`;

      const result = await bazelService.query(fullTarget, "streamed_jsonproto");
      const targets = parserService.parseStreamedJsonProto(result.stdout);

      if (targets.length === 0) {
        throw new Error(`Target ${fullTarget} not found`);
      }

      const targetData = targets[0];
      const label = targetData.full || targetData.label || fullTarget;
      const kind = targetData.ruleType || targetData.kind || "";

      // Extract package and name
      let pkg = targetData.package || "";
      let name = targetData.name || targetData.target || "";

      // If package starts with //, remove it
      if (pkg.startsWith("//")) {
        pkg = pkg.substring(2);
      }

      // If we still don't have package/name, try parsing from label
      if (!pkg || !name) {
        const match = label.match(/^\/\/([^:]*):(.+)$/);
        if (match) {
          pkg = match[1];
          name = match[2];
        }
      }

      const protoTarget = create(BazelTargetSchema, {
        label: label,
        kind: kind,
        package: pkg,
        name: name,
        tags: targetData.tags || [],
        deps: targetData.deps || [],
        srcs: targetData.srcs || [],
        attributes: targetData.attributes ?? []
      });

      return create(GetTargetResponseSchema, {
        target: protoTarget,
      });
    } catch (error: any) {
      throw new Error(`Failed to get target: ${error.message}`);
    }
  }

  /**
   * Get target dependencies
   */
  async getTargetDependencies(
    request: GetTargetDependenciesRequest
  ): Promise<GetTargetDependenciesResponse> {
    try {
      const { target, depth = 1 } = request;
      if (!target) {
        throw new Error("Target is required");
      }

      // Ensure target starts with //
      const fullTarget = target.startsWith("//") ? target : `//${target}`;

      const result = await bazelService.getTargetDependencies(fullTarget, depth);
      const dependencies = parserService.parseStreamedJsonProto(result.stdout);

      // Convert dependencies to BazelTarget format
      const protoDeps = dependencies.map((dep: any) => {
        const label = dep.full || "";
        const kind = dep.ruleType || "";

        // Extract package and name from the parsed data or from label
        let pkg = dep.package || "";
        let name = dep.name || dep.target || "";

        // If package starts with //, remove it for the package field
        if (pkg.startsWith("//")) {
          pkg = pkg.substring(2);
        }

        // If we still don't have package/name, try parsing from label
        if (!pkg || !name) {
          const match = label.match(/^\/\/([^:]*):(.+)$/);
          if (match) {
            pkg = match[1];
            name = match[2];
          }
        }

        return create(BazelTargetSchema, {
          label: label,
          kind: kind,
          package: pkg,
          name: name,
          tags: [],
          deps: [],
          srcs: [],
          attributes: dep.attributes ?? [],
        });
      });

      return create(GetTargetDependenciesResponseSchema, {
        target: fullTarget,
        depth: depth,
        total: protoDeps.length,
        dependencies: protoDeps,
      });
    } catch (error: any) {
      throw new Error(`Failed to get target dependencies: ${error.message}`);
    }
  }

  /**
   * Get target outputs
   */
  async getTargetOutputs(
    request: GetTargetOutputsRequest
  ): Promise<GetTargetOutputsResponse> {
    try {
      const { target } = request;
      if (!target) {
        throw new Error("Target is required");
      }

      const fullTarget = target.startsWith("//") ? target : `//${target}`;

      try {
        const result = await bazelService.getTargetOutputs(fullTarget);

        // Parse the output files (one per line)
        const outputs = result.stdout
          .split("\n")
          .filter((line) => line.trim())
          .map((line) => line.trim());

        return create(GetTargetOutputsResponseSchema, {
          target: fullTarget,
          outputs,
        });
      } catch (error: any) {
        // If cquery fails, try a simpler approach
        try {
          const buildInfo = await bazelService.getTargetBuildInfo(fullTarget);
          const outputs = buildInfo.stdout
            .split("\n")
            .filter(
              (line) => line.includes("output") || line.includes("Creating")
            )
            .map((line) => line.trim());

          return create(GetTargetOutputsResponseSchema, {
            target: fullTarget,
            outputs,
          });
        } catch (fallbackError) {
          return create(GetTargetOutputsResponseSchema, {
            target: fullTarget,
            outputs: [],
          });
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to get target outputs: ${error.message}`);
    }
  }

  /**
   * Get reverse dependencies
   */
  async getReverseDependencies(
    request: GetReverseDependenciesRequest
  ): Promise<GetReverseDependenciesResponse> {
    try {
      const { target } = request;
      if (!target) {
        throw new Error("Target is required");
      }

      // Ensure target starts with //
      const fullTarget = target.startsWith("//") ? target : `//${target}`;

      const result = await bazelService.getReverseDependencies(fullTarget);
      const dependencies = parserService.parseStreamedJsonProto(result.stdout);

      // Convert to BazelTarget format
      const protoDeps = dependencies.map((dep: any) => {
        const label = dep.full || "";
        const kind = dep.ruleType || "";

        // Extract package and name from the parsed data or from label
        let pkg = dep.package || "";
        let name = dep.name || dep.target || "";

        // If package starts with //, remove it for the package field
        if (pkg.startsWith("//")) {
          pkg = pkg.substring(2);
        }

        // If we still don't have package/name, try parsing from label
        if (!pkg || !name) {
          const match = label.match(/^\/\/([^:]*):(.+)$/);
          if (match) {
            pkg = match[1];
            name = match[2];
          }
        }

        return create(BazelTargetSchema, {
          label: label,
          kind: kind,
          package: pkg,
          name: name,
          tags: [],
          deps: [],
          srcs: [],
          attributes: dep.attributes ?? [],
        });
      });

      return create(GetReverseDependenciesResponseSchema, {
        target: fullTarget,
        dependencies: protoDeps,
      });
    } catch (error: any) {
      throw new Error(`Failed to get reverse dependencies: ${error.message}`);
    }
  }

  /**
   * Search targets
   */
  async searchTargets(
    request: SearchTargetsRequest
  ): Promise<SearchTargetsResponse> {
    try {
      const { query, type, package: packageFilter } = request;

      if (!query) {
        throw new Error("Query is required");
      }

      // Build the Bazel query based on search parameters
      let bazelQuery = query;
      if (type) {
        bazelQuery = `kind("${type}", ${query})`;
      }
      if (packageFilter) {
        bazelQuery = `attr(package, "${packageFilter}", ${bazelQuery})`;
      }

      const result = await bazelService.query(bazelQuery, "label_kind");
      const targets = parserService.parseLabelKindOutput(result.stdout);

      // Convert to proto format
      const protoTargets = targets.map((target) =>
        create(BazelTargetSchema,target)
      );

      return create(SearchTargetsResponseSchema, {
        query,
        total: protoTargets.length,
        targets: protoTargets,
      });
    } catch (error: any) {
      throw new Error(`Failed to search targets: ${error.message}`);
    }
  }

  /**
   * Execute a Bazel query
   */
  async executeQuery(
    request: ExecuteQueryRequest
  ): Promise<ExecuteQueryResponse> {
    try {
      const { query, outputFormat = "label_kind", queryType = "query" } = request;

      if (!query) {
        throw new Error("Query is required");
      }

      const result = await bazelService.query(query, outputFormat, queryType);

      let parsedResult: any;
      if (outputFormat === "xml") {
        parsedResult = await parserService.parseXmlOutput(result.stdout);
      } else if (outputFormat === "streamed_jsonproto") {
        // Parse streamed JSON proto format (one JSON object per line)
        const lines = result.stdout.trim().split('\n').filter(line => line.trim());
        const targets = lines.map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            console.error('Failed to parse JSON line:', line);
            return null;
          }
        }).filter(t => t !== null);

        parsedResult = { targets };
      } else if (outputFormat === "label_kind") {
        parsedResult = {
          targets: parserService.parseLabelKindOutput(result.stdout),
        };
      } else if (outputFormat === "graph") {
        // For graph output, we'll return the raw DOT format
        parsedResult = {
          graph: result.stdout,
          targets: [], // Graph format doesn't list targets in the same way
        };
      } else {
        parsedResult = {
          targets: parserService.parseLabelOutput(result.stdout),
        };
      }

      // Convert targets to proto format
      const protoTargets = (parsedResult.targets || []).map((target: any) =>
        create(BazelTargetSchema, {
          label: target.label || "",
          kind: target.kind || "",
          package: target.package || "",
          name: target.name || "",
          tags: target.tags || [],
          deps: target.deps || [],
          srcs: target.srcs || [],
          attributes: target.attributes ?? [],
        })
      );

      const queryResult = create(QueryResultSchema, {
        targets: protoTargets,
      });

      return create(ExecuteQueryResponseSchema, {
        query,
        outputFormat,
        result: queryResult,
        raw: result.stdout,
      });
    } catch (error: any) {
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  /**
   * Stream query results (server streaming)
   */
  async *streamQuery(
    request: StreamQueryRequest
  ): AsyncGenerator<StreamQueryResponse> {
    const { query, outputFormat = "label_kind", queryType = "query" } = request;

    if (!query) {
      throw new Error("Query is required");
    }

    try {
      const result = await bazelService.query(query, outputFormat, queryType);

      if (outputFormat === "streamed_jsonproto") {
        // Parse and yield each JSON object as a target
        const lines = result.stdout.trim().split("\n").filter(line => line.trim());

        for (const line of lines) {
          try {
            const target = JSON.parse(line);
            yield create(StreamQueryResponseSchema, {
              data: {
                case: "target",
                value: create(BazelTargetSchema, {
                  label: target.rule?.name || target.name || "",
                  kind: target.rule?.ruleClass || target.type || "",
                  package: target.rule?.location?.split(":")[0]?.replace("//", "") || "",
                  name: target.rule?.name?.split(":").pop() || "",
                  tags: [],
                  deps: [],
                  srcs: [],
                  attributes: target.rule?.attribute || [],
                }),
              },
            });
          } catch (e) {
            console.error("Failed to parse JSON line:", line, e);
            // Continue with next line
          }
        }
      } else {
        // For other formats, yield raw lines in chunks
        const lines = result.stdout.split("\n");
        const chunkSize = 10;

        for (let i = 0; i < lines.length; i += chunkSize) {
          const chunk = lines.slice(i, i + chunkSize).join("\n");
          yield create(StreamQueryResponseSchema, {
            data: {
              case: "rawLine",
              value: chunk,
            },
          });
        }
      }

      // Send completion signal
      yield create(StreamQueryResponseSchema, {
        data: {
          case: "rawLine",
          value: "",
        },
      });
    } catch (error: any) {
      // Send error
      yield create(StreamQueryResponseSchema, {
        data: {
          case: "error",
          value: error.message || "Query failed",
        },
      });
    }
  }

  /**
   * Build a target
   */
  async buildTarget(
    request: BuildTargetRequest
  ): Promise<BuildTargetResponse> {
    try {
      const { target, options = [], command = "build" } = request;

      if (!target) {
        throw new Error("Target is required");
      }

      try {
        let result;

        // Execute the appropriate Bazel command
        if (command === "test") {
          result = await bazelService.execute(["test", target, ...options]);
        } else if (command === "run") {
          result = await bazelService.execute(["run", target, ...options]);
        } else {
          // Default to build
          result = await bazelService.build(target, options);
        }

        return create(BuildTargetResponseSchema, {
          success: true,
          output: result.stdout,
          stderr: result.stderr,
        });
      } catch (error: any) {
        return create(BuildTargetResponseSchema, {
          success: false,
          output: error.stdout || "",
          stderr: error.stderr || error.message,
          error: error.message,
        });
      }
    } catch (error: any) {
      throw new Error(`${request.command || 'Build'} failed: ${error.message}`);
    }
  }

  /**
   * Stream build events (server streaming)
   */
  async *streamBuild(
    request: StreamBuildRequest
  ): AsyncGenerator<StreamBuildResponse> {
    const { target, options = [] } = request;

    if (!target) {
      throw new Error("Target is required");
    }

    // Start the build - send initial output
    yield create(StreamBuildResponseSchema, {
      event: {
        case: "output",
        value: `Starting build of ${target}`,
      },
    });

    try {
      // Execute the build
      const result = await bazelService.build(target, options);

      // Yield output lines as progress events
      const lines = result.stdout.split("\n");
      for (const line of lines) {
        if (line.trim()) {
          yield create(StreamBuildResponseSchema, {
            event: {
              case: "output",
              value: line,
            },
          });
        }
      }

      // Send completion
      yield create(StreamBuildResponseSchema, {
        event: {
          case: "complete",
          value: create(BuildCompleteSchema, {
            success: true,
            exitCode: 0,
          }),
        },
      });
    } catch (error: any) {
      // Send error
      yield create(StreamBuildResponseSchema, {
        event: {
          case: "error",
          value: error.message,
        },
      });
    }
  }

  /**
   * Get module graph
   */
  async getModuleGraph(
    _request: GetModuleGraphRequest
  ): Promise<GetModuleGraphResponse> {
    try {
      // Try to execute bazel mod graph command with JSON output
      console.log("Executing: bazel mod graph --output=json");
      const result = await bazelService.execute(["mod", "graph", "--output", "json"]);
      console.log("Bazel mod graph stdout length:", result.stdout.length);
      console.log("Bazel mod graph stderr:", result.stderr);

      // Parse the JSON output - Bazel returns a tree structure, not a flat list
      let rootModule: any;
      try {
        rootModule = JSON.parse(result.stdout);
        console.log("Parsed module graph root:", rootModule.key, rootModule.name);
        console.log("Direct dependencies:", rootModule.dependencies?.length || 0);
      } catch (parseError) {
        console.error("Failed to parse module graph JSON:", parseError);
        console.error("Raw stdout:", result.stdout.substring(0, 500));
        // Return empty graph if parsing fails
        return create(GetModuleGraphResponseSchema, {
          root: "",
          modules: [],
          dependencies: [],
          statistics: create(ModuleStatisticsSchema, {
            totalModules: 0,
            directDependencies: 0,
            devDependencies: 0,
            indirectDependencies: 0,
          }),
        });
      }

      // Flatten the tree structure into a list of modules
      const moduleMap = new Map<string, any>();

      function flattenModule(mod: any) {
        if (!mod || !mod.key) return;

        // Skip if already processed (handles unexpanded references)
        if (moduleMap.has(mod.key)) return;

        moduleMap.set(mod.key, mod);

        // Recursively process dependencies
        if (mod.dependencies && Array.isArray(mod.dependencies)) {
          for (const dep of mod.dependencies) {
            if (!dep.unexpanded) {
              flattenModule(dep);
            }
          }
        }
      }

      // Start flattening from root
      flattenModule(rootModule);

      console.log("Flattened module count:", moduleMap.size);

      // Convert to proto format
      const protoModules = Array.from(moduleMap.values()).map(
        (mod: any) => {
          // Convert dependencies - only include direct dependencies, not unexpanded ones
          const dependencies = (mod.dependencies || [])
            .filter((dep: any) => !dep.unexpanded)
            .map((dep: any) =>
              create(DependencySchema, {
                key: dep.key || "",
                name: dep.name || "",
                version: dep.version || "",
                devDependency: dep.devDependency || false,
                registry: dep.registry || "",
              })
            );

          // Convert extension usages
          const extensionUsages = (mod.extensionUsages || []).map((ext: any) =>
            create(ExtensionUsageSchema, {
              extensionBzlFile: ext.extensionBzlFile || "",
              extensionName: ext.extensionName || "",
              location: ext.location
                ? create(LocationSchema, {
                    file: ext.location.file || "",
                    line: ext.location.line || 0,
                    column: ext.location.column || 0,
                  })
                : undefined,
              imports: ext.imports || {},
              devDependency: ext.devDependency || false,
              isolate: ext.isolate || false,
            })
          );

          return create(ModuleSchema, {
            key: mod.key || "",
            name: mod.name || "",
            version: mod.version || "",
            location: mod.location
              ? create(LocationSchema, {
                  file: mod.location.file || "",
                  line: mod.location.line || 0,
                  column: mod.location.column || 0,
                })
              : undefined,
            compatibilityLevel: mod.compatibilityLevel || 0,
            repoName: mod.repoName || mod.name || "",
            bazelCompatibility: mod.bazelCompatibility || [],
            moduleRuleExportsAllRules: mod.moduleRuleExportsAllRules || false,
            tags: mod.tags || [],
            dependencies,
            resolvedDependencies: [], // Will be populated if needed
            extensionUsages,
            dependencyCount: dependencies.length,
            extensionCount: extensionUsages.length,
          });
        }
      );

      // Calculate statistics
      const rootKey = rootModule.key || "<root>";
      const rootModuleDeps = protoModules.find(
        (m) => m.key === rootKey
      )?.dependencies || [];

      const directDeps = rootModuleDeps.length;
      const devDeps = rootModuleDeps.filter((d: any) => d.devDependency).length;
      // Indirect dependencies = total modules - 1 (root) - direct dependencies
      const indirectDeps = Math.max(0, protoModules.length - 1 - directDeps);

      const response = create(GetModuleGraphResponseSchema, {
        root: rootKey,
        modules: protoModules,
        dependencies: [],
        statistics: create(ModuleStatisticsSchema, {
          totalModules: protoModules.length,
          directDependencies: directDeps,
          devDependencies: devDeps,
          indirectDependencies: indirectDeps,
        }),
      });

      console.log("Returning module graph response with", protoModules.length, "modules");
      return response;
    } catch (error: any) {
      console.error("Error in getModuleGraph:", error);
      console.error("Error stack:", error.stack);
      // Return empty graph on error
      return create(GetModuleGraphResponseSchema, {
        root: "",
        modules: [],
      });
    }
  }

  /**
   * Get module graph in DOT format
   */
  async getModuleGraphDot(
    request: GetModuleGraphDotRequest
  ): Promise<GetModuleGraphDotResponse> {
    try {
      console.log("Executing: bazel mod graph --output=graph");
      const args = ["mod", "graph", "--output", "graph"];

      // Add any additional options
      if (request.options && request.options.length > 0) {
        args.push(...request.options);
      }

      const result = await bazelService.execute(args);
      console.log("DOT graph length:", result.stdout.length);

      return create(GetModuleGraphDotResponseSchema, {
        dot: result.stdout,
      });
    } catch (error: any) {
      console.error("Error in getModuleGraphDot:", error);
      throw new Error(`Failed to get module graph DOT: ${error.message}`);
    }
  }

  /**
   * Get detailed module information
   */
  async getModuleInfo(
    request: GetModuleInfoRequest
  ): Promise<GetModuleInfoResponse> {
      const { moduleName } = request;

      // Get the full module graph first
      const graphResult = await bazelService.execute(["mod", "graph", "--output", "json"]);
      const moduleGraph = JSON.parse(graphResult.stdout);

      // Find the specific module
      const module = Object.entries(moduleGraph.modules || {}).find(
        ([key, mod]: [string, any]) => mod.name === moduleName || key === moduleName
      );

      if (!module) {
        throw new Error(`Module ${moduleName} not found`);
      }

      const [key, mod] = module as [string, any];
      const protoModule = create(ModuleSchema, {
        key,
        name: mod.name || "",
        version: mod.version || "",
      });

      return create(GetModuleInfoResponseSchema, {
        module: protoModule,
      });
 
  }

  /**
   * Get query templates
   */
  async getQueryTemplates(
    _request: GetQueryTemplatesRequest
  ): Promise<GetQueryTemplatesResponse> {
    // Return predefined query templates
    const templates = [
      // Standard query templates
      {
        id: "all-targets",
        name: "All Targets",
        description: "List all targets in the workspace",
        template: "//...",
        parameters: [],
        category: "basic",
        queryType: "query",
        outputFormat: "label_kind",
      },
      {
        id: "deps",
        name: "Dependencies",
        description: "Find all dependencies of a target (e.g., //foo:bar)",
        template: "deps({target})",
        parameters: ["target"],
        category: "dependencies",
        queryType: "query",
        outputFormat: "label_kind",
      },
      {
        id: "rdeps",
        name: "Reverse Dependencies",
        description: "Find what depends on a target (e.g., //foo:bar)",
        template: "rdeps(//..., {target})",
        parameters: ["target"],
        category: "dependencies",
        queryType: "query",
        outputFormat: "label_kind",
      },
      {
        id: "kind-filter",
        name: "Filter by Rule Type",
        description: "Find targets of a specific rule type (e.g., cc_library, ts_project)",
        template: "kind({kind}, //...)",
        parameters: ["kind"],
        category: "filter",
        queryType: "query",
        outputFormat: "label",
      },
      {
        id: "attr-filter",
        name: "Filter by Attribute",
        description: "Find targets with specific attribute values (e.g., srcs, '.*\\.ts$', //...)",
        template: "attr({attribute}, {pattern}, {scope})",
        parameters: ["attribute", "pattern", "scope"],
        category: "filter",
        queryType: "query",
        outputFormat: "label_kind",
      },
      // cquery templates
      {
        id: "cquery-deps",
        name: "Configured Dependencies",
        description: "Find dependencies with configuration info (e.g., //foo:bar)",
        template: "deps({target})",
        parameters: ["target"],
        category: "configured",
        queryType: "cquery",
        outputFormat: "label_kind",
      },
      {
        id: "cquery-somepath",
        name: "Path Between Targets",
        description: "Find a path from one target to another (e.g., //foo:a, //foo:b)",
        template: "somepath({from}, {to})",
        parameters: ["from", "to"],
        category: "configured",
        queryType: "cquery",
        outputFormat: "label_kind",
      },
      {
        id: "cquery-config",
        name: "Specific Configuration",
        description: "Query a target in a specific configuration (e.g., //foo:bar, target)",
        template: "config({target}, {config})",
        parameters: ["target", "config"],
        category: "configured",
        queryType: "cquery",
        outputFormat: "label_kind",
      },
      // aquery templates
      {
        id: "aquery-actions",
        name: "Actions for Target",
        description: "Show all actions generated for a target (e.g., //foo:bar)",
        template: "{target}",
        parameters: ["target"],
        category: "actions",
        queryType: "aquery",
        outputFormat: "text",
      },
      {
        id: "aquery-inputs",
        name: "Filter by Input Files",
        description: "Find actions with specific input files (e.g., '.*\\.cpp', deps(//foo:bar))",
        template: "inputs({pattern}, deps({target}))",
        parameters: ["pattern", "target"],
        category: "actions",
        queryType: "aquery",
        outputFormat: "text",
      },
      {
        id: "aquery-mnemonic",
        name: "Filter by Action Type",
        description: "Find actions by mnemonic/type (e.g., 'Cpp.*', //foo:bar)",
        template: "mnemonic({mnemonic}, {target})",
        parameters: ["mnemonic", "target"],
        category: "actions",
        queryType: "aquery",
        outputFormat: "text",
      },
      // Example queries (prefilled, no parameters)
      {
        id: "example-all-ts",
        name: "Example: All TypeScript Projects",
        description: "Find all ts_project targets in the workspace",
        template: "kind(ts_project, //...)",
        parameters: [],
        category: "examples",
        queryType: "query",
        outputFormat: "label",
      },
      {
        id: "example-proto-targets",
        name: "Example: All Proto Targets",
        description: "Find all proto_library and ts_proto_library targets",
        template: "kind('.*proto.*', //...)",
        parameters: [],
        category: "examples",
        queryType: "query",
        outputFormat: "label_kind",
      },
      {
        id: "example-test-targets",
        name: "Example: All Test Targets",
        description: "Find all test targets (any rule ending with _test)",
        template: "kind('.*_test$', //...)",
        parameters: [],
        category: "examples",
        queryType: "query",
        outputFormat: "label_kind",
      },
      {
        id: "example-cquery-server",
        name: "Example: Server Dependencies",
        description: "Show configured dependencies of the server",
        template: "deps(//server:run)",
        parameters: [],
        category: "examples",
        queryType: "cquery",
        outputFormat: "label_kind",
      },
      {
        id: "example-aquery-proto",
        name: "Example: Proto Build Actions",
        description: "Show actions for building proto files",
        template: "//proto:gazel_ts_proto",
        parameters: [],
        category: "examples",
        queryType: "aquery",
        outputFormat: "text",
      },
    ];

    const protoTemplates = templates.map((t) =>
      create(QueryTemplateSchema, {
        id: t.id,
        name: t.name,
        description: t.description,
        template: t.template,
        parameters: t.parameters,
        category: t.category,
        queryType: t.queryType,
        outputFormat: t.outputFormat,
      })
    );

    return create(GetQueryTemplatesResponseSchema, {
      templates: protoTemplates,
    });
  }

  /**
   * Get saved queries (stub implementation - would need database)
   */
  async getSavedQueries(
    _request: GetSavedQueriesRequest
  ): Promise<GetSavedQueriesResponse> {
    // This would typically load from a database
    // For now, return empty array
    return create(GetSavedQueriesResponseSchema, {
      queries: [],
    });
  }

  /**
   * Save a query (stub implementation - would need database)
   */
  async saveQuery(
    request: SaveQueryRequest
  ) {
    const { name, query, description } = request;

    // This would typically save to a database
    // For now, just return the query back
    const savedQuery = create(SavedQuerySchema, {
      id: Date.now().toString(),
      name,
      query,
      description,
      createdAt: { seconds: BigInt(Math.floor(Date.now() / 1000)), nanos: 0 },
      updatedAt: { seconds: BigInt(Math.floor(Date.now() / 1000)), nanos: 0 },
    });

    const resp:SaveQueryResponse = create(SaveQueryResponseSchema, {
      query: savedQuery,
    });
    return resp;
  }

  /**
   * Delete a query (stub implementation - would need database)
   */
  async deleteQuery(
    _request: DeleteQueryRequest
  ) {
    // This would typically delete from a database
    // For now, just return success
    return Promise.resolve(create(DeleteQueryResponseSchema, {
      success: true,
    }));
  }

  /**
   * Stream run events (server streaming)
   */
  async *streamRun(
    request: StreamRunRequest
  ) {
    const { target, options = [] } = request;

    if (!target) {
      throw new Error("Target is required");
    }

    // Start the run - send initial output
    yield create(StreamRunResponseSchema, {
      event: {
        case: "output",
        value: `Starting run of ${target}`,
      },
    });

    try {
      // Execute the run command
      const result = await bazelService.execute(["run", target, ...options]);

      // Yield output lines as progress events
      const lines = result.stdout.split("\n");
      for (const line of lines) {
        if (line.trim()) {
          yield create(StreamRunResponseSchema, {
            event: {
              case: "output",
              value: line,
            },
          });
        }
      }

      // Send completion
      yield create(StreamRunResponseSchema, {
        event: {
          case: "complete",
          value: create(RunCompleteSchema, {
            success: true,
            exitCode: 0,
          }),
        },
      });
    } catch (error: any) {
      // Send error
      yield create(StreamRunResponseSchema, {
        event: {
          case: "error",
          value: error.message,
        },
      });
    }
  }

  /**
   * Get build file content and targets
   */
  async getBuildFile(
    request: GetBuildFileRequest
  ): Promise<GetBuildFileResponse> {
      const { path: filePath } = request;

      if (!filePath) {
        throw new Error("File path is required");
      }

      const fullPath = path.join(config.bazelWorkspace, filePath);

      // Read the file content
      const content = await fs.readFile(fullPath, "utf-8");
      const lines = content.split("\n");

      // Parse targets from the BUILD file

      // Simple regex-based parsing to find target definitions
      const targetRegex = /^(\w+)\s*\(\s*name\s*=\s*["']([^"']+)["']/;

      const targets = lines.flatMap((line, index) => {
        const match = line.match(targetRegex);
        return match ? [create(BuildFileTargetSchema, {
            ruleType: match[1],
            name: match[2],
            line: index + 1,
          })] : [];
      });



      return create(GetBuildFileResponseSchema, {
        path: filePath,
        content,
        targets,
        lines: lines.length,
      });
    
  }

  /**
   * Get targets that use a specific file
   */
  async getTargetsByFile(
    request: GetTargetsByFileRequest
  ): Promise<GetTargetsByFileResponse> {
    try {
      const { file } = request;

      if (!file) {
        throw new Error("File name is required");
      }

      // Query for targets that have this file in their srcs
      const query = `attr(srcs, ${file}, //...)`;

      try {
        const result = await bazelService.query(query, "label_kind");
        const targets = parserService.parseLabelKindOutput(result.stdout);

        // Convert to proto format
        const protoTargets = targets.map((target) =>
          create(BazelTargetSchema,target)
        );

        return create(GetTargetsByFileResponseSchema, {
          file,
          total: protoTargets.length,
          targets: protoTargets,
        });
      } catch (queryError) {
        // If query fails, return empty results
        return create(GetTargetsByFileResponseSchema, {
          file,
          total: 0,
          targets: [],
        });
      }
    } catch (error: any) {
      throw new Error(`Failed to get targets by file: ${error.message}`);
    }
  }

  /**
   * Search in files
   */
  async searchInFiles(
    request: SearchInFilesRequest
  ): Promise<SearchInFilesResponse> {
    try {
      const { query, caseSensitive = false } = request;

      if (!query) {
        throw new Error("Search query is required");
      }

      // Use grep to search in BUILD files
      const grepArgs = [
        "-n", // Show line numbers
        "-H", // Show file names
        caseSensitive ? "" : "-i", // Case insensitive
        query,
        "--include=BUILD*",
        "--include=*.bzl",
        "-r", // Recursive
        config.bazelWorkspace,
      ].filter(Boolean);

      try {
        const result = await bazelService.execute(["run", "@bazel_tools//tools/bash:bash", "--", "-c", `grep ${grepArgs.join(" ")}`]);

        // Parse grep output (format: file:line:content)
        const results: Array<{ file: string; line: number; content: string }> = [];
        const lines = result.stdout.split("\n").filter((line) => line.trim());

        for (const line of lines) {
          const match = line.match(/^([^:]+):(\d+):(.+)$/);
          if (match) {
            results.push({
              file: match[1].replace(config.bazelWorkspace + "/", ""),
              line: parseInt(match[2], 10),
              content: match[3],
            });
          }
        }

        // Convert to proto format
        const protoResults = results.map((r) =>
          create(SearchResultSchema, {
            file: r.file,
            line: r.line,
            content: r.content,
          })
        );

        return create(SearchInFilesResponseSchema, {
          query,
          caseSensitive,
          total: protoResults.length,
          results: protoResults,
        });
      } catch (grepError) {
        // If grep fails (no matches or error), return empty results
        return create(SearchInFilesResponseSchema, {
          query,
          caseSensitive,
          total: 0,
          results: [],
        });
      }
    } catch (error: any) {
      throw new Error(`Failed to search in files: ${error.message}`);
    }
  }

  /**
   * Get command history
   */
  async getCommandHistory(
    request: GetCommandHistoryRequest
  ): Promise<GetCommandHistoryResponse> {
    // For now, return empty history
    // In a real implementation, this would read from a persistent store
    const limit = request.limit || 50;

    return create(GetCommandHistoryResponseSchema, {
      history: [],
    });
  }

  /**
   * Update Bazel executable path
   */
  async updateBazelExecutable(
    request: UpdateBazelExecutableRequest
  ): Promise<UpdateBazelExecutableResponse> {
    try {
      const executable = request.executable || '';

      // Update the config
      const detectedPath = setBazelExecutable(executable);

      // Update the bazelService to use the new executable
      bazelService.setBazelExecutable(detectedPath);

      // Verify the executable works by running 'bazel version'
      try {
        const result = await bazelService.execute(['version']);
        console.log(`[updateBazelExecutable] Successfully verified Bazel executable: ${detectedPath}`);
        console.log(`[updateBazelExecutable] Bazel version output: ${result.stdout.substring(0, 100)}`);

        return create(UpdateBazelExecutableResponseSchema, {
          success: true,
          message: 'Bazel executable updated and verified successfully',
          detectedPath: detectedPath,
        });
      } catch (verifyError: any) {
        console.error(`[updateBazelExecutable] Failed to verify Bazel executable: ${verifyError.message}`);
        return create(UpdateBazelExecutableResponseSchema, {
          success: false,
          message: `Bazel executable set to "${detectedPath}" but verification failed: ${verifyError.message}`,
          detectedPath: detectedPath,
        });
      }
    } catch (error: any) {
      console.error(`[updateBazelExecutable] Error: ${error.message}`);
      return create(UpdateBazelExecutableResponseSchema, {
        success: false,
        message: `Failed to update Bazel executable: ${error.message}`,
        detectedPath: '',
      });
    }
  }
}
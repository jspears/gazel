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
  BazelTargetSchema,
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
} from "proto/gazel_pb.js";
import bazelService from "./services/bazel.js";
import parserService from "./services/parser.js";
import config, { setWorkspace } from "./config.js";
import * as fs from "fs/promises";
import * as fsSync from "node:fs";
import * as path from "path";

export class GazelServiceImpl implements ServiceImpl<typeof GazelService> {
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
   * List all targets
   */
  async listTargets(request: ListTargetsRequest): Promise<ListTargetsResponse> {
    try {
      // Ensure we have valid defaults for pattern and format
      const pattern = request.pattern || "//...";
      const format = request.format || "label_kind";

      const result = await bazelService.query(pattern, format);

      let targets: any[];
      if (format === "xml") {
        const parsed = await parserService.parseXmlOutput(result.stdout);
        targets = parsed.targets;
      } else if (format === "label_kind") {
        targets = parserService.parseLabelKindOutput(result.stdout);
      } else {
        targets = parserService.parseLabelOutput(result.stdout);
      }

      // Convert to proto format
      const protoTargets = targets.map((target) =>
        create(BazelTargetSchema, {
          label: target.label || "",
          kind: target.kind || "",
          package: target.package || "",
          name: target.name || "",
          tags: target.tags || [],
          deps: target.deps || [],
          srcs: target.srcs || [],
          attributes: target.attributes || {},
        })
      );

      // Group targets by package
      const byPackage: Record<string, any> = {};
      protoTargets.forEach((target) => {
        const pkg = target.package || "unknown";
        if (!byPackage[pkg]) {
          byPackage[pkg] = create(TargetListSchema, { targets: [] });
        }
        byPackage[pkg].targets.push(target);
      });

      return create(ListTargetsResponseSchema, {
        total: protoTargets.length,
        targets: protoTargets,
        byPackage,
      });
    } catch (error: any) {
      throw new Error(`Failed to list targets: ${error.message}`);
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

      const result = await bazelService.query(fullTarget, "xml");
      const parsed = await parserService.parseXmlOutput(result.stdout);

      if (parsed.targets.length === 0) {
        throw new Error(`Target ${fullTarget} not found`);
      }

      const targetData = parsed.targets[0] as any;
      const protoTarget = create(BazelTargetSchema, {
        label: targetData.label || fullTarget,
        kind: targetData.kind || "",
        package: targetData.package || "",
        name: targetData.name || "",
        tags: targetData.tags || [],
        deps: targetData.deps || [],
        srcs: targetData.srcs || [],
        attributes: targetData.attributes || {},
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
      const dependencies = parserService.parseLabelOutput(result.stdout);

      // Convert dependencies to BazelTarget format
      const protoDeps = dependencies.map((dep: any) =>
        create(BazelTargetSchema, {
          label: typeof dep === 'string' ? dep : (dep.label || ""),
          kind: dep.kind || "",
          package: dep.package || "",
          name: dep.name || "",
          tags: [],
          deps: [],
          srcs: [],
          attributes: {},
        })
      );

      return create(GetTargetDependenciesResponseSchema, {
        target: fullTarget,
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
      const dependencies = parserService.parseLabelOutput(result.stdout);

      // Convert to BazelTarget format
      const protoDeps = dependencies.map((dep: any) =>
        create(BazelTargetSchema, {
          label: typeof dep === 'string' ? dep : (dep.label || ""),
          kind: dep.kind || "",
          package: dep.package || "",
          name: dep.name || "",
          tags: [],
          deps: [],
          srcs: [],
          attributes: {},
        })
      );

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
      const protoTargets = targets.map((target: any) =>
        create(BazelTargetSchema, {
          label: target.label || "",
          kind: target.kind || "",
          package: target.package || "",
          name: target.name || "",
          tags: [],
          deps: [],
          srcs: [],
          attributes: {},
        })
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
      const { query, outputFormat = "label_kind" } = request;

      if (!query) {
        throw new Error("Query is required");
      }

      const result = await bazelService.query(query, outputFormat);

      let parsedResult: any;
      if (outputFormat === "xml") {
        parsedResult = await parserService.parseXmlOutput(result.stdout);
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
          attributes: target.attributes || {},
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
    // For now, execute the query and yield results in chunks
    const { query, outputFormat = "label_kind" } = request;

    if (!query) {
      throw new Error("Query is required");
    }

    const result = await bazelService.query(query, outputFormat);
    const lines = result.stdout.split("\n");

    // Yield results in chunks
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

    // Send final line
    yield create(StreamQueryResponseSchema, {
      data: {
        case: "rawLine",
        value: "",
      },
    });
  }

  /**
   * Build a target
   */
  async buildTarget(
    request: BuildTargetRequest
  ): Promise<BuildTargetResponse> {
    try {
      const { target, options = [] } = request;

      if (!target) {
        throw new Error("Target is required");
      }

      try {
        const result = await bazelService.build(target, options);

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
        });
      }
    } catch (error: any) {
      throw new Error(`Build failed: ${error.message}`);
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
      const result = await bazelService.execute(["mod", "graph", "--output", "json"]);

      // Parse the JSON output
      let moduleGraph: any;
      try {
        moduleGraph = JSON.parse(result.stdout);
      } catch (parseError) {
        // Return empty graph if parsing fails
        return create(GetModuleGraphResponseSchema, {
          root: "",
          modules: [],
        });
      }

      // Convert to proto format
      const protoModules = Object.entries(moduleGraph.modules || {}).map(
        ([key, mod]: [string, any]) =>
          create(ModuleSchema, {
            key,
            name: mod.name || "",
            version: mod.version || "",
          })
      );

      return create(GetModuleGraphResponseSchema, {
        root: moduleGraph.root || "",
        modules: protoModules,
      });
    } catch (error: any) {
      // Return empty graph on error
      return create(GetModuleGraphResponseSchema, {
        root: "",
        modules: [],
      });
    }
  }
}
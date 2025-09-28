/**
 * gRPC Server for Gazel API
 * Replaces the HTTP/REST server with native gRPC
 */

import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BazelService } from './services/bazel.js';
import type { 
  WorkspaceInfo,
  BazelTarget,
  BuildFile,
  QueryTemplate,
  SavedQuery,
  CommandHistory 
} from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load proto file
const PROTO_PATH = path.join(__dirname, '../proto/gazel.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [path.join(__dirname, '../proto')]
});

const gazelProto = grpc.loadPackageDefinition(packageDefinition) as any;

export class GazelGrpcServer {
  private server: grpc.Server;
  private bazelService: BazelService;
  private port: number;

  constructor(port = 50051) {
    this.port = port;
    this.server = new grpc.Server();
    this.bazelService = new BazelService();
    
    // Add the Gazel service implementation
    this.server.addService(gazelProto.gazel.api.v1.GazelService.service, {
      // Workspace operations
      getWorkspaceInfo: this.getWorkspaceInfo.bind(this),
      getCurrentWorkspace: this.getCurrentWorkspace.bind(this),
      scanWorkspaces: this.scanWorkspaces.bind(this),
      switchWorkspace: this.switchWorkspace.bind(this),
      
      // Target operations
      listTargets: this.listTargets.bind(this),
      getTarget: this.getTarget.bind(this),
      getTargetDependencies: this.getTargetDependencies.bind(this),
      searchTargets: this.searchTargets.bind(this),
      
      // Query operations
      executeQuery: this.executeQuery.bind(this),
      streamQuery: this.streamQuery.bind(this),
      
      // Build operations
      buildTarget: this.buildTarget.bind(this),
      streamBuild: this.streamBuild.bind(this),
      
      // Module operations
      getModuleGraph: this.getModuleGraph.bind(this)
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.bindAsync(
        `0.0.0.0:${this.port}`,
        grpc.ServerCredentials.createInsecure(),
        (error, port) => {
          if (error) {
            reject(error);
          } else {
            console.log(`[GazelGrpcServer] Server listening on port ${port}`);
            resolve();
          }
        }
      );
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.tryShutdown(() => {
        console.log('[GazelGrpcServer] Server stopped');
        resolve();
      });
    });
  }

  // ===== Workspace Operations =====

  async getWorkspaceInfo(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const info = await this.bazelService.getWorkspaceInfo();
      callback(null, { info });
    } catch (error: any) {
      callback({
        code: grpc.status.INTERNAL,
        message: error.message
      });
    }
  }

  async getCurrentWorkspace(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const workspace = this.bazelService.getCurrentWorkspace();
      callback(null, {
        configured: !!workspace,
        workspace: workspace || '',
        valid: !!workspace,
        error: workspace ? '' : 'No workspace configured'
      });
    } catch (error: any) {
      callback({
        code: grpc.status.INTERNAL,
        message: error.message
      });
    }
  }

  async scanWorkspaces(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const workspaces = await this.bazelService.scanForWorkspaces();
      callback(null, { workspaces });
    } catch (error: any) {
      callback({
        code: grpc.status.INTERNAL,
        message: error.message
      });
    }
  }

  async switchWorkspace(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const { workspace } = call.request;
      this.bazelService.setWorkspace(workspace);
      
      // Verify the workspace is valid
      const info = await this.bazelService.getWorkspaceInfo();
      
      callback(null, {
        success: true,
        workspace,
        message: `Switched to workspace: ${info.name}`
      });
    } catch (error: any) {
      callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: error.message
      });
    }
  }

  // ===== Target Operations =====

  async listTargets(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const { pattern = '//...', format = 'label_kind' } = call.request;
      const result = await this.bazelService.listTargets(pattern, format);
      
      // Convert byPackage to proto format
      const byPackage: any = {};
      for (const [pkg, targets] of Object.entries(result.byPackage)) {
        byPackage[pkg] = { targets };
      }
      
      callback(null, {
        total: result.total,
        targets: result.targets,
        by_package: byPackage
      });
    } catch (error: any) {
      callback({
        code: grpc.status.INTERNAL,
        message: error.message
      });
    }
  }

  async getTarget(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const { target } = call.request;
      const targetInfo = await this.bazelService.getTargetInfo(target);
      callback(null, { target: targetInfo });
    } catch (error: any) {
      callback({
        code: grpc.status.NOT_FOUND,
        message: error.message
      });
    }
  }

  async getTargetDependencies(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const { target, depth = 1 } = call.request;
      const deps = await this.bazelService.getTargetDependencies(target, depth);
      callback(null, {
        target,
        depth,
        total: deps.length,
        dependencies: deps
      });
    } catch (error: any) {
      callback({
        code: grpc.status.INTERNAL,
        message: error.message
      });
    }
  }

  async searchTargets(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const { query, type, package: pkg } = call.request;
      const targets = await this.bazelService.searchTargets(query, type, pkg);
      callback(null, {
        query,
        total: targets.length,
        targets
      });
    } catch (error: any) {
      callback({
        code: grpc.status.INTERNAL,
        message: error.message
      });
    }
  }

  // ===== Query Operations =====

  async executeQuery(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const { query, output_format = 'label_kind' } = call.request;
      const result = await this.bazelService.executeQuery(query, output_format);
      callback(null, {
        query,
        output_format,
        result: { targets: result.targets },
        raw: result.raw
      });
    } catch (error: any) {
      callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: error.message
      });
    }
  }

  async streamQuery(call: grpc.ServerWritableStream<any, any>): Promise<void> {
    try {
      const { query, output_format = 'label_kind', parse_xml } = call.request;
      
      // Execute query and stream results
      const stream = this.bazelService.streamQuery(query, output_format);
      
      stream.on('data', (data) => {
        if (parse_xml && typeof data === 'object') {
          call.write({ target: data });
        } else {
          call.write({ raw_line: data.toString() });
        }
      });
      
      stream.on('error', (error) => {
        call.write({ error: error.message });
        call.end();
      });
      
      stream.on('end', () => {
        call.end();
      });
    } catch (error: any) {
      call.write({ error: error.message });
      call.end();
    }
  }

  // ===== Build Operations =====

  async buildTarget(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const { target, options = [] } = call.request;
      const result = await this.bazelService.buildTarget(target, options);
      callback(null, result);
    } catch (error: any) {
      callback({
        code: grpc.status.INTERNAL,
        message: error.message
      });
    }
  }

  async streamBuild(call: grpc.ServerWritableStream<any, any>): Promise<void> {
    try {
      const { target, options = [] } = call.request;

      // Start build with streaming
      const buildProcess = this.bazelService.streamBuild(target, options);

      buildProcess.on('output', (data: string) => {
        call.write({ output: data });
      });

      buildProcess.on('error', (error: string) => {
        call.write({ error });
      });

      buildProcess.on('progress', (progress: any) => {
        call.write({
          progress: {
            actions_completed: progress.completed,
            actions_total: progress.total,
            current_action: progress.action
          }
        });
      });

      buildProcess.on('complete', (result: any) => {
        call.write({
          complete: {
            success: result.success,
            exit_code: result.exitCode,
            duration_ms: result.duration
          }
        });
        call.end();
      });
    } catch (error: any) {
      call.write({ error: error.message });
      call.end();
    }
  }

  // ===== Module Operations =====

  async getModuleGraph(
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  ): Promise<void> {
    try {
      const graph = await this.bazelService.getModuleGraph();
      callback(null, {
        root: graph.root,
        modules: graph.modules,
        dependencies: graph.dependencies,
        statistics: graph.statistics
      });
    } catch (error: any) {
      callback({
        code: grpc.status.INTERNAL,
        message: error.message
      });
    }
  }
}

// Export function to create and start the server
export async function startGrpcServer(port = 50051): Promise<GazelGrpcServer> {
  const server = new GazelGrpcServer(port);
  await server.start();
  return server;
}

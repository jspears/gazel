/**
 * gRPC-Web/Connect Server for Gazel API
 * Supports both gRPC and gRPC-web protocols for browser compatibility
 */

import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bazelService from '../services/bazel.js';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load proto file
const PROTO_PATH = path.join(__dirname, '../../proto/gazel.proto');

const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
  includeDirs: [path.join(__dirname, '../../proto')]
});

const gazelProto = grpc.loadPackageDefinition(packageDefinition) as any;

export class GrpcWebServer {
  private app: express.Application;
  private bazelService: typeof bazelService;
  private port: number;
  private server: any;
  private currentWorkspace: string = process.cwd();

  constructor(port = 8080) {
    this.port = port;
    this.app = express();
    this.bazelService = bazelService;
    
    // Setup middleware
    this.setupMiddleware();
    
    // Setup routes
    this.setupRoutes();
  }

  private setupMiddleware() {
    // Enable CORS for all origins (adjust as needed for production)
    this.app.use(cors({
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Grpc-Web', 'X-User-Agent'],
    }));

    // Parse JSON bodies
    this.app.use(express.json({ limit: '50mb' }));
    
    // Parse binary bodies for gRPC-web
    this.app.use(express.raw({ 
      type: 'application/grpc-web+proto',
      limit: '50mb' 
    }));
    
    this.app.use(express.raw({ 
      type: 'application/grpc-web-text',
      limit: '50mb' 
    }));
  }

  private registerEndpoint(methodName: string, handler: (req: any) => Promise<any>, apiPath?: string) {
    // Register Connect protocol endpoint
    this.app.post(`/gazel.GazelService/${methodName}`, async (req, res) => {
      try {
        console.log(`[GrpcWebServer] Handling Connect request for ${methodName}:`, req.body);
        const result = await handler(req.body);

        // Connect protocol expects specific headers
        res.setHeader('content-type', 'application/json');
        res.json(result);
      } catch (error: any) {
        console.error(`[GrpcWebServer] Error in ${methodName}:`, error);

        // Connect protocol error format
        res.status(500).json({
          code: 'internal',
          message: error.message
        });
      }
    });

    // Also register JSON-RPC style endpoint if path provided
    if (apiPath) {
      this.app.post(apiPath, async (req, res) => {
        try {
          const result = await handler(req.body);
          res.json(result);
        } catch (error: any) {
          console.error(`[GrpcWebServer] Error in ${apiPath}:`, error);
          res.status(500).json({ error: error.message });
        }
      });
    }
  }

  private setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', service: 'gazel-grpc-web' });
    });

    // Register all endpoints with both Connect and JSON-RPC paths

    // Workspace operations
    this.registerEndpoint('GetWorkspaceInfo', (req) => this.getWorkspaceInfo(req), '/api/workspace/info');
    this.registerEndpoint('GetCurrentWorkspace', (req) => this.getCurrentWorkspace(req), '/api/workspace/current');
    this.registerEndpoint('ScanWorkspaces', (req) => this.scanWorkspaces(req), '/api/workspace/scan');
    this.registerEndpoint('SwitchWorkspace', (req) => this.switchWorkspace(req), '/api/workspace/switch');
    this.registerEndpoint('GetWorkspaceFiles', (req) => this.getWorkspaceFiles(req), '/api/workspace/files');

    // Target operations
    this.registerEndpoint('ListTargets', (req) => this.listTargets(req), '/api/targets/list');
    this.registerEndpoint('GetTarget', (req) => this.getTarget(req), '/api/targets/get');
    this.registerEndpoint('GetTargetDependencies', (req) => this.getTargetDependencies(req), '/api/targets/dependencies');
    this.registerEndpoint('GetTargetOutputs', (req) => this.getTargetOutputs(req), '/api/targets/outputs');
    this.registerEndpoint('GetReverseDependencies', (req) => this.getReverseDependencies(req), '/api/targets/reverse-dependencies');
    this.registerEndpoint('SearchTargets', (req) => this.searchTargets(req), '/api/targets/search');

    // Query operations
    this.registerEndpoint('ExecuteQuery', (req) => this.executeQuery(req), '/api/query/execute');

    // Build operations
    this.registerEndpoint('BuildTarget', (req) => this.buildTarget(req), '/api/build/target');
    this.registerEndpoint('TestTarget', (req) => this.testTarget(req), '/api/test/target');
    this.registerEndpoint('RunTarget', (req) => this.runTarget(req), '/api/run/target');

    // Module operations
    this.registerEndpoint('GetModuleGraph', (req) => this.getModuleGraph(req), '/api/modules/graph');

    // Build file operations
    this.registerEndpoint('GetBuildFile', (req) => this.getBuildFile(req), '/api/buildfile/get');
    this.registerEndpoint('ListBuildFiles', (req) => this.listBuildFiles(req), '/api/buildfile/list');
  }

  // Implement service methods
  private async getWorkspaceInfo(request: any): Promise<any> {
    const workspace = request.path || this.currentWorkspace;
    
    try {
      // Check if it's a valid Bazel workspace
      const hasWorkspace = await this.fileExists(path.join(workspace, 'WORKSPACE')) ||
                          await this.fileExists(path.join(workspace, 'WORKSPACE.bazel')) ||
                          await this.fileExists(path.join(workspace, 'MODULE.bazel'));
      
      if (!hasWorkspace) {
        return {
          path: workspace,
          name: path.basename(workspace),
          valid: false,
          error: 'Not a Bazel workspace',
          packages: [],
          target_count: 0,
          file_count: 0
        };
      }

      // Get basic info
      const { stdout } = await execAsync('bazel query "//..." --output=package', {
        cwd: workspace,
        maxBuffer: 10 * 1024 * 1024
      });

      const packages = stdout.trim().split('\n').filter(p => p.length > 0);

      return {
        path: workspace,
        name: path.basename(workspace),
        valid: true,
        error: '',
        packages,
        target_count: 0, // Would need another query
        file_count: packages.length
      };
    } catch (error: any) {
      return {
        path: workspace,
        name: path.basename(workspace),
        valid: false,
        error: error.message,
        packages: [],
        target_count: 0,
        file_count: 0
      };
    }
  }

  private async getCurrentWorkspace(request: any): Promise<any> {
    return {
      configured: true,
      workspace: this.currentWorkspace,
      name: path.basename(this.currentWorkspace)
    };
  }

  private async scanWorkspaces(request: any): Promise<any> {
    const searchPath = request.path || process.env.HOME;
    const workspaces: any[] = [];

    try {
      // Simple implementation - just check a few common locations
      const commonPaths = [
        process.cwd(),
        path.join(process.env.HOME || '', 'Documents'),
        path.join(process.env.HOME || '', 'Projects'),
        path.join(process.env.HOME || '', 'workspace')
      ];

      for (const dir of commonPaths) {
        if (await this.isBazelWorkspace(dir)) {
          workspaces.push({
            path: dir,
            name: path.basename(dir),
            valid: true
          });
        }
      }
    } catch (error) {
      console.error('Error scanning workspaces:', error);
    }

    return { workspaces };
  }

  private async switchWorkspace(request: any): Promise<any> {
    // Accept both 'workspace' and 'path' for compatibility
    const newWorkspace = request.workspace || request.path;

    if (!newWorkspace) {
      return {
        success: false,
        error: 'Workspace path is required'
      };
    }

    if (!await this.isBazelWorkspace(newWorkspace)) {
      return {
        success: false,
        error: 'Not a valid Bazel workspace'
      };
    }

    this.currentWorkspace = newWorkspace;

    return {
      success: true,
      workspace: this.currentWorkspace,
      name: path.basename(this.currentWorkspace)
    };
  }

  private async getWorkspaceFiles(request: any): Promise<any> {
    const workspace = this.currentWorkspace;
    const files: any[] = [];

    try {
      // Find all BUILD files
      const { stdout } = await execAsync('find . -name "BUILD" -o -name "BUILD.bazel" | head -100', {
        cwd: workspace,
        maxBuffer: 10 * 1024 * 1024
      });

      const buildFiles = stdout.trim().split('\n').filter(f => f.length > 0);

      for (const file of buildFiles) {
        const fullPath = path.join(workspace, file);
        const stats = await fs.stat(fullPath);

        files.push({
          path: file.replace(/^\.\//, ''),
          package: path.dirname(file).replace(/^\.\//, ''),
          size_bytes: stats.size,
          modified_time: stats.mtime.toISOString()
        });
      }
    } catch (error) {
      console.error('Error getting workspace files:', error);
    }

    return { files };
  }

  private async listTargets(request: any): Promise<any> {
    const pattern = request.pattern || '//...';

    try {
      const { stdout } = await execAsync(`bazel query "${pattern}" --output=label_kind`, {
        cwd: this.currentWorkspace,
        maxBuffer: 10 * 1024 * 1024
      });

      const lines = stdout.trim().split('\n').filter(line => line.length > 0);
      const targets: any[] = [];
      const byPackage: Record<string, any[]> = {};

      for (const line of lines) {
        const match = line.match(/^(\S+)\s+rule\s+(\/\/[^:]+):(.+)$/);
        if (match) {
          const [, kind, pkg, name] = match;
          const label = `${pkg}:${name}`;
          const target = {
            label,
            full: label,
            kind,
            ruleType: kind,
            type: kind,
            package: pkg,
            name
          };

          targets.push(target);

          if (!byPackage[pkg]) {
            byPackage[pkg] = [];
          }
          byPackage[pkg].push(target);
        }
      }

      return {
        total: targets.length,
        targets,
        by_package: byPackage
      };
    } catch (error: any) {
      return {
        total: 0,
        targets: [],
        by_package: {},
        error: error.message
      };
    }
  }

  private async getTarget(request: any): Promise<any> {
    const targetName = request.target;

    if (!targetName) {
      return { target: null, error: 'Target name is required' };
    }

    try {
      const { stdout } = await execAsync(`bazel query --output=xml "${targetName}"`, {
        cwd: this.currentWorkspace,
        maxBuffer: 10 * 1024 * 1024
      });

      // Parse XML to extract target info
      const xmlContent = stdout.trim();

      // Extract basic info from XML
      const ruleMatch = xmlContent.match(/class="([^"]+)"/);
      const ruleType = ruleMatch ? ruleMatch[1] : 'unknown';

      const locationMatch = xmlContent.match(/location="([^"]+)"/);
      const location = locationMatch ? locationMatch[1] : null;

      const nameMatch = xmlContent.match(/name="([^"]+)"/);
      const ruleName = nameMatch ? nameMatch[1] : null;

      // Parse attributes
      const attributes: Record<string, any> = {};

      // Extract string attributes
      const stringAttrs = xmlContent.matchAll(/<string name="([^"]+)" value="([^"]+)"\/>/g);
      for (const match of stringAttrs) {
        attributes[match[1]] = match[2];
      }

      // Extract list attributes
      const listMatches = xmlContent.matchAll(/<list name="([^"]+)">(.*?)<\/list>/gs);
      for (const match of listMatches) {
        const attrName = match[1];
        const listContent = match[2];
        const items: string[] = [];

        const labelMatches = listContent.matchAll(/<label value="([^"]+)"\/>/g);
        for (const labelMatch of labelMatches) {
          items.push(labelMatch[1]);
        }

        const stringMatches = listContent.matchAll(/<string value="([^"]+)"\/>/g);
        for (const stringMatch of stringMatches) {
          items.push(stringMatch[1]);
        }

        if (items.length > 0) {
          attributes[attrName] = items;
        }
      }

      // Parse target name to get package and name
      const targetMatch = targetName.match(/^(\/\/[^:]+):(.+)$/);
      let pkg = '';
      let name = targetName;

      if (targetMatch) {
        [, pkg, name] = targetMatch;
      }

      return {
        target: {
          label: targetName,
          full: targetName,
          name: ruleName || name,
          package: pkg,
          type: ruleType,
          ruleType: ruleType,
          kind: ruleType,
          location: location,
          attributes: attributes
        }
      };
    } catch (error: any) {
      return { target: null, error: error.message };
    }
  }

  private async getTargetDependencies(request: any): Promise<any> {
    const targetName = request.target;
    const depth = request.depth || 1;

    if (!targetName) {
      return {
        target: targetName,
        depth,
        total: 0,
        dependencies: [],
        error: 'Target name is required'
      };
    }

    try {
      const { stdout } = await execAsync(`bazel query "deps(${targetName}, ${depth})" --output=label_kind`, {
        cwd: this.currentWorkspace,
        maxBuffer: 10 * 1024 * 1024
      });

      const lines = stdout.trim().split('\n').filter(line => line.length > 0);
      const dependencies: any[] = [];

      for (const line of lines) {
        // Skip the target itself
        if (line.includes(targetName)) continue;

        const match = line.match(/^(\S+)\s+rule\s+(\/\/[^:]+):(.+)$/);
        if (match) {
          const [, kind, pkg, name] = match;
          const label = `${pkg}:${name}`;
          dependencies.push({
            label,
            full: label,
            kind,
            ruleType: kind,
            type: kind,
            package: pkg,
            name
          });
        }
      }

      return {
        target: targetName,
        depth,
        total: dependencies.length,
        dependencies
      };
    } catch (error: any) {
      return {
        target: targetName,
        depth,
        total: 0,
        dependencies: [],
        error: error.message
      };
    }
  }

  private async getTargetOutputs(request: any): Promise<any> {
    const targetName = request.target;

    if (!targetName) {
      return {
        target: targetName,
        outputs: [],
        count: 0,
        error: 'Target name is required'
      };
    }

    try {
      const { stdout } = await execAsync(
        `bazel cquery ${targetName} --output=files 2>/dev/null || bazel query ${targetName} --output=label 2>/dev/null`,
        {
          cwd: this.currentWorkspace,
          maxBuffer: 10 * 1024 * 1024,
          shell: '/bin/bash'
        }
      );

      const lines = stdout.trim().split('\n').filter(line => line.length > 0);
      const outputs: any[] = [];

      for (const line of lines) {
        if (line.startsWith('bazel-')) {
          const filename = path.basename(line);
          const ext = path.extname(line).replace('.', '');
          outputs.push({
            path: line,
            filename,
            type: ext || 'unknown'
          });
        }
      }

      return {
        target: targetName,
        outputs,
        count: outputs.length,
        error: null
      };
    } catch (error: any) {
      return {
        target: targetName,
        outputs: [],
        count: 0,
        error: null // Don't show error as this is optional
      };
    }
  }

  private async getReverseDependencies(request: any): Promise<any> {
    const targetName = request.target;

    if (!targetName) {
      return {
        target: targetName,
        total: 0,
        dependencies: [],
        error: 'Target name is required'
      };
    }

    try {
      const { stdout } = await execAsync(`bazel query "rdeps(//..., ${targetName})" --output=label_kind`, {
        cwd: this.currentWorkspace,
        maxBuffer: 10 * 1024 * 1024
      });

      const lines = stdout.trim().split('\n').filter(line => line.length > 0);
      const dependencies: any[] = [];

      for (const line of lines) {
        // Skip the target itself
        if (line.includes(targetName)) continue;

        const match = line.match(/^(\S+)\s+rule\s+(\/\/[^:]+):(.+)$/);
        if (match) {
          const [, kind, pkg, name] = match;
          const label = `${pkg}:${name}`;
          dependencies.push({
            label,
            full: label,
            kind,
            ruleType: kind,
            type: kind,
            package: pkg,
            name
          });
        }
      }

      return {
        target: targetName,
        total: dependencies.length,
        dependencies
      };
    } catch (error: any) {
      return {
        target: targetName,
        total: 0,
        dependencies: [],
        error: error.message
      };
    }
  }

  private async searchTargets(request: any): Promise<any> {
    const query = request.query || '';
    const pattern = request.pattern || '//...';

    try {
      const { stdout } = await execAsync(
        `bazel query "${pattern}" --output=label_kind | grep -i "${query}"`,
        {
          cwd: this.currentWorkspace,
          maxBuffer: 10 * 1024 * 1024,
          shell: '/bin/bash'
        }
      );

      const lines = stdout.trim().split('\n').filter(line => line.length > 0);
      const targets: any[] = [];

      for (const line of lines) {
        const match = line.match(/^(\S+)\s+rule\s+(\/\/[^:]+):(.+)$/);
        if (match) {
          const [, kind, pkg, name] = match;
          const label = `${pkg}:${name}`;
          targets.push({
            label,
            full: label,
            kind,
            ruleType: kind,
            type: kind,
            package: pkg,
            name
          });
        }
      }

      return {
        total: targets.length,
        targets
      };
    } catch (error: any) {
      return {
        total: 0,
        targets: [],
        error: error.message
      };
    }
  }

  private async executeQuery(request: any): Promise<any> {
    const query = request.query;
    const outputFormat = request.output_format || 'label';

    if (!query) {
      return {
        query,
        output: '',
        results: [],
        error: 'Query is required'
      };
    }

    try {
      const { stdout } = await execAsync(`bazel query "${query}" --output=${outputFormat}`, {
        cwd: this.currentWorkspace,
        maxBuffer: 10 * 1024 * 1024
      });

      const lines = stdout.trim().split('\n').filter(line => line.length > 0);
      const targets: any[] = [];

      if (outputFormat === 'label_kind') {
        for (const line of lines) {
          const match = line.match(/^(\S+)\s+rule\s+(\/\/[^:]+):(.+)$/);
          if (match) {
            const [, kind, pkg, name] = match;
            const label = `${pkg}:${name}`;
            targets.push({
              label,
              full: label,
              kind,
              ruleType: kind,
              type: kind,
              package: pkg,
              name
            });
          }
        }
      } else if (outputFormat === 'label') {
        for (const line of lines) {
          const match = line.match(/^(\/\/[^:]+):(.+)$/);
          if (match) {
            const [, pkg, name] = match;
            const label = `${pkg}:${name}`;
            targets.push({
              label,
              full: label,
              kind: 'unknown',
              ruleType: 'unknown',
              type: 'unknown',
              package: pkg,
              name
            });
          }
        }
      }

      return {
        query,
        output: stdout,
        results: targets,
        error: null
      };
    } catch (error: any) {
      return {
        query,
        output: '',
        results: [],
        error: error.message
      };
    }
  }

  private async buildTarget(request: any): Promise<any> {
    const target = request.target;
    const args = request.args || [];

    if (!target) {
      return {
        success: false,
        target,
        output: '',
        error: 'Target is required'
      };
    }

    try {
      const argsStr = args.join(' ');
      const { stdout, stderr } = await execAsync(`bazel build ${target} ${argsStr}`, {
        cwd: this.currentWorkspace,
        maxBuffer: 10 * 1024 * 1024
      });

      return {
        success: true,
        target,
        output: stdout + stderr,
        error: null
      };
    } catch (error: any) {
      return {
        success: false,
        target,
        output: error.stdout || '' + error.stderr || '',
        error: error.message
      };
    }
  }

  private async testTarget(request: any): Promise<any> {
    const target = request.target;
    const args = request.args || [];

    if (!target) {
      return {
        success: false,
        target,
        output: '',
        error: 'Target is required'
      };
    }

    try {
      const argsStr = args.join(' ');
      const { stdout, stderr } = await execAsync(`bazel test ${target} ${argsStr}`, {
        cwd: this.currentWorkspace,
        maxBuffer: 10 * 1024 * 1024
      });

      return {
        success: true,
        target,
        output: stdout + stderr,
        error: null
      };
    } catch (error: any) {
      return {
        success: false,
        target,
        output: error.stdout || '' + error.stderr || '',
        error: error.message
      };
    }
  }

  private async runTarget(request: any): Promise<any> {
    const target = request.target;
    const args = request.args || [];

    if (!target) {
      return {
        success: false,
        target,
        output: '',
        error: 'Target is required'
      };
    }

    try {
      const argsStr = args.join(' ');
      const { stdout, stderr } = await execAsync(`bazel run ${target} ${argsStr}`, {
        cwd: this.currentWorkspace,
        maxBuffer: 10 * 1024 * 1024
      });

      return {
        success: true,
        target,
        output: stdout + stderr,
        error: null
      };
    } catch (error: any) {
      return {
        success: false,
        target,
        output: error.stdout || '' + error.stderr || '',
        error: error.message
      };
    }
  }

  private async getModuleGraph(request: any): Promise<any> {
    try {
      const { stdout } = await execAsync('bazel mod graph', {
        cwd: this.currentWorkspace,
        maxBuffer: 10 * 1024 * 1024
      });

      return {
        graph: stdout,
        error: null
      };
    } catch (error: any) {
      return {
        graph: '',
        error: error.message
      };
    }
  }

  private async getBuildFile(request: any): Promise<any> {
    const filePath = request.path;

    if (!filePath) {
      return {
        path: '',
        content: '',
        targets: [],
        error: 'File path is required'
      };
    }

    try {
      const fullPath = path.join(this.currentWorkspace, filePath);
      const content = await fs.readFile(fullPath, 'utf-8');

      // Get targets in this BUILD file
      const pkg = path.dirname(filePath).replace(/^\.\//, '');
      const { stdout } = await execAsync(`bazel query "//${pkg}:all" --output=label_kind`, {
        cwd: this.currentWorkspace,
        maxBuffer: 10 * 1024 * 1024
      });

      const lines = stdout.trim().split('\n').filter(line => line.length > 0);
      const targets: any[] = [];

      for (const line of lines) {
        const match = line.match(/^(\S+)\s+rule\s+(\/\/[^:]+):(.+)$/);
        if (match) {
          const [, kind, , name] = match;
          const label = `//${pkg}:${name}`;
          targets.push({
            label,
            full: label,
            kind,
            ruleType: kind,
            type: kind,
            package: pkg,
            name
          });
        }
      }

      return {
        path: filePath,
        content,
        targets,
        error: null
      };
    } catch (error: any) {
      return {
        path: filePath,
        content: '',
        targets: [],
        error: error.message
      };
    }
  }

  private async listBuildFiles(request: any): Promise<any> {
    try {
      const { stdout } = await execAsync('find . -name "BUILD" -o -name "BUILD.bazel" | head -100', {
        cwd: this.currentWorkspace,
        maxBuffer: 10 * 1024 * 1024
      });

      const files = stdout.trim().split('\n')
        .filter(f => f.length > 0)
        .map(f => f.replace(/^\.\//, ''));

      return {
        files,
        count: files.length,
        error: null
      };
    } catch (error: any) {
      return {
        files: [],
        count: 0,
        error: error.message
      };
    }
  }

  // Helper methods
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async isBazelWorkspace(dir: string): Promise<boolean> {
    try {
      return await this.fileExists(path.join(dir, 'WORKSPACE')) ||
             await this.fileExists(path.join(dir, 'WORKSPACE.bazel')) ||
             await this.fileExists(path.join(dir, 'MODULE.bazel'));
    } catch {
      return false;
    }
  }

  // Server lifecycle methods
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(`[GrpcWebServer] Server listening on port ${this.port}`);
        console.log(`[GrpcWebServer] HTTP endpoints available at http://localhost:${this.port}/api/*`);
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('[GrpcWebServer] Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Export for use in standalone server
export default GrpcWebServer;

/**
 * Connect Protocol Routes for Gazel API
 * Implements the Connect protocol (gRPC-web) for browser compatibility
 * Following the Connect-ES specification: https://connectrpc.com/docs/protocol
 */

import { Router } from 'express';
import bazelService from '../services/bazel.js';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';

const router = Router();
const execAsync = promisify(exec);

// Store current workspace
let currentWorkspace = process.cwd();

// Helper to check if a file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Connect protocol error codes
 * https://connectrpc.com/docs/protocol#error-codes
 */
enum ConnectErrorCode {
  Canceled = 'canceled',
  Unknown = 'unknown',
  InvalidArgument = 'invalid_argument',
  DeadlineExceeded = 'deadline_exceeded',
  NotFound = 'not_found',
  AlreadyExists = 'already_exists',
  PermissionDenied = 'permission_denied',
  ResourceExhausted = 'resource_exhausted',
  FailedPrecondition = 'failed_precondition',
  Aborted = 'aborted',
  OutOfRange = 'out_of_range',
  Unimplemented = 'unimplemented',
  Internal = 'internal',
  Unavailable = 'unavailable',
  DataLoss = 'data_loss',
  Unauthenticated = 'unauthenticated',
}

/**
 * Create a Connect protocol error response
 */
function createConnectError(code: ConnectErrorCode, message: string, details?: any[]) {
  return {
    code,
    message,
    details: details || []
  };
}

/**
 * Middleware to handle Connect protocol requests
 * The Connect protocol uses POST requests with JSON payloads
 */
router.use((req, res, next) => {
  // Set Connect protocol headers
  res.setHeader('content-type', 'application/json');
  
  // Handle CORS for Connect protocol
  if (req.method === 'OPTIONS') {
    res.setHeader('access-control-allow-methods', 'POST');
    res.setHeader('access-control-allow-headers', 'content-type,connect-protocol-version');
    res.status(204).end();
    return;
  }
  
  next();
});

/**
 * Register a Connect protocol endpoint
 * Following the Connect protocol specification for unary RPCs
 */
function registerEndpoint(
  path: string,
  handler: (request: any) => Promise<any>
) {
  router.post(path, async (req, res) => {
    try {
      // Log the request for debugging
      console.log(`[Connect] ${path}:`, req.body);
      
      // Call the handler with the request body
      const response = await handler(req.body);
      
      // Send successful response
      res.status(200).json(response);
    } catch (error: any) {
      console.error(`[Connect] Error in ${path}:`, error);
      
      // Send error response following Connect protocol
      const errorResponse = createConnectError(
        ConnectErrorCode.Internal,
        error.message || 'Internal server error'
      );
      
      // Connect protocol uses HTTP 200 with error in body
      res.status(200).json(errorResponse);
    }
  });
}

// Register Connect protocol endpoints
// The path format is: /[package].[Service]/[Method]
// We also register backward-compatible paths without the package prefix

// Helper to register both the full path and backward-compatible path
function registerBothPaths(method: string, handler: (request: any) => Promise<any>) {
  // Register with full package name (Connect protocol standard)
  registerEndpoint(`/gazel.api.v1.GazelService/${method}`, handler);
  // Register backward-compatible path
  registerEndpoint(`/gazel.GazelService/${method}`, handler);
}

registerBothPaths('GetCurrentWorkspace', async (request) => {
  const workspace = currentWorkspace;
  
  if (!workspace) {
    throw new Error('No workspace configured');
  }

  // Check if it's a valid Bazel workspace
  const isValid = await fileExists(path.join(workspace, 'WORKSPACE')) ||
                  await fileExists(path.join(workspace, 'WORKSPACE.bazel')) ||
                  await fileExists(path.join(workspace, 'MODULE.bazel'));

  return {
    configured: true,
    workspace,
    valid: isValid,
    error: isValid ? '' : 'Not a valid Bazel workspace'
  };
});

registerBothPaths('SwitchWorkspace', async (request) => {
  const newWorkspace = request.workspace || request.path;

  if (!newWorkspace) {
    throw new Error('Workspace path is required');
  }

  // Check if it's a valid Bazel workspace
  const isValid = await fileExists(path.join(newWorkspace, 'WORKSPACE')) ||
                  await fileExists(path.join(newWorkspace, 'WORKSPACE.bazel')) ||
                  await fileExists(path.join(newWorkspace, 'MODULE.bazel'));

  if (!isValid) {
    throw new Error('Not a valid Bazel workspace');
  }

  // Update both our local state and the bazel service
  currentWorkspace = newWorkspace;
  bazelService.setWorkspace(newWorkspace);

  return {
    success: true,
    workspace: newWorkspace,
    message: `Switched to workspace: ${newWorkspace}`
  };
});

registerBothPaths('GetWorkspaceInfo', async (request) => {
  const workspace = request.path || currentWorkspace;
  
  if (!workspace) {
    throw new Error('No workspace specified');
  }

  try {
    // Check if it's a valid Bazel workspace
    const hasWorkspace = await fileExists(path.join(workspace, 'WORKSPACE')) ||
                        await fileExists(path.join(workspace, 'WORKSPACE.bazel')) ||
                        await fileExists(path.join(workspace, 'MODULE.bazel'));
    
    if (!hasWorkspace) {
      return {
        info: {
          path: workspace,
          name: path.basename(workspace),
          valid: false,
          error: 'Not a Bazel workspace',
          packages: [],
          targetCount: 0,
          fileCount: 0
        }
      };
    }

    // Get basic info
    const { stdout } = await execAsync('bazel query "//..." --output=package', {
      cwd: workspace,
      maxBuffer: 10 * 1024 * 1024
    });

    const packages = stdout.trim().split('\n').filter(p => p.length > 0);

    return {
      info: {
        path: workspace,
        name: path.basename(workspace),
        valid: true,
        error: '',
        packages,
        targetCount: 0, // Would need another query
        fileCount: packages.length
      }
    };
  } catch (error: any) {
    return {
      info: {
        path: workspace,
        name: path.basename(workspace),
        valid: false,
        error: error.message,
        packages: [],
        targetCount: 0,
        fileCount: 0
      }
    };
  }
});

registerBothPaths('ScanWorkspaces', async (request) => {
  const searchPath = request.path || process.env.HOME || '/';
  const workspaces: any[] = [];

  try {
    // Simple implementation - look for common workspace locations
    const commonPaths = [
      searchPath,
      path.join(searchPath, 'Documents'),
      path.join(searchPath, 'Projects'),
      path.join(searchPath, 'workspace'),
      path.join(searchPath, 'src'),
      path.join(searchPath, 'dev'),
    ];

    for (const dir of commonPaths) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const fullPath = path.join(dir, entry.name);
            
            // Check if it's a Bazel workspace
            const hasWorkspace = await fileExists(path.join(fullPath, 'WORKSPACE')) ||
                                await fileExists(path.join(fullPath, 'WORKSPACE.bazel'));
            const hasModule = await fileExists(path.join(fullPath, 'MODULE.bazel'));
            
            if (hasWorkspace || hasModule) {
              workspaces.push({
                path: fullPath,
                name: entry.name,
                type: hasModule ? 'bzlmod' : 'workspace'
              });
            }
          }
        }
      } catch {
        // Skip directories we can't read
      }
    }

    return { workspaces };
  } catch (error: any) {
    console.error('[Connect] Error scanning workspaces:', error);
    return { workspaces: [] };
  }
});

registerBothPaths('ListTargets', async (request) => {
  const pattern = request.pattern || '//...';
  
  try {
    const result = await bazelService.listTargets(pattern);
    return {
      total: result.targets.length,
      targets: result.targets,
      byPackage: {}
    };
  } catch (error: any) {
    return {
      total: 0,
      targets: [],
      byPackage: {}
    };
  }
});

registerBothPaths('GetTarget', async (request) => {
  const targetLabel = request.target;
  
  if (!targetLabel) {
    throw new Error('Target label is required');
  }

  const target = await bazelService.getTarget(targetLabel);
  return { target };
});

registerBothPaths('SearchTargets', async (request) => {
  const query = request.query || '';
  
  const result = await bazelService.searchTargets(query);
  return {
    query,
    total: result.targets.length,
    targets: result.targets
  };
});

registerBothPaths('ExecuteQuery', async (request) => {
  const query = request.query;
  const outputFormat = request.outputFormat || request.output_format || 'label';
  
  if (!query) {
    throw new Error('Query is required');
  }

  const result = await bazelService.executeQuery(query, { outputFormat });
  return {
    query,
    outputFormat,
    result: {
      targets: result.targets || []
    },
    raw: result.raw || ''
  };
});

export default router;

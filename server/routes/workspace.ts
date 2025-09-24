import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import fsSync from 'node:fs';
import path from 'path';
import os from 'os';
import bazelService from '../services/bazel.js';
import config, { setWorkspace } from '../config.js';
import type { BuildFile, WorkspaceInfo } from '../types/index.js';

const router = Router();

/**
 * Get workspace information
 */
router.get('/info', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [info, bazelVersion] = await Promise.all([
      bazelService.getWorkspaceInfo(),
      bazelService.getBazelVersion()
    ]);

    // Add additional workspace info
    const moduleFile = path.join(config.bazelWorkspace, 'MODULE.bazel');

    let workspaceExists = false;
    let workspaceContent = '';

    try {
      // Only check for MODULE.bazel
      workspaceContent = await fs.readFile(moduleFile, 'utf-8');
      workspaceExists = true;
    } catch (error) {
      console.log('No MODULE.bazel file found');
    }

    // Extract module name from content
    let workspaceName = 'unknown';
    if (workspaceContent) {
      // Look for module name in MODULE.bazel
      const moduleMatch = workspaceContent.match(/module\s*\(\s*name\s*=\s*["']([^"']+)["']/);
      if (moduleMatch) {
        workspaceName = moduleMatch[1];
      }
    }

    const response: Partial<WorkspaceInfo> = {
      ...info,
      workspace_path: config.bazelWorkspace,
      workspace_name: workspaceName,
      workspace_file_exists: workspaceExists,
      bazel_version: bazelVersion
    };

    res.json(response);
  } catch (error) {
    next(error);
  }
});

/**
 * List all BUILD files in the workspace
 */
router.get('/files', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const buildFiles: BuildFile[] = [];
    
    async function findBuildFiles(dir: string, relativePath: string = ''): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip bazel output directories and hidden directories
          if (!entry.name.startsWith('.') && 
              !entry.name.startsWith('bazel-') &&
              entry.name !== 'node_modules') {
            await findBuildFiles(fullPath, relPath);
          }
        } else if (entry.name === 'BUILD' ||
                   entry.name === 'BUILD.bazel' ||
                   entry.name === 'MODULE.bazel') {
          let fileType: 'workspace' | 'build' | 'module';
          if (entry.name === 'MODULE.bazel') {
            fileType = 'module';
          } else {
            fileType = 'build';
          }
          buildFiles.push({
            path: relPath,
            name: entry.name,
            type: fileType as 'workspace' | 'build'  // Cast to match existing type
          });
        }
      }
    }
    
    await findBuildFiles(config.bazelWorkspace);
    
    res.json({
      total: buildFiles.length,
      files: buildFiles
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get Bazel configuration (deprecated - returns empty config)
 */
router.get('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Return empty configuration since .bazelrc support is removed
    res.json({
      bazelrc_exists: false,
      configurations: {}
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get current workspace or null if not configured
 */
router.get('/current', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!config.bazelWorkspace) {
      res.json({ configured: false, workspace: null });
      return;
    }

    // Check if the workspace still exists and is valid
    try {
      const moduleFile = path.join(config.bazelWorkspace, 'MODULE.bazel');

      const exists = fsSync.existsSync(moduleFile);

      if (!exists) {
        res.json({
          configured: true,
          workspace: config.bazelWorkspace,
          valid: false,
          error: 'No MODULE.bazel file found'
        });
        return;
      }

      res.json({
        configured: true,
        workspace: config.bazelWorkspace,
        valid: true
      });
    } catch (error) {
      res.json({
        configured: true,
        workspace: config.bazelWorkspace,
        valid: false,
        error: 'Cannot access workspace directory'
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Scan for available Bazel workspaces
 */
router.get('/scan', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaces: Array<{
      path: string;
      name: string;
      type: 'current' | 'parent' | 'home' | 'discovered';
    }> = [];

    const seen = new Set<string>();

    // Helper function to check if a directory is a Bazel workspace
    async function checkWorkspace(dir: string, type: 'current' | 'parent' | 'home' | 'discovered'): Promise<void> {
      try {
        const normalized = path.resolve(dir);
        if (seen.has(normalized)) return;
        seen.add(normalized);

        const moduleFile = path.join(normalized, 'MODULE.bazel');

        // Check for MODULE.bazel only
        if (fsSync.existsSync(moduleFile)) {
          // Try to extract module name
          let workspaceName = path.basename(normalized);
          try {
            const content = await fs.readFile(moduleFile, 'utf-8');
            // Look for module name in MODULE.bazel
            const moduleMatch = content.match(/module\s*\(\s*name\s*=\s*["']([^"']+)["']/);
            if (moduleMatch) {
              workspaceName = moduleMatch[1];
            }
          } catch {
            // Ignore errors reading files
          }

          workspaces.push({
            path: normalized,
            name: workspaceName,
            type
          });
        }
      } catch {
        // Ignore errors accessing directories
      }
    }


   
    // 3. Add currently configured workspace if it exists and not already in list
    if (config.bazelWorkspace) {
      await checkWorkspace(config.bazelWorkspace, 'current');
    }

    res.json({ workspaces });
  } catch (error) {
    next(error);
  }
});

/**
 * Switch to a different workspace
 */
router.post('/switch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { workspace } = req.body;

    if (!workspace) {
      return res.status(400).json({ error: 'Workspace path is required' });
    }

    // Validate the workspace path
    const normalized = path.resolve(workspace);

    if (!fsSync.existsSync(normalized)) {
      return res.status(400).json({ error: 'Workspace directory does not exist' });
    }

    const moduleFile = path.join(normalized, 'MODULE.bazel');

    if (!fsSync.existsSync(moduleFile)) {
      return res.status(400).json({ error: 'Not a valid Bazel workspace (no MODULE.bazel file found)' });
    }

    // Update the configuration
    setWorkspace(normalized);

    // Update the bazel service workspace
    bazelService.setWorkspace(normalized);

    // Clear any caches
    bazelService.clearCache();

    res.json({
      success: true,
      workspace: normalized,
      message: 'Workspace switched successfully'
    });
  } catch (error) {
    next(error);
  }
});

export default router;

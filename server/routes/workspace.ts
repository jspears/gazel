import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import bazelService from '../services/bazel.js';
import config from '../config.js';
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
    const workspaceFile = path.join(config.bazelWorkspace, 'WORKSPACE');
    const workspaceBazelFile = path.join(config.bazelWorkspace, 'WORKSPACE.bazel');

    let workspaceExists = false;
    let workspaceContent = '';

    try {
      // Try WORKSPACE.bazel first, then WORKSPACE
      try {
        workspaceContent = await fs.readFile(workspaceBazelFile, 'utf-8');
        workspaceExists = true;
      } catch {
        workspaceContent = await fs.readFile(workspaceFile, 'utf-8');
        workspaceExists = true;
      }
    } catch (error) {
      console.log('No WORKSPACE file found');
    }

    // Extract workspace name from content
    let workspaceName = 'unknown';
    if (workspaceContent) {
      const nameMatch = workspaceContent.match(/workspace\s*\(\s*name\s*=\s*["']([^"']+)["']/);
      if (nameMatch) {
        workspaceName = nameMatch[1];
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
                   entry.name === 'WORKSPACE' ||
                   entry.name === 'WORKSPACE.bazel') {
          buildFiles.push({
            path: relPath,
            name: entry.name,
            type: entry.name.includes('WORKSPACE') ? 'workspace' : 'build'
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
 * Get Bazel configuration
 */
router.get('/config', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bazelrcPath = path.join(config.bazelWorkspace, '.bazelrc');
    let bazelrcContent = '';
    
    try {
      bazelrcContent = await fs.readFile(bazelrcPath, 'utf-8');
    } catch {
      console.log('No .bazelrc file found');
    }
    
    // Parse .bazelrc content
    const configs: Record<string, string[]> = {};
    if (bazelrcContent) {
      const lines = bazelrcContent.split('\n');
      lines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const match = trimmed.match(/^(build|test|query|common):?(.*)$/);
          if (match) {
            const [, command, options] = match;
            if (!configs[command]) {
              configs[command] = [];
            }
            if (options) {
              configs[command].push(options.trim());
            }
          }
        }
      });
    }
    
    res.json({
      bazelrc_exists: !!bazelrcContent,
      configurations: configs
    });
  } catch (error) {
    next(error);
  }
});

export default router;

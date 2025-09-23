import { Router, Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import config from '../config.js';
import parserService from '../services/parser.js';

const router = Router();

/**
 * List BUILD files
 */
router.get('/build', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const buildFiles: Array<{path: string; targets: number; lastModified: number}> = [];

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
        } else if (entry.name === 'BUILD' || entry.name === 'BUILD.bazel') {
          // Get file stats for modification time
          const stats = await fs.stat(fullPath);

          // Read file and count targets
          const content = await fs.readFile(fullPath, 'utf-8');
          const targets = parserService.parseBuildFile(content);

          buildFiles.push({
            path: relPath,
            targets: targets.length,
            lastModified: stats.mtimeMs
          });
        }
      }
    }

    await findBuildFiles(config.bazelWorkspace);

    // Sort by last modified date (newest first)
    buildFiles.sort((a, b) => b.lastModified - a.lastModified);

    res.json({
      total: buildFiles.length,
      files: buildFiles
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get BUILD file content
 */
router.get('/build/*', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filePath = req.params[0];
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path is required' });
    }
    
    // Security: ensure path doesn't escape workspace
    const fullPath = path.resolve(config.bazelWorkspace, filePath);
    if (!fullPath.startsWith(config.bazelWorkspace)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Try different BUILD file names
    let content: string | null = null;
    let actualPath: string | null = null;
    
    const possiblePaths = [
      fullPath,
      path.join(fullPath, 'BUILD'),
      path.join(fullPath, 'BUILD.bazel')
    ];
    
    for (const tryPath of possiblePaths) {
      try {
        content = await fs.readFile(tryPath, 'utf-8');
        actualPath = tryPath;
        break;
      } catch {
        // Continue to next path
      }
    }
    
    if (!content || !actualPath) {
      return res.status(404).json({ error: 'BUILD file not found' });
    }
    
    // Parse targets in the file
    const targets = parserService.parseBuildFile(content);
    
    res.json({
      path: path.relative(config.bazelWorkspace, actualPath),
      content,
      targets,
      lines: content.split('\n').length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get WORKSPACE file content
 */
router.get('/workspace', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceFile = path.join(config.bazelWorkspace, 'WORKSPACE');
    const workspaceBazelFile = path.join(config.bazelWorkspace, 'WORKSPACE.bazel');
    
    let content: string | null = null;
    let actualPath: string | null = null;
    
    // Try WORKSPACE.bazel first, then WORKSPACE
    try {
      content = await fs.readFile(workspaceBazelFile, 'utf-8');
      actualPath = workspaceBazelFile;
    } catch {
      try {
        content = await fs.readFile(workspaceFile, 'utf-8');
        actualPath = workspaceFile;
      } catch {
        return res.status(404).json({ error: 'WORKSPACE file not found' });
      }
    }
    
    // Extract workspace name and external dependencies
    let workspaceName = '';
    const externalDeps: string[] = [];
    
    const nameMatch = content.match(/workspace\s*\(\s*name\s*=\s*["']([^"']+)["']/);
    if (nameMatch) {
      workspaceName = nameMatch[1];
    }
    
    // Find http_archive, git_repository, etc.
    const depPatterns = [
      /http_archive\s*\(\s*name\s*=\s*["']([^"']+)["']/g,
      /git_repository\s*\(\s*name\s*=\s*["']([^"']+)["']/g,
      /local_repository\s*\(\s*name\s*=\s*["']([^"']+)["']/g
    ];
    
    for (const pattern of depPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        externalDeps.push(match[1]);
      }
    }
    
    res.json({
      path: path.relative(config.bazelWorkspace, actualPath),
      content,
      workspaceName,
      externalDependencies: externalDeps,
      lines: content.split('\n').length
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Search in BUILD files
 */
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, caseSensitive = false } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    const results: Array<{
      file: string;
      line: number;
      content: string;
    }> = [];
    
    async function searchInFiles(dir: string, relativePath: string = ''): Promise<void> {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip bazel output directories and hidden directories
          if (!entry.name.startsWith('.') && 
              !entry.name.startsWith('bazel-') &&
              entry.name !== 'node_modules') {
            await searchInFiles(fullPath, relPath);
          }
        } else if (entry.name === 'BUILD' || 
                   entry.name === 'BUILD.bazel' ||
                   entry.name === 'WORKSPACE' ||
                   entry.name === 'WORKSPACE.bazel') {
          const content = await fs.readFile(fullPath, 'utf-8');
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            const searchIn = caseSensitive ? line : line.toLowerCase();
            const searchFor = caseSensitive ? query : query.toLowerCase();
            
            if (searchIn.includes(searchFor)) {
              results.push({
                file: relPath,
                line: index + 1,
                content: line.trim()
              });
            }
          });
        }
      }
    }
    
    await searchInFiles(config.bazelWorkspace);
    
    res.json({
      query,
      caseSensitive,
      total: results.length,
      results: results.slice(0, 100) // Limit to 100 results
    });
  } catch (error) {
    next(error);
  }
});

export default router;

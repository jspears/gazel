import { Router, Request, Response, NextFunction } from 'express';
import bazelService from '../services/bazel.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

interface ModuleDependency {
  key: string;
  name: string;
  version: string;
  apparentName: string;
  unexpanded?: boolean;
  dependencies?: ModuleDependency[];
  indirectDependencies?: ModuleDependency[];
  cycles?: any[];
}

interface ModuleNode extends ModuleDependency {
  root?: boolean;
}

// Flattened module for easier processing
interface FlattenedModule {
  key: string;
  name: string;
  version: string;
  apparentName: string;
  isRoot?: boolean;
  directDependencies: string[];
  allDependencies: Set<string>;
  depth: number;
}

/**
 * Get module graph information
 */
router.get('/graph', async (req: Request, res: Response, next: NextFunction) => {
  try {
    let moduleGraph: ModuleNode;

    // Try to execute bazel mod graph command with JSON output
    try {
      const result = await bazelService.execute(['mod', 'graph', '--output', 'json']);

      // Parse the JSON output
      try {
        moduleGraph = JSON.parse(result.stdout);
      } catch (parseError) {
        console.error('Failed to parse module graph JSON:', parseError);
        console.error('Raw output:', result.stdout);

        // Check if the output is empty or indicates bzlmod is not enabled
        if (!result.stdout || result.stdout.trim() === '') {
          // Try to use sample data
          const samplePath = path.join(__dirname, '..', '..', '..', 'samples', 'module.json');
          try {
            const sampleData = await fs.readFile(samplePath, 'utf-8');
            moduleGraph = JSON.parse(sampleData);
          } catch (sampleError) {
            // Return a sample/empty graph structure
            return res.json({
              root: null,
              modules: [],
              dependencies: [],
              statistics: {
                totalModules: 0,
                directDependencies: 0,
                devDependencies: 0,
                indirectDependencies: 0
              },
              error: 'Module graph is empty. Make sure bzlmod is enabled in your workspace.'
            });
          }
        } else {
          return res.status(500).json({
            error: 'Failed to parse module graph output',
            details: result.stdout
          });
        }
      }
    } catch (bazelError: any) {
      console.error('Failed to execute bazel command:', bazelError);

      // Try to use sample data as fallback
      const samplePath = path.join(__dirname, '..', '..', '..', 'samples', 'module.json');
      try {
        const sampleData = await fs.readFile(samplePath, 'utf-8');
        moduleGraph = JSON.parse(sampleData);
      } catch (sampleError) {
        // Check for common bazel errors
        if (bazelError.stderr?.includes('not found') || bazelError.message?.includes('not found')) {
          return res.status(500).json({
            error: 'Bazel is not installed or not in PATH',
            command: bazelError.command,
            suggestion: 'Please install Bazel or Bazelisk to use this feature'
          });
        }

        if (bazelError.stderr?.includes('MODULE.bazel') || bazelError.stderr?.includes('bzlmod')) {
          return res.status(500).json({
            error: 'This workspace does not use bzlmod or does not have a MODULE.bazel file',
            command: bazelError.command,
            suggestion: 'This feature requires a Bazel workspace with bzlmod enabled'
          });
        }

        return res.status(500).json({
          error: bazelError.message,
          command: bazelError.command,
          stdout: bazelError.stdout,
          stderr: bazelError.stderr
        });
      }
    }

    // Process and enhance the module graph data
    const processedGraph = processModuleGraph(moduleGraph);

    res.json(processedGraph);
  } catch (error: any) {
    console.error('Unexpected error in module graph endpoint:', error);
    next(error);
  }
});

/**
 * Get detailed information about a specific module
 */
router.get('/info/:moduleName', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { moduleName } = req.params;

    // Get the full module graph
    const result = await bazelService.execute(['mod', 'graph', '--output', 'json']);

    // Parse the JSON output
    let moduleGraph: ModuleNode;
    try {
      moduleGraph = JSON.parse(result.stdout);
    } catch (parseError) {
      console.error('Failed to parse module graph JSON:', parseError);
      return res.status(500).json({
        error: 'Failed to parse module graph output',
        details: result.stdout
      });
    }

    // Find the specific module in the flattened graph
    const flattened = flattenModuleGraph(moduleGraph);
    const moduleInfo = flattened.get(moduleName) ||
                      Array.from(flattened.values()).find(m => m.name === moduleName);

    if (!moduleInfo) {
      return res.status(404).json({
        error: `Module '${moduleName}' not found`
      });
    }

    // Get additional details about the module
    const detailedInfo = getModuleDetails(moduleName, moduleInfo, flattened);

    res.json(detailedInfo);
  } catch (error: any) {
    console.error('Failed to get module info:', error);
    
    if (error.command) {
      return res.status(500).json({
        error: error.message,
        command: error.command,
        stdout: error.stdout,
        stderr: error.stderr
      });
    }
    
    next(error);
  }
});

/**
 * Flatten the module tree into a map for easier processing
 */
function flattenModuleGraph(node: ModuleNode, depth = 0, visited = new Set<string>()): Map<string, FlattenedModule> {
  const modules = new Map<string, FlattenedModule>();

  function traverse(node: ModuleDependency, currentDepth: number, parentKey?: string) {
    if (visited.has(node.key)) {
      return;
    }
    visited.add(node.key);

    const flatModule: FlattenedModule = {
      key: node.key,
      name: node.name,
      version: node.version,
      apparentName: node.apparentName,
      isRoot: (node as ModuleNode).root,
      directDependencies: [],
      allDependencies: new Set<string>(),
      depth: currentDepth
    };

    // Process direct dependencies
    if (node.dependencies && !node.unexpanded) {
      for (const dep of node.dependencies) {
        flatModule.directDependencies.push(dep.key);
        flatModule.allDependencies.add(dep.key);

        // Recursively traverse dependencies
        traverse(dep, currentDepth + 1, node.key);
      }
    }

    modules.set(node.key, flatModule);
  }

  traverse(node, depth);
  return modules;
}

/**
 * Process the raw module graph data
 */
function processModuleGraph(rootNode: ModuleNode): any {
  const flattened = flattenModuleGraph(rootNode);

  const processed: any = {
    root: rootNode.key,
    modules: [],
    dependencies: [],
    statistics: {
      totalModules: flattened.size,
      directDependencies: 0,
      devDependencies: 0,
      indirectDependencies: 0
    }
  };

  // Convert flattened modules to array format
  for (const [key, module] of flattened) {
    processed.modules.push({
      key: module.key,
      name: module.name,
      version: module.version,
      apparentName: module.apparentName,
      isRoot: module.isRoot,
      dependencyCount: module.directDependencies.length,
      depth: module.depth,
      dependencies: module.directDependencies.map(depKey => {
        const dep = flattened.get(depKey);
        return dep ? {
          key: dep.key,
          name: dep.name,
          version: dep.version
        } : null;
      }).filter(Boolean)
    });

    // Build dependency edges
    for (const depKey of module.directDependencies) {
      processed.dependencies.push({
        from: key,
        to: depKey,
        type: 'direct',
        version: flattened.get(depKey)?.version || ''
      });
    }
  }

  // Calculate statistics
  const rootModule = flattened.get(rootNode.key);
  if (rootModule) {
    processed.statistics.directDependencies = rootModule.directDependencies.length;
    processed.statistics.indirectDependencies = rootModule.allDependencies.size - rootModule.directDependencies.length;
  }

  // Sort modules by depth and name
  processed.modules.sort((a: any, b: any) => {
    if (a.isRoot) return -1;
    if (b.isRoot) return 1;
    if (a.depth !== b.depth) return a.depth - b.depth;
    return a.name.localeCompare(b.name);
  });

  return processed;
}

/**
 * Get detailed information about a module
 */
function getModuleDetails(moduleName: string, moduleInfo: FlattenedModule, allModules: Map<string, FlattenedModule>): any {
  const details: any = {
    key: moduleInfo.key,
    name: moduleInfo.name,
    version: moduleInfo.version,
    apparentName: moduleInfo.apparentName,
    isRoot: moduleInfo.isRoot,
    depth: moduleInfo.depth,
    directDependents: [],
    directDependencies: [],
    transitiveDependencies: []
  };

  // Get direct dependencies with full info
  for (const depKey of moduleInfo.directDependencies) {
    const dep = allModules.get(depKey);
    if (dep) {
      details.directDependencies.push({
        key: dep.key,
        name: dep.name,
        version: dep.version,
        apparentName: dep.apparentName
      });
    }
  }

  // Find modules that depend on this module
  for (const [key, module] of allModules) {
    if (module.directDependencies.includes(moduleInfo.key)) {
      details.directDependents.push({
        key: module.key,
        name: module.name,
        version: module.version,
        apparentName: module.apparentName
      });
    }
  }

  // Get transitive dependencies (all dependencies minus direct)
  for (const depKey of moduleInfo.allDependencies) {
    if (!moduleInfo.directDependencies.includes(depKey)) {
      const dep = allModules.get(depKey);
      if (dep) {
        details.transitiveDependencies.push({
          key: dep.key,
          name: dep.name,
          version: dep.version,
          apparentName: dep.apparentName
        });
      }
    }
  }

  return details;
}

export default router;

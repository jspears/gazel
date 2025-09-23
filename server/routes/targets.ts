import { Router, Request, Response, NextFunction } from 'express';
import bazelService from '../services/bazel.js';
import parserService from '../services/parser.js';
import type { BazelTarget, ParsedTarget } from '../types/index.js';

const router = Router();

/**
 * List all targets
 */
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { pattern = '//...', format = 'label_kind' } = req.query as { pattern?: string; format?: string };
    
    const result = await bazelService.query(pattern, format);
    
    let targets: BazelTarget[] | ParsedTarget[];
    if (format === 'xml') {
      const parsed = await parserService.parseXmlOutput(result.stdout);
      targets = parsed.targets;
    } else if (format === 'label_kind') {
      targets = parserService.parseLabelKindOutput(result.stdout);
    } else {
      targets = parserService.parseLabelOutput(result.stdout);
    }
    
    // Group targets by package
    const byPackage: Record<string, (BazelTarget | ParsedTarget)[]> = {};
    targets.forEach(target => {
      const pkg = (target as ParsedTarget).package || 'unknown';
      if (!byPackage[pkg]) {
        byPackage[pkg] = [];
      }
      byPackage[pkg].push(target);
    });
    
    res.json({
      total: targets.length,
      targets,
      byPackage
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get target outputs (what files it produces)
 * Using query parameter instead of path to avoid conflicts with targets containing /outputs
 */
router.get('/outputs', async (req: Request, res: Response, next: NextFunction) => {
  const target = req.query.target as string;
  if (!target) {
    return res.status(400).json({ error: 'Target parameter is required' });
  }
  const fullTarget = target.startsWith('//') ? target : `//${target}`;

  try {
    const result = await bazelService.getTargetOutputs(fullTarget);

    // Parse the output files (one per line)
    const outputs = result.stdout
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        // Extract just the filename from the full path
        const parts = line.split('/');
        const filename = parts[parts.length - 1];
        return {
          path: line.trim(),
          filename,
          type: filename.split('.').pop() || 'unknown'
        };
      });

    res.json({
      target: fullTarget,
      outputs,
      count: outputs.length
    });
  } catch (error: any) {
    // If cquery fails, try a simpler approach
    try {
      const buildInfo = await bazelService.getTargetBuildInfo(fullTarget);
      const outputs = buildInfo.stdout
        .split('\n')
        .filter(line => line.includes('output') || line.includes('Creating'))
        .map(line => line.trim());

      res.json({
        target: fullTarget,
        outputs: outputs.map(o => ({ path: o, filename: o, type: 'info' })),
        count: outputs.length,
        method: 'build_info'
      });
    } catch (fallbackError) {
      console.error('Failed to get target outputs:', error);
      res.json({
        target: fullTarget,
        outputs: [],
        count: 0,
        error: 'Could not determine outputs for this target',
        command: error.command || `bazel cquery "${fullTarget}" --output=files`,
        details: error.stderr || error.message
      });
    }
  }
});

/**
 * Get target dependencies
 * Using query parameter to avoid conflicts with complex target names
 */
router.get('/dependencies', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { target, depth = '1', format = 'label' } = req.query as { target?: string; depth?: string; format?: string };
    if (!target) {
      return res.status(400).json({ error: 'Target parameter is required' });
    }
    
    // Ensure target starts with //
    const fullTarget = target.startsWith('//') ? target : `//${target}`;
    
    const depthNum = depth === 'all' ? -1 : parseInt(depth, 10);
    const result = await bazelService.getTargetDependencies(fullTarget, depthNum);
    
    let dependencies: BazelTarget[] | ParsedTarget[];
    if (format === 'xml') {
      const parsed = await parserService.parseXmlOutput(result.stdout);
      dependencies = parsed.targets;
    } else {
      dependencies = parserService.parseLabelOutput(result.stdout);
    }
    
    res.json({
      target: fullTarget,
      depth: depthNum,
      total: dependencies.length,
      dependencies
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get reverse dependencies (what depends on this target)
 * Using query parameter to avoid conflicts with complex target names
 */
router.get('/rdeps', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { target } = req.query as { target?: string };
    if (!target) {
      return res.status(400).json({ error: 'Target parameter is required' });
    }

    // Ensure target starts with //
    const fullTarget = target.startsWith('//') ? target : `//${target}`;
    
    const result = await bazelService.getReverseDependencies(fullTarget);
    const dependencies = parserService.parseLabelOutput(result.stdout);
    
    res.json({
      target: fullTarget,
      total: dependencies.length,
      dependents: dependencies
    });
  } catch (error) {
    next(error);
  }
});

interface SearchBody {
  query: string;
  type?: string;
  package?: string;
}

/**
 * Search targets by name or pattern
 */
router.post('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, type, package: pkg }: SearchBody = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Build Bazel query
    let bazelQuery = '';
    
    if (pkg) {
      bazelQuery = `${pkg}:*${query}*`;
    } else {
      bazelQuery = `//...:*${query}*`;
    }
    
    // Add type filter if specified
    if (type) {
      bazelQuery = `kind("${type}", ${bazelQuery})`;
    }
    
    const result = await bazelService.query(bazelQuery, 'label_kind');
    const targets = parserService.parseLabelKindOutput(result.stdout);
    
    res.json({
      query,
      total: targets.length,
      targets
    });
  } catch (error: any) {
    // If the query fails, try a simpler approach
    if (error.stderr && error.stderr.includes('syntax error')) {
      try {
        const result = await bazelService.query('//...', 'label_kind');
        const allTargets = parserService.parseLabelKindOutput(result.stdout);
        
        // Filter targets manually
        const filtered = allTargets.filter(t => {
          const fullName = t.full || '';
          return fullName.toLowerCase().includes(req.body.query.toLowerCase());
        });
        
        return res.json({
          query: req.body.query,
          total: filtered.length,
          targets: filtered
        });
      } catch (fallbackError) {
        next(fallbackError);
      }
    } else {
      next(error);
    }
  }
});

/**
 * Get specific target details
 * This wildcard route must be last to avoid catching other routes
 */
router.get('/:target(*)', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const target = req.params.target;

    // Ensure target starts with //
    const fullTarget = target.startsWith('//') ? target : `//${target}`;

    const result = await bazelService.getTargetInfo(fullTarget);
    const parsed = await parserService.parseXmlOutput(result.stdout);

    if (parsed.targets.length === 0) {
      return res.status(404).json({ error: 'Target not found' });
    }

    res.json(parsed.targets[0]);
  } catch (error: any) {
    const target = req.params.target;
    const fullTarget = target.startsWith('//') ? target : `//${target}`;
    if (error.stderr && error.stderr.includes('no such target')) {
      return res.status(404).json({
        error: 'Target not found',
        command: error.command || `bazel query "${fullTarget}" --output=xml`,
        details: error.stderr
      });
    }
    next(error);
  }
});

export default router;

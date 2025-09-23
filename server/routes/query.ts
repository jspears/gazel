import { Router, Request, Response, NextFunction } from 'express';
import bazelService from '../services/bazel.js';
import parserService from '../services/parser.js';

const router = Router();

interface QueryBody {
  query: string;
  outputFormat?: string;
}

interface SavedQuery {
  id: string;
  name: string;
  query: string;
  description?: string;
  createdAt: Date;
}

// In-memory storage for saved queries (in production, use a database)
const savedQueries: Map<string, SavedQuery> = new Map();

/**
 * Execute a Bazel query
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, outputFormat = 'label_kind' }: QueryBody = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    const result = await bazelService.query(query, outputFormat);
    
    let parsedResult: any;
    if (outputFormat === 'xml') {
      parsedResult = await parserService.parseXmlOutput(result.stdout);
    } else if (outputFormat === 'label_kind') {
      parsedResult = {
        targets: parserService.parseLabelKindOutput(result.stdout)
      };
    } else {
      parsedResult = {
        targets: parserService.parseLabelOutput(result.stdout)
      };
    }
    
    res.json({
      query,
      outputFormat,
      result: parsedResult,
      raw: result.stdout
    });
  } catch (error: any) {
    if (error.stderr) {
      return res.status(400).json({
        error: 'Query failed',
        command: error.command || `bazel query "${query}" --output=${outputFormat}`,
        details: error.stderr
      });
    }
    next(error);
  }
});

/**
 * Get saved queries
 */
router.get('/saved', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const queries = Array.from(savedQueries.values());
    res.json(queries);
  } catch (error) {
    next(error);
  }
});

/**
 * Save a query
 */
router.post('/save', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, query, description } = req.body;
    
    if (!name || !query) {
      return res.status(400).json({ error: 'Name and query are required' });
    }
    
    const id = `query_${Date.now()}`;
    const savedQuery: SavedQuery = {
      id,
      name,
      query,
      description,
      createdAt: new Date()
    };
    
    savedQueries.set(id, savedQuery);
    
    res.json(savedQuery);
  } catch (error) {
    next(error);
  }
});

/**
 * Delete a saved query
 */
router.delete('/saved/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    if (!savedQueries.has(id)) {
      return res.status(404).json({ error: 'Query not found' });
    }
    
    savedQueries.delete(id);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * Get common query templates
 */
router.get('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const templates = [
      {
        name: 'All targets',
        query: '//...',
        description: 'List all targets in the workspace'
      },
      {
        name: 'All test targets',
        query: 'kind("test", //...)',
        description: 'List all test targets'
      },
      {
        name: 'All binary targets',
        query: 'kind("binary", //...)',
        description: 'List all binary targets'
      },
      {
        name: 'All library targets',
        query: 'kind("library", //...)',
        description: 'List all library targets'
      },
      {
        name: 'Dependencies of target',
        query: 'deps(//path/to:target)',
        description: 'Show all dependencies of a target'
      },
      {
        name: 'Reverse dependencies',
        query: 'rdeps(//..., //path/to:target)',
        description: 'Show what depends on a target'
      },
      {
        name: 'All paths between targets',
        query: 'allpaths(//from:target, //to:target)',
        description: 'Show all dependency paths between two targets'
      },
      {
        name: 'Direct dependencies',
        query: 'deps(//path/to:target, 1)',
        description: 'Show only direct dependencies'
      }
    ];
    
    res.json(templates);
  } catch (error) {
    next(error);
  }
});

export default router;

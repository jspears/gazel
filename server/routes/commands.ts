import { Router, Request, Response, NextFunction } from 'express';
import bazelService from '../services/bazel.js';

const router = Router();

interface CommandBody {
  target: string;
  options?: string[];
}

interface CommandHistory {
  id: string;
  command: string;
  target: string;
  options: string[];
  timestamp: Date;
  success: boolean;
  output?: string;
  error?: string;
}

// In-memory command history (in production, use a database)
const commandHistory: CommandHistory[] = [];

/**
 * Build a target
 */
router.post('/build', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { target, options = [] }: CommandBody = req.body;
    
    if (!target) {
      return res.status(400).json({ error: 'Target is required' });
    }
    
    const historyEntry: CommandHistory = {
      id: `cmd_${Date.now()}`,
      command: 'build',
      target,
      options,
      timestamp: new Date(),
      success: false
    };
    
    try {
      const result = await bazelService.build(target, options);
      
      historyEntry.success = true;
      historyEntry.output = result.stdout;
      commandHistory.unshift(historyEntry);
      
      res.json({
        success: true,
        output: result.stdout,
        stderr: result.stderr
      });
    } catch (error: any) {
      historyEntry.error = error.stderr || error.message;
      commandHistory.unshift(historyEntry);

      return res.status(400).json({
        success: false,
        error: error.message,
        command: error.command || `bazel build ${target} ${options.join(' ')}`,
        stderr: error.stderr,
        stdout: error.stdout
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Test a target
 */
router.post('/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { target, options = [] }: CommandBody = req.body;
    
    if (!target) {
      return res.status(400).json({ error: 'Target is required' });
    }
    
    const historyEntry: CommandHistory = {
      id: `cmd_${Date.now()}`,
      command: 'test',
      target,
      options,
      timestamp: new Date(),
      success: false
    };
    
    try {
      const result = await bazelService.test(target, options);
      
      historyEntry.success = true;
      historyEntry.output = result.stdout;
      commandHistory.unshift(historyEntry);
      
      res.json({
        success: true,
        output: result.stdout,
        stderr: result.stderr
      });
    } catch (error: any) {
      historyEntry.error = error.stderr || error.message;
      commandHistory.unshift(historyEntry);

      return res.status(400).json({
        success: false,
        error: error.message,
        command: error.command || `bazel test ${target} ${options.join(' ')}`,
        stderr: error.stderr,
        stdout: error.stdout
      });
    }
  } catch (error) {
    next(error);
  }
});

/**
 * Stream build output (for long-running builds) - GET endpoint for EventSource
 */
router.get('/build/stream', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Decode URL search parameters
    const target = req.query.target as string;
    const optionsParam = req.query.options as string;
    const options = optionsParam ? optionsParam.split(',').filter(opt => opt.trim()) : [];

    if (!target) {
      return res.status(400).json({ error: 'Target is required' });
    }

    console.log(`Building target: ${target} with options:`, options);

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial message
    res.write(`data: ${JSON.stringify({ type: 'info', data: `Starting: bazel build ${target}` })}\n\n`);

    let processKilled = false;

    const child = bazelService.streamCommand(
      'build',
      [target, ...options],
      (data: string) => {
        res.write(`data: ${JSON.stringify({ type: 'stdout', data })}\n\n`);
      },
      (data: string) => {
        res.write(`data: ${JSON.stringify({ type: 'stderr', data })}\n\n`);
      },
      (code: number | null) => {
        processKilled = true;
        res.write(`data: ${JSON.stringify({ type: 'exit', code })}\n\n`);
        res.end();
      }
    );

    // Handle client disconnect
    req.on('close', () => {
      if (!processKilled) {
        processKilled = true;
        console.log(`Client disconnected, killing build for target: ${target}`);
        child.kill();
      }
    });

    // Handle process errors
    child.on('error', (err) => {
      console.error(`Build process error for target ${target}:`, err);
      if (!processKilled) {
        processKilled = true;
        res.write(`data: ${JSON.stringify({ type: 'error', data: err.message })}\n\n`);
        res.end();
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Stream run output (for running executable targets) - GET endpoint for EventSource
 */
router.get('/run/stream', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Decode URL search parameters
    const target = req.query.target as string;
    const optionsParam = req.query.options as string;
    const options = optionsParam ? optionsParam.split(',').filter(opt => opt.trim()) : [];

    if (!target) {
      return res.status(400).json({ error: 'Target is required' });
    }

    console.log(`Running target: ${target} with options:`, options);

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial message
    res.write(`data: ${JSON.stringify({ type: 'info', data: `Starting: bazel run ${target}` })}\n\n`);

    let processKilled = false;

    const child = bazelService.streamCommand(
      'run',
      [target, ...options],
      (data: string) => {
        res.write(`data: ${JSON.stringify({ type: 'stdout', data })}\n\n`);
      },
      (data: string) => {
        res.write(`data: ${JSON.stringify({ type: 'stderr', data })}\n\n`);
      },
      (code: number | null) => {
        processKilled = true;
        res.write(`data: ${JSON.stringify({ type: 'exit', code })}\n\n`);
        res.end();
      }
    );

    // Handle client disconnect
    req.on('close', () => {
      if (!processKilled) {
        processKilled = true;
        console.log(`Client disconnected, killing process for target: ${target}`);
        child.kill();
      }
    });

    // Handle process errors
    child.on('error', (err) => {
      console.error(`Process error for target ${target}:`, err);
      if (!processKilled) {
        processKilled = true;
        res.write(`data: ${JSON.stringify({ type: 'error', data: err.message })}\n\n`);
        res.end();
      }
    });
  } catch (error) {
    console.error('Error in run/stream:', error);
    next(error);
  }
});

/**
 * Test run endpoint (for testing without bazel)
 */
router.post('/test-run', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { target } = req.body;

    // Set up SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Simulate a run command
    res.write(`data: ${JSON.stringify({ type: 'info', data: `Starting test run for: ${target}` })}\n\n`);

    setTimeout(() => {
      res.write(`data: ${JSON.stringify({ type: 'stdout', data: `Building ${target}...\n` })}\n\n`);
    }, 500);

    setTimeout(() => {
      res.write(`data: ${JSON.stringify({ type: 'stdout', data: `Running ${target}...\n` })}\n\n`);
    }, 1000);

    setTimeout(() => {
      res.write(`data: ${JSON.stringify({ type: 'stdout', data: `Hello from ${target}!\n` })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'stdout', data: `This is a test output.\n` })}\n\n`);
    }, 1500);

    setTimeout(() => {
      res.write(`data: ${JSON.stringify({ type: 'exit', code: 0 })}\n\n`);
      res.end();
    }, 2000);

  } catch (error) {
    next(error);
  }
});

/**
 * Get command history
 */
router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string || '50', 10);
    
    res.json({
      total: commandHistory.length,
      history: commandHistory.slice(0, limit)
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Clear command history
 */
router.delete('/history', async (req: Request, res: Response, next: NextFunction) => {
  try {
    commandHistory.length = 0;
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

/**
 * Clear Bazel cache
 */
router.post('/clean', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { expunge = false } = req.body;
    
    const command = expunge ? 'clean --expunge' : 'clean';
    const result = await bazelService.execute('clean', expunge ? ['--expunge'] : []);
    
    res.json({
      success: true,
      output: result.stdout
    });
  } catch (error: any) {
    const command = req.body.expunge ? 'bazel clean --expunge' : 'bazel clean';
    return res.status(400).json({
      success: false,
      error: error.message,
      command: error.command || command,
      stderr: error.stderr
    });
  }
});

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import { spawn } from 'child_process';
import config from '../config.js';
import { createXmlToJsonStream, createCompactXmlToJsonStream } from '../services/xmlStreamParser.js';
import { createEnhancedXmlStream } from '../services/enhancedXmlParser.js';

const router = Router();

interface StreamQueryBody {
  query: string;
  outputFormat?: string;
  parseXml?: boolean;
}

/**
 * Stream a Bazel query result for large outputs
 */
router.post('/query', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query, outputFormat = 'xml', parseXml = false }: StreamQueryBody = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Spawn bazel process
    const bazel = spawn(config.bazelExecutable, [
      'query',
      `--output=${outputFormat}`,
      query
    ], {
      cwd: config.bazelWorkspace,
      shell: false
    });

    let errorOutput = '';

    // If parseXml is true and format is xml, parse it to JSON
    if (parseXml && outputFormat === 'xml') {
      // Set JSON headers
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');

      // Create the XML to JSON transformer
      const xmlParser = createXmlToJsonStream();

      // Pipe bazel output through the parser to the response
      bazel.stdout.pipe(xmlParser).pipe(res);

      // Handle parser errors
      xmlParser.on('error', (err) => {
        console.error('XML parsing error:', err);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'XML parsing failed',
            details: err.message
          });
        }
      });
    } else {
      // Stream raw output
      res.setHeader('Content-Type', outputFormat === 'xml' ? 'application/xml' : 'text/plain');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');

      // Stream stdout directly to response
      bazel.stdout.on('data', (chunk) => {
        res.write(chunk);
      });
    }

    // Capture stderr
    bazel.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });

    // Handle process completion
    bazel.on('close', (code) => {
      if (code !== 0) {
        console.error(`Bazel query failed with code ${code}: ${errorOutput}`);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Query failed',
            details: errorOutput
          });
        }
      } else if (!parseXml || outputFormat !== 'xml') {
        // Only end the response if we're not using the parser
        // (the parser will end it when it's done)
        res.end();
      }
    });

    // Handle process errors
    bazel.on('error', (err) => {
      console.error('Failed to spawn bazel process:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to execute query',
          details: err.message
        });
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      bazel.kill();
    });

  } catch (error: any) {
    next(error);
  }
});

/**
 * Stream a Bazel query result with compact JSON format
 */
router.post('/query-compact', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query }: { query: string } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Always use XML format for parsing
    const bazel = spawn(config.bazelExecutable, [
      'query',
      '--output=xml',
      query
    ], {
      cwd: config.bazelWorkspace,
      shell: false
    });

    let errorOutput = '';

    // Set JSON headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    // Create the compact XML to JSON transformer
    const xmlParser = createCompactXmlToJsonStream();

    // Pipe bazel output through the parser to the response
    bazel.stdout.pipe(xmlParser).pipe(res);

    // Handle parser errors
    xmlParser.on('error', (err) => {
      console.error('XML parsing error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'XML parsing failed',
          details: err.message
        });
      }
    });

    // Capture stderr
    bazel.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });

    // Handle process completion
    bazel.on('close', (code) => {
      if (code !== 0) {
        console.error(`Bazel query failed with code ${code}: ${errorOutput}`);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Query failed',
            details: errorOutput
          });
        }
      }
    });

    // Handle process errors
    bazel.on('error', (err) => {
      console.error('Failed to spawn bazel process:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to execute query',
          details: err.message
        });
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      bazel.kill();
    });

  } catch (error: any) {
    next(error);
  }
});

/**
 * Stream a Bazel query result with enhanced parsing
 * This extracts deps, srcs, hdrs, and other structured data
 */
router.post('/query-enhanced', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { query }: { query: string } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Always use XML format for parsing
    const bazel = spawn(config.bazelExecutable, [
      'query',
      '--output=xml',
      query
    ], {
      cwd: config.bazelWorkspace,
      shell: false
    });

    let errorOutput = '';

    // Set JSON headers
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    // Create the enhanced XML parser
    const xmlParser = createEnhancedXmlStream();

    // Pipe bazel output through the parser to the response
    bazel.stdout.pipe(xmlParser).pipe(res);

    // Handle parser errors
    xmlParser.on('error', (err) => {
      console.error('XML parsing error:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'XML parsing failed',
          details: err.message
        });
      }
    });

    // Capture stderr
    bazel.stderr.on('data', (chunk) => {
      errorOutput += chunk.toString();
    });

    // Handle process completion
    bazel.on('close', (code) => {
      if (code !== 0) {
        console.error(`Bazel query failed with code ${code}: ${errorOutput}`);
        if (!res.headersSent) {
          res.status(500).json({
            error: 'Query failed',
            details: errorOutput
          });
        }
      }
    });

    // Handle process errors
    bazel.on('error', (err) => {
      console.error('Failed to spawn bazel process:', err);
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Failed to execute query',
          details: err.message
        });
      }
    });

    // Handle client disconnect
    req.on('close', () => {
      bazel.kill();
    });

  } catch (error: any) {
    next(error);
  }
});

export default router;

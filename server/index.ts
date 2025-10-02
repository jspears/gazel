import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import config from './config.js';
import { printStartupBanner, printShutdownMessage } from './utils/console-styles.js';

// Import routes
import workspaceRoutes from './routes/workspace.js';
import targetsRoutes from './routes/targets.js';
import queryRoutes from './routes/query.js';
import filesRoutes from './routes/files.js';
import commandsRoutes from './routes/commands.js';
import streamRoutes from './routes/stream.js';
import modulesRoutes from './routes/modules.js';
import connectRoutes from './routes/connect.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve sample files
app.use('/samples', express.static(path.join(__dirname, '..', 'samples')));

// API Routes
app.use('/api/workspace', workspaceRoutes);
app.use('/api/targets', targetsRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/commands', commandsRoutes);
app.use('/api/stream', streamRoutes);
app.use('/api/modules', modulesRoutes);

// Connect Protocol Routes (gRPC-web)
// These routes handle the Connect protocol for browser-based gRPC
app.use('/', connectRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  // In Bazel, the client build output is in a different location
  // Try multiple possible locations for the built client files
  const runfilesDir = process.env.RUNFILES_DIR || '';

  const possiblePaths = [
    path.join(runfilesDir, '_main', 'client', 'dist'),  // Bazel runfiles location
    path.join(runfilesDir, 'client', 'dist'),  // Alternative runfiles location
    path.join(__dirname, '..', 'client', 'dist'),  // Relative to server
    path.join(__dirname, '..', '..', 'client', 'dist'),  // Up two levels
    path.join(__dirname, '..', '..', 'dist'),  // Traditional location
  ];

  let distPath = '';
  for (const p of possiblePaths) {
    const indexPath = path.join(p, 'index.html');
    try {
      if (fs.existsSync(indexPath)) {
        distPath = p;
        break;
      }
    } catch (e) {
      // Try next path
    }
  }

  if (distPath) {
    console.log(`Serving static files from: ${path.basename(distPath)}`);
    app.use(express.static(distPath));

    // Handle client-side routing
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    console.warn('Warning: Could not find built client files for production mode');
    console.warn('Searched in standard locations relative to server');
  }
}

// Error handling middleware
interface ErrorWithStatus extends Error {
  status?: number;
  code?: number;
  stdout?: string;
  stderr?: string;
}

app.use((err: ErrorWithStatus, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
const server = app.listen(config.port, () => {
  // Only print banner if not running in Electron
  if (!process.env.ELECTRON_APP) {
    printStartupBanner(
      config.port,
      config.bazelWorkspace,
      process.env.NODE_ENV || 'development'
    );
  } else {
    console.log(`Server running on port ${config.port}`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  printShutdownMessage();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  printShutdownMessage();
  server.close(() => {
    process.exit(0);
  });
});

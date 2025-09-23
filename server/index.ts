import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './config.js';

// Import routes
import workspaceRoutes from './routes/workspace.js';
import targetsRoutes from './routes/targets.js';
import queryRoutes from './routes/query.js';
import filesRoutes from './routes/files.js';
import commandsRoutes from './routes/commands.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middleware
app.use(cors(config.cors));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/workspace', workspaceRoutes);
app.use('/api/targets', targetsRoutes);
app.use('/api/query', queryRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/commands', commandsRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', '..', 'dist');
  app.use(express.static(distPath));
  
  // Handle client-side routing
  app.get('*', (req: Request, res: Response) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// Error handling middleware
interface ErrorWithStatus extends Error {
  status?: number;
  code?: number;
  stdout?: string;
  stderr?: string;
}

app.use((err: ErrorWithStatus, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Start server
app.listen(config.port, () => {
  console.log(`Gazel server running on http://localhost:${config.port}`);
  console.log(`Bazel workspace: ${config.bazelWorkspace}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

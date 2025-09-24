import type { Config } from './types/index.js';
import dotenv from 'dotenv';

dotenv.config();

// Keep workspace in memory only - don't persist to .env
let bazelWorkspace = process.env.BAZEL_WORKSPACE || '';
if (bazelWorkspace) {
  console.log(`Initial BAZEL_WORKSPACE from env: '${bazelWorkspace}'`);
} else {
  console.log('No BAZEL_WORKSPACE set - waiting for client to configure');
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3002', 10),
  bazelWorkspace,
  bazelExecutable: process.env.BAZEL_EXECUTABLE || 'bazel',
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? false
      : ['http://localhost:5173', 'http://localhost:3001'],
    credentials: true
  },
  cache: {
    ttl: 60000, // 1 minute cache for query results
    maxSize: 100 // Maximum number of cached queries
  }
};

// Function to update workspace dynamically (in memory only)
export function setWorkspace(newWorkspace: string): void {
  config.bazelWorkspace = newWorkspace;
  bazelWorkspace = newWorkspace;
  console.log(`Updated BAZEL_WORKSPACE in memory to '${newWorkspace}'`);
}

export default config;

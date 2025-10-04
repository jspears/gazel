import type { Config } from './types/index.js';
import dotenv from 'dotenv';

dotenv.config();


export const config: Config = {
  port: parseInt(process.env.PORT || '3002', 10),
  bazelWorkspace:'',
  bazelExecutable: process.env.BAZEL_EXECUTABLE || 'bazelisk',
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
}

export default config;

import type { Config } from './types/index.js';
import dotenv from 'dotenv';

dotenv.config();

const bazelWorkspace = process.env.BAZEL_WORKSPACE;
console.log(`Using BAZEL_WORKSPACE '${bazelWorkspace}'`)

if (!bazelWorkspace)
  throw new Error(`Please point BAZEL_WORKSPACE to your bazel workspace`)

export const config: Config = {
  port: parseInt(process.env.PORT || '3001', 10),
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

export default config;

import type { Config } from './types/index.js';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

dotenv.config();

let bazelWorkspace = process.env.BAZEL_WORKSPACE || '';
console.log(`Using BAZEL_WORKSPACE '${bazelWorkspace}'`)

// Don't throw error if no workspace is set - allow app to start and show picker
// if (!bazelWorkspace)
//   throw new Error(`Please point BAZEL_WORKSPACE to your bazel workspace`)

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

// Function to update workspace dynamically
export function setWorkspace(newWorkspace: string): void {
  config.bazelWorkspace = newWorkspace;
  bazelWorkspace = newWorkspace;

  // Update .env file for persistence
  const envPath = path.join(process.cwd(), '.env');
  let envContent = '';

  try {
    envContent = fs.readFileSync(envPath, 'utf-8');
  } catch {
    // .env file doesn't exist, create it
  }

  // Update or add BAZEL_WORKSPACE line
  const lines = envContent.split('\n');
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('BAZEL_WORKSPACE=')) {
      lines[i] = `BAZEL_WORKSPACE=${newWorkspace}`;
      found = true;
      break;
    }
  }

  if (!found) {
    lines.push(`BAZEL_WORKSPACE=${newWorkspace}`);
  }

  fs.writeFileSync(envPath, lines.join('\n'));
  console.log(`Updated BAZEL_WORKSPACE to '${newWorkspace}'`);
}

export default config;

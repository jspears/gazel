import type { Config } from './types/index.js';
import dotenv from 'dotenv';
import { execSync } from 'node:child_process';

dotenv.config();

/**
 * Find the Bazel executable in the system PATH
 * Tries bazelisk first, then falls back to bazel
 */
function findBazelExecutable(): string {
  // If explicitly set via environment variable, use that
  if (process.env.BAZEL_EXECUTABLE) {
    return process.env.BAZEL_EXECUTABLE;
  }

  // Try to find bazelisk first
  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const bazeliskPath = execSync(`${which} bazelisk`, { encoding: 'utf8' }).trim().split('\n')[0];
    if (bazeliskPath) {
      console.log(`[config] Found bazelisk at: ${bazeliskPath}`);
      return bazeliskPath;
    }
  } catch (error) {
    // bazelisk not found, try bazel
  }

  // Fall back to bazel
  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const bazelPath = execSync(`${which} bazel`, { encoding: 'utf8' }).trim().split('\n')[0];
    if (bazelPath) {
      console.log(`[config] Found bazel at: ${bazelPath}`);
      return bazelPath;
    }
  } catch (error) {
    // bazel not found either
  }

  // If neither is found, default to 'bazel' and let it fail with a helpful error
  console.warn('[config] Neither bazelisk nor bazel found in PATH, defaulting to "bazel"');
  return 'bazel';
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3002', 10),
  bazelWorkspace:'',
  bazelExecutable: findBazelExecutable(),
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

// Function to update Bazel executable dynamically (in memory only)
// Returns the actual path being used after resolution
export function setBazelExecutable(executable: string): string {
  if (!executable || executable.trim() === '') {
    // Empty string means auto-detect
    const detected = findBazelExecutable();
    config.bazelExecutable = detected;
    return detected;
  }

  // Use the provided executable path
  config.bazelExecutable = executable;
  return executable;
}

export default config;

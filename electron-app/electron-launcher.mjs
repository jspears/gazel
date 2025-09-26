#!/usr/bin/env node

// Simple launcher for Electron app that works with Bazel
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the root directory (parent of electron-app)
const rootDir = path.join(__dirname, '..');

// Path to electron binary
const electronPath = path.join(rootDir, 'node_modules', '.bin', 'electron');

// Path to the main entry point
const mainPath = path.join(rootDir, 'electron', 'main.js');

// Check if we're in development mode
const isDev = process.env.NODE_ENV !== 'production';

// Set up environment variables
const env = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || 'development',
};

// Launch Electron
console.log('Starting Electron app...');
console.log('Electron path:', electronPath);
console.log('Main path:', mainPath);

const child = spawn(electronPath, [mainPath], {
  stdio: 'inherit',
  env,
  cwd: rootDir,
});

child.on('error', (err) => {
  console.error('Failed to start Electron:', err);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});

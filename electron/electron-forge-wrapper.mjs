#!/usr/bin/env node

// This wrapper script allows Bazel to run electron-forge from the electron-app directory
// while using the root node_modules

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get the command from arguments (start, package, make, etc.)
const command = process.argv[2] || 'start';
const additionalArgs = process.argv.slice(3);

// Find the electron-forge executable
const rootDir = path.join(__dirname, '..');
const electronForgePath = path.join(rootDir, 'node_modules', '@electron-forge', 'cli', 'dist', 'electron-forge.js');

// Check if the file exists
if (!fs.existsSync(electronForgePath)) {
  console.error(`Error: electron-forge not found at ${electronForgePath}`);
  console.error('Please ensure @electron-forge/cli is installed in the root node_modules');
  process.exit(1);
}

// Set working directory to electron-app
process.chdir(__dirname);

// Run electron-forge with the specified command
const child = spawn('node', [electronForgePath, command, ...additionalArgs], {
  stdio: 'inherit',
  cwd: __dirname,
  env: {
    ...process.env,
    // Ensure electron-forge can find the config
    npm_package_config_forge: path.join(__dirname, 'forge.config.cjs'),
  }
});

child.on('exit', (code) => {
  process.exit(code);
});

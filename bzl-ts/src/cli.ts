#!/usr/bin/env node
/**
 * CLI for generating TypeScript gRPC clients from Bazel proto files
 */

import { generateGrpcClient, generateAllClients } from './generator';
import * as path from 'path';

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error('Usage: bzl-ts-gen <proto-path> <output-dir> [package-name]');
    console.error('  proto-path: Path to .proto file or directory containing .proto files');
    console.error('  output-dir: Directory to output generated TypeScript files');
    console.error('  package-name: Optional package name (for single file generation)');
    process.exit(1);
  }

  const [protoPath, outputDir, packageName] = args;

  try {
    // Check if protoPath is a directory or file
    const fs = require('fs');
    const stat = fs.statSync(protoPath);

    if (stat.isDirectory()) {
      console.log(`Generating clients for all proto files in ${protoPath}...`);
      await generateAllClients(protoPath, outputDir);
    } else if (protoPath.endsWith('.proto')) {
      console.log(`Generating client for ${protoPath}...`);
      await generateGrpcClient({
        protoPath,
        outputDir,
        packageName: packageName || path.basename(protoPath, '.proto'),
      });
    } else {
      console.error('Error: proto-path must be a .proto file or directory');
      process.exit(1);
    }

    console.log('Generation complete!');
  } catch (error) {
    console.error('Error generating clients:', error);
    process.exit(1);
  }
}

main();

#!/usr/bin/env node
/**
 * Script to generate TypeScript gRPC stubs from proto files
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const protoLoader = require('@grpc/proto-loader');
const grpc = require('@grpc/grpc-js');

const PROTO_DIR = path.join(__dirname, '..', 'protos');
const OUTPUT_DIR = path.join(__dirname, '..', 'generated');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Generate TypeScript definitions for a proto file
 */
async function generateStub(protoFile) {
  const basename = path.basename(protoFile, '.proto');
  console.log(`Generating stub for ${basename}...`);

  try {
    // Load the proto file
    const packageDefinition = await protoLoader.load(protoFile, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: [PROTO_DIR],
    });

    // Generate TypeScript interface definitions
    const tsContent = generateTypeScriptInterfaces(packageDefinition, basename);
    
    // Write TypeScript file
    const outputFile = path.join(OUTPUT_DIR, `${basename}.ts`);
    fs.writeFileSync(outputFile, tsContent);
    
    console.log(`  ✓ Generated ${outputFile}`);
  } catch (error) {
    console.error(`  ✗ Failed to generate stub for ${basename}: ${error.message}`);
  }
}

/**
 * Generate TypeScript interface definitions from package definition
 */
function generateTypeScriptInterfaces(packageDef, fileName) {
  const lines = [];
  
  // Add header
  lines.push('/**');
  lines.push(` * Generated TypeScript definitions for ${fileName}`);
  lines.push(' * Auto-generated - do not edit directly');
  lines.push(' */');
  lines.push('');
  lines.push("import * as grpc from '@grpc/grpc-js';");
  lines.push("import * as protoLoader from '@grpc/proto-loader';");
  lines.push('');

  // Extract message types
  const messages = new Set();
  const services = new Map();

  // Parse the package definition
  for (const key in packageDef) {
    const value = packageDef[key];
    
    if (typeof value === 'object' && value !== null) {
      // Check if it's a service
      if (value.service) {
        services.set(key, value.service);
      } else if (value.format) {
        // It's likely a message type
        messages.add(key);
      }
    }
  }

  // Generate message interfaces
  if (messages.size > 0) {
    lines.push('// Message Types');
    for (const message of messages) {
      lines.push(`export interface ${message} {`);
      lines.push('  [key: string]: any; // Proto message fields');
      lines.push('}');
      lines.push('');
    }
  }

  // Generate service interfaces
  if (services.size > 0) {
    lines.push('// Service Definitions');
    for (const [serviceName, serviceDef] of services) {
      lines.push(`export interface ${serviceName}Client extends grpc.Client {`);
      
      // Add service methods
      for (const methodName in serviceDef) {
        const method = serviceDef[methodName];
        const isStreaming = method.responseStream || method.requestStream;
        
        if (method.responseStream && method.requestStream) {
          // Bidirectional streaming
          lines.push(`  ${methodName}(): grpc.ClientDuplexStream<any, any>;`);
        } else if (method.responseStream) {
          // Server streaming
          lines.push(`  ${methodName}(request: any): grpc.ClientReadableStream<any>;`);
        } else if (method.requestStream) {
          // Client streaming
          lines.push(`  ${methodName}(callback: grpc.requestCallback<any>): grpc.ClientWritableStream<any>;`);
        } else {
          // Unary
          lines.push(`  ${methodName}(request: any, callback: grpc.requestCallback<any>): grpc.ClientUnaryCall;`);
        }
      }
      
      lines.push('}');
      lines.push('');
    }
  }

  // Add loader function
  lines.push('// Proto Loader');
  lines.push(`export async function load${fileName.charAt(0).toUpperCase() + fileName.slice(1)}Proto(): Promise<grpc.GrpcObject> {`);
  lines.push('  const packageDefinition = await protoLoader.load(');
  lines.push(`    '${fileName}.proto',`);
  lines.push('    {');
  lines.push('      keepCase: true,');
  lines.push('      longs: String,');
  lines.push('      enums: String,');
  lines.push('      defaults: true,');
  lines.push('      oneofs: true,');
  lines.push('    }');
  lines.push('  );');
  lines.push('  return grpc.loadPackageDefinition(packageDefinition);');
  lines.push('}');

  return lines.join('\n');
}

/**
 * Main function
 */
async function main() {
  console.log('Generating TypeScript gRPC stubs...\n');

  // Find all proto files
  const protoFiles = fs.readdirSync(path.join(PROTO_DIR, 'bazel'))
    .filter(file => file.endsWith('.proto'))
    .map(file => path.join(PROTO_DIR, 'bazel', file));

  if (protoFiles.length === 0) {
    console.error('No proto files found. Run fetch-protos.sh first.');
    process.exit(1);
  }

  console.log(`Found ${protoFiles.length} proto files\n`);

  // Generate stubs for each proto file
  for (const protoFile of protoFiles) {
    await generateStub(protoFile);
  }

  // Create index file
  const indexContent = generateIndexFile(protoFiles);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), indexContent);

  console.log('\n✅ Stub generation complete!');
  console.log(`Generated files in: ${OUTPUT_DIR}`);
}

/**
 * Generate index.ts file that exports all stubs
 */
function generateIndexFile(protoFiles) {
  const lines = [];
  
  lines.push('/**');
  lines.push(' * Index file for generated Bazel gRPC stubs');
  lines.push(' * Auto-generated - do not edit directly');
  lines.push(' */');
  lines.push('');

  // Export all generated modules
  for (const protoFile of protoFiles) {
    const basename = path.basename(protoFile, '.proto');
    lines.push(`export * from './${basename}';`);
  }

  return lines.join('\n');
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

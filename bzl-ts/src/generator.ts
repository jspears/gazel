/**
 * Generator for TypeScript gRPC clients from Bazel proto files
 */

import * as fs from 'fs';
import * as path from 'path';
import * as protoLoader from '@grpc/proto-loader';
import * as grpc from '@grpc/grpc-js';

export interface GeneratorOptions {
  protoPath: string;
  outputDir: string;
  packageName?: string;
}

/**
 * Generate TypeScript client from a proto file
 */
export async function generateGrpcClient(options: GeneratorOptions): Promise<void> {
  const { protoPath, outputDir, packageName } = options;

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Load the proto file
  const packageDefinition = await protoLoader.load(protoPath, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });

  // Load the package definition into gRPC
  const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);

  // Generate TypeScript definitions
  const tsContent = generateTypeScriptDefinitions(protoDescriptor, packageName);

  // Write the TypeScript file
  const outputFile = path.join(outputDir, `${packageName || 'client'}.ts`);
  fs.writeFileSync(outputFile, tsContent);

  console.log(`Generated gRPC client at ${outputFile}`);
}

/**
 * Generate TypeScript definitions from proto descriptor
 */
function generateTypeScriptDefinitions(
  protoDescriptor: any,
  packageName?: string
): string {
  const lines: string[] = [];

  // Add imports
  lines.push(`import * as grpc from '@grpc/grpc-js';`);
  lines.push(`import * as protoLoader from '@grpc/proto-loader';`);
  lines.push('');

  // Add interface definitions for services
  lines.push('// Service interfaces');
  for (const key in protoDescriptor) {
    if (typeof protoDescriptor[key] === 'function') {
      lines.push(`export interface ${key}Client extends grpc.Client {`);
      
      // Get service methods
      const service = protoDescriptor[key];
      const serviceMethods = service.service;
      
      if (serviceMethods) {
        for (const methodName in serviceMethods) {
          const method = serviceMethods[methodName];
          lines.push(`  ${methodName}(`);
          lines.push(`    request: any,`);
          lines.push(`    callback: grpc.requestCallback<any>`);
          lines.push(`  ): grpc.ClientUnaryCall;`);
        }
      }
      
      lines.push('}');
      lines.push('');
    }
  }

  // Add client creation function
  lines.push('// Client creation');
  lines.push(`export function createClient(`);
  lines.push(`  protoPath: string,`);
  lines.push(`  address: string,`);
  lines.push(`  credentials?: grpc.ChannelCredentials`);
  lines.push(`): Promise<any> {`);
  lines.push(`  return protoLoader.load(protoPath, {`);
  lines.push(`    keepCase: true,`);
  lines.push(`    longs: String,`);
  lines.push(`    enums: String,`);
  lines.push(`    defaults: true,`);
  lines.push(`    oneofs: true,`);
  lines.push(`  }).then((packageDefinition) => {`);
  lines.push(`    const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);`);
  lines.push(`    return protoDescriptor;`);
  lines.push(`  });`);
  lines.push('}');

  return lines.join('\n');
}

/**
 * Find all proto files in a directory
 */
export function findProtoFiles(dir: string): string[] {
  const protoFiles: string[] = [];

  function walk(currentDir: string) {
    const files = fs.readdirSync(currentDir);
    for (const file of files) {
      const filePath = path.join(currentDir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walk(filePath);
      } else if (file.endsWith('.proto')) {
        protoFiles.push(filePath);
      }
    }
  }

  walk(dir);
  return protoFiles;
}

/**
 * Generate clients for all proto files in a directory
 */
export async function generateAllClients(
  protoDir: string,
  outputDir: string
): Promise<void> {
  const protoFiles = findProtoFiles(protoDir);
  
  for (const protoFile of protoFiles) {
    const basename = path.basename(protoFile, '.proto');
    await generateGrpcClient({
      protoPath: protoFile,
      outputDir,
      packageName: basename,
    });
  }
}

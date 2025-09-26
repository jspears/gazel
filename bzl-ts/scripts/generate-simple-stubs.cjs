#!/usr/bin/env node
/**
 * Simple TypeScript stub generator for Bazel proto files
 * Generates TypeScript interfaces without requiring all proto dependencies
 */

const fs = require('fs');
const path = require('path');

const PROTO_DIR = path.join(__dirname, '..', 'protos', 'bazel');
const OUTPUT_DIR = path.join(__dirname, '..', 'generated');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/**
 * Parse proto file and extract message and service definitions
 */
function parseProtoFile(protoPath) {
  const content = fs.readFileSync(protoPath, 'utf8');
  const basename = path.basename(protoPath, '.proto');
  
  const messages = [];
  const services = [];
  const enums = [];
  
  // Extract package name
  const packageMatch = content.match(/package\s+([^;]+);/);
  const packageName = packageMatch ? packageMatch[1] : '';
  
  // Extract messages
  const messageRegex = /message\s+(\w+)\s*{([^}]*)}/g;
  let match;
  while ((match = messageRegex.exec(content)) !== null) {
    const messageName = match[1];
    const messageBody = match[2];
    
    const fields = [];
    const fieldRegex = /(?:optional|required|repeated)?\s*(\w+)\s+(\w+)\s*=\s*(\d+)/g;
    let fieldMatch;
    while ((fieldMatch = fieldRegex.exec(messageBody)) !== null) {
      fields.push({
        type: fieldMatch[1],
        name: fieldMatch[2],
        number: fieldMatch[3]
      });
    }
    
    messages.push({ name: messageName, fields });
  }
  
  // Extract services
  const serviceRegex = /service\s+(\w+)\s*{([^}]*)}/g;
  while ((match = serviceRegex.exec(content)) !== null) {
    const serviceName = match[1];
    const serviceBody = match[2];
    
    const methods = [];
    const methodRegex = /rpc\s+(\w+)\s*\(([^)]+)\)\s*returns\s*\(([^)]+)\)/g;
    let methodMatch;
    while ((methodMatch = methodRegex.exec(serviceBody)) !== null) {
      methods.push({
        name: methodMatch[1],
        request: methodMatch[2].trim(),
        response: methodMatch[3].trim(),
        isStreamingRequest: methodMatch[2].includes('stream'),
        isStreamingResponse: methodMatch[3].includes('stream')
      });
    }
    
    services.push({ name: serviceName, methods });
  }
  
  // Extract enums - make names unique
  const enumRegex = /enum\s+(\w+)\s*{([^}]*)}/g;
  const enumNames = new Map();
  while ((match = enumRegex.exec(content)) !== null) {
    let enumName = match[1];
    const enumBody = match[2];

    // If we've seen this enum name before, make it unique
    if (enumNames.has(enumName)) {
      const count = enumNames.get(enumName) + 1;
      enumNames.set(enumName, count);
      enumName = `${enumName}${count}`;
    } else {
      enumNames.set(enumName, 1);
    }

    const values = [];
    const valueRegex = /(\w+)\s*=\s*(\d+)/g;
    let valueMatch;
    while ((valueMatch = valueRegex.exec(enumBody)) !== null) {
      values.push({
        name: valueMatch[1],
        value: valueMatch[2]
      });
    }

    enums.push({ name: enumName, values });
  }
  
  return { basename, packageName, messages, services, enums };
}

/**
 * Generate TypeScript code from parsed proto
 */
function generateTypeScript(parsed) {
  const lines = [];
  
  // Header
  lines.push('/**');
  lines.push(` * Generated TypeScript definitions for ${parsed.basename}`);
  lines.push(` * Package: ${parsed.packageName || 'unknown'}`);
  lines.push(' * Auto-generated - do not edit directly');
  lines.push(' */');
  lines.push('');
  lines.push("import * as grpc from '@grpc/grpc-js';");
  lines.push('');
  
  // Generate enums
  if (parsed.enums.length > 0) {
    lines.push('// Enums');
    for (const enumDef of parsed.enums) {
      lines.push(`export enum ${enumDef.name} {`);
      const seenValues = new Set();
      for (const value of enumDef.values) {
        // Skip duplicate enum values
        if (seenValues.has(value.name)) continue;
        seenValues.add(value.name);
        lines.push(`  ${value.name} = ${value.value},`);
      }
      lines.push('}');
      lines.push('');
    }
  }
  
  // Generate message interfaces
  if (parsed.messages.length > 0) {
    lines.push('// Message Types');
    const seenFields = new Set();
    for (const message of parsed.messages) {
      lines.push(`export interface ${message.name} {`);
      const messageFields = new Set();
      for (const field of message.fields) {
        // Skip duplicate fields within the same message
        if (messageFields.has(field.name)) continue;
        messageFields.add(field.name);

        const tsType = protoTypeToTypeScript(field.type);
        lines.push(`  ${field.name}?: ${tsType};`);
      }
      if (message.fields.length === 0) {
        lines.push('  [key: string]: any;');
      }
      lines.push('}');
      lines.push('');
    }
  }
  
  // Generate service interfaces
  if (parsed.services.length > 0) {
    lines.push('// Service Definitions');
    for (const service of parsed.services) {
      lines.push(`export interface ${service.name}Client extends grpc.Client {`);
      
      for (const method of service.methods) {
        if (method.isStreamingRequest && method.isStreamingResponse) {
          lines.push(`  ${method.name}(): grpc.ClientDuplexStream<${cleanType(method.request)}, ${cleanType(method.response)}>;`);
        } else if (method.isStreamingResponse) {
          lines.push(`  ${method.name}(request: ${cleanType(method.request)}): grpc.ClientReadableStream<${cleanType(method.response)}>;`);
        } else if (method.isStreamingRequest) {
          lines.push(`  ${method.name}(callback: grpc.requestCallback<${cleanType(method.response)}>): grpc.ClientWritableStream<${cleanType(method.request)}>;`);
        } else {
          lines.push(`  ${method.name}(request: ${cleanType(method.request)}, callback: grpc.requestCallback<${cleanType(method.response)}>): grpc.ClientUnaryCall;`);
        }
      }
      
      lines.push('}');
      lines.push('');
    }
  }
  
  return lines.join('\n');
}

/**
 * Convert proto type to TypeScript type
 */
function protoTypeToTypeScript(protoType) {
  const typeMap = {
    'double': 'number',
    'float': 'number',
    'int32': 'number',
    'int64': 'string', // Use string for 64-bit integers
    'uint32': 'number',
    'uint64': 'string',
    'sint32': 'number',
    'sint64': 'string',
    'fixed32': 'number',
    'fixed64': 'string',
    'sfixed32': 'number',
    'sfixed64': 'string',
    'bool': 'boolean',
    'string': 'string',
    'bytes': 'Uint8Array',
  };
  
  return typeMap[protoType] || 'any';
}

/**
 * Clean type name (remove 'stream' keyword)
 */
function cleanType(type) {
  return type.replace(/^stream\s+/, '');
}

/**
 * Main function
 */
async function main() {
  console.log('Generating TypeScript gRPC stubs...\n');
  
  // Find all proto files
  const protoFiles = fs.readdirSync(PROTO_DIR)
    .filter(file => file.endsWith('.proto'))
    .map(file => path.join(PROTO_DIR, file));
  
  if (protoFiles.length === 0) {
    console.error('No proto files found. Run fetch-protos.sh first.');
    process.exit(1);
  }
  
  console.log(`Found ${protoFiles.length} proto files\n`);
  
  const generatedFiles = [];
  
  // Generate stubs for each proto file
  for (const protoFile of protoFiles) {
    const basename = path.basename(protoFile, '.proto');
    console.log(`Generating stub for ${basename}...`);
    
    try {
      const parsed = parseProtoFile(protoFile);
      const tsContent = generateTypeScript(parsed);
      
      const outputFile = path.join(OUTPUT_DIR, `${basename}.ts`);
      fs.writeFileSync(outputFile, tsContent);
      
      generatedFiles.push(basename);
      console.log(`  ✓ Generated ${outputFile}`);
    } catch (error) {
      console.error(`  ✗ Failed to generate stub for ${basename}: ${error.message}`);
    }
  }
  
  // Create index file with namespaced exports to avoid conflicts
  if (generatedFiles.length > 0) {
    const indexLines = [
      '/**',
      ' * Index file for generated Bazel gRPC stubs',
      ' * Auto-generated - do not edit directly',
      ' */',
      '',
      '// Export each module with namespace to avoid conflicts',
      ...generatedFiles.map(name => {
        const camelName = name.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        return `export * as ${camelName} from './${name}';`;
      })
    ];

    fs.writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), indexLines.join('\n'));
    console.log(`\n✓ Generated index.ts`);
  }
  
  console.log('\n✅ Stub generation complete!');
  console.log(`Generated ${generatedFiles.length} files in: ${OUTPUT_DIR}`);
}

// Run the script
main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

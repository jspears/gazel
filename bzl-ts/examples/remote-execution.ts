/**
 * Remote Execution Example
 * Demonstrates using the Remote Execution API v2 with Bazel
 */

import { BazelClient } from '../src/index.js';
import { remoteExecution } from '../generated/index.js';

async function main() {
  console.log('Remote Execution Example\n');
  console.log('========================\n');

  // Initialize client with remote execution configuration
  const hasRemoteConfig = process.env.REMOTE_EXECUTOR && process.env.REMOTE_CAS;

  const bazel = new BazelClient({
    workspace: process.env.BAZEL_WORKSPACE || process.cwd(),
    remote: hasRemoteConfig ? {
      executor: process.env.REMOTE_EXECUTOR,
      instanceName: process.env.REMOTE_INSTANCE || 'default',
      cas: process.env.REMOTE_CAS,

      // Optional: Authentication
      apiKey: process.env.REMOTE_API_KEY,

      // Optional: Custom headers
      headers: process.env.REMOTE_HEADERS ?
        JSON.parse(process.env.REMOTE_HEADERS) : undefined
    } : undefined
  });

  console.log('Client initialized with remote execution support');
  console.log(`  Executor: ${bazel.remote?.executor || 'Not configured'}`);
  console.log(`  CAS: ${bazel.remote?.cas || 'Not configured'}`);
  console.log(`  Instance: ${bazel.remote?.instanceName || 'default'}\n`);

  // Check if remote execution is configured
  if (!bazel.remoteExecution) {
    console.log('⚠️  Remote execution is not configured.');
    console.log('   Set REMOTE_EXECUTOR and REMOTE_CAS environment variables to enable it.');
    console.log('\n   Example:');
    console.log('   REMOTE_EXECUTOR=grpc://remote.buildbuddy.io:443 \\');
    console.log('   REMOTE_CAS=grpc://remote.buildbuddy.io:443 \\');
    console.log('   REMOTE_API_KEY=your-api-key \\');
    console.log('   bazel run //bzl-ts:example_remote_execution\n');
    
    // Demo with mock data even without real remote execution
    console.log('Running demo with mock remote execution service...\n');
    await runMockDemo();
    return;
  }

  try {
    // 1. Get server capabilities
    console.log('1. Checking server capabilities...');
    const capabilities = await bazel.remoteExecution.getCapabilities();
    console.log('   Server capabilities:');
    console.log(`   - Execution: ${capabilities.executionCapabilities ? 'Supported' : 'Not supported'}`);
    console.log(`   - Cache: ${capabilities.cacheCapabilities ? 'Supported' : 'Not supported'}`);
    if (capabilities.executionCapabilities?.digestFunction) {
      console.log(`   - Digest function: ${capabilities.executionCapabilities.digestFunction}`);
    }
    if (capabilities.executionCapabilities?.execEnabled) {
      console.log(`   - Execution enabled: ${capabilities.executionCapabilities.execEnabled}`);
    }
    console.log();

    // 2. Create a simple action to execute
    console.log('2. Creating a simple action...');
    
    // Create a command
    const command: remoteExecution.Command = {
      arguments: ['echo', 'Hello from remote execution!'],
      environmentVariables: [
        { name: 'USER', value: 'bazel-remote' },
        { name: 'BUILD_ID', value: Date.now().toString() }
      ],
      outputFiles: ['output.txt'],
      outputDirectories: [],
      platform: {
        properties: [
          { name: 'OSFamily', value: 'Linux' },
          { name: 'Arch', value: 'x86_64' }
        ]
      }
    };

    // Upload the command to CAS
    console.log('   Uploading command to CAS...');
    const commandDigest = await bazel.remoteExecution.uploadCommand(command);
    console.log(`   Command digest: ${commandDigest.hash}/${commandDigest.sizeBytes}`);

    // Create an action
    const action: remoteExecution.Action = {
      commandDigest: commandDigest,
      inputRootDigest: { hash: '', sizeBytes: '0' }, // Empty input for this example
      timeout: { seconds: '60', nanos: 0 },
      doNotCache: false
    };

    // 3. Execute the action
    console.log('\n3. Executing action remotely...');
    const executeResponse = await bazel.remoteExecution.execute(action);
    
    if (executeResponse.result) {
      console.log('   ✅ Execution completed successfully!');
      console.log(`   - Exit code: ${executeResponse.result.exitCode}`);
      
      if (executeResponse.result.stdoutDigest) {
        console.log('\n   Stdout:');
        const stdout = await bazel.remoteExecution.downloadBlob(executeResponse.result.stdoutDigest);
        console.log(`   ${stdout.toString()}`);
      }
      
      if (executeResponse.result.stderrDigest) {
        console.log('\n   Stderr:');
        const stderr = await bazel.remoteExecution.downloadBlob(executeResponse.result.stderrDigest);
        console.log(`   ${stderr.toString()}`);
      }
      
      if (executeResponse.result.outputFiles?.length > 0) {
        console.log('\n   Output files:');
        for (const file of executeResponse.result.outputFiles) {
          console.log(`   - ${file.path}: ${file.digest?.hash}/${file.digest?.sizeBytes}`);
        }
      }
    } else if (executeResponse.status) {
      console.log(`   ⚠️  Execution returned status: ${executeResponse.status.code}`);
      console.log(`   Message: ${executeResponse.status.message}`);
    }

    // 4. Check action cache
    console.log('\n4. Checking action cache...');
    const cachedResult = await bazel.remoteExecution.getActionResult(
      await bazel.remoteExecution.getActionDigest(action)
    );
    
    if (cachedResult) {
      console.log('   ✅ Action result found in cache!');
      console.log(`   - Exit code: ${cachedResult.exitCode}`);
    } else {
      console.log('   ℹ️  Action result not in cache');
    }

    // 5. Upload and download blobs
    console.log('\n5. Testing blob upload/download...');
    const testData = Buffer.from('This is a test blob for remote CAS');
    const blobDigest = await bazel.remoteExecution.uploadBlob(
      await bazel.remoteExecution.computeDigest(testData),
      testData
    );
    console.log(`   Uploaded blob: ${blobDigest.hash}/${blobDigest.sizeBytes}`);
    
    const downloadedData = await bazel.remoteExecution.downloadBlob(blobDigest);
    console.log(`   Downloaded blob: "${downloadedData.toString()}"`);
    console.log(`   ✅ Blob round-trip successful!`);

    // 6. Batch check for missing blobs
    console.log('\n6. Checking for missing blobs...');
    const digests = [
      blobDigest,
      { hash: 'nonexistent123', sizeBytes: '100' }
    ];
    const missingBlobs = await bazel.remoteExecution.findMissingBlobs(digests);
    console.log(`   Found ${missingBlobs.length} missing blob(s):`);
    missingBlobs.forEach(d => {
      console.log(`   - ${d.hash}/${d.sizeBytes}`);
    });

    // 7. Watch long-running operation (if supported)
    console.log('\n7. Long-running operations...');
    if (executeResponse.name) {
      console.log(`   Watching operation: ${executeResponse.name}`);
      const operationStream = bazel.remoteExecution.watchOperation(executeResponse.name);
      
      operationStream.on('data', (operation: remoteExecution.Operation) => {
        console.log(`   - Operation update: ${operation.done ? 'Complete' : 'In progress'}`);
      });
      
      // Wait a bit for updates
      await new Promise(resolve => setTimeout(resolve, 2000));
      operationStream.cancel();
    } else {
      console.log('   No long-running operation to watch');
    }

    console.log('\n✅ Remote execution example completed successfully!');

  } catch (error) {
    console.error('\n❌ Error during remote execution:', error);
    console.error('\nMake sure your remote execution service is running and accessible.');
  }
}

// Mock demo when no real remote execution is configured
async function runMockDemo() {
  console.log('Mock Remote Execution Demo');
  console.log('==========================\n');

  console.log('1. Server Capabilities (mock):');
  console.log('   - Execution: Supported');
  console.log('   - Cache: Supported');
  console.log('   - Digest function: SHA256');
  console.log('   - Max batch total size: 4MB\n');

  console.log('2. Example Action (mock):');
  console.log('   Command: gcc -c hello.c -o hello.o');
  console.log('   Platform: Linux x86_64');
  console.log('   Timeout: 60s\n');

  console.log('3. Execution Result (mock):');
  console.log('   ✅ Success (exit code: 0)');
  console.log('   Stdout: Compiling hello.c...');
  console.log('   Output files: hello.o (1234 bytes)\n');

  console.log('4. Cache Statistics (mock):');
  console.log('   - Action cache hits: 42');
  console.log('   - Action cache misses: 8');
  console.log('   - CAS hits: 156');
  console.log('   - CAS misses: 12\n');

  console.log('5. Common Remote Execution Configurations:\n');
  
  console.log('   BuildBuddy:');
  console.log('   -----------');
  console.log('   REMOTE_EXECUTOR=grpc://remote.buildbuddy.io:443');
  console.log('   REMOTE_CAS=grpc://remote.buildbuddy.io:443');
  console.log('   REMOTE_API_KEY=<your-api-key>\n');

  console.log('   BuildFarm:');
  console.log('   ----------');
  console.log('   REMOTE_EXECUTOR=grpc://buildfarm.example.com:8980');
  console.log('   REMOTE_CAS=grpc://buildfarm.example.com:8981\n');

  console.log('   Buildbarn:');
  console.log('   ----------');
  console.log('   REMOTE_EXECUTOR=grpc://scheduler.buildbarn:8982');
  console.log('   REMOTE_CAS=grpc://storage.buildbarn:8981\n');

  console.log('   Local Testing (with Buildbarn/BuildGrid):');
  console.log('   -----------------------------------------');
  console.log('   REMOTE_EXECUTOR=grpc://localhost:8980');
  console.log('   REMOTE_CAS=grpc://localhost:8981\n');

  console.log('To use remote execution with Bazel directly:');
  console.log('---------------------------------------------');
  console.log('bazel build //your:target \\');
  console.log('  --remote_executor=grpc://remote.example.com:443 \\');
  console.log('  --remote_cache=grpc://remote.example.com:443 \\');
  console.log('  --remote_instance_name=projects/your-project \\');
  console.log('  --remote_header="x-api-key=your-key"\n');
}

// Run the example
main().catch(console.error);

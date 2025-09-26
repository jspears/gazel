/**
 * Example usage of the generated Bazel gRPC TypeScript stubs
 */

import { 
  buildEventStream,
  remoteExecution,
  analysisV2,
  commandLine,
  invocationPolicy,
  build
} from './generated';

// Example 1: Working with Build Event Stream types
function createBuildEvent(): buildEventStream.BuildEvent {
  const event: buildEventStream.BuildEvent = {
    id: {
      started: {
        uuid: 'test-uuid-123',
        command: 'build',
        commandLineLabel: '//my:target',
        workspaceDirectory: '/workspace',
        workingDirectory: '/workspace',
        serverPid: 12345,
        buildToolVersion: '7.0.0',
        optionsDescription: 'default options',
        invocationId: 'inv-123',
        commandLine: [],
        structuredCommandLine: [],
        workspaceInfo: {
          localExecRoot: '/exec/root'
        }
      }
    },
    children: [],
    lastMessage: false
  };
  
  return event;
}

// Example 2: Working with Remote Execution API types
function createAction(): remoteExecution.Action {
  const action: remoteExecution.Action = {
    commandDigest: {
      hash: 'abc123def456',
      sizeBytes: '1024'
    },
    inputRootDigest: {
      hash: 'input123',
      sizeBytes: '2048'
    },
    timeout: {
      seconds: '60',
      nanos: 0
    },
    doNotCache: false,
    salt: new Uint8Array([1, 2, 3]),
    platform: {
      properties: [
        { name: 'os', value: 'linux' },
        { name: 'arch', value: 'x86_64' }
      ]
    }
  };
  
  return action;
}

// Example 3: Working with Analysis types
function createTargetComplete(): analysisV2.TargetComplete {
  const target: analysisV2.TargetComplete = {
    target: {
      label: '//my:target',
      ruleClass: 'cc_library',
      ruleAttributes: []
    },
    success: true,
    tag: ['tag1', 'tag2'],
    outputGroup: [
      {
        name: 'default',
        fileSets: [],
        incomplete: false
      }
    ],
    important: true
  };
  
  return target;
}

// Example 4: Working with Command Line types
function createCommandLineOption(): commandLine.Option {
  const option: commandLine.Option = {
    combinedForm: '--config=debug',
    optionName: 'config',
    optionValue: 'debug',
    effectTags: [commandLine.OptionEffectTag.AFFECTS_OUTPUTS]
  };
  
  return option;
}

// Example 5: Working with Build types
function createQueryResult(): build.QueryResult {
  const result: build.QueryResult = {
    target: [
      {
        type: build.Target.Discriminator.RULE,
        rule: {
          name: '//my:target',
          ruleClass: 'cc_library',
          location: '/workspace/BUILD:10:1',
          attribute: [],
          ruleInput: [],
          ruleOutput: [],
          defaultSetting: []
        }
      }
    ]
  };
  
  return result;
}

// Example 6: Working with enums
function demonstrateEnums() {
  // Build Event Stream enums
  const streamType = buildEventStream.BuildEventId.BuildEventIdOneofCase.STARTED;
  const testStatus = buildEventStream.TestStatus.PASSED;
  
  // Remote Execution enums
  const cacheCapability = remoteExecution.CacheCapabilities.SymlinkAbsolutePathStrategy.ALLOWED;
  const digestFunction = remoteExecution.DigestFunction.SHA256;
  
  // Command Line enums
  const effectTag = commandLine.OptionEffectTag.NO_OP;
  
  console.log('Stream Type:', streamType);
  console.log('Test Status:', testStatus);
  console.log('Cache Capability:', cacheCapability);
  console.log('Digest Function:', digestFunction);
  console.log('Effect Tag:', effectTag);
}

// Main function to demonstrate usage
function main() {
  console.log('=== Bazel gRPC TypeScript Stubs Examples ===\n');
  
  console.log('1. Build Event:');
  const buildEvent = createBuildEvent();
  console.log(JSON.stringify(buildEvent, null, 2));
  
  console.log('\n2. Remote Execution Action:');
  const action = createAction();
  console.log(JSON.stringify(action, null, 2));
  
  console.log('\n3. Analysis Target Complete:');
  const targetComplete = createTargetComplete();
  console.log(JSON.stringify(targetComplete, null, 2));
  
  console.log('\n4. Command Line Option:');
  const option = createCommandLineOption();
  console.log(JSON.stringify(option, null, 2));
  
  console.log('\n5. Query Result:');
  const queryResult = createQueryResult();
  console.log(JSON.stringify(queryResult, null, 2));
  
  console.log('\n6. Enum Values:');
  demonstrateEnums();
}

// Run the examples
if (require.main === module) {
  main();
}

export {
  createBuildEvent,
  createAction,
  createTargetComplete,
  createCommandLineOption,
  createQueryResult,
  demonstrateEnums
};

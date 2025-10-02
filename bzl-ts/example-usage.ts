/**
 * Example usage of the generated Bazel proto TypeScript types
 */

// Import the generated types
import { BazelBuildInfo, BazelTargetInfo } from '../bazel-bin/bzl-ts/protos/bazel_example_pb';
import { BuildEvent } from '../bazel-bin/src/main/java/com/google/devtools/build/lib/buildeventstream/proto/build_event_stream_pb';
import { ExecLogEntry_Spawn } from '../bazel-bin/src/main/protobuf/spawn_pb';
import { Target } from '../bazel-bin/src/main/protobuf/build_pb';

// Example function that creates a BazelBuildInfo message
export function createBazelBuildInfo(): BazelBuildInfo {
  // Note: This is a type-only example since we're using the generated types
  // In a real application, you would use the protobuf runtime to create instances
  const buildInfo: BazelBuildInfo = {
    buildEvent: {} as BuildEvent,
    spawnInfo: {} as ExecLogEntry_Spawn,
    workspaceName: 'my-workspace',
    targets: ['//app:build', '//server:test']
  } as BazelBuildInfo;

  return buildInfo;
}

// Example function that processes target information
export function processTargetInfo(target: Target): BazelTargetInfo {
  const targetInfo: BazelTargetInfo = {
    target: target,
    packageName: 'example/package',
    attributes: {
      'visibility': 'public',
      'testonly': 'false'
    }
  } as BazelTargetInfo;

  return targetInfo;
}

// Example type guard
export function isBazelBuildInfo(obj: any): obj is BazelBuildInfo {
  return obj && 
    typeof obj.workspaceName === 'string' &&
    Array.isArray(obj.targets);
}

// Example of using the types in an interface
export interface BazelEventProcessor {
  processBuildEvent(event: BuildEvent): void;
  processSpawn(spawn: ExecLogEntry_Spawn): void;
  getBuildInfo(): BazelBuildInfo;
}

// Example implementation
export class DefaultBazelEventProcessor implements BazelEventProcessor {
  private buildInfo: BazelBuildInfo;

  constructor() {
    this.buildInfo = createBazelBuildInfo();
  }

  processBuildEvent(event: BuildEvent): void {
    this.buildInfo.buildEvent = event;
    console.log('Processing build event');
  }

  processSpawn(spawn: ExecLogEntry_Spawn): void {
    this.buildInfo.spawnInfo = spawn;
    console.log('Processing spawn');
  }

  getBuildInfo(): BazelBuildInfo {
    return this.buildInfo;
  }
}

console.log('Bazel proto TypeScript types are successfully generated and can be used!');

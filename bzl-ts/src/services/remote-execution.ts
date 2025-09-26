/**
 * Remote Execution Service - Interface with remote build execution and caching
 */

import * as grpc from '@grpc/grpc-js';
import { remoteExecution } from '../../generated/index.js';
import { createHash } from 'crypto';

export interface RemoteExecutionOptions {
  executor?: string;
  cas?: string;
  cache?: string;
  instanceName?: string;
  credentials?: grpc.ChannelCredentials;
  apiKey?: string;
  headers?: Record<string, string>;
}

export class RemoteExecutionService {
  private executionClient?: grpc.Client;
  private cacheClient?: grpc.Client;
  private capabilitiesClient?: grpc.Client;
  private instanceName: string;

  constructor(private options: RemoteExecutionOptions) {
    this.instanceName = options.instanceName || 'default';

    if (options.executor) {
      this.initExecutionClient(options.executor, options.credentials);
    }

    // Support both 'cas' and 'cache' for backwards compatibility
    const cacheEndpoint = options.cas || options.cache;
    if (cacheEndpoint) {
      this.initCacheClient(cacheEndpoint, options.credentials);
    }
  }

  /**
   * Initialize execution client
   */
  private initExecutionClient(endpoint: string, credentials?: grpc.ChannelCredentials): void {
    const creds = credentials || grpc.credentials.createInsecure();
    this.executionClient = new grpc.Client(endpoint, creds);
    this.capabilitiesClient = new grpc.Client(endpoint, creds);
  }

  /**
   * Initialize cache client
   */
  private initCacheClient(endpoint: string, credentials?: grpc.ChannelCredentials): void {
    const creds = credentials || grpc.credentials.createInsecure();
    this.cacheClient = new grpc.Client(endpoint, creds);
  }

  /**
   * Get server capabilities
   */
  async getCapabilities(): Promise<remoteExecution.ServerCapabilities> {
    if (!this.capabilitiesClient) {
      throw new Error('Remote execution not configured');
    }

    return new Promise((resolve, reject) => {
      this.capabilitiesClient!.makeUnaryRequest(
        '/build.bazel.remote.execution.v2.Capabilities/GetCapabilities',
        (value: any) => Buffer.from(JSON.stringify(value)),
        (buffer: Buffer) => JSON.parse(buffer.toString()),
        { instanceName: this.instanceName },
        (err, response) => {
          if (err) {
            reject(err);
          } else {
            resolve(response as remoteExecution.ServerCapabilities);
          }
        }
      );
    });
  }

  /**
   * Execute an action remotely
   */
  async execute(action: remoteExecution.Action): Promise<remoteExecution.ExecuteResponse> {
    if (!this.executionClient) {
      throw new Error('Remote execution not configured');
    }

    // First, upload the action to CAS
    const actionDigest = await this.uploadAction(action);

    // Create execute request
    const request: remoteExecution.ExecuteRequest = {
      instanceName: this.instanceName,
      actionDigest,
      skipCacheLookup: false,
      executionPolicy: {
        priority: 0
      },
      resultsCachePolicy: {
        priority: 0
      }
    };

    // Execute the action
    return new Promise((resolve, reject) => {
      const stream = this.executionClient!.makeServerStreamRequest(
        '/build.bazel.remote.execution.v2.Execution/Execute',
        (value: any) => Buffer.from(JSON.stringify(value)),
        (buffer: Buffer) => JSON.parse(buffer.toString()),
        request
      );

      let lastResponse: remoteExecution.ExecuteResponse | null = null;

      stream.on('data', (data: any) => {
        lastResponse = data as remoteExecution.ExecuteResponse;
        // Could emit progress events here
      });

      stream.on('end', () => {
        if (lastResponse) {
          resolve(lastResponse);
        } else {
          reject(new Error('No response received'));
        }
      });

      stream.on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Upload an action to CAS
   */
  private async uploadAction(action: remoteExecution.Action): Promise<remoteExecution.Digest> {
    const actionData = JSON.stringify(action);
    const hash = createHash('sha256').update(actionData).digest('hex');
    const sizeBytes = Buffer.byteLength(actionData).toString();

    const digest: remoteExecution.Digest = {
      hash,
      sizeBytes
    };

    // Upload to CAS
    await this.uploadBlob(digest, Buffer.from(actionData));

    return digest;
  }

  /**
   * Upload a blob to CAS
   */
  async uploadBlob(digest: remoteExecution.Digest, data: Buffer): Promise<void> {
    if (!this.cacheClient) {
      throw new Error('Remote cache not configured');
    }

    const request = {
      instanceName: this.instanceName,
      requests: [{
        digest,
        data: data.toString('base64')
      }]
    };

    return new Promise((resolve, reject) => {
      this.cacheClient!.makeUnaryRequest(
        '/build.bazel.remote.execution.v2.ContentAddressableStorage/BatchUpdateBlobs',
        (value: any) => Buffer.from(JSON.stringify(value)),
        (buffer: Buffer) => JSON.parse(buffer.toString()),
        request,
        (err, response) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Download a blob from CAS
   */
  async downloadBlob(digest: remoteExecution.Digest): Promise<Buffer> {
    if (!this.cacheClient) {
      throw new Error('Remote cache not configured');
    }

    const request = {
      instanceName: this.instanceName,
      digests: [digest]
    };

    return new Promise((resolve, reject) => {
      this.cacheClient!.makeUnaryRequest(
        '/build.bazel.remote.execution.v2.ContentAddressableStorage/BatchReadBlobs',
        (value: any) => Buffer.from(JSON.stringify(value)),
        (buffer: Buffer) => JSON.parse(buffer.toString()),
        request,
        (err, response: any) => {
          if (err) {
            reject(err);
          } else if (response.responses && response.responses.length > 0) {
            const data = Buffer.from(response.responses[0].data, 'base64');
            resolve(data);
          } else {
            reject(new Error('Blob not found'));
          }
        }
      );
    });
  }

  /**
   * Check if blobs exist in CAS
   */
  async findMissingBlobs(digests: remoteExecution.Digest[]): Promise<remoteExecution.Digest[]> {
    if (!this.cacheClient) {
      throw new Error('Remote cache not configured');
    }

    const request = {
      instanceName: this.instanceName,
      blobDigests: digests
    };

    return new Promise((resolve, reject) => {
      this.cacheClient!.makeUnaryRequest(
        '/build.bazel.remote.execution.v2.ContentAddressableStorage/FindMissingBlobs',
        (value: any) => Buffer.from(JSON.stringify(value)),
        (buffer: Buffer) => JSON.parse(buffer.toString()),
        request,
        (err, response: any) => {
          if (err) {
            reject(err);
          } else {
            resolve(response.missingBlobDigests || []);
          }
        }
      );
    });
  }

  /**
   * Get action result from cache
   */
  async getActionResult(actionDigest: remoteExecution.Digest): Promise<remoteExecution.ActionResult | null> {
    if (!this.cacheClient) {
      throw new Error('Remote cache not configured');
    }

    const request = {
      instanceName: this.instanceName,
      actionDigest,
      inlineStdout: true,
      inlineStderr: true,
      inlineOutputFiles: []
    };

    return new Promise((resolve, reject) => {
      this.cacheClient!.makeUnaryRequest(
        '/build.bazel.remote.execution.v2.ActionCache/GetActionResult',
        (value: any) => Buffer.from(JSON.stringify(value)),
        (buffer: Buffer) => JSON.parse(buffer.toString()),
        request,
        (err, response) => {
          if (err) {
            if (err.code === grpc.status.NOT_FOUND) {
              resolve(null);
            } else {
              reject(err);
            }
          } else {
            resolve(response as remoteExecution.ActionResult);
          }
        }
      );
    });
  }

  /**
   * Update action result in cache
   */
  async updateActionResult(
    actionDigest: remoteExecution.Digest,
    result: remoteExecution.ActionResult
  ): Promise<void> {
    if (!this.cacheClient) {
      throw new Error('Remote cache not configured');
    }

    const request = {
      instanceName: this.instanceName,
      actionDigest,
      actionResult: result
    };

    return new Promise((resolve, reject) => {
      this.cacheClient!.makeUnaryRequest(
        '/build.bazel.remote.execution.v2.ActionCache/UpdateActionResult',
        (value: any) => Buffer.from(JSON.stringify(value)),
        (buffer: Buffer) => JSON.parse(buffer.toString()),
        request,
        (err, response) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  /**
   * Watch for operation updates
   */
  watchOperation(operationName: string): grpc.ClientReadableStream<any> {
    if (!this.executionClient) {
      throw new Error('Remote execution not configured');
    }

    return this.executionClient.makeServerStreamRequest(
      '/google.longrunning.Operations/WaitOperation',
      (value: any) => Buffer.from(JSON.stringify(value)),
      (buffer: Buffer) => JSON.parse(buffer.toString()),
      { name: operationName }
    );
  }

  /**
   * Upload a command to CAS
   */
  async uploadCommand(command: remoteExecution.Command): Promise<remoteExecution.Digest> {
    const commandData = Buffer.from(JSON.stringify(command));
    const digest = await this.computeDigest(commandData);
    await this.uploadBlob(digest, commandData);
    return digest;
  }

  /**
   * Compute digest for data
   */
  async computeDigest(data: Buffer): Promise<remoteExecution.Digest> {
    const hash = createHash('sha256').update(data).digest('hex');
    return {
      hash,
      size_bytes: data.length.toString()
    };
  }

  /**
   * Get action digest
   */
  async getActionDigest(action: remoteExecution.Action): Promise<remoteExecution.Digest> {
    const actionData = Buffer.from(JSON.stringify(action));
    return this.computeDigest(actionData);
  }

  /**
   * Close connections
   */
  close(): void {
    this.executionClient?.close();
    this.cacheClient?.close();
    this.capabilitiesClient?.close();
  }
}

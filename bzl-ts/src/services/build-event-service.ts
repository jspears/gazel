/**
 * Build Event Service - Receives and processes Build Event Protocol messages
 */

import * as grpc from '@grpc/grpc-js';
import { EventEmitter } from 'events';
import { buildEventStream } from '../../generated/index';

/**
 * BEP service implementation that receives build events from Bazel
 */
export class BuildEventService extends EventEmitter {
  private server?: grpc.Server;
  private port?: number;

  /**
   * Start the BEP gRPC server
   */
  async start(): Promise<number> {
    const server = this.server = new grpc.Server();
    
    // Add the PublishBuildEvent service
    server.addService(this.getServiceDefinition(), {
      publishLifecycleEvent: this.handleLifecycleEvent,
      publishBuildToolEventStream: this.handleBuildEventStream,
    });

    // Bind to a random port
    return new Promise((resolve, reject) => {
      server.bindAsync(
        '127.0.0.1:0',
        grpc.ServerCredentials.createInsecure(),
        (err, port) => {
          if (err) {
            reject(err);
          } else {
            this.port = port;
            this.server!.start();
            resolve(port);
          }
        }
      );
    });
  }

  /**
   * Stop the BEP server
   */
  stop(): void {
    if (this.server) {
      this.server.forceShutdown();
      this.server = undefined;
      this.port = undefined;
    }
  }

  /**
   * Get the gRPC service definition for PublishBuildEvent
   */
  private getServiceDefinition(): any {
    // This would normally be generated from the proto file
    // For now, we'll create a minimal definition
    return {
      publishLifecycleEvent: {
        path: '/google.devtools.build.v1.PublishBuildEvent/PublishLifecycleEvent',
        requestStream: false,
        responseStream: false,
        requestSerialize: (value: any) => Buffer.from(JSON.stringify(value)),
        requestDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
        responseSerialize: (value: any) => Buffer.from(JSON.stringify(value)),
        responseDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString())
      },
      publishBuildToolEventStream: {
        path: '/google.devtools.build.v1.PublishBuildEvent/PublishBuildToolEventStream',
        requestStream: true,
        responseStream: true,
        requestSerialize: (value: any) => Buffer.from(JSON.stringify(value)),
        requestDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString()),
        responseSerialize: (value: any) => Buffer.from(JSON.stringify(value)),
        responseDeserialize: (buffer: Buffer) => JSON.parse(buffer.toString())
      }
    };
  }

  /**
   * Handle lifecycle events
   */
  private handleLifecycleEvent = (
    call: grpc.ServerUnaryCall<any, any>,
    callback: grpc.sendUnaryData<any>
  )=>{
    const event = call.request;
    this.emit('lifecycleEvent', event);
    callback(null, { streamId: event.streamId });
  }

  /**
   * Handle build event stream
   */
  private handleBuildEventStream = (
    call: grpc.ServerDuplexStream<any, any>
  )=> {
    call.on('data', (data: any) => {
      // Parse the build event
      const event = this.parseBuildEvent(data);
      if (event) {
        this.emit('buildEvent', event);
      }

      // Send acknowledgment
      call.write({
        sequenceNumber: data.sequenceNumber,
        streamId: data.streamId
      });
    });

    call.on('end', () => {
      call.end();
    });

    call.on('error', (err) => {
      console.error('BEP stream error:', err);
      this.emit('error', err);
    });
  }

  /**
   * Parse a build event from the wire format
   */
  private parseBuildEvent(data: any): buildEventStream.BuildEvent | null {
    try {
      // Convert the raw event data to our typed BuildEvent
      const event: buildEventStream.BuildEvent = {
        id: this.parseEventId(data.orderedBuildEvent?.event?.id),
        children: data.orderedBuildEvent?.event?.children || [],
        lastMessage: data.orderedBuildEvent?.event?.lastMessage || false
      };

      // Parse specific event payloads
      const rawEvent = data.orderedBuildEvent?.event;
      if (rawEvent?.started) {
        event.started = rawEvent.started;
      } else if (rawEvent?.progress) {
        event.progress = rawEvent.progress;
      } else if (rawEvent?.completed) {
        event.completed = rawEvent.completed;
      } else if (rawEvent?.finished) {
        event.finished = rawEvent.finished;
      } else if (rawEvent?.testResult) {
        event.testResult = rawEvent.testResult;
      } else if (rawEvent?.actionExecuted) {
        event.actionExecuted = rawEvent.actionExecuted;
      }

      return event;
    } catch (err) {
      console.error('Failed to parse build event:', err);
      return null;
    }
  }

  /**
   * Parse event ID
   */
  private parseEventId(id: any): buildEventStream.BuildEventId | undefined {
    if (!id) return undefined;

    const eventId: buildEventStream.BuildEventId = {};

    if (id.started) {
      eventId.started = id.started;
    } else if (id.progress) {
      eventId.progress = id.progress;
    } else if (id.targetCompleted) {
      eventId.targetCompleted = id.targetCompleted;
    } else if (id.targetConfigured) {
      eventId.targetConfigured = id.targetConfigured;
    } else if (id.testResult) {
      eventId.testResult = id.testResult;
    } else if (id.testSummary) {
      eventId.testSummary = id.testSummary;
    } else if (id.buildFinished) {
      eventId.buildFinished = id.buildFinished;
    } else if (id.actionCompleted) {
      eventId.actionCompleted = id.actionCompleted;
    }

    return eventId;
  }
}

/**
 * BES (Build Event Service) client for publishing events to a remote service
 */
export class BuildEventServiceClient {
  private client: grpc.Client;

  constructor(endpoint: string, credentials?: grpc.ChannelCredentials) {
    const creds = credentials || grpc.credentials.createInsecure();
    this.client = new grpc.Client(endpoint, creds);
  }

  /**
   * Publish build events to BES
   */
  async publishBuildEvents(events: buildEventStream.BuildEvent[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const stream = this.client.makeServerStreamRequest(
        '/google.devtools.build.v1.PublishBuildEvent/PublishBuildToolEventStream',
        (value: any) => Buffer.from(JSON.stringify(value)),
        (buffer: Buffer) => JSON.parse(buffer.toString()),
        {}
      );

      // Send all events
      for (const event of events) {
        stream.write({
          orderedBuildEvent: {
            streamId: { buildId: 'build-' + Date.now() },
            sequenceNumber: events.indexOf(event),
            event: event
          }
        });
      }

      stream.end();

      stream.on('data', (data: any) => {
        // Handle acknowledgments
      });

      stream.on('end', () => {
        resolve();
      });

      stream.on('error', (err: Error) => {
        reject(err);
      });
    });
  }

  /**
   * Stream build events in real-time
   */
  streamBuildEvents(): grpc.ClientDuplexStream<any, any> {
    return this.client.makeBidiStreamRequest(
      '/google.devtools.build.v1.PublishBuildEvent/PublishBuildToolEventStream',
      (value: any) => Buffer.from(JSON.stringify(value)),
      (buffer: Buffer) => JSON.parse(buffer.toString()),
      {}
    );
  }

  close(): void {
    this.client.close();
  }
}

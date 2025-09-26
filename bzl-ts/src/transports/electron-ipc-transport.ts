/**
 * Electron IPC Transport for gRPC
 * Implements a gRPC transport layer over Electron's IPC mechanism
 */

import { EventEmitter } from 'events';
import type { 
  IpcMain, 
  IpcMainEvent, 
  IpcMainInvokeEvent,
  WebContents 
} from 'electron';

/**
 * Message types for IPC communication
 */
export enum IPCMessageType {
  UNARY_REQUEST = 'grpc:unary:request',
  UNARY_RESPONSE = 'grpc:unary:response',
  STREAM_START = 'grpc:stream:start',
  STREAM_DATA = 'grpc:stream:data',
  STREAM_END = 'grpc:stream:end',
  STREAM_ERROR = 'grpc:stream:error',
  SERVER_STREAM_START = 'grpc:server-stream:start',
  SERVER_STREAM_DATA = 'grpc:server-stream:data',
  CLIENT_STREAM_START = 'grpc:client-stream:start',
  CLIENT_STREAM_DATA = 'grpc:client-stream:data',
  DUPLEX_STREAM_START = 'grpc:duplex:start',
  DUPLEX_STREAM_DATA = 'grpc:duplex:data',
}

/**
 * IPC message structure
 */
export interface IPCMessage {
  id: string;
  type: IPCMessageType;
  method: string;
  data?: any;
  error?: {
    code: number;
    message: string;
    details?: any;
  };
  metadata?: Record<string, string>;
}

/**
 * Service method handler types
 */
export type UnaryHandler<TRequest, TResponse> = (
  request: TRequest,
  metadata?: Record<string, string>
) => Promise<TResponse>;

export type ServerStreamHandler<TRequest, TResponse> = (
  request: TRequest,
  stream: ServerStream<TResponse>,
  metadata?: Record<string, string>
) => void;

export type ClientStreamHandler<TRequest, TResponse> = (
  stream: ClientStream<TRequest>,
  metadata?: Record<string, string>
) => Promise<TResponse>;

export type DuplexStreamHandler<TRequest, TResponse> = (
  stream: DuplexStream<TRequest, TResponse>,
  metadata?: Record<string, string>
) => void;

/**
 * Stream interfaces
 */
export interface ServerStream<T> {
  write(data: T): void;
  end(): void;
  error(error: Error): void;
}

export interface ClientStream<T> extends EventEmitter {
  on(event: 'data', listener: (data: T) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
}

export interface DuplexStream<TRequest, TResponse> extends ServerStream<TResponse>, ClientStream<TRequest> {}

/**
 * Main process gRPC server over IPC
 */
export class ElectronIPCServer extends EventEmitter {
  private services: Map<string, Map<string, Function>> = new Map();
  private activeStreams: Map<string, any> = new Map();
  
  constructor(private ipcMain: IpcMain) {
    super();
    this.setupHandlers();
  }

  /**
   * Register a service with its methods
   */
  addService(serviceName: string, implementation: Record<string, Function>): void {
    const methods = new Map<string, Function>();
    
    for (const [methodName, handler] of Object.entries(implementation)) {
      methods.set(methodName, handler);
    }
    
    this.services.set(serviceName, methods);
    this.emit('service-added', serviceName);
  }

  /**
   * Setup IPC handlers
   */
  private setupHandlers(): void {
    // Handle unary calls
    this.ipcMain.handle(IPCMessageType.UNARY_REQUEST, async (event: IpcMainInvokeEvent, message: IPCMessage) => {
      return this.handleUnaryRequest(event, message);
    });

    // Handle server streaming
    this.ipcMain.on(IPCMessageType.SERVER_STREAM_START, (event: IpcMainEvent, message: IPCMessage) => {
      this.handleServerStreamStart(event, message);
    });

    // Handle client streaming
    this.ipcMain.on(IPCMessageType.CLIENT_STREAM_START, (event: IpcMainEvent, message: IPCMessage) => {
      this.handleClientStreamStart(event, message);
    });

    this.ipcMain.on(IPCMessageType.CLIENT_STREAM_DATA, (event: IpcMainEvent, message: IPCMessage) => {
      this.handleClientStreamData(event, message);
    });

    // Handle duplex streaming
    this.ipcMain.on(IPCMessageType.DUPLEX_STREAM_START, (event: IpcMainEvent, message: IPCMessage) => {
      this.handleDuplexStreamStart(event, message);
    });

    this.ipcMain.on(IPCMessageType.DUPLEX_STREAM_DATA, (event: IpcMainEvent, message: IPCMessage) => {
      this.handleDuplexStreamData(event, message);
    });

    // Handle stream end
    this.ipcMain.on(IPCMessageType.STREAM_END, (event: IpcMainEvent, message: IPCMessage) => {
      this.handleStreamEnd(event, message);
    });
  }

  /**
   * Handle unary request
   */
  private async handleUnaryRequest(event: IpcMainInvokeEvent, message: IPCMessage): Promise<IPCMessage> {
    try {
      const [serviceName, methodName] = message.method.split('/');
      const service = this.services.get(serviceName);
      
      if (!service) {
        throw new Error(`Service ${serviceName} not found`);
      }
      
      const handler = service.get(methodName);
      if (!handler) {
        throw new Error(`Method ${methodName} not found in service ${serviceName}`);
      }
      
      const response = await handler(message.data, message.metadata);
      
      return {
        id: message.id,
        type: IPCMessageType.UNARY_RESPONSE,
        method: message.method,
        data: response,
        metadata: message.metadata
      };
    } catch (error: any) {
      return {
        id: message.id,
        type: IPCMessageType.UNARY_RESPONSE,
        method: message.method,
        error: {
          code: error.code || 2, // UNKNOWN
          message: error.message,
          details: error.details
        }
      };
    }
  }

  /**
   * Handle server stream start
   */
  private handleServerStreamStart(event: IpcMainEvent, message: IPCMessage): void {
    const [serviceName, methodName] = message.method.split('/');
    const service = this.services.get(serviceName);
    
    if (!service) {
      this.sendStreamError(event.sender, message.id, new Error(`Service ${serviceName} not found`));
      return;
    }
    
    const handler = service.get(methodName);
    if (!handler) {
      this.sendStreamError(event.sender, message.id, new Error(`Method ${methodName} not found`));
      return;
    }
    
    // Create server stream
    const stream: ServerStream<any> = {
      write: (data: any) => {
        event.sender.send(IPCMessageType.SERVER_STREAM_DATA, {
          id: message.id,
          type: IPCMessageType.SERVER_STREAM_DATA,
          method: message.method,
          data
        });
      },
      end: () => {
        event.sender.send(IPCMessageType.STREAM_END, {
          id: message.id,
          type: IPCMessageType.STREAM_END,
          method: message.method
        });
        this.activeStreams.delete(message.id);
      },
      error: (error: Error) => {
        this.sendStreamError(event.sender, message.id, error);
        this.activeStreams.delete(message.id);
      }
    };
    
    this.activeStreams.set(message.id, stream);
    
    try {
      handler(message.data, stream, message.metadata);
    } catch (error: any) {
      stream.error(error);
    }
  }

  /**
   * Handle client stream start
   */
  private handleClientStreamStart(event: IpcMainEvent, message: IPCMessage): void {
    const [serviceName, methodName] = message.method.split('/');
    const service = this.services.get(serviceName);
    
    if (!service) {
      this.sendStreamError(event.sender, message.id, new Error(`Service ${serviceName} not found`));
      return;
    }
    
    const handler = service.get(methodName);
    if (!handler) {
      this.sendStreamError(event.sender, message.id, new Error(`Method ${methodName} not found`));
      return;
    }
    
    // Create client stream
    const stream = new EventEmitter() as ClientStream<any>;
    this.activeStreams.set(message.id, { stream, handler, sender: event.sender });
    
    // Call handler with stream
    handler(stream, message.metadata)
      .then((response: any) => {
        event.sender.send(IPCMessageType.UNARY_RESPONSE, {
          id: message.id,
          type: IPCMessageType.UNARY_RESPONSE,
          method: message.method,
          data: response
        });
        this.activeStreams.delete(message.id);
      })
      .catch((error: any) => {
        this.sendStreamError(event.sender, message.id, error);
        this.activeStreams.delete(message.id);
      });
  }

  /**
   * Handle client stream data
   */
  private handleClientStreamData(event: IpcMainEvent, message: IPCMessage): void {
    const streamInfo = this.activeStreams.get(message.id);
    if (streamInfo && streamInfo.stream) {
      streamInfo.stream.emit('data', message.data);
    }
  }

  /**
   * Handle duplex stream start
   */
  private handleDuplexStreamStart(event: IpcMainEvent, message: IPCMessage): void {
    const [serviceName, methodName] = message.method.split('/');
    const service = this.services.get(serviceName);
    
    if (!service) {
      this.sendStreamError(event.sender, message.id, new Error(`Service ${serviceName} not found`));
      return;
    }
    
    const handler = service.get(methodName);
    if (!handler) {
      this.sendStreamError(event.sender, message.id, new Error(`Method ${methodName} not found`));
      return;
    }
    
    // Create duplex stream
    const stream = new EventEmitter() as DuplexStream<any, any>;
    
    // Add server stream methods
    (stream as any).write = (data: any) => {
      event.sender.send(IPCMessageType.DUPLEX_STREAM_DATA, {
        id: message.id,
        type: IPCMessageType.DUPLEX_STREAM_DATA,
        method: message.method,
        data,
        direction: 'server'
      });
    };
    
    (stream as any).end = () => {
      event.sender.send(IPCMessageType.STREAM_END, {
        id: message.id,
        type: IPCMessageType.STREAM_END,
        method: message.method
      });
      this.activeStreams.delete(message.id);
    };
    
    (stream as any).error = (error: Error) => {
      this.sendStreamError(event.sender, message.id, error);
      this.activeStreams.delete(message.id);
    };
    
    this.activeStreams.set(message.id, stream);
    
    try {
      handler(stream, message.metadata);
    } catch (error: any) {
      (stream as any).error(error);
    }
  }
  /**
   * Handle duplex stream data
   */
  private handleDuplexStreamData(event: IpcMainEvent, message: IPCMessage): void {
    const stream = this.activeStreams.get(message.id);
    if (stream && message.data) {
      stream.emit('data', message.data);
    }
  }

  /**
   * Handle stream end
   */
  private handleStreamEnd(event: IpcMainEvent, message: IPCMessage): void {
    const streamInfo = this.activeStreams.get(message.id);
    if (streamInfo) {
      if (streamInfo.stream) {
        streamInfo.stream.emit('end');
      } else if (streamInfo.emit) {
        streamInfo.emit('end');
      }
      this.activeStreams.delete(message.id);
    }
  }

  /**
   * Send stream error
   */
  private sendStreamError(sender: WebContents, id: string, error: Error): void {
    sender.send(IPCMessageType.STREAM_ERROR, {
      id,
      type: IPCMessageType.STREAM_ERROR,
      error: {
        code: (error as any).code || 2,
        message: error.message,
        details: (error as any).details
      }
    });
  }

  /**
   * Close all active streams
   */
  close(): void {
    for (const [id, stream] of this.activeStreams) {
      if (stream.end) {
        stream.end();
      } else if (stream.stream && stream.stream.emit) {
        stream.stream.emit('end');
      }
    }
    this.activeStreams.clear();
    this.services.clear();
  }
}

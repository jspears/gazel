/**
 * Electron IPC Client for gRPC
 * Renderer process client that communicates with main process via IPC
 */

import { EventEmitter } from 'events';
import type { IpcRenderer } from 'electron';
import { 
  IPCMessage, 
  IPCMessageType,
  ServerStream,
  ClientStream,
  DuplexStream
} from './electron-ipc-transport.js';

/**
 * Client-side stream implementation
 */
class ClientServerStream<T> implements ServerStream<T> {
  constructor(
    private ipcRenderer: IpcRenderer,
    private streamId: string,
    private method: string
  ) {}

  write(data: T): void {
    this.ipcRenderer.send(IPCMessageType.CLIENT_STREAM_DATA, {
      id: this.streamId,
      type: IPCMessageType.CLIENT_STREAM_DATA,
      method: this.method,
      data
    });
  }

  end(): void {
    this.ipcRenderer.send(IPCMessageType.STREAM_END, {
      id: this.streamId,
      type: IPCMessageType.STREAM_END,
      method: this.method
    });
  }

  error(error: Error): void {
    this.ipcRenderer.send(IPCMessageType.STREAM_ERROR, {
      id: this.streamId,
      type: IPCMessageType.STREAM_ERROR,
      method: this.method,
      error: {
        code: (error as any).code || 2,
        message: error.message,
        details: (error as any).details
      }
    });
  }
}

/**
 * Client-side duplex stream
 */
class ClientDuplexStream<TRequest, TResponse> extends EventEmitter implements DuplexStream<TRequest, TResponse> {
  constructor(
    private ipcRenderer: IpcRenderer,
    private streamId: string,
    private method: string
  ) {
    super();
  }

  write(data: TResponse): void {
    this.ipcRenderer.send(IPCMessageType.DUPLEX_STREAM_DATA, {
      id: this.streamId,
      type: IPCMessageType.DUPLEX_STREAM_DATA,
      method: this.method,
      data,
      direction: 'client'
    });
  }

  end(): void {
    this.ipcRenderer.send(IPCMessageType.STREAM_END, {
      id: this.streamId,
      type: IPCMessageType.STREAM_END,
      method: this.method
    });
  }

  error(error: Error): void {
    this.ipcRenderer.send(IPCMessageType.STREAM_ERROR, {
      id: this.streamId,
      type: IPCMessageType.STREAM_ERROR,
      method: this.method,
      error: {
        code: (error as any).code || 2,
        message: error.message,
        details: (error as any).details
      }
    });
  }
}

/**
 * Electron IPC Client for renderer process
 */
export class ElectronIPCClient {
  private activeStreams: Map<string, EventEmitter> = new Map();
  private requestId: number = 0;

  constructor(private ipcRenderer: IpcRenderer) {
    this.setupListeners();
  }

  /**
   * Setup IPC listeners
   */
  private setupListeners(): void {
    // Handle server stream data
    this.ipcRenderer.on(IPCMessageType.SERVER_STREAM_DATA, (event, message: IPCMessage) => {
      const stream = this.activeStreams.get(message.id);
      if (stream) {
        stream.emit('data', message.data);
      }
    });

    // Handle duplex stream data
    this.ipcRenderer.on(IPCMessageType.DUPLEX_STREAM_DATA, (event, message: IPCMessage) => {
      const stream = this.activeStreams.get(message.id);
      if (stream && message.data) {
        stream.emit('data', message.data);
      }
    });

    // Handle stream end
    this.ipcRenderer.on(IPCMessageType.STREAM_END, (event, message: IPCMessage) => {
      const stream = this.activeStreams.get(message.id);
      if (stream) {
        stream.emit('end');
        this.activeStreams.delete(message.id);
      }
    });

    // Handle stream error
    this.ipcRenderer.on(IPCMessageType.STREAM_ERROR, (event, message: IPCMessage) => {
      const stream = this.activeStreams.get(message.id);
      if (stream && message.error) {
        const error = new Error(message.error.message);
        (error as any).code = message.error.code;
        (error as any).details = message.error.details;
        stream.emit('error', error);
        this.activeStreams.delete(message.id);
      }
    });
  }

  /**
   * Make a unary call
   */
  async unaryCall<TRequest, TResponse>(
    method: string,
    request: TRequest,
    metadata?: Record<string, string>
  ): Promise<TResponse> {
    const id = this.generateId();
    
    const message: IPCMessage = {
      id,
      type: IPCMessageType.UNARY_REQUEST,
      method,
      data: request,
      metadata
    };

    const response = await this.ipcRenderer.invoke(IPCMessageType.UNARY_REQUEST, message);
    
    if (response.error) {
      const error = new Error(response.error.message);
      (error as any).code = response.error.code;
      (error as any).details = response.error.details;
      throw error;
    }
    
    return response.data;
  }

  /**
   * Make a server streaming call
   */
  serverStreamingCall<TRequest, TResponse>(
    method: string,
    request: TRequest,
    metadata?: Record<string, string>
  ): ClientStream<TResponse> {
    const id = this.generateId();
    const stream = new EventEmitter() as ClientStream<TResponse>;
    
    this.activeStreams.set(id, stream);
    
    const message: IPCMessage = {
      id,
      type: IPCMessageType.SERVER_STREAM_START,
      method,
      data: request,
      metadata
    };
    
    this.ipcRenderer.send(IPCMessageType.SERVER_STREAM_START, message);
    
    return stream;
  }

  /**
   * Make a client streaming call
   */
  async clientStreamingCall<TRequest, TResponse>(
    method: string,
    metadata?: Record<string, string>
  ): Promise<{ stream: ServerStream<TRequest>, response: Promise<TResponse> }> {
    const id = this.generateId();
    
    const stream = new ClientServerStream<TRequest>(this.ipcRenderer, id, method);
    
    const responsePromise = new Promise<TResponse>((resolve, reject) => {
      // Setup one-time listener for response
      const responseHandler = (event: any, message: IPCMessage) => {
        if (message.id === id) {
          this.ipcRenderer.removeListener(IPCMessageType.UNARY_RESPONSE, responseHandler);
          
          if (message.error) {
            const error = new Error(message.error.message);
            (error as any).code = message.error.code;
            (error as any).details = message.error.details;
            reject(error);
          } else {
            resolve(message.data);
          }
        }
      };
      
      this.ipcRenderer.on(IPCMessageType.UNARY_RESPONSE, responseHandler);
    });
    
    // Start the client stream
    const message: IPCMessage = {
      id,
      type: IPCMessageType.CLIENT_STREAM_START,
      method,
      metadata
    };
    
    this.ipcRenderer.send(IPCMessageType.CLIENT_STREAM_START, message);
    
    return { stream, response: responsePromise };
  }

  /**
   * Make a duplex streaming call
   */
  duplexStreamingCall<TRequest, TResponse>(
    method: string,
    metadata?: Record<string, string>
  ): DuplexStream<TRequest, TResponse> {
    const id = this.generateId();
    const stream = new ClientDuplexStream<TRequest, TResponse>(this.ipcRenderer, id, method);
    
    this.activeStreams.set(id, stream);
    
    const message: IPCMessage = {
      id,
      type: IPCMessageType.DUPLEX_STREAM_START,
      method,
      metadata
    };
    
    this.ipcRenderer.send(IPCMessageType.DUPLEX_STREAM_START, message);
    
    return stream;
  }

  /**
   * Generate unique request ID
   */
  private generateId(): string {
    return `${Date.now()}-${++this.requestId}`;
  }

  /**
   * Close all active streams
   */
  close(): void {
    for (const [id, stream] of this.activeStreams) {
      stream.emit('end');
    }
    this.activeStreams.clear();
  }
}

/**
 * Create a typed service client
 */
export function createServiceClient<T>(
  ipcClient: ElectronIPCClient,
  serviceName: string,
  methodDefinitions: Record<string, { type: 'unary' | 'serverStream' | 'clientStream' | 'duplex' }>
): T {
  const client: any = {};
  
  for (const [methodName, definition] of Object.entries(methodDefinitions)) {
    const fullMethod = `${serviceName}/${methodName}`;
    
    switch (definition.type) {
      case 'unary':
        client[methodName] = (request: any, metadata?: Record<string, string>) => 
          ipcClient.unaryCall(fullMethod, request, metadata);
        break;
        
      case 'serverStream':
        client[methodName] = (request: any, metadata?: Record<string, string>) =>
          ipcClient.serverStreamingCall(fullMethod, request, metadata);
        break;
        
      case 'clientStream':
        client[methodName] = (metadata?: Record<string, string>) =>
          ipcClient.clientStreamingCall(fullMethod, metadata);
        break;
        
      case 'duplex':
        client[methodName] = (metadata?: Record<string, string>) =>
          ipcClient.duplexStreamingCall(fullMethod, metadata);
        break;
    }
  }
  
  return client as T;
}

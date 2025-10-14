// electron-ipc-transport.ts
import {
  Transport,
  UnaryRequest,
  UnaryResponse,
  StreamRequest,
  StreamResponse,
  Code,
  ConnectError,
  createConnectError,
  Message,
  MethodInfo,
  ServiceType,
  PartialMessage,
  createPromiseClient,
  CallOptions,
  AnyMessage
} from "@connectrpc/connect";
import { IpcRenderer, IpcMain, WebContents } from "electron";

// Unique ID generator for tracking requests
let requestIdCounter = 0;
const generateRequestId = () => `req_${Date.now()}_${++requestIdCounter}`;

// IPC Channel names
const IPC_CHANNELS = {
  RPC_REQUEST: "connect-rpc:request",
  RPC_RESPONSE: "connect-rpc:response",
  RPC_STREAM_DATA: "connect-rpc:stream-data",
  RPC_STREAM_END: "connect-rpc:stream-end",
  RPC_STREAM_ERROR: "connect-rpc:stream-error",
  RPC_CANCEL: "connect-rpc:cancel",
} as const;

// Types for IPC messages
interface IpcRpcRequest {
  id: string;
  service: string;
  method: string;
  data: Uint8Array;
  headers: Record<string, string>;
  isStream: boolean;
}

interface IpcRpcResponse {
  id: string;
  data?: Uint8Array;
  error?: {
    code: Code;
    message: string;
    details?: any;
  };
  headers?: Record<string, string>;
  trailers?: Record<string, string>;
}

interface IpcStreamData {
  id: string;
  data: Uint8Array;
}

interface IpcStreamEnd {
  id: string;
  trailers?: Record<string, string>;
}

// Renderer-side Transport
export class ElectronIpcTransport implements Transport {
  private readonly ipcRenderer: IpcRenderer;
  private readonly activeStreams = new Map<string, {
    onData: (chunk: Uint8Array) => void;
    onEnd: () => void;
    onError: (error: ConnectError) => void;
  }>();

  constructor(ipcRenderer: IpcRenderer) {
    this.ipcRenderer = ipcRenderer;
    this.setupListeners();
  }

  private setupListeners(): void {
    // Handle streaming data
    this.ipcRenderer.on(IPC_CHANNELS.RPC_STREAM_DATA, (_, msg: IpcStreamData) => {
      const stream = this.activeStreams.get(msg.id);
      if (stream) {
        stream.onData(msg.data);
      }
    });

    // Handle stream end
    this.ipcRenderer.on(IPC_CHANNELS.RPC_STREAM_END, (_, msg: IpcStreamEnd) => {
      const stream = this.activeStreams.get(msg.id);
      if (stream) {
        stream.onEnd();
        this.activeStreams.delete(msg.id);
      }
    });

    // Handle stream errors
    this.ipcRenderer.on(IPC_CHANNELS.RPC_STREAM_ERROR, (_, msg: IpcRpcResponse) => {
      const stream = this.activeStreams.get(msg.id);
      if (stream && msg.error) {
        stream.onError(new ConnectError(msg.error.message, msg.error.code));
        this.activeStreams.delete(msg.id);
      }
    });
  }

  async unary<I extends Message<I>, O extends Message<O>>(
    service: ServiceType,
    method: MethodInfo<I, O>,
    signal: AbortSignal | undefined,
    timeoutMs: number | undefined,
    header: Headers,
    message: PartialMessage<I>
  ): Promise<UnaryResponse<I, O>> {
    const requestId = generateRequestId();
    
    try {
      // Serialize the message
      const bytes = method.I.toBinary(message as I);
      
      // Convert headers to plain object
      const headers: Record<string, string> = {};
      header.forEach((value, key) => {
        headers[key] = value;
      });

      const request: IpcRpcRequest = {
        id: requestId,
        service: service.typeName,
        method: method.name,
        data: bytes,
        headers,
        isStream: false,
      };

      // Setup abort handling
      if (signal) {
        signal.addEventListener("abort", () => {
          this.ipcRenderer.send(IPC_CHANNELS.RPC_CANCEL, { id: requestId });
        });
      }

      // Send request and wait for response
      const response = await this.ipcRenderer.invoke(IPC_CHANNELS.RPC_REQUEST, request);
      
      if (response.error) {
        throw new ConnectError(response.error.message, response.error.code);
      }

      // Deserialize response
      const responseMessage = method.O.fromBinary(response.data);
      
      // Create response headers and trailers
      const responseHeader = new Headers(response.headers);
      const responseTrailer = new Headers(response.trailers);

      return {
        message: responseMessage,
        service,
        method,
        header: responseHeader,
        trailer: responseTrailer,
      };
    } catch (error) {
      if (error instanceof ConnectError) {
        throw error;
      }
      throw new ConnectError(
        `IPC transport error: ${error}`,
        Code.Internal
      );
    }
  }

  async stream<I extends Message<I>, O extends Message<O>>(
    service: ServiceType,
    method: MethodInfo<I, O>,
    signal: AbortSignal | undefined,
    timeoutMs: number | undefined,
    header: Headers,
    input: AsyncIterable<PartialMessage<I>>
  ): Promise<StreamResponse<I, O>> {
    const requestId = generateRequestId();
    const responseQueue: O[] = [];
    const readers: ((result: IteratorResult<O>) => void)[] = [];
    let streamEnded = false;
    let streamError: ConnectError | undefined;
    let responseHeaders: Headers = new Headers();
    let responseTrailers: Headers = new Headers();

    // Setup stream handlers
    const streamHandlers = {
      onData: (chunk: Uint8Array) => {
        const message = method.O.fromBinary(chunk);
        if (readers.length > 0) {
          const reader = readers.shift()!;
          reader({ value: message, done: false });
        } else {
          responseQueue.push(message);
        }
      },
      onEnd: () => {
        streamEnded = true;
        // Resolve any pending readers
        while (readers.length > 0) {
          const reader = readers.shift()!;
          reader({ value: undefined as any, done: true });
        }
      },
      onError: (error: ConnectError) => {
        streamError = error;
        streamEnded = true;
        // Reject any pending readers
        while (readers.length > 0) {
          const reader = readers.shift()!;
          reader({ value: undefined as any, done: true });
        }
      },
    };

    this.activeStreams.set(requestId, streamHandlers);

    // Convert headers to plain object
    const headers: Record<string, string> = {};
    header.forEach((value, key) => {
      headers[key] = value;
    });

    // Setup abort handling
    if (signal) {
      signal.addEventListener("abort", () => {
        this.ipcRenderer.send(IPC_CHANNELS.RPC_CANCEL, { id: requestId });
        this.activeStreams.delete(requestId);
      });
    }

    // Create async iterable for response
    const responseIterable: AsyncIterable<O> = {
      [Symbol.asyncIterator](): AsyncIterator<O> {
        return {
          async next(): Promise<IteratorResult<O>> {
            // If we have queued messages, return them first
            if (responseQueue.length > 0) {
              return { value: responseQueue.shift()!, done: false };
            }

            // If stream has ended, we're done
            if (streamEnded) {
              if (streamError) {
                throw streamError;
              }
              return { value: undefined as any, done: true };
            }

            // Wait for next message
            return new Promise<IteratorResult<O>>((resolve) => {
              readers.push(resolve);
            });
          },
        };
      },
    };

    // Start sending input messages
    (async () => {
      try {
        // Send initial request with first message if available
        const iterator = input[Symbol.asyncIterator]();
        const firstMessage = await iterator.next();
        
        if (!firstMessage.done) {
          const bytes = method.I.toBinary(firstMessage.value as I);
          
          const request: IpcRpcRequest = {
            id: requestId,
            service: service.typeName,
            method: method.name,
            data: bytes,
            headers,
            isStream: true,
          };

          // Send initial request
          const initialResponse = await this.ipcRenderer.invoke(IPC_CHANNELS.RPC_REQUEST, request);
          
          if (initialResponse.error) {
            streamHandlers.onError(new ConnectError(initialResponse.error.message, initialResponse.error.code));
            return;
          }

          if (initialResponse.headers) {
            responseHeaders = new Headers(initialResponse.headers);
          }

          // Continue sending remaining messages
          for await (const message of {
            [Symbol.asyncIterator]: () => iterator
          }) {
            const bytes = method.I.toBinary(message as I);
            this.ipcRenderer.send(IPC_CHANNELS.RPC_STREAM_DATA, {
              id: requestId,
              data: bytes,
            });
          }
        }

        // Signal end of client stream
        this.ipcRenderer.send(IPC_CHANNELS.RPC_STREAM_END, { id: requestId });
      } catch (error) {
        streamHandlers.onError(
          error instanceof ConnectError 
            ? error 
            : new ConnectError(`Stream error: ${error}`, Code.Internal)
        );
      }
    })();

    return {
      service,
      method,
      header: responseHeaders,
      trailer: responseTrailers,
      message: responseIterable,
    };
  }
}

// Main process handler
export class ElectronIpcHandler {
  private readonly handlers = new Map<string, (req: any) => Promise<any>>();
  private readonly activeStreams = new Map<string, {
    cancel: () => void;
  }>();

  constructor(
    private readonly ipcMain: IpcMain,
    private readonly getWebContents: (event: any) => WebContents
  ) {
    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Handle RPC requests
    this.ipcMain.handle(IPC_CHANNELS.RPC_REQUEST, async (event, request: IpcRpcRequest) => {
      const webContents = this.getWebContents(event);
      
      try {
        const handlerKey = `${request.service}/${request.method}`;
        const handler = this.handlers.get(handlerKey);
        
        if (!handler) {
          return {
            id: request.id,
            error: {
              code: Code.Unimplemented,
              message: `Method ${handlerKey} not implemented`,
            },
          };
        }

        if (request.isStream) {
          // Handle streaming
          const streamController = new AbortController();
          this.activeStreams.set(request.id, {
            cancel: () => streamController.abort(),
          });

          // Process stream
          const result = await handler({
            ...request,
            signal: streamController.signal,
            sendData: (data: Uint8Array) => {
              webContents.send(IPC_CHANNELS.RPC_STREAM_DATA, {
                id: request.id,
                data,
              });
            },
            sendEnd: (trailers?: Record<string, string>) => {
              webContents.send(IPC_CHANNELS.RPC_STREAM_END, {
                id: request.id,
                trailers,
              });
              this.activeStreams.delete(request.id);
            },
            sendError: (error: ConnectError) => {
              webContents.send(IPC_CHANNELS.RPC_STREAM_ERROR, {
                id: request.id,
                error: {
                  code: error.code,
                  message: error.message,
                },
              });
              this.activeStreams.delete(request.id);
            },
          });

          return result;
        } else {
          // Handle unary
          return await handler(request);
        }
      } catch (error) {
        return {
          id: request.id,
          error: {
            code: Code.Internal,
            message: error instanceof Error ? error.message : String(error),
          },
        };
      }
    });

    // Handle stream data from client
    this.ipcMain.on(IPC_CHANNELS.RPC_STREAM_DATA, (event, data: IpcStreamData) => {
      // Forward to appropriate handler
      // This would be implemented based on your service needs
    });

    // Handle stream end from client
    this.ipcMain.on(IPC_CHANNELS.RPC_STREAM_END, (event, data: IpcStreamEnd) => {
      // Clean up stream
      this.activeStreams.delete(data.id);
    });

    // Handle cancellation
    this.ipcMain.on(IPC_CHANNELS.RPC_CANCEL, (event, data: { id: string }) => {
      const stream = this.activeStreams.get(data.id);
      if (stream) {
        stream.cancel();
        this.activeStreams.delete(data.id);
      }
    });
  }

  // Register a service handler
  registerHandler(service: string, method: string, handler: (req: any) => Promise<any>): void {
    const key = `${service}/${method}`;
    this.handlers.set(key, handler);
  }
}

// Helper to create client with IPC transport
export function createIpcClient<T extends ServiceType>(
  service: T,
  ipcRenderer: IpcRenderer
): ReturnType<typeof createPromiseClient<T>> {
  const transport = new ElectronIpcTransport(ipcRenderer);
  return createPromiseClient(service, transport);
}
import { create, type DescMethodStreaming,type MessageShape, type DescMessage, type DescMethodUnary, type MessageInitShape, fromBinary, toBinary } from "@bufbuild/protobuf";
import { type StreamResponse,type UnaryResponse, type Transport } from "@connectrpc/connect";
import {  ipcRenderer as _ipcRenderer, IpcRenderer } from 'electron';

export class IpcTransport implements Transport {
  constructor(private ipcRenderer:typeof _ipcRenderer = _ipcRenderer) {
    console.log('IpcTransport initialized', {
      hasUnary: typeof this.unary === 'function',
      hasStream: typeof this.stream === 'function'
    });
  }

   unary = async <I extends DescMessage, O extends DescMessage>(
    method: DescMethodUnary<I, O>,
    _signal: AbortSignal | undefined,
    _timeoutMs: number | undefined,
    _header: HeadersInit | undefined,
    input: MessageInitShape<I>,
    _contextValues?: unknown
  ):Promise<UnaryResponse<I, O>> => {
    // Convert input to binary for IPC transfer
    const inputMessage = create(method.input, input);
    const binaryInput = toBinary(method.input, inputMessage);

    // Convert Uint8Array to Buffer for IPC transfer
   // const bufferInput = Buffer.from(binaryInput);

    const result = await this.ipcRenderer.invoke('grpc:unary:request', {
      method: method.localName,
      service: method.parent.name,
      data: binaryInput
    });

    // Convert Buffer back to Uint8Array
    const uint8Result = result instanceof Buffer ? new Uint8Array(result) : result;
    const message = fromBinary(method.output, uint8Result);
    return {
      stream: false,
      message,
      method,
      service: method.parent,
      trailer: new Headers(),
      header: new Headers()
    }
  }

  stream = async <I extends DescMessage, O extends DescMessage>(
    method: DescMethodStreaming<I, O>,
    signal: AbortSignal | undefined,
    _timeoutMs: number | undefined,
    _header: HeadersInit | undefined,
    input: AsyncIterable<MessageInitShape<I>>,
    _contextValues?: unknown
  ): Promise<StreamResponse<I, O>> => {
    // Generate a unique stream ID for this streaming call
    const streamId = `stream-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

    // Create an async generator for the response messages
    async function* responseGenerator(ipcRenderer: IpcRenderer, abortSignal?: AbortSignal): AsyncIterable<MessageShape<O>> {
      // Set up the stream listener
      const messageChannel = `grpc:stream:message:${streamId}`;
      const errorChannel = `grpc:stream:error:${streamId}`;
      const completeChannel = `grpc:stream:complete:${streamId}`;

      const messageQueue: MessageShape<O>[] = [];
      const errorQueue: Error[] = [];
      let isComplete = false;
      let resolveNext: ((value: IteratorResult<MessageShape<O>>) => void) | null = null;

      // Set up IPC listeners
      const handleMessage = (_event: Electron.IpcRendererEvent, data: unknown) => {
        // Data comes as binary from the main process - convert Buffer to Uint8Array
        const uint8Data = data instanceof Buffer ? new Uint8Array(data) : data as Uint8Array;
        const value = fromBinary(method.output, uint8Data);
        console.log('[ipcTransport] handleMessage', value);
        if (resolveNext) {
          resolveNext({ value, done: false });
          resolveNext = null;
        } else {
          messageQueue.push(value);
        }
      };

      const handleError = (_event: Electron.IpcRendererEvent, error: string) => {
        const err = new Error(error);
        if (resolveNext) {
          resolveNext({ value: undefined, done: true });
          resolveNext = null;
        }
        errorQueue.push(err);
      };

      const handleComplete = () => {
        isComplete = true;
        if (resolveNext) {
          resolveNext({ value: undefined, done: true });
          resolveNext = null;
        }
      };

      ipcRenderer.on(messageChannel, handleMessage);
      ipcRenderer.on(errorChannel, handleError);
      ipcRenderer.on(completeChannel, handleComplete);

      // Handle abort signal
      const handleAbort = () => {
        isComplete = true;
        if (resolveNext) {
          resolveNext({ value: undefined, done: true });
          resolveNext = null;
        }
        ipcRenderer.send('grpc:stream:abort', streamId);
      };

      if (abortSignal) {
        abortSignal.addEventListener('abort', handleAbort);
      }

      try {
        // For server streaming, we only send one input message
        // For client/bidirectional streaming, we'd need to handle multiple messages
        let inputMessage: MessageInitShape<I> | undefined;
        for await (const msg of input) {
          inputMessage = msg;
          break; // Only take the first message for server streaming
        }

        // Convert input to binary for IPC transfer
        const binaryInput = toBinary(method.input, create(method.input, inputMessage))

        // Convert Uint8Array to Buffer for IPC transfer
        const bufferInput = Buffer.from(binaryInput);

        // Start the stream on the main process
        await ipcRenderer.invoke('grpc:stream:start', {
          streamId,
          method: method.localName,
          service: method.parent.name,
          data: bufferInput
        });

        // Yield messages as they arrive
        while (!isComplete || messageQueue.length > 0 || errorQueue.length > 0) {
          if (errorQueue.length > 0) {
            throw errorQueue.shift()!;
          }

          if (messageQueue.length > 0) {
            yield messageQueue.shift()!;
          } else if (!isComplete) {
            // Wait for the next message
            await new Promise<IteratorResult<MessageShape<O>>>((resolve) => {
              resolveNext = resolve;
            });
          }
        }
      } finally {
        // Clean up listeners
        ipcRenderer.removeListener(messageChannel, handleMessage);
        ipcRenderer.removeListener(errorChannel, handleError);
        ipcRenderer.removeListener(completeChannel, handleComplete);

        if (abortSignal) {
          abortSignal.removeEventListener('abort', handleAbort);
        }

        // Notify main process to clean up
        ipcRenderer.send('grpc:stream:cleanup', streamId);
      }
    }

    return {
      stream: true,
      message: responseGenerator(this.ipcRenderer, signal),
      method,
      service: method.parent,
      trailer: new Headers(),
      header: new Headers()
    };
  }
}


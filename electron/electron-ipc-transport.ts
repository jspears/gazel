import { create, type DescMethodStreaming,type MessageShape, type DescMessage, type DescMethodUnary, type MessageInitShape, fromBinary } from "@bufbuild/protobuf";
import { type StreamResponse,type UnaryResponse, type Transport } from "@connectrpc/connect";
import {  ipcRenderer as _ipcRenderer, IpcRenderer } from 'electron';

export class IpcTransport implements Transport {
  constructor(private ipcRenderer:typeof _ipcRenderer = _ipcRenderer) {
    console.log('IpcTransport initialized');
  }

   unary = async <I extends DescMessage, O extends DescMessage>(
    method: DescMethodUnary<I, O>,
    _signal: AbortSignal | undefined,
    _timeoutMs: number | undefined,
    _header: HeadersInit | undefined,
    input: MessageInitShape<I>,
    _contextValues?: unknown
  ):Promise<UnaryResponse<I, O>> => {
    const result = await this.ipcRenderer.invoke('grpc:unary:request', {
      method: method.localName,
      service: method.parent.name,
      data: create(method.input, input)
    });

    const message = fromBinary(method.output, result);
    return {
      stream: false,
      message,
      method,
      service: method.parent,
      trailer: new Headers(),
      header: new Headers()
    }
  }

  async stream<I extends DescMessage, O extends DescMessage>(
    method: DescMethodStreaming<I, O>,
    signal: AbortSignal | undefined,
    _timeoutMs: number | undefined,
    _header: HeadersInit | undefined,
    input: AsyncIterable<MessageInitShape<I>>,
    _contextValues?: unknown
  ): Promise<StreamResponse<I, O>> {
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
        const message = create(method.output, data as MessageInitShape<O>);
        if (resolveNext) {
          resolveNext({ value: message, done: false });
          resolveNext = null;
        } else {
          messageQueue.push(message);
        }
      };

      const handleError = (_event: Electron.IpcRendererEvent, error: string) => {
        const err = new Error(error);
        if (resolveNext) {
          resolveNext({ value: undefined as any, done: true });
          resolveNext = null;
        }
        errorQueue.push(err);
      };

      const handleComplete = () => {
        isComplete = true;
        if (resolveNext) {
          resolveNext({ value: undefined as any, done: true });
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
          resolveNext({ value: undefined as any, done: true });
          resolveNext = null;
        }
        ipcRenderer.send('grpc:stream:abort', streamId);
      };

      if (abortSignal) {
        abortSignal.addEventListener('abort', handleAbort);
      }

      try {
        // Collect input messages if it's a client streaming or bidirectional streaming method
        const inputMessages: MessageInitShape<I>[] = [];
        for await (const msg of input) {
          inputMessages.push(msg);
        }

        // Start the stream on the main process
        await ipcRenderer.invoke('grpc:stream:start', {
          streamId,
          method: method.name,
          service: method.parent.name,
          data: inputMessages.map(msg => create(method.input, msg))
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


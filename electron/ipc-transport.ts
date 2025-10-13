import type { DescMessage, MessageInitShape, DescMethodStreaming, DescMethodUnary } from "@bufbuild/protobuf";
import { fromBinary } from "@bufbuild/protobuf";

import type { Transport,StreamResponse, UnaryResponse  } from "@connectrpc/connect";
import { Code, ConnectError } from "@connectrpc/connect";

interface IpcRenderer {
  stream(...args: unknown[]): Promise<unknown>;
  unary(...args: unknown[]): Promise<unknown>;

  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void;
  removeListener(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void;
}

/**
 * Creates an async iterable from IPC events.
 * This is similar to createAsyncIterable from Connect but implemented manually.
 */
function createAsyncIterableFromIpc<T>(
  setup: (push: (value: T) => void, complete: () => void, error: (err: Error) => void) => () => void
): AsyncIterable<T> {
  const queue: Array<{ type: 'value'; value: T } | { type: 'complete' } | { type: 'error'; error: Error }> = [];
  const resolvers: Array<(result: IteratorResult<T>) => void> = [];
  let cleanup: (() => void) | null = null;
  let isDone = false;

  const push = (value: T) => {
    if (resolvers.length > 0) {
      const resolve = resolvers.shift();
      if (resolve) resolve({ value, done: false });
    } else {
      queue.push({ type: 'value', value });
    }
  };

  const complete = () => {
    isDone = true;
    while (resolvers.length > 0) {
      const resolve = resolvers.shift();
      if (resolve) resolve({ value: undefined as any, done: true });
    }
    if (cleanup) cleanup();
  };

  const error = (err: Error) => {
    queue.push({ type: 'error', error: err });
    isDone = true;
    if (cleanup) cleanup();
  };

  cleanup = setup(push, complete, error);

  return {
    [Symbol.asyncIterator]() {
      return {
        async next(): Promise<IteratorResult<T>> {
          // Process queued items first
          while (queue.length > 0) {
            const item = queue.shift();
            if (!item) continue;

            if (item.type === 'error') {
              throw item.error;
            }
            if (item.type === 'complete') {
              return { value: undefined as any, done: true };
            }
            return { value: item.value, done: false };
          }

          // If done and no queued items, return done
          if (isDone) {
            return { value: undefined as any, done: true };
          }

          // Wait for next item
          return new Promise<IteratorResult<T>>((resolve) => {
            resolvers.push(resolve);
          });
        },
        async return(): Promise<IteratorResult<T>> {
          if (cleanup) cleanup();
          isDone = true;
          return { value: undefined as any, done: true };
        },
        async throw(err: any): Promise<IteratorResult<T>> {
          if (cleanup) cleanup();
          throw err;
        }
      };
    }
  };
}

/**
 * Creates a Connect transport that uses Electron IPC for communication.
 * This transport handles both unary and streaming calls by sending messages over IPC.
 */
export function createIpcTransport(ipcRenderer: IpcRenderer): Transport {
  return {
    async unary<I extends DescMessage, O extends DescMessage>(method: DescMethodUnary<I, O>, 
        _signal: AbortSignal | undefined, _timeoutMs: number | undefined,
        _header: HeadersInit | undefined, message: MessageInitShape<I>): Promise<UnaryResponse<I, O>> {
      try {
        // Use method.localName which is the camelCase method name
        const methodName = method.localName;
        const service = method.parent;
        const response = await ipcRenderer.invoke('grpc:unary', {
          service: service.typeName,
          method: methodName,
          message
        });

        return {
          stream: false,
          service,
          method,
          header: new Headers(),
          message: response as any,
          trailer: new Headers()
        };
      } catch (error) {
        throw new ConnectError(
          error instanceof Error ? error.message : String(error),
          Code.Unknown
        );
      }
    },

    async     stream<I extends DescMessage, O extends DescMessage>(method: DescMethodStreaming<I, O>, signal: AbortSignal | undefined,
      _timeoutMs: number | undefined,
      _header: HeadersInit | undefined,
       input: AsyncIterable<MessageInitShape<I>>, _contextValues?: unknown): Promise<StreamResponse<I, O>> {
      const service = method.parent;

      // Generate a unique stream ID
      const streamId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // For server streaming, we only send one input message
      const inputMessage = await (async () => {
        if (!input || typeof input[Symbol.asyncIterator] !== 'function') {
          return {};
        }
        for await (const msg of input) {
          return msg; // Take the first message
        }
        return {};
      })();

      // Start the stream on the main process
      // Use method.localName which is the camelCase method name
      const methodName = method.localName;

      await ipcRenderer.invoke('grpc:stream:start',( {
        streamId,
        service: service.typeName,
        method: methodName,
        message: inputMessage
      });

      // Create an async iterable that listens to IPC events
      const iterable = createAsyncIterableFromIpc<any>((push, complete, error) => {
        const dataChannel = `grpc:stream:${streamId}:data`;
        const completeChannel = `grpc:stream:${streamId}:complete`;
        const errorChannel = `grpc:stream:${streamId}:error`;

        const dataListener = (_event: unknown, binaryMessage: Uint8Array) => {
          // Deserialize the binary message back to a protobuf object
          const message = fromBinary(method.output, binaryMessage);
          push(message);
        };

        const completeListener = () => {
          complete();
        };

        const errorListener = (_event: unknown, errorMsg: string) => {
          error(new ConnectError(errorMsg, Code.Unknown));
        };

        // Set up listeners
        ipcRenderer.on(dataChannel, dataListener);
        ipcRenderer.on(completeChannel, completeListener);
        ipcRenderer.on(errorChannel, errorListener);

        // Handle cancellation
        if (signal) {
          signal.addEventListener('abort', () => {
            ipcRenderer.invoke('grpc:stream:cancel', streamId);
            error(new ConnectError('Cancelled', Code.Canceled));
          });
        }

        // Return cleanup function
        return () => {
          ipcRenderer.removeListener(dataChannel, dataListener);
          ipcRenderer.removeListener(completeChannel, completeListener);
          ipcRenderer.removeListener(errorChannel, errorListener);
        };
      });

      return {
        stream: true,
        service,
        method,
        header: new Headers(),
        message: iterable,
        trailer: new Headers()
      };
    }
  };
}


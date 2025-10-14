import { createClient, type Client } from "@connectrpc/connect";
import { GazelService } from "@speajus/gazel-proto";
import { setClient } from '../client/client.impl';
import { createIpcTransport } from './ipc-transport';

export * from '../client/client.impl';

type GazelServiceClient = Client<typeof GazelService>;

/**
 * Converts a callback-based subscription API into an async generator.
 * This allows consuming event streams using for-await-of syntax.
 */
function callbackToAsyncGenerator<T>(
  subscribeFn: (callbacks: {
    onData(data: T): void;
    onError(error: Error): void;
    onComplete(): void;
  }) => () => void
): AsyncGenerator<T> {
  const queue: Array<{ value?: T; error?: Error; done: boolean }> = [];
  const resolvers: Array<(result: { value?: T; error?: Error; done: boolean }) => void> = [];
  let isDone = false;
  let error: Error | null = null;
  let unsubscribe: (() => void) | null = null;

  // Subscribe with callbacks for data, error, and completion
  unsubscribe = subscribeFn({
    onData: (data: T) => {
      if (resolvers.length > 0) {
        const resolve = resolvers.shift()!;
        resolve({ value: data, done: false });
      } else {
        queue.push({ value: data, done: false });
      }
    },
    onError: (err: Error) => {
      error = err;
      while (resolvers.length > 0) {
        const resolve = resolvers.shift()!;
        resolve({ error: err, done: true });
      }
    },
    onComplete: () => {
      isDone = true;
      while (resolvers.length > 0) {
        const resolve = resolvers.shift()!;
        resolve({ done: true });
      }
    }
  });

  return {
    [Symbol.asyncIterator]() {
      return this;
    },
    async next(): Promise<IteratorResult<T>> {
      // Return queued items first
      if (queue.length > 0) {
        const item = queue.shift()!;
        if (item.error) throw item.error;
        if (item.done) return { value: undefined as any, done: true };
        return { value: item.value!, done: false };
      }

      // Check if we're done
      if (isDone) return { value: undefined as any, done: true };
      if (error) throw error;

      // Wait for next item
      const result = await new Promise<{ value?: T; error?: Error; done: boolean }>((resolve) => {
        resolvers.push(resolve);
      });

      if (result.error) throw result.error;
      if (result.done) return { value: undefined as any, done: true };
      return { value: result.value!, done: false };
    },
    async return(): Promise<IteratorResult<T>> {
      if (unsubscribe) unsubscribe();
      isDone = true;
      return { value: undefined as any, done: true };
    },
    async throw(err: any): Promise<IteratorResult<T>> {
      if (unsubscribe) unsubscribe();
      throw err;
    }
  } as AsyncGenerator<T>;
}

 /**
   * Reconstructs an async generator from an event stream.
   * This function listens to IPC events on the specified channel and yields values
   * as they arrive, properly handling completion and errors.
   *
   * @param channel - The IPC channel to listen on
   * @returns An async generator that yields values from the stream
   *
   * @example
   * ```typescript
   * const streamId = await streamManager.startStream(() => myGenerator(), 'my-stream');
   * const channel = `stream:my-stream:${streamId}`;
   *
   * for await (const value of streamManager.fromEventStream(channel)) {
   *   console.log('Received:', value);
   * }
   * ```
   */
 

declare global {
  interface Window {
    electronAPI?: {
      ipc: {
        invoke(channel: string, ...args: unknown[]): Promise<unknown>;
        on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void;
        removeListener(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void;
      };
      selectWorkspaceFile(): Promise<string | null>;
      platform: string;
      isElectron: boolean;
    };
  }
}

// Only set the client if we're in an Electron environment with the electronAPI available
if (window?.electronAPI) {
  // Create the IPC transport
  const transport = createIpcTransport(window.electronAPI);

  // Create the client using the transport
  const client = createClient(GazelService, transport);

  setClient(client);

  console.log('[Client] Electron IPC client initialized with IPC transport');
}
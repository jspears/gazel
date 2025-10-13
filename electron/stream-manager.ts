import { GazelServiceImpl } from '../server/server.js';
const newId = () => `${Math.random().toString(36).substring(2, 11)}`;

interface IpcRenderer {
  send(channel: string, ...args: unknown[]): void;
  on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void;
  removeListener(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void;
}

export class StreamManager {
  private ipcRenderer: IpcRenderer;
  private canceled: Set<string>;

  constructor(ipcRenderer: IpcRenderer, private serviceImpl: GazelServiceImpl) {
    this.ipcRenderer = ipcRenderer;
    this.canceled = new Set<string>();
  }

  /**
   * Start a stream and send events via IPC channels.
   * Events are sent on:
   * - `stream:${streamId}:data` for each value
   * - `stream:${streamId}:complete` when done
   * - `stream:${streamId}:error` on error
   */
  async startStream(method: string, input: unknown): Promise<string> {
    const streamId = newId();
    const dataChannel = `stream:${streamId}:data`;
    const completeChannel = `stream:${streamId}:complete`;
    const errorChannel = `stream:${streamId}:error`;

    console.log('[StreamManager] Starting stream', streamId, 'for method', method);

    // Run the generator and emit events via IPC
    (async () => {
      try {
        const generator = this.serviceImpl[method](input) as AsyncGenerator<unknown>;

        for await (const value of generator) {
          if (this.canceled.has(streamId)) {
            console.log('[StreamManager] Stream canceled:', streamId);
            return;
          }

          // Send data event via IPC
          console.log('[StreamManager] Sending data on', dataChannel);
          this.ipcRenderer.send(dataChannel, value);
        }

        // Send completion event via IPC
        console.log('[StreamManager] Stream complete:', streamId);
        this.ipcRenderer.send(completeChannel, null);
      } catch (error: unknown) {
        // Send error event via IPC
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('[StreamManager] Stream error:', streamId, errorMessage);
        this.ipcRenderer.send(errorChannel, errorMessage);
      } finally {
        this.canceled.delete(streamId);
      }
    })();

    return streamId;
  }

  stopStream(streamId: string): void {
    console.log('[StreamManager] Stopping stream:', streamId);
    this.canceled.add(streamId);
  }
}

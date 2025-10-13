import { contextBridge, ipcRenderer } from 'electron';
//Protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  stream: (...args: unknown[]) => ipcRenderer.invoke('grpc:stream:start', ...args),
  unary: (...args: unknown[]) => ipcRenderer.invoke('grpc:unary:request', ...args),
  
  // Expose IPC methods for the transport
  ipc: {

    invoke(channel: string, ...args: unknown[]): Promise<unknown> {
      return ipcRenderer.invoke(channel, ...args);
    },
    on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void {
      ipcRenderer.on(channel, listener);
    },
    removeListener(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void {
      ipcRenderer.removeListener(channel, listener);
    }
  },
  // gRPC-over-IPC methods
  // grpc: {
  //   unary(service: string, method: M, data = {}){
  //     return ipcRenderer.invoke('grpc:unary:request', { 
  //       service,
  //        method,
  //         data });
  //   },
  //   stream: {
  //     start: (streamId: string, service: string, method: string, data = {}) =>
  //       ipcRenderer.send('grpc:stream:start', { streamId, service, method, data }),
      
  //     cancel: (streamId: string) =>
  //       ipcRenderer.send('grpc:stream:cancel', streamId),
      
  //     onData: (streamId: string, callback: (data: any) => void) => {
  //       const channel = `grpc:stream:data:${streamId}`;
  //       const handler = (_event: any, data: any) => callback(data);
  //       ipcRenderer.on(channel, handler);
  //       return () => ipcRenderer.removeListener(channel, handler);
  //     },
      
  //     onEnd: (streamId: string, callback: () => void) => {
  //       const channel = `grpc:stream:end:${streamId}`;
  //       const handler = () => callback();
  //       ipcRenderer.once(channel, handler);
  //       return () => ipcRenderer.removeListener(channel, handler);
  //     },
      
  //     onError: (streamId: string, callback: (error: string) => void) => {
  //       const channel = `grpc:stream:error:${streamId}`;
  //       const handler = (_event: any, error: string) => callback(error);
  //       ipcRenderer.once(channel, handler);
  //       return () => ipcRenderer.removeListener(channel, handler);
  //     }
  //   }
  // },
  // grpc: new IpcTransport(ipcRenderer),
  // Platform information
  platform: process.platform,
  isElectron: true,
  onStreamData: (channel: string, callback: (data: any) => void) => {
    ipcRenderer.on(channel, callback);
    return () => ipcRenderer.removeListener(channel, callback);
  }
});

// Helper function to safely serialize arguments for IPC
function serializeForIpc(arg: any, depth = 0, maxDepth = 3): any {
  // Prevent infinite recursion
  if (depth > maxDepth) {
    return '[Max Depth Reached]';
  }

  if (arg === null || arg === undefined) {
    return arg;
  }

  // Handle primitives
  if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
    return arg;
  }

  // Handle Error objects specially
  if (arg instanceof Error) {
    return `Error: ${arg.message}`;
  }

  // Handle arrays
  if (Array.isArray(arg)) {
    return arg.map(item => serializeForIpc(item, depth + 1, maxDepth));
  }

  // Handle plain objects and try to serialize them safely
  if (typeof arg === 'object') {
    try {
      // Try JSON.stringify first as it's the safest
      JSON.stringify(arg);
      // If that works, create a plain object with only enumerable properties
      const plain: any = {};
      for (const key in arg) {
        if (Object.prototype.hasOwnProperty.call(arg, key)) {
          try {
            const value = arg[key];
            // Only include serializable values
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' || value === null) {
              plain[key] = value;
            } else if (typeof value === 'object' && depth < maxDepth) {
              // Recursively serialize nested objects (with depth limit)
              plain[key] = serializeForIpc(value, depth + 1, maxDepth);
            }
          } catch {
            // Skip properties that can't be accessed
          }
        }
      }
      return plain;
    } catch {
      // If serialization fails, return a string representation
      try {
        return String(arg);
      } catch {
        return '[Unserializable Object]';
      }
    }
  }

  // For functions and other non-serializable types, return a string representation
  try {
    return String(arg);
  } catch {
    return '[Unserializable Value]';
  }
}

// // Override console methods to forward to main process
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console),
};

console.log = (...args: any[]) => {
  originalConsole.log(...args);
  try {
    const serializedArgs = args.map(serializeForIpc);
    ipcRenderer.send('console:log', 'log', ...serializedArgs);
  } catch (err) {
    originalConsole.error('[Preload] Failed to send log to main process:', err);
  }
};

console.warn = (...args: any[]) => {
  originalConsole.warn(...args);
  try {
    const serializedArgs = args.map(serializeForIpc);
    ipcRenderer.send('console:log', 'warn', ...serializedArgs);
  } catch (err) {
    originalConsole.error('[Preload] Failed to send warn to main process:', err);
  }
};

console.error = (...args: any[]) => {
  originalConsole.error(...args);
  try {
    const serializedArgs = args.map(serializeForIpc);
    ipcRenderer.send('console:log', 'error', ...serializedArgs);
  } catch (err) {
    originalConsole.error('[Preload] Failed to send error to main process:', err);
  }
};

console.info = (...args: any[]) => {
  originalConsole.info(...args);
  try {
    const serializedArgs = args.map(serializeForIpc);
    ipcRenderer.send('console:log', 'info', ...serializedArgs);
  } catch (err) {
    originalConsole.error('[Preload] Failed to send info to main process:', err);
  }
};

console.debug = (...args: any[]) => {
  originalConsole.debug(...args);
  try {
    const serializedArgs = args.map(serializeForIpc);
    ipcRenderer.send('console:log', 'debug', ...serializedArgs);
  } catch (err) {
    originalConsole.error('[Preload] Failed to send debug to main process:', err);
  }
};

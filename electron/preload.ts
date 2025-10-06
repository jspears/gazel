import { contextBridge, ipcRenderer } from 'electron';
import { IpcTransport } from './electron-ipc-transport.js';


// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
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
  grpc: new IpcTransport(ipcRenderer),
  // Console logging bridge
  console: {
    log: (...args: any[]) => ipcRenderer.send('console:log', 'log', ...args),
    warn: (...args: any[]) => ipcRenderer.send('console:log', 'warn', ...args),
    error: (...args: any[]) => ipcRenderer.send('console:log', 'error', ...args),
    info: (...args: any[]) => ipcRenderer.send('console:log', 'info', ...args),
    debug: (...args: any[]) => ipcRenderer.send('console:log', 'debug', ...args),
  },
  
  // Platform information
  platform: process.platform,
  isElectron: true,
});

// Override console methods to forward to main process
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

console.log = (...args: any[]) => {
  originalConsole.log(...args);
  ipcRenderer.send('console:log', 'log', ...args);
};

console.warn = (...args: any[]) => {
  originalConsole.warn(...args);
  ipcRenderer.send('console:log', 'warn', ...args);
};

console.error = (...args: any[]) => {
  originalConsole.error(...args);
  ipcRenderer.send('console:log', 'error', ...args);
};

console.info = (...args: any[]) => {
  originalConsole.info(...args);
  ipcRenderer.send('console:log', 'info', ...args);
};

console.debug = (...args: any[]) => {
  originalConsole.debug(...args);
  ipcRenderer.send('console:log', 'debug', ...args);
};

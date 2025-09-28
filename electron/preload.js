/**
 * Preload script for Electron
 * Exposes IPC functionality to the renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Store original console methods before overriding
const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  info: console.info.bind(console),
  debug: console.debug.bind(console)
};

// Override console methods to send to main process
const createConsoleMethod = (level) => {
  return (...args) => {
    // Send to main process for terminal output
    ipcRenderer.send('console-log', level, ...args);
    // Also log locally for DevTools
    originalConsole[level](...args);
  };
};

// Replace global console methods
console.log = createConsoleMethod('log');
console.warn = createConsoleMethod('warn');
console.error = createConsoleMethod('error');
console.info = createConsoleMethod('info');
console.debug = createConsoleMethod('debug');

// Expose protected methods that allow the renderer process
// to use ipcRenderer for gRPC-over-IPC communication
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    // Send messages for gRPC streaming
    send: (channel, ...args) => {
      const validChannels = [
        // gRPC-over-IPC channels
        'grpc:unary:request',
        'grpc:stream:start',
        'grpc:stream:data',
        'grpc:stream:end',
        'grpc:stream:error',
        'grpc:server-stream:start',
        'grpc:server-stream:data',
        'grpc:client-stream:start',
        'grpc:client-stream:data',
        'grpc:duplex:start',
        'grpc:duplex:data',
        // Service-specific channels
        'grpc:BazelService:buildStream:start',
        'grpc:BazelService:buildStream:data',
        'grpc:BazelService:buildStream:end',
        'grpc:BazelService:watchFiles:start',
        'grpc:BazelService:watchFiles:data',
        'grpc:BazelService:watchFiles:end'
      ];

      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      } else {
        console.warn(`[Preload] Blocked send to unauthorized channel: ${channel}`);
      }
    },

    // Listen for gRPC responses and streams
    on: (channel, callback) => {
      const validChannels = [
        // gRPC response channels
        'grpc:unary:response',
        'grpc:server-stream:data',
        'grpc:duplex:data',
        'grpc:stream:end',
        'grpc:stream:error',
        // Service-specific response channels
        'grpc:BazelService:buildStream:data',
        'grpc:BazelService:buildStream:end',
        'grpc:BazelService:buildStream:error',
        'grpc:BazelService:watchFiles:data',
        'grpc:BazelService:watchFiles:end',
        'grpc:BazelService:watchFiles:error'
      ];

      if (validChannels.includes(channel)) {
        // Strip event as it includes sender
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on(channel, subscription);

        // Return unsubscribe function
        return () => {
          ipcRenderer.removeListener(channel, subscription);
        };
      } else {
        console.warn(`[Preload] Blocked listener on unauthorized channel: ${channel}`);
        return () => {};
      }
    },

    // Invoke gRPC unary calls
    invoke: (channel, ...args) => {
      const validChannels = [
        // Main gRPC channel for unary calls
        'grpc:unary:request',
        // BazelService channels (bzl-ts)
        'grpc:BazelService:setWorkspace',
        'grpc:BazelService:getWorkspace',
        'grpc:BazelService:query',
        'grpc:BazelService:cquery',
        'grpc:BazelService:aquery',
        'grpc:BazelService:build',
        'grpc:BazelService:test',
        'grpc:BazelService:run',
        'grpc:BazelService:clean',
        'grpc:BazelService:info',
        'grpc:BazelService:version',
        'grpc:BazelService:getDependencyGraph',
        'grpc:BazelService:getActionGraph',
        'grpc:BazelService:getServerStatus',
        'grpc:BazelService:shutdown',
        // GazelService channels (Gazel API)
        'grpc:GazelService:getWorkspaceInfo',
        'grpc:GazelService:getWorkspaceFiles',
        'grpc:GazelService:getWorkspaceConfig',
        'grpc:GazelService:getBuildFile',
        'grpc:GazelService:getCurrentWorkspace',
        'grpc:GazelService:scanWorkspaces',
        'grpc:GazelService:switchWorkspace',
        'grpc:GazelService:listTargets',
        'grpc:GazelService:getTarget',
        'grpc:GazelService:getTargetDependencies',
        'grpc:GazelService:getTargetOutputs',
        'grpc:GazelService:getReverseDependencies',
        'grpc:GazelService:searchTargets',
        'grpc:GazelService:executeQuery',
        'grpc:GazelService:streamQuery',
        'grpc:GazelService:buildTarget',
        'grpc:GazelService:testTarget',
        'grpc:GazelService:runTarget',
        'grpc:GazelService:streamBuild',
        'grpc:GazelService:getModuleGraph',
        'grpc:GazelService:getModuleInfo',
        // Query management
        'grpc:GazelService:getSavedQueries',
        'grpc:GazelService:saveQuery',
        'grpc:GazelService:deleteQuery',
        'grpc:GazelService:getQueryTemplates',
        // Command history
        'grpc:GazelService:getCommandHistory',
        'grpc:GazelService:clearCommandHistory',
        // Clean
        'grpc:GazelService:cleanBazel'
      ];

      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }

      console.warn(`[Preload] Blocked invoke on unauthorized channel: ${channel}`);
      return Promise.reject(new Error(`Invalid channel: ${channel}`));
    },
    
    removeListener: (channel, callback) => {
      ipcRenderer.removeListener(channel, callback);
    },
    
    removeAllListeners: (channel) => {
      ipcRenderer.removeAllListeners(channel);
    }
  },
  
  // Platform information
  platform: process.platform,
  arch: process.arch,
  version: process.versions.electron
});

console.log('[Preload] Context bridge initialized');
console.log('[Preload] Console logging to terminal enabled');

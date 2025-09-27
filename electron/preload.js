/**
 * Preload script for Electron
 * Exposes IPC functionality to the renderer process
 */

const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process
// to use ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    // Allow specific IPC channels
    send: (channel, ...args) => {
      const validChannels = [
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
        'grpc:duplex:data'
      ];
      
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, ...args);
      }
    },
    
    on: (channel, callback) => {
      const validChannels = [
        'grpc:unary:response',
        'grpc:server-stream:data',
        'grpc:duplex:data',
        'grpc:stream:end',
        'grpc:stream:error'
      ];
      
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender`
        const subscription = (event, ...args) => callback(...args);
        ipcRenderer.on(channel, subscription);
        
        // Return a function to remove the listener
        return () => {
          ipcRenderer.removeListener(channel, subscription);
        };
      }
    },
    
    invoke: (channel, ...args) => {
      const validChannels = [
        'grpc:unary:request'
      ];
      
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args);
      }
      
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

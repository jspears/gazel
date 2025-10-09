import { createClient, type Transport } from "@connectrpc/connect";
import { GazelService } from "@speajus/gazel-proto";
import { setClient } from '../client/client.impl.js';
import { setMetadataProvider } from './electron-ipc-transport.js';
import { storage } from '../client/lib/storage.js';

export * from '../client/client.impl.js';

const createGazelServiceClient = (transport:Transport)=> {
  return createClient(GazelService, transport);
}

declare global {
  interface Window {
    electronAPI?: {
      grpc: Transport;
    }
  }
}

// Only set the client if we're in an Electron environment with the electronAPI available
if (window?.electronAPI) {
  // Set up metadata provider to read from localStorage
  setMetadataProvider(() => {
    const workspace = storage.getPreference('lastWorkspace');
    const executable = storage.getPreference('bazelExecutable');

    const metadata: { workspace?: string; executable?: string } = {};
    if (workspace) {
      metadata.workspace = workspace;
    }
    if (executable) {
      metadata.executable = executable;
    }

    return metadata;
  });

  setClient(createGazelServiceClient(window.electronAPI.grpc));
  console.log('[Client] Electron IPC client initialized with metadata provider');
} else {
  console.log('[Client] Not in Electron environment, IPC client not initialized');
}
import { createClient, type Transport } from "@connectrpc/connect";
import { GazelService } from "proto/gazel_pb.js";
import { setClient } from '../client/client.impl.js';
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
  setClient(createGazelServiceClient(window.electronAPI.grpc));
  console.log('[Client] Electron IPC client initialized');
} else {
  console.log('[Client] Not in Electron environment, IPC client not initialized');
}
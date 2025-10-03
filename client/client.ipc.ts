import { GazelService } from "proto/gazel_pb";
import { createClient, type Transport, type UnaryResponse, type StreamResponse } from "@connectrpc/connect";
import { setClient } from './client.impl';
export * from './client.impl';
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
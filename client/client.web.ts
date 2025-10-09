import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { GazelService } from "@speajus/gazel-proto";
import { createClient, type Transport } from "@connectrpc/connect";
import  { setClient } from './client.impl.js';
import { metadataInterceptor } from './lib/metadata-interceptor.js';
export * from './client.impl.js';

export const createGazelServiceClient = (transport:Transport)=> {
  return createClient(GazelService, transport);
}

// Create transport with metadata interceptor
const transport = createGrpcWebTransport({
  baseUrl: '/api',
  interceptors: [metadataInterceptor]
});

setClient(createGazelServiceClient(transport));
console.log('[Client] Web client initialized with metadata interceptor');
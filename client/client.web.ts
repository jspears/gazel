import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { GazelService } from "../proto/gazel_pb";
import { createClient, type Transport } from "@connectrpc/connect";
import  { setClient } from './client.impl';
export * from './client.impl';

export const createGazelServiceClient = (transport:Transport)=> {
  return createClient(GazelService, transport);
}

setClient(createGazelServiceClient(createGrpcWebTransport({baseUrl:'/api'})));
console.log('[Client] Web client initialized');
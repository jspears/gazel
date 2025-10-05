import { createGrpcWebTransport } from "@connectrpc/connect-web";
import { GazelService } from "proto/gazel_pb.js";
import { createClient, type Transport } from "@connectrpc/connect";
import  { setClient } from './client.impl.js';
export * from './client.impl.js';

export const createGazelServiceClient = (transport:Transport)=> {
  return createClient(GazelService, transport);
}

setClient(createGazelServiceClient(createGrpcWebTransport({baseUrl:'/api'})));
console.log('[Client] Web client initialized');

import type { Client } from '@connectrpc/connect';
import type { GazelService } from '@speajus/gazel-proto';

type GazelServiceClient = Client<typeof GazelService>;


let _client: GazelServiceClient | undefined;
export function setClient(client: GazelServiceClient) {
    if (_client) {
        console.warn('[Client] already initialized, overwriting');
    }else{
        console.log('[Client] initialized');
    }
    _client = client;
}

export function getClient():GazelServiceClient {
  if (!_client) {
        throw new Error('Client not initialized, call setClient first');
  }
  return _client;
}

export const api = new Proxy({} as GazelServiceClient, {
    get(_target, prop) {
        return getClient()?.[prop];
    }
});
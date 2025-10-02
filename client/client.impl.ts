
import { type GazelService } from "../proto/gazel_pb";
import { type Client } from "@connectrpc/connect";



let _client: Client<typeof GazelService> | undefined;
export function setClient(client: Client<typeof GazelService> ) {
    if (_client) {
        console.warn('Client already initialized, overwriting');
    }else{
        console.log('Client initialized');
    }
    _client = client;
}

export function getClient() {
  if (!_client) {
        throw new Error('Client not initialized, call setClient first');
  }
  return _client;
}

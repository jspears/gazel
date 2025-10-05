import { type Client } from "@connectrpc/connect";
import { type GazelService } from "../proto/gazel_pb.js";
import { type IpcRenderer } from "electron";



declare global {
  interface Window {
    gazel?: {
        setClient(client: Client<typeof GazelService>): void;
    }
    electron?: {
      ipcRenderer: IpcRenderer;
    };
  }
}
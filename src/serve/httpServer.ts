import type { AddressInfo } from 'node:net';

export interface HttpServer {
  start(port: number): Promise<void>;
  stop(): Promise<void>;
  address(): AddressInfo;
}

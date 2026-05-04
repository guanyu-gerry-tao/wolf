export interface ServeOptions {
  port: number;
  browser?: boolean;
  stopAfterStart?: boolean;
}

export interface ServeApplicationService {
  run(options: ServeOptions): Promise<void>;
}

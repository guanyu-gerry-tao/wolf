export interface ConfigSetResult {
  key: string;
  coerced: unknown;
}

export interface ConfigApplicationService {
  // Reads a dot-path key from wolf.toml. Throws if the key is absent.
  get(key: string): Promise<unknown>;

  // Coerces `valueStr` to the existing field's runtime shape, validates via
  // the AppConfig schema, backs up wolf.toml, then writes.
  set(key: string, valueStr: string): Promise<ConfigSetResult>;
}

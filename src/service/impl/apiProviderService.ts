import type { JobProviderService, RawJob } from '../jobProvider.js';

export interface ApiProviderConfig {
  name: string;
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
}

export class ApiProviderService implements JobProviderService {
  readonly name: string;
  private readonly config: ApiProviderConfig;

  constructor(config: ApiProviderConfig) {
    this.name = config.name;
    this.config = config;
  }

  async fetch(): Promise<RawJob[]> {
    const method = this.config.method ?? 'GET';

    const response = await globalThis.fetch(this.config.url, {
      method,
      headers: this.config.headers,
      body: method === 'POST' ? this.config.body : undefined,
    });

    if (!response.ok) {
      throw new Error(
        `ApiProviderService: HTTP ${response.status} ${response.statusText} from ${this.config.url}`,
      );
    }

    const data: unknown = await response.json();

    if (Array.isArray(data)) {
      return data as RawJob[];
    }

    if (data !== null && typeof data === 'object') {
      // If the response is a wrapper object, look for a single array-valued field
      const values = Object.values(data as Record<string, unknown>);
      const arrayValues = values.filter(Array.isArray);
      if (arrayValues.length === 1) {
        return arrayValues[0] as RawJob[];
      }
    }

    throw new Error(
      'ApiProviderService: response is not an array or recognisable wrapper',
    );
  }
}

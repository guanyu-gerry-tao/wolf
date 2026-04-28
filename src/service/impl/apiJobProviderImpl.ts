import type { JobProvider, RawJob } from '../jobProvider.js';

/**
 * Configuration for a generic HTTP-API provider. The whole point is that
 * users can point wolf at any JSON-returning endpoint without writing a
 * provider class — AI-driven field extraction normalizes the response
 * downstream.
 */
export interface ApiProviderConfig {
  name: string;
  url: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
}

/**
 * Generic HTTP-API `JobProvider`. Accepts either a JSON array directly or
 * a wrapper object with a single array-valued field (the common shape for
 * paginated APIs). Anything else throws so misconfigured endpoints fail
 * loudly instead of silently returning zero jobs.
 */
export class ApiJobProviderImpl implements JobProvider {
  readonly name: string;
  private readonly config: ApiProviderConfig;

  constructor(config: ApiProviderConfig) {
    this.name = config.name;
    this.config = config;
  }

  /** @inheritdoc */
  async fetch(): Promise<RawJob[]> {
    const method = this.config.method ?? 'GET';

    const response = await globalThis.fetch(this.config.url, {
      method,
      headers: this.config.headers,
      body: method === 'POST' ? this.config.body : undefined,
    });

    if (!response.ok) {
      throw new Error(
        `ApiJobProviderImpl: HTTP ${response.status} ${response.statusText} from ${this.config.url}`,
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
      'ApiJobProviderImpl: response is not an array or recognisable wrapper',
    );
  }
}

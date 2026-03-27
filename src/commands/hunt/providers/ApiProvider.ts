/**
 * ApiProvider.ts — Generic HTTP job provider.
 *
 * Fetches raw job data from any user-configured HTTP endpoint.
 * The user sets the endpoint URL and optional auth in wolf.toml.
 * Wolf sends a GET (or POST) request, receives JSON, and returns it as-is.
 * Structured field extraction (title, company, description, etc.) happens
 * later in wolf score via AI — not here.
 *
 * ## wolf.toml configuration example
 *
 * [[providers.api]]
 * enabled = true
 * name = "my-company-api"      # used as job.source identifier
 * url = "https://api.example.com/jobs"
 * method = "GET"               # "GET" or "POST" (default: "GET")
 * headers = { "Authorization" = "Bearer <token>" }
 * body = '{"role": "SWE"}'    # optional POST body (JSON string)
 *
 * ## What this provider returns
 *
 * An array of raw JSON objects — whatever the API returns.
 * Each object should contain at minimum a job description and a URL,
 * but any structure is accepted. wolf score feeds these to Claude
 * for field extraction, so no mapping is required here.
 */

import type { JobProvider, HuntOptions } from '../../../types/index.js';

/** Configuration for one ApiProvider instance, loaded from wolf.toml. */
export interface ApiProviderConfig {
  name: string;           // used as job.source (e.g. "my-company-api")
  url: string;            // endpoint to call
  method?: 'GET' | 'POST'; // default: 'GET'
  headers?: Record<string, string>;
  body?: string;          // raw JSON string for POST requests
}

export class ApiProvider implements JobProvider {
  readonly name: string;
  private readonly config: ApiProviderConfig;

  constructor(config: ApiProviderConfig) {
    this.name = config.name;
    this.config = config;
  }

  /**
   * Fetches raw job data from the configured endpoint.
   *
   * @param _options - Hunt options (role, location, maxResults).
   *   Note: ApiProvider passes these as query params on GET requests,
   *   or merges them into the request body on POST requests.
   *   The endpoint is expected to filter results — wolf does not filter here.
   * @returns Array of raw JSON objects from the API response.
   *   Must be an array — if the API wraps results (e.g. { jobs: [...] }),
   *   the provider should unwrap it before returning.
   * @throws If the HTTP request fails or the response is not valid JSON.
   */
  async hunt(_options: HuntOptions): Promise<object[]> {
    // TODO(M2):
    // 1. Build request:
    //    - GET: append role/location/maxResults as query params to this.config.url
    //    - POST: merge role/location/maxResults into this.config.body (JSON.parse → merge → JSON.stringify)
    // 2. Call fetch(url, { method, headers, body })
    // 3. Check response.ok — throw if HTTP error (include status code in error message)
    // 4. Parse response.json()
    // 5. If result is an array, return it directly
    //    If result is an object with a single array field (e.g. { jobs: [...] }), return that array
    //    Otherwise throw: "ApiProvider: response is not an array or recognisable wrapper"
    throw new Error('Not implemented');
  }
}

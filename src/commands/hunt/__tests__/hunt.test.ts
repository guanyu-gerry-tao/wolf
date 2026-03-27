/**
 * Tests for commands/hunt/index.ts and providers/ApiProvider.ts
 *
 * TDD: implement the module, then convert it.todo → it and fill in assertions.
 */

import { describe, it } from 'vitest';

describe('ApiProvider', () => {
  it.todo('fetches from the configured URL and returns an array');
  it.todo('unwraps a single-key wrapper object (e.g. { jobs: [...] })');
  it.todo('appends role/location as query params on GET requests');
  it.todo('throws on non-ok HTTP response (includes status code in message)');
  it.todo('throws if response is not an array or recognisable wrapper');
});

describe('hunt', () => {
  it.todo('throws if no providers are enabled');
  it.todo('returns ingestedCount equal to total raw jobs received from all providers');
  it.todo('returns newCount after deduplication');
  it.todo('saves jobs with status raw and score null');
});

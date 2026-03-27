/**
 * Tests for commands/status/index.ts
 *
 * TDD: implement status.ts, then convert it.todo → it and fill in assertions.
 */

import { describe, it } from 'vitest';

describe('status', () => {
  it.todo('calls pollAll() before returning results');
  it.todo('returns all jobs with total count when no filters set');
  it.todo('passes status filter to getJobs');
  it.todo('passes minScore filter to getJobs');
  it.todo('passes since filter to getJobs');
  it.todo('byStatus breakdown matches countByStatus result');
});

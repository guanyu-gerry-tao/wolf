/**
 * Tests for utils/batch.ts
 *
 * TDD: implement batch.ts, then convert it.todo → it and fill in assertions.
 */

import { describe, it } from 'vitest';

describe('submit', () => {
  it.todo('calls Anthropic Batch API and returns a batchId');
  it.todo('stores the batchId in the DB via saveBatch');
  it.todo('each request item uses jobId as custom_id');
  it.todo('throws if WOLF_ANTHROPIC_API_KEY is not set');
});

describe('pollAll', () => {
  it.todo('returns zeroes when there are no pending batches');
  it.todo('calls the registered handler when a batch completes');
  it.todo('marks as failed when all items errored');
  it.todo('marks as partial_failed when some items succeed and some error');
  it.todo('includes failed jobIds in failedJobIds list');
  it.todo('leaves failed jobs with score: null for retry on next wolf score run');
});

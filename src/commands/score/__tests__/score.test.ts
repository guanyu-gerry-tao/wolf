/**
 * Tests for commands/score/index.ts
 *
 * TDD: implement the module, then convert it.todo → it and fill in assertions.
 */

import { describe, it } from 'vitest';

describe('scoreSingle', () => {
  it.todo('returns a valid ScoringResponse and updates the job in DB');
  it.todo('throws if Claude returns score outside [0.0, 1.0]');
  it.todo('throws if Claude returns invalid JSON');
  it.todo('throws if WOLF_ANTHROPIC_API_KEY is not set');
});

describe('applyDealbreakers', () => {
  it.todo('passes all jobs when no dealbreakers are set');
  it.todo('filters jobs that do not offer sponsorship when sponsorship is required');
  it.todo('passes jobs where sponsorshipOffered is null (unclear) — benefit of the doubt');
  it.todo('filters onsite jobs when remote is required');
  it.todo('passes hybrid jobs when remote is required');
});

describe('scoreResultHandler', () => {
  it.todo('writes valid score and justification to DB');
  it.todo('sets job status to new after scoring');
  it.todo('throws if score is outside [0.0, 1.0]');
  it.todo('throws if justification is missing or empty');
  it.todo('throws if Claude returns invalid JSON');
});

describe('score (integration)', () => {
  it.todo('returns { submitted: 0, filtered: 0 } when no unscored jobs exist');
  it.todo('polls pending batches when poll: true is set');
  it.todo('uses scoreSingle when single: true is set');
  it.todo('throws if single: true but jobIds has more than one entry');
});

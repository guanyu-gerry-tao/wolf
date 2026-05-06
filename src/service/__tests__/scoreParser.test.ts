import { describe, it, expect } from 'vitest';
import { parseScoreResponse } from '../impl/scoringServiceImpl.js';
import { TIER_NAMES } from '../../utils/scoringTiers.js';

// `parseScoreResponse` is a pure function. The AI is instructed to emit
// exactly three tags — <tier>...</tier>, <pros>...</pros>,
// <cons>...</cons> — and the parser converts the tier name to the
// integer index that lands in `Job.tierAi`, while assembling a canonical
// `## Tier / ## Pros / ## Cons` markdown blob for `Job.scoreJustification`.
// These tests pin every shape we expect to see in production (clean,
// slightly noisy, and outright malformed) so the service layer can rely on
// the verdict without re-validating.

describe('parseScoreResponse', () => {
  // Happy path: clean tags, name-style tier, single-line pros/cons.
  // Asserts the integer index AND the assembled markdown shape end-to-end.
  it('parses a clean response and assembles the canonical markdown', () => {
    const raw =
      '<tier>tailor</tier>\n' +
      '<pros>\n- Backend Go fits target roles\n- Comp meets floor\n</pros>\n' +
      '<cons>\n- Cloud stack is GCP, profile shows AWS\n</cons>';
    const result = parseScoreResponse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tier).toBe(TIER_NAMES.indexOf('tailor'));
    expect(result.value.comment).toContain('## Tier\ntailor');
    expect(result.value.comment).toContain('## Pros\n- Backend Go fits target roles');
    expect(result.value.comment).toContain('## Cons\n- Cloud stack is GCP');
  });

  // The 4 tier names + their indices. Sweeping all values guarantees the
  // index lookup matches `TIER_NAMES` order — locked invariant.
  it.each([
    ['skip', 0],
    ['mass_apply', 1],
    ['tailor', 2],
    ['invest', 3],
  ] as const)('maps tier name "%s" to index %i', (name, index) => {
    const raw = `<tier>${name}</tier><pros>- ok</pros><cons>-</cons>`;
    const result = parseScoreResponse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tier).toBe(index);
  });

  // Tier names should be matched case-insensitively because chatty models
  // sometimes capitalize. Keeps parsing robust without softening the contract.
  it('accepts tier names case-insensitively', () => {
    const raw = '<tier>INVEST</tier><pros>- great</pros><cons>-</cons>';
    const result = parseScoreResponse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tier).toBe(TIER_NAMES.indexOf('invest'));
  });

  // Models occasionally wrap the answer in surrounding chatter ("Sure, here
  // is the verdict"). Whitespace and prose around the tags must be tolerated.
  it('tolerates surrounding whitespace and prose around the tags', () => {
    const raw = `Here is the result.\n\n  <tier>mass_apply</tier>  \n<pros>\n- partial fit\n</pros>\n<cons>\n- stack mismatch\n</cons>\n\nDone.`;
    const result = parseScoreResponse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tier).toBe(TIER_NAMES.indexOf('mass_apply'));
  });

  // Multi-line pros/cons must survive verbatim — reviewers want the full
  // reasoning rendered to the user / stored in scoreJustification.
  it('preserves multi-line pros and cons content', () => {
    const raw =
      '<tier>tailor</tier>\n' +
      '<pros>\n- First pro line\n- Second pro line\n</pros>\n' +
      '<cons>\n- First con line\n- Second con line\n</cons>';
    const result = parseScoreResponse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.comment).toContain('- First pro line\n- Second pro line');
    expect(result.value.comment).toContain('- First con line\n- Second con line');
  });

  // Unknown tier name is a fatal parse error — better to fail loud than
  // pick a default tier silently.
  it('rejects an unknown tier value', () => {
    const raw = '<tier>maybe</tier><pros>- ok</pros><cons>-</cons>';
    const result = parseScoreResponse(raw);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/skip|mass_apply|tailor|invest/i);
  });

  it('rejects missing <tier> tag', () => {
    const raw = '<pros>- ok</pros><cons>-</cons>';
    const result = parseScoreResponse(raw);
    expect(result.ok).toBe(false);
  });

  it('rejects missing <pros> tag', () => {
    const raw = '<tier>skip</tier><cons>-</cons>';
    const result = parseScoreResponse(raw);
    expect(result.ok).toBe(false);
  });

  it('rejects missing <cons> tag', () => {
    const raw = '<tier>skip</tier><pros>- ok</pros>';
    const result = parseScoreResponse(raw);
    expect(result.ok).toBe(false);
  });

  // Whitespace-only pros means the model gave us nothing — treat as empty.
  // Cons can be empty (some jobs are pure positives) but pros must list
  // at least one signal.
  it('rejects whitespace-only pros', () => {
    const raw = '<tier>skip</tier><pros>   </pros><cons>-</cons>';
    const result = parseScoreResponse(raw);
    expect(result.ok).toBe(false);
  });

  // Stringified index ("3") in the tier slot — accepted because the
  // tierIndexOf helper allows it (parity with `wolf job set tierAi 3`).
  it('accepts stringified index in the tier slot', () => {
    const raw = '<tier>3</tier><pros>- great fit</pros><cons>- none</cons>';
    const result = parseScoreResponse(raw);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.tier).toBe(3);
  });
});

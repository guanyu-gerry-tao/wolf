import { describe, it, expect } from 'vitest';
import { formatScoreResult } from '../score.js';
import { TIER_NAMES } from '../../../utils/scoringTiers.js';

// `formatScoreResult` is the single rendering path between `ScoreResult` and
// what the user sees. Each test pins one of the three modes so a future
// style tweak keeps the user experience explicit and reviewable.

describe('formatScoreResult (v3 tier model)', () => {
  // Default mode: how many jobs were enqueued + reminder to poll.
  it('default mode reports submitted count and reminds to poll', () => {
    const out = formatScoreResult({ submitted: 3 }, 'default');
    expect(out).toContain('Submitted 3 jobs');
    expect(out).toContain('--poll');
  });

  it('default mode pluralizes correctly when submitted is 1', () => {
    const out = formatScoreResult({ submitted: 1 }, 'default');
    expect(out).toContain('Submitted 1 job ');
  });

  // The default-mode footer mentions all four tier names so the user knows
  // what they're going to get back. Helps onboarding.
  it('default mode includes the canonical tier names in the footer', () => {
    const out = formatScoreResult({ submitted: 2 }, 'default');
    for (const name of TIER_NAMES) {
      expect(out).toContain(name);
    }
  });

  // Empty queue — guide the user to the next action.
  it('default mode hints at next step when no unscored jobs are found', () => {
    const out = formatScoreResult({ submitted: 0 }, 'default');
    expect(out).toMatch(/no unscored jobs/i);
    expect(out).toContain('wolf hunt');
  });

  // Single mode prints the AI markdown blob directly so the user / agent
  // sees the same shape the file stores.
  it('single mode prints the canonical markdown blob', () => {
    const md = '## Tier\ntailor\n\n## Pros\n- backend Go\n\n## Cons\n- onsite\n';
    const out = formatScoreResult(
      { submitted: 1, singleTier: 2, singleTierName: 'tailor', singleMd: md },
      'single',
    );
    expect(out).toContain('## Tier\ntailor');
    expect(out).toContain('## Pros\n- backend Go');
    expect(out).toContain('## Cons\n- onsite');
  });

  // Defensive fallback: if singleMd is somehow missing, at least the tier
  // name should reach the user.
  it('single mode falls back to a Tier line when singleMd is missing', () => {
    const out = formatScoreResult(
      { submitted: 1, singleTier: 0, singleTierName: 'skip' },
      'single',
    );
    expect(out).toContain('Tier: skip');
  });

  // Poll mode — when nothing was completed, say so explicitly so the user
  // doesn't think the command silently failed.
  it('poll mode explicitly reports zero polled batches', () => {
    const out = formatScoreResult({ submitted: 0, polled: 0 }, 'poll');
    expect(out).toMatch(/polled 0/i);
    expect(out).toMatch(/no completed/i);
  });

  // Poll mode happy path mentions the inspection hint pointing at the
  // tailor / invest tiers (the actionable buckets).
  it('poll mode includes count and inspection hint when batches were polled', () => {
    const out = formatScoreResult({ submitted: 0, polled: 2 }, 'poll');
    expect(out).toContain('Polled 2 batches');
    expect(out).toContain('wolf job list');
    expect(out).toContain('tailor,invest');
  });
});

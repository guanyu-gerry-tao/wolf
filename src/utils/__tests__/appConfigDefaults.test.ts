import { describe, expect, it } from 'vitest';
import { AppConfigSchema } from '../schemas.js';
import { DEFAULT_COMPANION_CONFIG, DEFAULT_WORKSPACE_CONFIG } from '../appConfigDefaults.js';

describe('app config defaults', () => {
  // The side panel reset button and `wolf init` share these defaults. This
  // test keeps the TS object aligned with the Zod schema that validates
  // wolf.toml at runtime.
  it('parses as a complete default wolf.toml shape', () => {
    const parsed = AppConfigSchema.parse({
      schemaVersion: 2,
      ...DEFAULT_WORKSPACE_CONFIG,
      companion: DEFAULT_COMPANION_CONFIG,
    });

    expect(parsed.default).toBe('default');
    expect(parsed.hunt).toEqual({ minScore: 0.5, maxResults: 50 });
    expect(parsed.tailor).toEqual({
      model: 'anthropic/claude-sonnet-4-6',
      defaultCoverLetterTone: 'professional',
    });
    expect(parsed.fill.model).toBe('anthropic/claude-haiku-4-5-20251001');
  });
});

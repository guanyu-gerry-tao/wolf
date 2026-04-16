import { describe, it, expect } from 'vitest';
import { parseModelRef } from '../parseModelRef.js';
import { ModelRefSchema } from '../schemas.js';

describe('parseModelRef', () => {
  // Happy path: canonical "<provider>/<model>" strings split into AiConfig.
  it('parses anthropic refs', () => {
    expect(parseModelRef('anthropic/claude-sonnet-4-6'))
      .toEqual({ provider: 'anthropic', model: 'claude-sonnet-4-6' });
  });

  it('parses openai refs', () => {
    expect(parseModelRef('openai/gpt-4o'))
      .toEqual({ provider: 'openai', model: 'gpt-4o' });
  });

  // Slashes inside the model portion must survive: only the FIRST slash is the separator.
  // Future-proofs for HuggingFace-style names like "meta-llama/Llama-3".
  it('splits on the first slash only', () => {
    expect(parseModelRef('anthropic/foo/bar'))
      .toEqual({ provider: 'anthropic', model: 'foo/bar' });
  });

  // Malformed input: missing provider, trailing slash, unknown vendor — all rejected.
  it('throws when the provider segment is missing', () => {
    expect(() => parseModelRef('/gpt-4o')).toThrow(/Invalid model ref/);
    expect(() => parseModelRef('no-slash')).toThrow(/Invalid model ref/);
  });

  it('throws when the model segment is missing', () => {
    expect(() => parseModelRef('anthropic/')).toThrow(/Invalid model ref/);
  });

  it('throws on unknown providers', () => {
    expect(() => parseModelRef('google/gemini-pro')).toThrow(/Unknown provider/);
  });

  // ModelRefSchema (Zod, at config boundary) and parseModelRef (runtime, at point of use)
  // must agree on what's valid — otherwise a config that loads cleanly could blow up later.
  // These cases guard against silent drift between the two validators.
  describe('agreement with ModelRefSchema', () => {
    // Every happy case here should pass BOTH: Zod accepts the shape, parseModelRef splits it.
    const validRefs = [
      'anthropic/claude-sonnet-4-6',
      'openai/gpt-4o',
      'anthropic/foo/bar',
    ];
    it.each(validRefs)('%s passes both validators', (ref) => {
      expect(() => ModelRefSchema.parse(ref)).not.toThrow();
      expect(() => parseModelRef(ref)).not.toThrow();
    });

    // Inputs Zod rejects must also be rejected by parseModelRef (and vice versa)
    // so a caller that skips Zod still gets a clear error.
    const invalidRefs = [
      '',
      'no-slash',
      '/gpt-4o',
      'google/gemini-pro',
    ];
    it.each(invalidRefs)('%s fails both validators', (ref) => {
      const zodOk = ModelRefSchema.safeParse(ref).success;
      let parseOk = true;
      try { parseModelRef(ref); } catch { parseOk = false; }
      expect(zodOk && parseOk).toBe(false);
    });
  });
});

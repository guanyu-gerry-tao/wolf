import { vi, describe, test, expect, beforeEach } from 'vitest';
import { aiClient, PROVIDERS, PROVIDER_IDS, isProviderId } from '../ai/index.js';

// Hoisted mocks so the factory passed to vi.mock() can reference them.
// These fake SDK instances let us assert call shapes without network I/O.
const { mockAnthropicCreate, mockOpenAICreate, mockAnthropicConstructor, mockOpenAIConstructor } = vi.hoisted(() => ({
  mockAnthropicCreate: vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'mock: hello from claude' }],
  }),
  mockOpenAICreate: vi.fn().mockResolvedValue({
    choices: [{ message: { content: 'mock: hello from gpt' } }],
  }),
  mockAnthropicConstructor: vi.fn(),
  mockOpenAIConstructor: vi.fn(),
}));

// Intercept real network requests — SDKs are never actually instantiated with real keys.
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function (opts: unknown) {
    mockAnthropicConstructor(opts);
    return { messages: { create: mockAnthropicCreate } };
  }),
}));

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function (opts: unknown) {
    mockOpenAIConstructor(opts);
    return { chat: { completions: { create: mockOpenAICreate } } };
  }),
}));

// Reset call counts and env vars between tests so each scenario starts clean.
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.WOLF_ANTHROPIC_API_KEY;
  delete process.env.WOLF_OPENAI_API_KEY;
});

// =====================================================================
// Registry — source of truth for which providers wolf supports
// =====================================================================

describe('registry', () => {
  // PROVIDER_IDS is derived from PROVIDERS keys, so adding a provider here
  // is a one-line change that propagates everywhere that imports these.
  test('exports PROVIDER_IDS matching the PROVIDERS object keys', () => {
    expect(PROVIDER_IDS.sort()).toEqual(Object.keys(PROVIDERS).sort());
  });

  // isProviderId guards untrusted strings (parseModelRef input, CLI flags, etc).
  test('isProviderId accepts registered ids and rejects anything else', () => {
    for (const id of PROVIDER_IDS) expect(isProviderId(id)).toBe(true);
    expect(isProviderId('google')).toBe(false);
    expect(isProviderId('')).toBe(false);
  });

  // Every registered provider must have a resolvable family implementation;
  // this test would fail if someone adds a provider referencing a new family
  // without wiring its FamilyCall into the dispatch table.
  test('every provider points at a family the dispatcher knows about', async () => {
    for (const id of PROVIDER_IDS) {
      // Smoke-test: aiClient should route without throwing a "no family" error.
      await expect(aiClient('hi', undefined, { provider: id })).resolves.toBeTypeOf('string');
    }
  });
});

// =====================================================================
// aiClient — provider routing, default behaviours, request shape
// =====================================================================

describe('aiClient — routing', () => {
  test('defaults to anthropic when no provider is specified', async () => {
    const result = await aiClient('hello');
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
    expect(mockOpenAICreate).not.toHaveBeenCalled();
    expect(typeof result).toBe('string');
  });

  test('routes to the openai family when provider is openai', async () => {
    await aiClient('hello', undefined, { provider: 'openai' });
    expect(mockOpenAICreate).toHaveBeenCalledTimes(1);
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  test('routes to the anthropic family when provider is anthropic', async () => {
    await aiClient('hello', undefined, { provider: 'anthropic' });
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
    expect(mockOpenAICreate).not.toHaveBeenCalled();
  });
});

describe('aiClient — model', () => {
  // The registry holds per-provider defaults; aiClient falls back to them
  // when the caller does not pass a model.
  test('uses the provider default model when no model is specified (anthropic)', async () => {
    await aiClient('hello');
    expect(mockAnthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: PROVIDERS.anthropic.defaultModel }),
    );
  });

  test('uses the provider default model when no model is specified (openai)', async () => {
    await aiClient('hello', undefined, { provider: 'openai' });
    expect(mockOpenAICreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: PROVIDERS.openai.defaultModel }),
    );
  });

  test('passes the caller-specified model through to anthropic', async () => {
    await aiClient('hello', undefined, { provider: 'anthropic', model: 'claude-opus-4-6' });
    expect(mockAnthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-4-6' }),
    );
  });

  test('passes the caller-specified model through to openai', async () => {
    await aiClient('hello', undefined, { provider: 'openai', model: 'gpt-4o-mini' });
    expect(mockOpenAICreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'gpt-4o-mini' }),
    );
  });
});

describe('aiClient — message shape', () => {
  // Anthropic: system is a top-level field, not a message — this is the key
  // behavioural difference that justifies a separate family implementation.
  test('anthropic family puts systemPrompt in the system field', async () => {
    await aiClient('my prompt', 'my system', { provider: 'anthropic' });
    expect(mockAnthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: 'my system',
        messages: [{ role: 'user', content: 'my prompt' }],
      }),
    );
  });

  // OpenAI-compat: system is the first message with role: 'system'.
  test('openai family puts systemPrompt as a system-role message', async () => {
    await aiClient('my prompt', 'my system', { provider: 'openai' });
    expect(mockOpenAICreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          { role: 'system', content: 'my system' },
          { role: 'user', content: 'my prompt' },
        ]),
      }),
    );
  });
});

// =====================================================================
// API key wiring — env vars must reach SDK constructors
// =====================================================================

describe('aiClient — env var wiring', () => {
  test('passes WOLF_ANTHROPIC_API_KEY to the Anthropic SDK constructor', async () => {
    process.env.WOLF_ANTHROPIC_API_KEY = 'test-anthropic-key';
    await aiClient('hello', undefined, { provider: 'anthropic' });
    expect(mockAnthropicConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'test-anthropic-key' }),
    );
  });

  test('passes WOLF_OPENAI_API_KEY to the OpenAI SDK constructor', async () => {
    process.env.WOLF_OPENAI_API_KEY = 'test-openai-key';
    await aiClient('hello', undefined, { provider: 'openai' });
    expect(mockOpenAIConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: 'test-openai-key' }),
    );
  });
});

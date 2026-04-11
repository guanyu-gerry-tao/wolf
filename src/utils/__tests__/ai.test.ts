// Vitest natively supports ESM — vi.mock() is automatically hoisted to the top
// Vitest 原生支持 ESM，vi.mock() 会自动提升到文件顶部执行
import { vi, describe, test, expect, beforeEach } from "vitest";
import { anthropicClient, openaiClient, aiClient } from "../ai.js";

// vi.hoisted() creates mock functions that can be referenced both inside
// vi.mock() factories AND inside test cases
// vi.hoisted() 创建可以在 vi.mock() 工厂函数和测试用例中同时引用的 mock 函数
const { mockAnthropicCreate, mockOpenAICreate, mockAnthropicConstructor, mockOpenAIConstructor } = vi.hoisted(() => ({
  mockAnthropicCreate: vi.fn().mockResolvedValue({
    content: [{ type: "text", text: "mock: hello from claude" }],
  }),
  mockOpenAICreate: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "mock: hello from gpt" } }],
  }),
  mockAnthropicConstructor: vi.fn(),
  mockOpenAIConstructor: vi.fn(),
}));

// Mock Anthropic SDK — intercepts real network requests, returns hardcoded fake data
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function (opts: unknown) {
    mockAnthropicConstructor(opts);
    return { messages: { create: mockAnthropicCreate } };
  }),
}));

// Mock OpenAI SDK — same pattern as above
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function (opts: unknown) {
    mockOpenAIConstructor(opts);
    return { chat: { completions: { create: mockOpenAICreate } } };
  }),
}));

// Reset call counts and env vars between tests
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.WOLF_ANTHROPIC_API_KEY;
  delete process.env.WOLF_OPENAI_API_KEY;
});

// =====================================================================
// Type checks — verify the exports exist and are functions
// 类型检查 — 验证函数存在
// =====================================================================

describe("AIClient type", () => {
  test("anthropicClient is a function", () => {
    expect(typeof anthropicClient).toBe("function");
  });

  test("openaiClient is a function", () => {
    expect(typeof openaiClient).toBe("function");
  });
});

// =====================================================================
// anthropicClient — uses mock, no API key needed, no cost
// anthropicClient — 使用 mock，不需要 API key，不花钱
// =====================================================================

describe("anthropicClient", () => {
  test("returns a non-empty string", async () => {
    const result = await anthropicClient("Reply with just the word: hello");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("accepts an optional systemPrompt", async () => {
    const result = await anthropicClient(
      "What are you?",
      "You are a helpful assistant. Reply in one sentence.",
    );
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("calls Anthropic SDK with the prompt as a user message", async () => {
    await anthropicClient("hello");
    // Verify the SDK was actually called — can't hardcode the return value to pass this
    // 验证 SDK 确实被调用了，直接硬编码返回值无法通过这个测试
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
    expect(mockAnthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "hello" }],
      }),
    );
  });

  test("passes systemPrompt as system role when provided", async () => {
    await anthropicClient("hello", "be concise");
    expect(mockAnthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "be concise",
        messages: [{ role: "user", content: "hello" }],
      }),
    );
  });
});

// =====================================================================
// openaiClient — uses mock, no API key needed, no cost
// openaiClient — 使用 mock，不需要 API key，不花钱
// =====================================================================

describe("openaiClient", () => {
  test("returns a non-empty string", async () => {
    const result = await openaiClient("Reply with just the word: hello");
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("accepts an optional systemPrompt", async () => {
    const result = await openaiClient(
      "What are you?",
      "You are a helpful assistant. Reply in one sentence.",
    );
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("calls OpenAI SDK with the prompt as a user message", async () => {
    await openaiClient("hello");
    // Verify the SDK was actually called — can't hardcode the return value to pass this
    // 验证 SDK 确实被调用了，直接硬编码返回值无法通过这个测试
    expect(mockOpenAICreate).toHaveBeenCalledTimes(1);
    expect(mockOpenAICreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: "user", content: "hello" }],
      }),
    );
  });

  test("passes systemPrompt as system role when provided", async () => {
    await openaiClient("hello", "be concise");
    expect(mockOpenAICreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          { role: "system", content: "be concise" },
          { role: "user", content: "hello" },
        ]),
      }),
    );
  });
});

// =====================================================================
// aiClient — unified wrapper that routes to the correct provider
// aiClient — 统一封装，根据 provider 路由到对应实现
// =====================================================================

describe("aiClient", () => {
  test("is a function", () => {
    expect(typeof aiClient).toBe("function");
  });

  test("defaults to anthropic provider", async () => {
    const result = await aiClient("hello");
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
    expect(mockOpenAICreate).not.toHaveBeenCalled();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("routes to openai when provider is 'openai'", async () => {
    const result = await aiClient("hello", undefined, { provider: "openai" });
    expect(mockOpenAICreate).toHaveBeenCalledTimes(1);
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  test("routes to anthropic when provider is 'anthropic'", async () => {
    await aiClient("hello", undefined, { provider: "anthropic" });
    expect(mockAnthropicCreate).toHaveBeenCalledTimes(1);
    expect(mockOpenAICreate).not.toHaveBeenCalled();
  });

  test("passes custom model to anthropic", async () => {
    await aiClient("hello", undefined, {
      provider: "anthropic",
      model: "claude-opus-4-6",
    });
    expect(mockAnthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-opus-4-6" }),
    );
  });

  test("passes custom model to openai", async () => {
    await aiClient("hello", undefined, {
      provider: "openai",
      model: "gpt-4o-mini",
    });
    expect(mockOpenAICreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o-mini" }),
    );
  });

  test("uses default anthropic model when model not specified", async () => {
    await aiClient("hello");
    expect(mockAnthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "claude-haiku-4-5-20251001" }),
    );
  });

  test("uses default openai model when model not specified", async () => {
    await aiClient("hello", undefined, { provider: "openai" });
    expect(mockOpenAICreate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-4o" }),
    );
  });

  test("passes prompt and systemPrompt to anthropic", async () => {
    await aiClient("my prompt", "my system", { provider: "anthropic" });
    expect(mockAnthropicCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "my system",
        messages: [{ role: "user", content: "my prompt" }],
      }),
    );
  });

  test("passes prompt and systemPrompt to openai", async () => {
    await aiClient("my prompt", "my system", { provider: "openai" });
    expect(mockOpenAICreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          { role: "system", content: "my system" },
          { role: "user", content: "my prompt" },
        ]),
      }),
    );
  });
});

// =====================================================================
// API key — verify WOLF_* env vars are passed to SDK constructors
// =====================================================================

describe("anthropicClient — API key", () => {
  test("passes WOLF_ANTHROPIC_API_KEY to Anthropic constructor", async () => {
    process.env.WOLF_ANTHROPIC_API_KEY = "test-anthropic-key";
    await anthropicClient("hello");
    expect(mockAnthropicConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "test-anthropic-key" }),
    );
  });
});

describe("openaiClient — API key", () => {
  test("passes WOLF_OPENAI_API_KEY to OpenAI constructor", async () => {
    process.env.WOLF_OPENAI_API_KEY = "test-openai-key";
    await openaiClient("hello");
    expect(mockOpenAIConstructor).toHaveBeenCalledWith(
      expect.objectContaining({ apiKey: "test-openai-key" }),
    );
  });
});

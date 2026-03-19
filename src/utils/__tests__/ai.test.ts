// Vitest natively supports ESM — vi.mock() is automatically hoisted to the top
// Vitest 原生支持 ESM，vi.mock() 会自动提升到文件顶部执行
import { vi, describe, test, expect, beforeEach } from "vitest";
import { anthropicClient, openaiClient } from "../ai.js";

// vi.hoisted() creates mock functions that can be referenced both inside
// vi.mock() factories AND inside test cases
// vi.hoisted() 创建可以在 vi.mock() 工厂函数和测试用例中同时引用的 mock 函数
const { mockAnthropicCreate, mockOpenAICreate } = vi.hoisted(() => ({
  mockAnthropicCreate: vi.fn().mockResolvedValue({
    content: [{ type: "text", text: "mock: hello from claude" }],
  }),
  mockOpenAICreate: vi.fn().mockResolvedValue({
    choices: [{ message: { content: "mock: hello from gpt" } }],
  }),
}));

// Mock Anthropic SDK — intercepts real network requests, returns hardcoded fake data
// Mock Anthropic SDK — 拦截真实网络请求，返回写死的假数据
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  })),
}));

// Mock OpenAI SDK — same pattern as above
// Mock OpenAI SDK — 同上
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: { create: mockOpenAICreate },
    },
  })),
}));

// Reset call counts between tests so they don't interfere with each other
// 每个测试前重置调用记录，避免测试之间互相影响
beforeEach(() => {
  vi.clearAllMocks();
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

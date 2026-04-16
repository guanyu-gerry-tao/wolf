import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_OPENAI_MODEL = "gpt-4o";

/**
 * Internal contract for all provider implementations.
 * Update this type to have TypeScript enforce the change across all implementations.
 */
type ProviderClient = (
  prompt: string,
  systemPrompt?: string,
  model?: string,
) => Promise<string>;

/**
 * Unified AI call. Routes to the correct provider based on options.
 * Use this in all wolf commands — do NOT call anthropicClient/openaiClient directly.
 *
 * @param prompt - User message
 * @param systemPrompt - Optional system instruction
 * @param options - provider defaults to 'anthropic'; model defaults to provider's default
 */
export async function aiClient(
  prompt: string,
  systemPrompt?: string,
  options?: {
    provider?: 'anthropic' | 'openai';
    model?: string;
  }
): Promise<string> {
  const provider = options?.provider ?? 'anthropic';
  const model = options?.model;

  switch (provider) {
    case 'openai':     return openaiClient(prompt, systemPrompt, model);
    case 'anthropic':  return anthropicClient(prompt, systemPrompt, model);
  }
}

/**
 * Calls Claude (Anthropic) and returns the reply text.
 */
export const anthropicClient: ProviderClient = async (
  prompt,
  systemPrompt,
  model = DEFAULT_ANTHROPIC_MODEL,
) => {
  const client = new Anthropic({ apiKey: process.env.WOLF_ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{ role: "user", content: prompt }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
}

/**
 * Calls GPT (OpenAI) and returns the reply text.
 */
export const openaiClient: ProviderClient = async (
  prompt,
  systemPrompt,
  model = DEFAULT_OPENAI_MODEL,
) => {
  const client = new OpenAI({ apiKey: process.env.WOLF_OPENAI_API_KEY });
  const messages: ChatCompletionMessageParam[] = [];
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt });
  messages.push({ role: "user", content: prompt });
  const response = await client.chat.completions.create({
    model,
    messages,
  });
  return response.choices[0].message.content ?? "";
}
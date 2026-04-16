import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import type { FamilyCall } from './types.js';

/**
 * Covers OpenAI itself plus any OpenAI-compatible endpoint (Groq, Together,
 * OpenRouter, vLLM, Ollama, LM Studio, llama.cpp server, custom proxies).
 * baseURL, when provided, overrides the default openai.com endpoint.
 */
export const callOpenAiCompat: FamilyCall = async ({ prompt, systemPrompt, model, apiKey, baseURL }) => {
  const client = new OpenAI({ apiKey, baseURL });
  const messages: ChatCompletionMessageParam[] = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  messages.push({ role: 'user', content: prompt });
  const response = await client.chat.completions.create({ model, messages });
  return response.choices[0].message.content ?? '';
};

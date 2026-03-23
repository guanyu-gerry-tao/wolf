/**
 * AIClient — 所有 AI 提供商的统一函数签名。
 *
 * prompt       : 用户的消息
 * systemPrompt : 可选，设定 AI 行为的系统指令
 * 返回值        : AI 的回复文本
 */
export type AIClient = (
  prompt: string,
  systemPrompt?: string,
) => Promise<string>;

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

/**
 * 调用 Claude（Anthropic）并返回回复文本。
 */
export const anthropicClient: AIClient = async (prompt, systemPrompt) => {
  const client = (Anthropic as any)();
  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{ role: "user", content: prompt }],
  });
  return response.content[0].type === "text" ? response.content[0].text : "";
};

/**
 * 调用 GPT（OpenAI）并返回回复文本。
 */
export const openaiClient: AIClient = async (prompt, systemPrompt) => {
  const client = (OpenAI as any)();
  const messages: { role: string; content: string }[] = [];
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }
  messages.push({ role: "user", content: prompt });
  const response = await client.chat.completions.create({
    model: "gpt-4o",
    messages,
  });
  return response.choices[0].message.content ?? "";
};
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

/**
 * 调用 Claude（Anthropic）并返回回复文本。
 * TODO: 使用 @anthropic-ai/sdk 实现
 */
export const anthropicClient: AIClient = async (_prompt, _systemPrompt) => {
  // _ 前缀表示参数未使用，避免编译器警告，完成后记得去掉
  throw new Error("not implemented");
};

/**
 * 调用 GPT（OpenAI）并返回回复文本。
 * TODO: 使用 openai 实现
 */
export const openaiClient: AIClient = async (_prompt, _systemPrompt) => {
  // _ 前缀表示参数未使用，避免编译器警告，完成后记得去掉
  throw new Error("not implemented");
};

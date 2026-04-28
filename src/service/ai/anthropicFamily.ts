import Anthropic from '@anthropic-ai/sdk';
import type { FamilyCall } from './types.js';

export const callAnthropic: FamilyCall = async ({ prompt, systemPrompt, model, apiKey }) => {
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    ...(systemPrompt ? { system: systemPrompt } : {}),
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content[0].type === 'text' ? response.content[0].text : '';
};

import Anthropic from '@anthropic-ai/sdk';
import type { MessageBatchIndividualResponse } from '@anthropic-ai/sdk/resources/messages/batches';
import type { ContentBlock } from '@anthropic-ai/sdk/resources/messages/messages';
import type { BatchAiCallOptions, BatchAiCallRequest } from '../../batchService.js';
import type {
  BatchProviderAdapter,
  ProviderBatchItemResult,
  ProviderBatchStatus,
} from './batchProviderAdapter.js';

/** Anthropic Message Batches adapter. */
export class AnthropicBatchProviderAdapter implements BatchProviderAdapter {
  private readonly client: Anthropic;

  constructor(apiKey: string | undefined = process.env.WOLF_ANTHROPIC_API_KEY) {
    this.client = new Anthropic({ apiKey });
  }

  /** @inheritdoc */
  async submit(requests: BatchAiCallRequest[], options: BatchAiCallOptions): Promise<string> {
    const batch = await this.client.messages.batches.create({
      requests: requests.map((request) => ({
        custom_id: request.customId,
        params: {
          model: options.model,
          max_tokens: options.maxTokens ?? 4096,
          ...(request.systemPrompt ? { system: request.systemPrompt } : {}),
          messages: [{ role: 'user' as const, content: request.prompt }],
        },
      })),
    });
    return batch.id;
  }

  /** @inheritdoc */
  async retrieve(providerBatchId: string): Promise<ProviderBatchStatus> {
    const batch = await this.client.messages.batches.retrieve(providerBatchId);
    return batch.processing_status === 'ended' ? 'ended' : 'pending';
  }

  /** @inheritdoc */
  async results(providerBatchId: string): Promise<ProviderBatchItemResult[]> {
    const resultStream = await this.client.messages.batches.results(providerBatchId);
    const rows: MessageBatchIndividualResponse[] = [];

    for await (const row of resultStream as AsyncIterable<MessageBatchIndividualResponse>) {
      rows.push(row);
    }

    return rows.map(normalizeResult);
  }
}

function normalizeResult(row: MessageBatchIndividualResponse): ProviderBatchItemResult {
  switch (row.result.type) {
    case 'succeeded':
      return {
        customId: row.custom_id,
        status: 'succeeded',
        resultText: textFromContentBlocks(row.result.message.content),
        errorMessage: null,
      };
    case 'errored':
      return {
        customId: row.custom_id,
        status: 'errored',
        resultText: null,
        errorMessage: anthropicErrorMessage(row.result.error),
      };
    case 'canceled':
      return { customId: row.custom_id, status: 'canceled', resultText: null, errorMessage: 'canceled' };
    case 'expired':
      return { customId: row.custom_id, status: 'expired', resultText: null, errorMessage: 'expired' };
  }
}

function anthropicErrorMessage(error: { error?: { message?: string }; message?: string }): string {
  return error.error?.message ?? error.message ?? 'errored';
}

function textFromContentBlocks(content: ContentBlock[]): string {
  return content
    .filter((block): block is Extract<ContentBlock, { type: 'text' }> => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

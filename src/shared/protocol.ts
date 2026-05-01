import { z } from 'zod';

export const PingRequestSchema = z.object({
  nonce: z.string().min(1),
});
export type PingRequest = z.infer<typeof PingRequestSchema>;

export const PingResponseSchema = z.object({
  nonce: z.string(),
  serverTime: z.string().datetime(),
  version: z.string(),
});
export type PingResponse = z.infer<typeof PingResponseSchema>;

export const ManualPageInboxRequestSchema = z.object({
  kind: z.literal('manual_page').default('manual_page'),
  source: z.literal('wolf_companion').default('wolf_companion'),
  title: z.string().optional(),
  url: z.string().url(),
  html: z.string().min(1),
  capturedAt: z.string().datetime(),
});
export type ManualPageInboxRequest = z.infer<typeof ManualPageInboxRequestSchema>;

export const HuntRunInboxRequestSchema = z.object({
  kind: z.literal('hunt_result').default('hunt_result'),
  provider: z.string().min(1),
  receivedAt: z.string().datetime(),
  results: z.array(z.unknown()),
});
export type HuntRunInboxRequest = z.infer<typeof HuntRunInboxRequestSchema>;

export const InboxPromoteRequestSchema = z.object({
  limit: z.number().int().min(1).max(500).default(20),
  provider: z.enum(['anthropic', 'openai']).default('anthropic'),
  shardSize: z.number().int().min(1).max(20).default(20),
});
export type InboxPromoteRequest = z.infer<typeof InboxPromoteRequestSchema>;

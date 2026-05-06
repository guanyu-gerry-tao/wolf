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

export const RuntimeStatusResponseSchema = z.object({
  version: z.string(),
  workspacePath: z.string(),
  browser: z.object({
    status: z.enum(['not_started', 'wrong_instance', 'ready', 'todo']),
    detail: z.string(),
    requiredAction: z.string(),
  }),
  profile: z.object({
    status: z.enum(['unknown', 'ready', 'not_ready']),
  }),
  features: z.record(z.string(), z.boolean()),
});
export type RuntimeStatusResponse = z.infer<typeof RuntimeStatusResponseSchema>;

export const ArtifactSlotResponseSchema = z.object({
  status: z.enum(['not_ready', 'ready']),
  url: z.string().nullable(),
});
export type ArtifactSlotResponse = z.infer<typeof ArtifactSlotResponseSchema>;

export const RunStatusResponseSchema = z.object({
  runId: z.string().min(1),
  status: z.enum(['queued', 'running', 'waiting_ai', 'ready', 'failed', 'todo']),
  type: z.string().optional(),
  itemCount: z.number().int().nonnegative().optional(),
  error: z.string().nullable().optional(),
  artifacts: z.object({
    resume: ArtifactSlotResponseSchema,
    coverLetter: ArtifactSlotResponseSchema,
  }).optional(),
});
export type RunStatusResponse = z.infer<typeof RunStatusResponseSchema>;

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

export const QuickTailorRequestSchema = z.object({
  jobId: z.string().min(1),
  userPrompt: z.string().optional(),
  artifactTargets: z.array(z.enum(['resume', 'cover_letter'])).default(['resume', 'cover_letter']),
});
export type QuickTailorRequest = z.infer<typeof QuickTailorRequestSchema>;

export const BatchTailorRequestSchema = z.object({
  jobIds: z.array(z.string().min(1)).optional(),
  statusFilter: z.string().optional(),
  userPrompt: z.string().optional(),
});
export type BatchTailorRequest = z.infer<typeof BatchTailorRequestSchema>;

export const RegenerateArtifactRequestSchema = z.object({
  jobId: z.string().min(1),
  artifactType: z.enum(['resume', 'cover_letter']),
  existingArtifactText: z.string(),
  userPrompt: z.string().min(1),
});
export type RegenerateArtifactRequest = z.infer<typeof RegenerateArtifactRequestSchema>;

export const QuickFillRequestSchema = z.object({
  jobId: z.string().min(1),
  tabId: z.union([z.string(), z.number()]).nullable().optional(),
  userPrompt: z.string().optional(),
});
export type QuickFillRequest = z.infer<typeof QuickFillRequestSchema>;

/**
 * `POST /api/score` request body. Mirrors `ScoreOptions` from
 * `src/utils/types/commands.ts` so the HTTP surface is the same as the CLI:
 * one verb, one shape. Every field is optional — `{}` is a valid request and
 * triggers default-mode batch submission for every unscored job.
 */
export const ScoreRequestSchema = z.object({
  profileId: z.string().min(1).optional(),
  jobIds: z.array(z.string().min(1)).optional(),
  poll: z.boolean().optional(),
  single: z.boolean().optional(),
  aiModel: z.string().min(1).optional(),
});
export type ScoreRequest = z.infer<typeof ScoreRequestSchema>;

/** `POST /api/score` response — mirrors `ScoreResult` (v3 tier model). */
export const ScoreResponseSchema = z.object({
  submitted: z.number().int().nonnegative(),
  polled: z.number().int().nonnegative().optional(),
  singleTier: z.number().int().min(0).max(3).optional(),
  singleTierName: z.enum(['skip', 'mass_apply', 'tailor', 'invest']).optional(),
  singleMd: z.string().optional(),
});
export type ScoreResponse = z.infer<typeof ScoreResponseSchema>;

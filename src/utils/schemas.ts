import { z } from 'zod';
import { PROVIDER_IDS } from './ai/registry.js';

// --- AppConfig ---

// Model reference format: "<provider>/<model>"
// Regex is built from the PROVIDERS registry so adding a provider there
// automatically widens what wolf.toml accepts.
// Exported so tests can assert the regex and parseModelRef stay in agreement.
const PROVIDER_PATTERN = PROVIDER_IDS.join('|');
export const ModelRefSchema = z.string().regex(
  new RegExp(`^(${PROVIDER_PATTERN})\\/.+$`),
  `Model must be "<provider>/<model>" where provider is one of ${PROVIDER_IDS.join(', ')}`,
);

const DEFAULT_SONNET = 'anthropic/claude-sonnet-4-6';
const DEFAULT_HAIKU  = 'anthropic/claude-haiku-4-5-20251001';

export const AppConfigSchema = z.object({
  instance: z.object({
    mode: z.enum(['stable', 'dev']),
  }).optional(),
  // The folder name of the default profile under `profiles/<name>/`. Repository
  // throws at read time if the directory doesn't exist (renamed/missing).
  default: z.string(),
  hunt: z.object({
    minScore: z.number().min(0).max(1).default(0.5),
    maxResults: z.number().positive().default(50),
  }).default({ minScore: 0.5, maxResults: 50 }),
  tailor: z.object({
    model: ModelRefSchema.default(DEFAULT_SONNET),
    defaultCoverLetterTone: z.string().default('professional'),
  }).default({ model: DEFAULT_SONNET, defaultCoverLetterTone: 'professional' }),
  score: z.object({
    model: ModelRefSchema.default(DEFAULT_SONNET),
  }).default({ model: DEFAULT_SONNET }),
  reach: z.object({
    model: ModelRefSchema.default(DEFAULT_SONNET),
    defaultEmailTone: z.string().default('professional'),
    maxEmailsPerDay: z.number().positive().default(10),
  }).default({ model: DEFAULT_SONNET, defaultEmailTone: 'professional', maxEmailsPerDay: 10 }),
  fill: z.object({
    model: ModelRefSchema.default(DEFAULT_HAIKU),
  }).default({ model: DEFAULT_HAIKU }),
});

import { z } from 'zod';
import { PROVIDER_IDS } from '../service/ai/registry.js';

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
  // Workspace schema version. Bumped by wolf releases that introduce a
  // breaking workspace-format change (e.g. when a future release migrates
  // profile.md to profile.toml). Missing field is treated as v1 (the
  // pre-migration baseline) by the migrations runtime — see
  // `src/runtime/migrations/`. Users upgrade by running `wolf migrate`.
  schemaVersion: z.number().int().positive().default(1),
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
  }).default({ model: DEFAULT_SONNET }),
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
  companion: z.object({
    servePort: z.number().int().min(1024).max(65535).default(47823),
    maxStagehandSessions: z.number().int().min(1).max(10).default(3),
    browserMode: z.enum(['wolf_persistent_profile']).default('wolf_persistent_profile'),
  }).default({
    servePort: 47823,
    maxStagehandSessions: 3,
    browserMode: 'wolf_persistent_profile',
  }),
});

import { z } from 'zod';
import { PROVIDER_IDS } from './ai/registry.js';

// --- Sponsorship enums ---
// Free-form string — common values are H-1B, L1, OPT, CPT, "no limit",
// but users may enter multi-status or non-US equivalents.
export const StatusSchema = z.string().min(1);
export const SponsorshipSchema = z.enum([
  'no sponsorship',
  'Green card',
  'Work visa',
  'OPT',
  'CPT',
]);

// --- UserProfile ---
// Empty-string-to-null transform mirrors the firstUrl/secondUrl pattern below:
// optional fields always appear in profile.toml as `key = ""` so users can see
// and fill them in, but the runtime model treats empty as absent.
const optionalString = () =>
  z.string().nullable().default(null).transform(v => v === '' ? null : v);

export const UserProfileSchema = z.object({
  id: z.string(),
  label: z.string(),
  // Name split into legal + display fields — see UserProfile interface for
  // semantics; render via displayName() / legalFullName() in utils/profileName.ts.
  // Accepts "" so `wolf init --empty` can write a placeholder profile.toml that
  // still parses; interactive `wolf init` prompts enforce non-empty via validate().
  legalFirstName: z.string(),
  legalMiddleName: optionalString(),
  legalLastName: z.string(),
  preferredName: optionalString(),
  pronouns: optionalString(),
  email: z.union([z.literal(''), z.string().email()]),
  phone: z.string(),
  // Empty string is treated as absent — written as "" when null so the field
  // always appears in profile.toml, making it visible and easy to fill in later.
  firstUrl: z.string().nullable().default(null).transform(v => v === '' ? null : v),
  secondUrl: z.string().nullable().default(null).transform(v => v === '' ? null : v),
  thirdUrl: z.string().nullable().default(null).transform(v => v === '' ? null : v),
  immigrationStatus: StatusSchema,
  willingToRelocate: z.string(),
  targetRoles: z.array(z.string()),
  targetLocations: z.array(z.string()),
  scoringNotes: z.string().nullable().default(null).transform(v => v === '' ? null : v),
});

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
  defaultProfileId: z.string(),
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

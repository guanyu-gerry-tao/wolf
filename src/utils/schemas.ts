import { z } from 'zod';

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
export const UserProfileSchema = z.object({
  id: z.string(),
  label: z.string(),
  name: z.string(),
  email: z.string().email(),
  phone: z.string(),
  // Empty string is treated as absent — written as "" when null so the field
  // always appears in profile.toml, making it visible and easy to fill in later.
  firstUrl: z.string().nullable().default(null).transform(v => v === '' ? null : v),
  secondUrl: z.string().nullable().default(null).transform(v => v === '' ? null : v),
  thirdUrl: z.string().nullable().default(null).transform(v => v === '' ? null : v),
  immigrationStatus: StatusSchema,
  willingToRelocate: z.boolean(),
  targetRoles: z.array(z.string()),
  targetLocations: z.array(z.string()),
  scoringNotes: z.string().nullable().default(null).transform(v => v === '' ? null : v),
});

// --- AppConfig ---
export const AppConfigSchema = z.object({
  defaultProfileId: z.string(),
  ai: z.object({
    provider: z.enum(['anthropic', 'openai']).default('anthropic'),
    model: z.string().default('claude-sonnet-4-6'),
  }).default({ provider: 'anthropic', model: 'claude-sonnet-4-6' }),
  hunt: z.object({
    minScore: z.number().min(0).max(1).default(0.5),
    maxResults: z.number().positive().default(50),
  }),
  tailor: z.object({
    defaultCoverLetterTone: z.string().default('professional'),
  }),
  reach: z.object({
    defaultEmailTone: z.string().default('professional'),
    maxEmailsPerDay: z.number().positive().default(10),
  }),
});

import { z } from 'zod';

// --- Sponsorship enums ---
export const StatusSchema = z.enum(['H-1B', 'L1', 'OPT', 'CPT', 'no limit']);
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
  firstUrl: z.string().nullable().default(null),
  secondUrl: z.string().nullable().default(null),
  thirdUrl: z.string().nullable().default(null),
  immigrationStatus: StatusSchema,
  willingToRelocate: z.boolean(),
  targetRoles: z.array(z.string()),
  targetLocations: z.array(z.string()),
  scoringNotes: z.string().nullable().default(null),
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

import { Status } from "./sponsorship.js";

/**
 * A complete identity used when applying.
 * Wolf supports multiple profiles to handle ATS workarounds, different
 * immigration statuses, or name variants.
 *
 * Each profile lives in profiles/<id>/profile.toml inside the workspace.
 */
export interface UserProfile {
  id: string; // e.g. "default", "gc-persona"
  label: string; // human-readable name of the profile, e.g. "Default", "Green Card"
  name: string; // full name as on resume;
  email: string;
  phone: string; // required — most forms demand a phone number
  firstUrl: string | null; // e.g. LinkedIn
  secondUrl: string | null; // e.g. GitHub
  thirdUrl: string | null; // e.g. personal website
  immigrationStatus: Status; // required — affects scoring; e.g. "F-1 OPT", "US citizen"
  willingToRelocate: string;  // e.g. "yes" / "no" / "domestic only" / "open to relocation"
  targetRoles: string[]; // e.g. ["Software Engineer", "Full Stack Developer"]
  targetLocations: string[]; // e.g. ["NYC", "SF", "Remote"]
  scoringNotes: string | null; // free-form notes to AI, e.g. "prefer backend, open to hybrid"
}

/**
 * Per-command model reference in wolf.toml: "<provider>/<model>" format.
 * e.g. "anthropic/claude-sonnet-4-6", "openai/gpt-4o".
 * Parsed into AiConfig at the config-load boundary via parseModelRef().
 */
export type ModelRef = string;

/**
 * Top-level config loaded from wolf.toml on startup.
 * Profiles are stored as separate files under profiles/<id>/ — not embedded here.
 * default* fields are baselines — individual command runs can override them via options.
 */
export interface AppConfig {
  defaultProfileId: string;            // which profile folder to use by default
  hunt: {
    minScore: number;                  // default 0.5
    maxResults: number;                // default 50
  };
  tailor: {
    model: ModelRef;                   // default "anthropic/claude-sonnet-4-6"
    defaultCoverLetterTone: string;    // e.g. "professional", "conversational"
  };
  score: {
    model: ModelRef;                   // default "anthropic/claude-sonnet-4-6"
  };
  reach: {
    model: ModelRef;                   // default "anthropic/claude-sonnet-4-6"
    defaultEmailTone: string;          // e.g. "professional", "casual"
    maxEmailsPerDay: number;           // safety limit, default 10
  };
  fill: {
    model: ModelRef;                   // default "anthropic/claude-haiku-4-5-20251001"
  };
}

/** AI provider + model split for a single service call. */
export interface AiConfig {
  provider: 'anthropic' | 'openai';
  model: string;
}

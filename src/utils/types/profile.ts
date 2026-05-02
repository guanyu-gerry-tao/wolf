import type { ProviderId } from "../../service/ai/registry.js";

/**
 * A profile = one identity directory under `profiles/<name>/`.
 *
 * The directory name IS the identifier — it's used as the foreign key from
 * `jobs.applied_profile_id` and as the value of `wolf.toml.default`. There is
 * no separate `id` field stored anywhere.
 *
 * `md` is the full text of `profiles/<name>/profile.md` — the single source of
 * identity facts (name, contact, address, demographics, work auth, clearance).
 * AI agents (tailor / fill / outreach) consume it verbatim as prompt context.
 *
 * Two sibling files live next to `profile.md` in the same directory:
 *   - `resume_pool.md`        — full experience bank (read by tailor)
 *   - `standard_questions.md` — application-only Q&A and document pointers
 * Plus an `attachments/` folder holding files referenced by standard_questions.md.
 */
export interface Profile {
  name: string;  // directory name, e.g. "default" or "gc-persona"
  md: string;    // full text of profile.md
}

/**
 * Per-command model reference in wolf.toml: "<provider>/<model>" format.
 * e.g. "anthropic/claude-sonnet-4-6", "openai/gpt-4o".
 * Parsed into AiConfig at the config-load boundary via parseModelRef().
 */
export type ModelRef = string;

/**
 * Top-level config loaded from wolf.toml on startup.
 * Profiles are stored as separate directories under `profiles/<name>/` — not embedded here.
 * default* fields are baselines — individual command runs can override them via options.
 */
export interface AppConfig {
  // Workspace schema version. Bumped by wolf releases that introduce a
  // breaking workspace-format change. Missing field is treated as v1
  // (the pre-migration baseline). See `src/runtime/migrations/`.
  schemaVersion: number;
  instance?: {
    mode: 'stable' | 'dev';
  };
  default: string;                     // which profile folder is the default (must exist on disk)
  hunt: {
    minScore: number;                  // default 0.5
    maxResults: number;                // default 50
  };
  tailor: {
    model: ModelRef;                   // default "anthropic/claude-sonnet-4-6"
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
  companion: {
    servePort: number;                  // default local daemon port for the browser extension
    maxStagehandSessions: number;       // planned LOCAL Stagehand parallelism cap
    browserMode: 'wolf_persistent_profile'; // wolf-controlled Chrome profile only
  };
}

/** AI provider + model split for a single service call. */
export interface AiConfig {
  provider: ProviderId;
  model: string;
}

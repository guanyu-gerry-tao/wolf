import type { AiConfig, Profile } from '../utils/types/index.js';

/**
 * Produces a "tailoring brief" — a structured Markdown decision doc that the
 * downstream resume and cover-letter writers both read. The brief captures
 * which roles/projects to emphasize, the 3 core themes, and a cover-letter
 * angle, so the two writers tell the same story.
 */
export interface TailoringBriefService {
  /**
   * Runs the analyst agent. Returns the brief Markdown.
   *
   * @param resumePool  Full candidate pool (Markdown)
   * @param jdText      Job description text
   * @param profile     Candidate identity (name + profile.md content). The
   *                    analyst includes the full profile.md verbatim as
   *                    context — it surfaces target roles, narrative, and
   *                    contact details for the brief.
   * @param aiConfig    Provider + model routing for this call
   * @param hint        Optional user guidance. When present, injected into
   *                    the user prompt under "## User Guidance" and treated
   *                    as authoritative by the analyst.
   */
  analyze(
    resumePool: string,
    jdText: string,
    profile: Profile,
    aiConfig: AiConfig,
    hint?: string,
  ): Promise<string>;
}

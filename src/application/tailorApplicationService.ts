import type { TailorOptions, TailorResult } from '../utils/types/index.js';

/** Result of the brief step — the absolute path to `tailoring-brief.md`. */
export interface AnalyzeResult {
  briefPath: string;
}

/** Result of a writer step (resume or cover letter) — the rendered HTML + PDF. */
export interface WriteStepResult {
  htmlPath: string;
  pdfPath: string;
}

/**
 * Use case for `wolf tailor` — the 3-agent checkpoint pipeline that takes
 * a `(profile, resume_pool, JD)` triple and produces a tailored resume +
 * cover letter as both HTML (editable checkpoint) and PDF (final).
 *
 * The pipeline is exposed both as a one-shot (`tailor`) and as discrete
 * steps (`analyze` → `writeResume` / `writeCoverLetter`) so users can
 * inspect or hand-edit `tailoring-brief.md` before the writers run.
 */
export interface TailorApplicationService {
  /**
   * Full pipeline: analyze -> brief -> (resume + cover letter in parallel).
   * @throws if job not found, AI fails, or render fails
   */
  tailor(options: TailorOptions): Promise<TailorResult>;

  /**
   * Step 1: produce the tailoring brief only. Writes data/<jobId>/src/tailoring-brief.md.
   * Useful for "check the brief before committing to a full rewrite".
   */
  analyze(options: TailorOptions): Promise<AnalyzeResult>;

  /**
   * Step 2a: write resume HTML + PDF using the existing brief on disk.
   * @throws if the brief file is missing (run `wolf tailor brief` first)
   */
  writeResume(options: TailorOptions): Promise<WriteStepResult>;

  /**
   * Step 2b: write cover letter HTML + PDF using the existing brief on disk.
   * @throws if the brief file is missing (run `wolf tailor brief` first)
   */
  writeCoverLetter(options: TailorOptions): Promise<WriteStepResult>;
}

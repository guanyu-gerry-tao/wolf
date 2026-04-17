import type { TailorOptions, TailorResult } from '../types/index.js';

export interface AnalyzeResult {
  briefPath: string;
}

export interface WriteStepResult {
  htmlPath: string;
  pdfPath: string;
}

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

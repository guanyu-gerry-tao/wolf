import type { Company, CompanyQuery, CompanyUpdate } from "../utils/types/company.js";

/**
 * Repository for the `companies` table plus per-company workspace files.
 * Companies are first-class entities (multiple jobs share one row); the
 * `reach` flow uses domain + LinkedIn URL to draft outreach.
 */
export interface CompanyRepository {
  /** Fetches one company by id, or `null` if missing. */
  get(id: string): Promise<Company | null>;
  /** Looks up a company by exact name match (case-sensitive). */
  getByName(name: string): Promise<Company | null>;
  /** Inserts or updates a company row keyed on `id`. */
  upsert(company: Company): Promise<void>;
  /** Partial update — touches only the fields named in `patch`. */
  update(id: string, patch: CompanyUpdate): Promise<void>;
  /** Filtered list query. Empty `q` returns every row. */
  query(q: CompanyQuery): Promise<Company[]>;

  /**
   * Resolve the absolute workspace directory for a company.
   * Layout: `<workspace>/data/companies/<name>_<companyIdShort>/`.
   */
  getWorkspaceDir(id: string): Promise<string>;

  /**
   * Read the free-form notes stored at `<workspaceDir>/info.md` for a company.
   * Comment lines (`//`) are preserved — callers strip them before feeding AI.
   * Returns the file body as-is; empty string if the file has no content beyond
   * whitespace. Throws only on unexpected I/O errors.
   */
  readInfo(id: string): Promise<string>;
}

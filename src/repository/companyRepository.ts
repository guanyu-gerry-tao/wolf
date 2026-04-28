import type { Company, CompanyQuery, CompanyUpdate } from "../utils/types/company.js";

export interface CompanyRepository {
  get(id: string): Promise<Company | null>;
  getByName(name: string): Promise<Company | null>;
  upsert(company: Company): Promise<void>;
  update(id: string, patch: CompanyUpdate): Promise<void>;
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

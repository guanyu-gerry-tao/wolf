import type { Company, CompanyQuery, CompanyUpdate } from "../types/company.js";

export interface CompanyRepository {
  get(id: string): Promise<Company | null>;
  getByName(name: string): Promise<Company | null>;
  upsert(company: Company): Promise<void>;
  update(id: string, patch: CompanyUpdate): Promise<void>;
  query(q: CompanyQuery): Promise<Company[]>;
}

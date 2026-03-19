/**
 * Numeric company size tier — designed to be comparable.
 * 1 = startup (<50), 2 = small (50–500), 3 = mid (500–5000), 4 = bigtech (5000+)
 */
export type CompanySize = 1 | 2 | 3 | 4;

/**
 * A company is a first-class entity stored separately from jobs.
 * Multiple jobs from the same company share one Company record.
 * The domain field is used by the reach command to infer email patterns.
 */
export interface Company {
  id: string;                          // uuid
  name: string;                        // e.g. "TikTok", "Google"
  domain: string | null;               // e.g. "tiktok.com"
  linkedinUrl: string | null;
  size: CompanySize | null;
  industry: string | null;             // e.g. "Software", "Finance"
  headquartersLocation: string | null; // e.g. "Mountain View, CA"
  notes: string | null;                // user's personal notes
  createdAt: string;                   // ISO 8601
  updatedAt: string;                   // ISO 8601
}

export interface CompanyQuery {
  size?: CompanySize | CompanySize[];
  industry?: string;
  limit?: number;
  offset?: number;
}

export interface CompanyUpdate {
  name?: string;
  domain?: string | null;
  linkedinUrl?: string | null;
  size?: CompanySize | null;
  industry?: string | null;
  headquartersLocation?: string | null;
  notes?: string | null;
}

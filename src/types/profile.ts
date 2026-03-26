import type { CompanySize } from "./company.js";

/**
 * Per-profile scoring configuration.
 *
 * Scoring is a hybrid model:
 * - AI scores roleMatch (semantic understanding of JD vs. target roles/skills)
 * - Algorithm scores everything else (workAuth, location, remote, salary, companySize)
 * - weights are the algorithm's coefficients; AI never sees them
 *
 * Dealbreakers run before scoring — a job that trips one is immediately
 * set to "filtered" and never scored, saving AI API calls.
 */
export interface ScoringPreferences {
  /** Anchors that the algorithm measures deviation from. */
  preferences: {
    minSalary: number | null;            // minimum acceptable annual salary in USD
    preferredCompanySizes: CompanySize[]; // e.g. [3, 4] = mid or bigtech; [] = no preference
  };

  /** Weight of each factor in the final score (0.0–1.0; ideally sum to 1.0). */
  weights: {
    workAuth: number;    // auth match vs. profile immigrationStatus
    roleMatch: number;   // AI's semantic role relevance score
    location: number;    // location match vs. profile targetLocations
    remote: number;      // remote preference match
    salary: number;      // salary vs. preferences.minSalary
    companySize: number; // company size proximity to preferences.preferredCompanySizes
  };

  /**
   * Hard filters — evaluated before scoring.
   * true  = must have this property
   * false = must NOT have this property
   * null  = no filter
   */
  dealbreakers: {
    /** true = must offer sponsorship; false = must NOT sponsor; null = don't care */
    sponsorship: boolean | null;
    /** true = must be remote; false = must be on-site; null = don't care */
    remote: boolean | null;
  };
}

/**
 * A complete identity used when applying.
 * Wolf supports multiple profiles to handle ATS workarounds, different
 * immigration statuses, or name variants.
 *
 * Multiple profiles can share the same base .tex resume — wolf always
 * injects this profile's contact info into the resume header at generation time.
 */
export interface UserProfile {
  id: string;                      // e.g. "default", "gc-persona"
  label: string;                   // human-readable, e.g. "Default", "Green Card"
  name: string;
  alternateName: string[];         // other names used on applications
  email: string;
  alternateEmail: string[];
  phone: string;                   // required — most forms demand a phone number
  alternatePhone: string[];
  linkedinUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  immigrationStatus: string;       // required — affects scoring; e.g. "F-1 OPT", "US citizen"
  currentCity: string | null;
  willingToRelocate: boolean;
  workAuthTimeline: string | null; // e.g. "OPT starts May 2026"
  targetRoles: string[];           // e.g. ["Software Engineer", "Full Stack Developer"]
  targetLocations: string[];       // e.g. ["NYC", "SF", "Remote"]
  skills: string[];
  resumePath: string;              // path to base .tex; contact header is injected from this profile
  /** Path to portfolio PDF. Wolf reads this file only — never modifies it. Must be .pdf. */
  portfolioPath: string | null;
  /** Path to transcript PDF. Wolf reads this file only — never modifies it. Must be .pdf. */
  transcriptPath: string | null;
  targetedCompanyIds: string[];    // companies actively watched; jobs from these get a scoring boost
  scoringPreferences: ScoringPreferences;
}

export interface ProviderConfig {
  enabled: boolean;
  strategy?: string; // provider-specific, e.g. "email" for handshake
}

/**
 * Top-level config loaded from ~/.wolf/config.json on startup.
 * default* fields are baselines — individual command runs can override them via options.
 */
export interface AppConfig {
  profiles: UserProfile[];          // at least one required
  defaultProfileId: string;
  providers: Record<string, ProviderConfig>;
  hunt: {
    minScore: number;               // default 0.5
    maxResults: number;             // default 50
  };
  tailor: {
    defaultTemplatePath: string | null;
    defaultCoverLetterTone: string; // e.g. "professional", "conversational"
  };
  reach: {
    defaultEmailTone: string;       // e.g. "professional", "casual"
    maxEmailsPerDay: number;        // safety limit, default 10
  };
}

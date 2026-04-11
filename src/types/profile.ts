import type { CompanySize } from "./company.js";
import { Status } from "./sponsorship.js";

/**
 * A complete identity used when applying.
 * Wolf supports multiple profiles to handle ATS workarounds, different
 * immigration statuses, or name variants.
 *
 * Multiple profiles can share the same base .tex resume — wolf always
 * injects this profile's contact info into the resume header at generation time.
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
  willingToRelocate: boolean;
  targetRoles: string[]; // e.g. ["Software Engineer", "Full Stack Developer"]
  targetLocations: string[]; // e.g. ["NYC", "SF", "Remote"]
}

// TODO: after finish other parts, come back
/**
 * Top-level config loaded from ~/.wolf/config.json on startup.
 * default* fields are baselines — individual command runs can override them via options.
 */
export interface AppConfig {
  profiles: UserProfile[]; // at least one required
  defaultProfileId: string;
  // TODO: provider setting
  hunt: {
    minScore: number; // default 0.5
    maxResults: number; // default 50
  };
  tailor: {
    defaultTemplatePath: string | null;
    defaultCoverLetterTone: string; // e.g. "professional", "conversational"
  };
  reach: {
    defaultEmailTone: string; // e.g. "professional", "casual"
    maxEmailsPerDay: number; // safety limit, default 10
  };
}

# Types — wolf

This document defines the shared TypeScript types used across all layers of wolf. These types live in `src/types/index.ts` and serve as the contract between CLI, MCP, commands, and storage layers.

Think of this file as the **data dictionary** for the whole project — if you want to know what a "Job" or "UserProfile" looks like in memory, this is the place to look.

---

## Core Domain Types

### `JobStatus`

Tracks where a job is in your personal pipeline, from first discovery to final outcome. Wolf uses this to filter, sort, and decide what actions are available.

```typescript
type JobStatus = "new" | "reviewed" | "ignored" | "filtered" | "applied" | "interview" | "offer" | "rejected";
```

Lifecycle:

```
new  →  reviewed  →  applied  →  interview  →  offer
     →  ignored               →  rejected
     →  filtered  (auto, by dealbreakers)
```

- `new`: just found by wolf, not yet looked at by the user
- `reviewed`: user has seen it and not dismissed it — the next step is to apply
- `ignored`: user manually dismissed it; kept in the database so the user can recover it later
- `filtered`: automatically dismissed by wolf's dealbreaker rules (e.g. no sponsorship); also kept in the database and recoverable — distinct from `ignored` so you can tell whether wolf or you made the call
- `applied`: application submitted
- `interview`: the company reached out for an interview
- `offer`: received an offer
- `rejected`: the company passed, or the user withdrew

---

### `CompanySize`

A numeric scale representing company headcount, designed to be comparable and sortable. Higher numbers mean larger companies.

```typescript
type CompanySize = 1 | 2 | 3 | 4;
// 1 = startup   (<50 employees)
// 2 = small     (50–500)
// 3 = mid       (500–5000)
// 4 = bigtech   (5000+)
```

Using numbers means you can write comparisons like `companySize >= 3` (mid or larger) in filters.

---

### `Company`

A company is a first-class entity, stored separately from jobs. This allows:
- Multiple jobs to share the same company record without duplicating size, domain, or notes
- Users to target specific companies (e.g. always watch TikTok's postings) independent of any individual job
- The `reach` command to infer email patterns from `domain`

```typescript
interface Company {
  id: string;                         // unique ID (uuid)
  name: string;                       // e.g. "TikTok", "Google"
  domain: string | null;              // e.g. "tiktok.com" — used to infer email patterns in reach
  linkedinUrl: string | null;         // company LinkedIn page URL
  size: CompanySize | null;           // company size tier; null if unknown
  industry: string | null;            // e.g. "Software", "Finance", "Healthcare"
  headquartersLocation: string | null; // e.g. "Mountain View, CA"
  notes: string | null;               // user's personal notes about this company
  createdAt: string;                  // ISO 8601 timestamp
  updatedAt: string;                  // ISO 8601 timestamp
}
```

---

### `Salary`

Annual compensation in USD, or the literal string `"unpaid"` for internships or volunteer roles. Using a union type forces the code to handle both cases explicitly rather than treating 0 as "unpaid".

```typescript
type Salary = number | "unpaid";
```

---

### `JobSource`

Where wolf found the job. Used for filtering and debugging.

```typescript
type JobSource = "linkedin" | "handshake" | "email" | "browser_mcp" | "manual";
```

- `linkedin` / `handshake`: scraped via Apify
- `email`: parsed from a forwarded job alert email
- `browser_mcp`: found by an external agent browsing the web
- `manual`: user added it themselves

---

### `Job`

The central data object. One row per job listing, stored in SQLite. Every wolf command either reads from or writes to `Job` records.

```typescript
interface Job {
  id: string;                              // unique ID (uuid)
  title: string;                           // e.g. "Software Engineer Intern"
  companyId: string;                       // reference to Company.id
  url: string;                             // application or listing URL
  source: JobSource;                       // where this job was found
  description: string;                     // full JD text
  location: string;                        // e.g. "New York, NY" — the specific office location for this role
  remote: boolean;                         // whether the position is remote
  salary: Salary | null;                   // annual salary in USD, "unpaid", or null if not listed
  workAuthorizationRequired: string | null; // e.g. "no sponsorship", "sponsorship available", "US citizens only"
  score: number | null;                    // AI relevance score 0.0–1.0, null if unscored
  scoreJustification: string | null;       // AI explanation for the score
  status: JobStatus;
  appliedProfileId: string | null;         // which profile was used when applying; null if not yet applied
  tailoredResumePath: string | null;       // path to tailored .tex file
  tailoredResumePdfPath: string | null;    // path to compiled resume PDF
  coverLetterPath: string | null;          // path to cover letter .md file
  coverLetterPdfPath: string | null;       // path to cover letter PDF
  screenshotPath: string | null;           // path to form-fill screenshot
  outreachDraftPath: string | null;        // path to outreach email draft
  createdAt: string;                       // ISO 8601 timestamp
  updatedAt: string;                       // ISO 8601 timestamp
}
```

`companyId` is a foreign key to the `Company` table. Company-level attributes (size, domain, industry) live on `Company`, not here — so all jobs from Google share one `Company` record.

`workAuthorizationRequired` mirrors the sponsorship/authorization language from the JD, and is matched against `UserProfile.immigrationStatus` during scoring.

`appliedProfileId` records which identity (name, email, immigration status) was used when submitting the application, so wolf knows which profile to use for follow-ups.

---

### `Resume`

The parsed, structured form of a `.tex` resume file. Wolf reads this when tailoring — it needs to understand the resume's structure (sections, bullet points) to intelligently rewrite it for a specific JD.

The contact info header in the base `.tex` file is treated as **placeholder content**. When generating a tailored resume, wolf always overwrites the header with the selected `UserProfile`'s name, email, and phone — so multiple profiles can share the same base `.tex` file without any mismatch.

```typescript
interface ResumePlainSection {
  heading: string;            // e.g. "Summary", "Objective"
  content: string;            // plain text body (no bullet items)
}

interface ResumeSection {
  heading: string;            // e.g. "Education", "Experience", "Skills"
  items: ResumeSectionItem[];
}

interface ResumeSectionItem {
  title: string | null;       // e.g. "Software Engineer Intern"; null for unnamed items
  subtitle: string | null;    // e.g. "Google"
  location: string | null;    // e.g. "Mountain View, CA"
  date: string | null;        // e.g. "Jun 2025 – Aug 2025"
  bullets: string[];          // bullet point descriptions
}

interface Resume {
  name: string;
  contactInfo: {
    email: string;
    phone: string | null;
    linkedin: string | null;
    github: string | null;
    website: string | null;
  };
  sections: (ResumeSection | ResumePlainSection)[];
  rawTex: string;             // original .tex source
}
```

`ResumePlainSection` is used for free-form sections like Summary or Objective that don't have structured bullet items.

---

### `UserProfile`

A complete identity used when applying. Wolf supports **multiple profiles** to handle situations like:

- Switching email/phone to reapply to the same company after an ATS rejection
- Presenting a different immigration status for companies that don't sponsor visas
- Using a different name variant on different platforms

Multiple profiles can share the same base `.tex` resume file — wolf always injects the profile's contact info into the resume header at generation time, so there's no risk of a mismatch between what the resume says and what the form fields say.

```typescript
interface UserProfile {
  id: string;                       // unique identifier, e.g. "default", "gc-persona"
  label: string;                    // human-readable name, e.g. "Default", "Green Card"
  name: string;
  alternateName: string[];          // e.g. ["Gary Tao"] — other names used on applications
  email: string;
  alternateEmail: string[];         // backup email addresses
  phone: string;                    // primary phone number (required)
  alternatePhone: string[];         // backup phone numbers
  linkedinUrl: string | null;
  githubUrl: string | null;
  websiteUrl: string | null;
  immigrationStatus: string;        // e.g. "US citizen", "F-1 OPT", "H-1B needed" (required)
  currentCity: string | null;
  willingToRelocate: boolean;
  workAuthTimeline: string | null;  // e.g. "OPT starts May 2026"
  targetRoles: string[];            // e.g. ["Software Engineer", "Full Stack Developer"]
  targetLocations: string[];        // e.g. ["NYC", "SF", "Remote"]
  skills: string[];                 // e.g. ["TypeScript", "React", "Python"]
  resumePath: string;               // path to base resume .tex file (contact header is injected from this profile)
  targetedCompanyIds: string[];     // companies the user is actively watching; jobs from these companies get a scoring boost
  scoringPreferences: ScoringPreferences;
}
```

`immigrationStatus` is required because it affects job scoring (matched against `Job.workAuthorizationRequired`). `phone` is required because most application forms demand it.

---

### `ScoringPreferences`

Per-profile configuration that controls how jobs are evaluated. Attached to `UserProfile` so each persona can have different tolerances.

Scoring uses a **hybrid model**:
- **AI** scores `roleMatch` — reading the JD against your target roles and skills. This requires semantic understanding that rules can't do well.
- **Algorithm** scores the remaining structured dimensions (work auth fit, location, remote preference) using deterministic rules.
- **`weights`** are the algorithmic layer's coefficients. The final score is a weighted average of all sub-scores. The AI is not shown these weights — it only outputs its `roleMatch` sub-score.

```typescript
interface ScoringPreferences {
  // Scoring anchors — what the algorithm measures deviation from
  preferences: {
    minSalary: number | null;              // minimum acceptable annual salary in USD; null = no minimum
    preferredCompanySizes: CompanySize[];   // e.g. [3, 4] = mid or bigtech; empty = no preference
  };

  // How much each factor contributes to the final score (0.0–1.0 each, should sum to 1.0)
  weights: {
    workAuth: number;    // auth match vs. profile immigrationStatus
    roleMatch: number;   // AI's semantic role relevance score
    location: number;    // location match vs. profile targetLocations
    remote: number;      // remote preference match
    salary: number;      // salary vs. preferences.minSalary
    companySize: number; // company size proximity to preferences.preferredCompanySizes
  };

  // Hard filters — run before scoring; trips → status: "filtered", no AI call made
  dealbreakers: {
    sponsorship: boolean | null;
    // true  = must offer sponsorship (filter out "no sponsorship" jobs) — for F-1/H-1B users
    // false = must NOT sponsor (filter out jobs that offer it) — for GC/citizen users seeking less competition
    // null  = no filter
    remote: boolean | null;
    // true  = must be remote
    // false = must be on-site
    // null  = no filter
  };
}
```

The dealbreaker check runs **before** scoring. A job that trips a dealbreaker is immediately set to `filtered` and never scored — saving AI API calls.

---

### `AppConfig`

The top-level config object that wolf loads on startup from `~/.wolf/config.json`. It contains all profiles, all provider settings, and default behavior for each command.

```typescript
interface AppConfig {
  profiles: UserProfile[];           // all defined profiles; at least one required
  defaultProfileId: string;          // which profile to use when none is specified
  providers: Record<string, ProviderConfig>;
  hunt: {
    minScore: number;                      // minimum score threshold (default 0.5)
    maxResults: number;                    // max jobs per hunt run (default 50)
  };
  tailor: {
    defaultTemplatePath: string | null;    // default LaTeX template for resume; can be overridden per-run
    defaultCoverLetterTone: string;        // e.g. "professional", "conversational"; can be overridden per-run
  };
  reach: {
    defaultEmailTone: string;             // e.g. "professional", "casual"; can be overridden per-run
    maxEmailsPerDay: number;              // safety limit (default 10)
  };
}

interface ProviderConfig {
  enabled: boolean;
  strategy?: string;           // provider-specific config, e.g. "email" for handshake
}
```

`default*` fields are the baseline — individual command runs can override them via options. For example, `defaultCoverLetterTone` sets the usual tone, but a single `wolf tailor` run can override it with `--tone casual`.

> **TODO:** `ProviderConfig` design needs further discussion — may need per-provider typed config rather than a generic `strategy` string.

---

## Command Input / Output Types

Every wolf command has an `*Options` type (what goes **in**) and a `*Result` type (what comes **out**). These are the same types used whether you call wolf from the CLI or from an MCP tool.

Fields marked `?` are **optional**: when absent, the command falls back to config defaults. This is intentionally `?` (optional) rather than `| null` (nullable) — an absent flag means "use the default", while `null` would mean "explicitly set to nothing". These are different intentions.

---

### `hunt`

`wolf hunt` searches enabled job sources, scores results against your profile, and stores new jobs in the database.

```typescript
interface HuntOptions {
  profileId?: string;          // which profile to use for targetRoles/targetLocations; defaults to defaultProfileId
  role?: string;               // target role keyword; overrides profile.targetRoles
  location?: string;           // target location; overrides profile.targetLocations
  companyIds?: string[];       // restrict hunt to specific companies (e.g. hunt only TikTok and ByteDance)
  providers?: string[];        // override which providers to use; defaults to all enabled providers
  maxResults?: number;         // override config.hunt.maxResults
}

interface HuntResult {
  jobs: Job[];
  newCount: number;            // number of jobs not previously seen
  avgScore: number;
}
```

---

### `tailor`

`wolf tailor` takes a job ID, reads the JD, and uses Claude to rewrite your resume's bullet points to match. It also optionally generates a cover letter. Every job gets its own tailored output — the base resume is never modified.

```typescript
interface TailorOptions {
  jobId: string;               // ID of the job to tailor for
  profileId?: string;          // which profile to use for contact injection; defaults to defaultProfileId
  resume?: string;             // path to a specific .tex resume; defaults to the selected profile's resumePath
  coverLetter?: boolean;       // also generate cover letter (default true)
  diff?: boolean;              // show before/after comparison
}
```

`resume?` also enables cover-letter-only mode: pass an existing tailored resume path and set `coverLetter: true` to skip re-tailoring the resume.

```typescript
interface TailorResult {
  tailoredTexPath: string | null;     // path to output .tex file; null if resume was not re-tailored
  tailoredPdfPath: string | null;     // path to compiled resume PDF; null if resume was not re-tailored
  coverLetterMdPath: string | null;   // path to cover letter .md
  coverLetterPdfPath: string | null;  // path to cover letter PDF
  changes: string[];                  // summary of key changes made
  matchScore: number;                 // estimated match score after tailoring
}
```

---

### `fill` (form fill — auto-fills and submits job application forms)

`wolf fill` uses Playwright to open the job application URL, detect form fields, map values from the selected profile and tailored documents, and optionally submit. Think of it as a browser robot that fills in the application form on your behalf.

```typescript
interface FormField {
  name: string;                // field name or label as it appears on the form
  type: string;                // "text", "email", "file", "select", "checkbox", etc.
  required: boolean;
  value: string | null;        // mapped value from user profile; null if no mapping found
}

interface FillOptions {
  jobId: string;               // ID of the job to apply for
  profileId?: string;          // which profile to use for form field mapping; defaults to defaultProfileId
  dryRun?: boolean;            // preview only, don't submit (default true)
  resumePath?: string;         // path to a specific resume PDF to upload; defaults to tailored resume for this job
  coverLetterPath?: string;    // path to a specific cover letter PDF to upload; defaults to tailored CL for this job
}

interface FillResult {
  fields: FormField[];
  submitted: boolean;
  screenshotPath: string | null;
}
```

---

### `reach`

`wolf reach` finds HR contacts or hiring managers for a given job, drafts an outreach email, and optionally sends it via Gmail.

```typescript
interface Contact {
  name: string;
  title: string;               // e.g. "Engineering Manager"
  companyId: string | null;    // reference to Company.id; null if company not in the database
  companyName: string;         // denormalized for display — always present even if companyId is null
  email: string | null;        // real or inferred email
  emailInferred: boolean;      // true if email was guessed from pattern (e.g. first.last@company.com)
  linkedinUrl: string | null;
}

interface ReachOptions {
  jobId: string;               // ID of the job to do outreach for
  profileId?: string;          // which profile to use for sender name/email; defaults to defaultProfileId
  send?: boolean;              // actually send the email (default false)
}

interface ReachResult {
  contacts: Contact[];
  draftPath: string;           // path to draft email .md file
  sent: boolean;
}
```

---

### `status` (job tracker — query and summarize tracked jobs)

`wolf status` is a **read-only** query command. It reads from the local SQLite database and returns a filtered list of tracked jobs with summary statistics. It does not trigger AI calls or external requests — it only shows you what wolf already knows.

```typescript
interface StatusOptions {
  status?: JobStatus;          // filter by status
  companyIds?: string[];       // filter to specific companies
  minScore?: number;           // filter by minimum score
  since?: string;              // filter by createdAt date (ISO 8601)
}

interface StatusResult {
  jobs: Job[];
  total: number;
  byStatus: Record<JobStatus, number>;  // count of jobs per status, e.g. { new: 12, applied: 3, ... }
}
```

---

## Storage / CRUD Types

Internal types used by the storage layer (`src/utils/db.ts`) to query and update records in SQLite. These are not exposed via CLI or MCP — they're used by command handlers internally when reading or writing to the database.

```typescript
interface JobQuery {
  status?: JobStatus | JobStatus[];   // filter by one or more statuses
  companyIds?: string[];              // filter to specific companies
  minScore?: number;                  // minimum score threshold
  since?: string;                     // filter by createdAt (ISO 8601)
  source?: JobSource;                 // filter by source
  limit?: number;                     // max records to return
  offset?: number;                    // pagination offset (for large result sets)
}

interface JobUpdate {
  status?: JobStatus;
  appliedProfileId?: string | null;
  score?: number | null;
  scoreJustification?: string | null;
  tailoredResumePath?: string | null;
  tailoredResumePdfPath?: string | null;
  coverLetterPath?: string | null;
  coverLetterPdfPath?: string | null;
  screenshotPath?: string | null;
  outreachDraftPath?: string | null;
}
```

interface CompanyQuery {
  size?: CompanySize | CompanySize[];  // filter by company size tier
  industry?: string;                   // filter by industry
  limit?: number;
  offset?: number;
}

interface CompanyUpdate {
  name?: string;
  domain?: string | null;
  linkedinUrl?: string | null;
  size?: CompanySize | null;
  industry?: string | null;
  headquartersLocation?: string | null;
  notes?: string | null;
}
```

---

## Provider Interface

`JobProvider` is a plugin interface using the **strategy pattern**. Each job source (LinkedIn, Handshake, etc.) implements this interface independently. When `wolf hunt` runs, it iterates over all enabled providers, calls `hunt()` on each, then merges and deduplicates the raw results before scoring.

The key benefit: adding a new job source only requires writing a new class that implements `JobProvider`. No changes to the core hunt logic needed.

```typescript
interface JobProvider {
  name: string;
  hunt(options: HuntOptions): Promise<Job[]>;
}
```

`hunt(options)` is an async function: you give it search parameters, and it goes out to the internet, fetches matching jobs, and returns them as a `Job[]` array. `Promise<Job[]>` means the result arrives asynchronously (because network requests take time).

Built-in providers: `ApifyLinkedInProvider`, `ApifyHandshakeProvider`, `EmailProvider`, `BrowserMCPProvider`, `ManualProvider`.

---

## MCP Tool Schemas

Each MCP tool maps directly to a command:

| MCP Tool | Input Type | Output Type |
|---|---|---|
| `wolf_hunt` | `HuntOptions` | `HuntResult` |
| `wolf_tailor` | `TailorOptions` | `TailorResult` |
| `wolf_fill` | `FillOptions` | `FillResult` |
| `wolf_reach` | `ReachOptions` | `ReachResult` |

MCP input/output schemas are JSON Schema representations of these TypeScript types, defined in `src/mcp/tools.ts`.

# default

<!-- 
// Consumed by:
//   wolf tailor  — currently. Name + contact + links go into the resume header
//                  and the cover-letter salutation. Job-preferences targets and
//                  scoring notes feed the analyst's tailoring brief.
//   wolf fill    — when M4 ships. Reads name, address, citizenship, current
//                  country, demographics, and clearance to fill matching ATS
//                  form fields (these are static facts, not gameable).
//                  Game-theoretic phrasing — work-auth / sponsorship /
//                  willingness-to-relocate / salary — comes from
//                  standard_questions.md instead.
//   wolf reach   — when M5 ships. Uses name + contact for the outreach email
//                  sender info and signature.
//   wolf score   — when M2 ships. Uses scoring notes + job preferences (incl.
//                  sponsorship preference) to rank and filter jobs.
-->

// Convention:
//   H1 = category
//   H2 = field / question
//   Body under H2 = your answer
//
// Markers (each is a `//` line — stripped before AI sees the file;
// also hidden from MD preview so they only show in raw editor view):
//   // REQUIRED — you must answer; AI cannot guess this.
//   // (optional — leave blank if N/A)
//
// Sections without `//` already carry a sensible default; edit if it doesn't fit you.
//
// The whole file gets passed to AI agents (tailor, resume writer, fill, outreach)
// as context. Be honest and specific; the AI will adapt phrasing per role.

# Identity

## Legal first name
// REQUIRED — you must answer; AI cannot guess this.

## Legal middle name
// (optional — leave blank if none)

## Legal last name
// REQUIRED — you must answer; AI cannot guess this.

## Preferred name
// (optional — leave blank to use legal first name)

## Pronouns
// (optional)

## Date of birth
// (optional — required by some non-US ATS; format YYYY-MM-DD)

## Country of citizenship
// REQUIRED — country whose passport you hold (e.g. "United States", "China", "India").
// This is a fact, not a strategy. Wolf fill uses it to answer ATS "Country of
// citizenship" dropdowns and similar.

## Country you're currently in
United States
// Where you are physically right now. Used by wolf fill to answer "Are you
// currently in [country]?" / "Are you authorized to work in [country] from
// here?" type form questions. Default is United States (most NG mass-apply
// scenarios). Update if you're abroad.

# Contact

## Email
// REQUIRED — you must answer; AI cannot guess this.

## Phone
// REQUIRED — you must answer; AI cannot guess this.

# Address

## Full address
// REQUIRED — write complete address including country, e.g.
//   "123 Main St, Apt 4, San Francisco, CA 94102, USA"

# Links

## First link (most prominent on resume)
// REQUIRED — at minimum your LinkedIn.
// AI infers the link type (LinkedIn / GitHub / portfolio / LeetCode) from the URL.

## Second link (also on resume if there's room)
// (optional)

## Other links
// (optional — one URL per line, any number)

# Job Preferences

## Target roles
// REQUIRED — comma-separated, e.g. "Software Engineer, Backend Engineer".

## Target locations
// REQUIRED — comma-separated, e.g. "SF Bay Area, NYC, Remote-US".

## Relocation preference — where are you actually willing to live?
// REQUIRED. This is the HONEST answer for hunt filtering. Mark willingness
// at each level: "yes" / "no" / "maybe":
//   - within current metro area: yes
//   - within current state: yes
//   - cross-country (e.g. coast to coast): yes
//   - international (out of current country): no
// Free notes (e.g. "Anywhere in CA", "NYC and SF only"):
//
// Form-time phrasing of "Are you willing to relocate?" lives in
// standard_questions.md and is often more permissive than this honest
// answer — that's a strategic choice (say "Yes" on form, negotiate later).

## Scoring notes
// (optional — free-form preferences for the AI scorer,
//   e.g. "prefer backend over frontend, OK with hybrid").

## Precision-apply companies (don't mass-apply)
// (optional — comma-separated company names. Wolf will still tailor a resume,
//   but won't auto-fill the application; you apply manually.
//   Leave blank to mass-apply everyone.)

## Hard-reject companies (never apply, even if AI suggests)
// (optional — comma-separated company names. Filtered out at hunt.)

## Sponsorship preference — which jobs do you want to apply to?
// REQUIRED. This is your STRATEGY for hunt filtering, not your form answer.
// For each row, mark "yes" / "no" / "only if no other option":
//   - require H-1B sponsorship: 
//   - require green-card sponsorship: 
//   - require CPT (current student): 
//   - require OPT (current student): 
//   - don't sponsor at all (citizens / GC / EAD only): 
// Free notes (e.g. "OPT for summer, H-1B for full-time"):
//
// Form-time phrasing of "Do you require sponsorship?" lives in
// standard_questions.md and may differ — that's a strategic / negotiation
// choice, not a contradiction.

## Minimum hourly rate (intern, USD)
// (optional — e.g. "30" or leave blank for no floor)

## Minimum annual salary (new grad, USD)
// (optional — e.g. "100000" or leave blank for no floor)

## Remote preference
no preference

## Max applications per day (self-rate-limit)
30

# Demographics

// US ATS EEO fields. All voluntary by law. "Decline to answer" is always valid.

## Race
// (optional EEO — "Decline to answer" is a valid value)

## Gender
// (optional EEO — "Decline to answer" is a valid value)

## Ethnicity
// (optional EEO — "Not Hispanic or Latino" / "Hispanic or Latino" / "Decline to answer")

## Veteran status
I am not a protected veteran

## Disability status
// (optional EEO — "I do not wish to answer" is a valid value)

## LGBTQ+
// (optional — "Decline to state" is a valid value)

## Transgender
// (optional — "Decline to state" is a valid value)

## First-generation college student
No

# Clearance

## Do you have an active security clearance?
No

## Clearance level
// (optional — only fill if active clearance: Secret / Top Secret / TS-SCI)

## Clearance status
// (optional — only fill if active clearance: Active / Inactive / Eligible)

## Are you willing to obtain one?
Yes

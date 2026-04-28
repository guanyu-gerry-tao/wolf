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

> [!TIP]
> Convention:
>   H1 = category
>   H2 = field / question
>   Body under H2 = your answer
>
> Markers (each is a `>` blockquote line — stripped before AI sees the file;
> renders as a styled quote box in MD preview):
>   > [!IMPORTANT]
>   > you must answer; AI cannot guess this.
>   > Optional. Leave blank if N/A.
>
> Sections without a `>` marker already carry a sensible default; edit if it doesn't fit you.
>
> The whole file gets passed to AI agents (tailor, resume writer, fill, outreach)
> as context. Be honest and specific; the AI will adapt phrasing per role.

# Identity

## Legal first name
> [!IMPORTANT]
> you must answer; AI cannot guess this.

## Legal middle name
> [!TIP]
> Optional. Leave blank if none.

## Legal last name
> [!IMPORTANT]
> you must answer; AI cannot guess this.

## Preferred name
> [!TIP]
> Optional. Leave blank to use legal first name.

## Pronouns
> [!TIP]
> Optional.

## Date of birth
> [!TIP]
> Optional. Required by some non-US ATS; format YYYY-MM-DD.

## Country of citizenship
> [!IMPORTANT]
> Country whose passport you hold (e.g. "United States", "China", "India").
> This is a fact, not a strategy. Wolf fill uses it to answer ATS "Country of
> citizenship" dropdowns and similar.

## Country you're currently in
United States
> [!TIP]
> Where you are physically right now. Used by wolf fill to answer "Are you
> currently in [country]?" / "Are you authorized to work in [country] from
> here?" type form questions. Default is United States (most NG mass-apply
> scenarios). Update if you're abroad.

# Contact

## Email
> [!IMPORTANT]
> you must answer; AI cannot guess this.

## Phone
> [!IMPORTANT]
> you must answer; AI cannot guess this.

# Address

## Full address
> [!IMPORTANT]
> Write complete address including country, e.g.
>   "123 Main St, Apt 4, San Francisco, CA 94102, USA"

# Links

## First link (most prominent on resume)
> [!IMPORTANT]
> At minimum your LinkedIn.
> AI infers the link type (LinkedIn / GitHub / portfolio / LeetCode) from the URL.

## Second link (also on resume if there's room)
> [!TIP]
> Optional.

## Other links
> [!TIP]
> Optional. One URL per line, any number.

# Job Preferences

## Target roles
> [!IMPORTANT]
> Comma-separated, e.g. "Software Engineer, Backend Engineer".

## Target locations
> [!IMPORTANT]
> Comma-separated, e.g. "SF Bay Area, NYC, Remote-US".

## Relocation preference — where are you actually willing to live?
> [!IMPORTANT]
> This is the HONEST answer for hunt filtering. Mark willingness
> at each level: "yes" / "no" / "maybe":
>   - within current metro area: yes
>   - within current state: yes
>   - cross-country (e.g. coast to coast): yes
>   - international (out of current country): no
> Free notes (e.g. "Anywhere in CA", "NYC and SF only"):
>
> Form-time phrasing of "Are you willing to relocate?" lives in
> standard_questions.md and is often more permissive than this honest
> answer — that's a strategic choice (say "Yes" on form, negotiate later).

## Scoring notes
> [!TIP]
> Optional. Free-form preferences for the AI scorer,
>   e.g. "prefer backend over frontend, OK with hybrid".

## Precision-apply companies (don't mass-apply)
> [!TIP]
> Optional. Comma-separated company names. Wolf will still tailor a resume,
>   but won't auto-fill the application; you apply manually.
>   Leave blank to mass-apply everyone.

## Hard-reject companies (never apply, even if AI suggests)
> [!TIP]
> Optional. Comma-separated company names. Filtered out at hunt.

## Sponsorship preference — which jobs do you want to apply to?
> [!IMPORTANT]
> This is your STRATEGY for hunt filtering, not your form answer.
> For each row, mark "yes" / "no" / "only if no other option":
>   - require H-1B sponsorship: 
>   - require green-card sponsorship: 
>   - require CPT (current student): 
>   - require OPT (current student): 
>   - don't sponsor at all (citizens / GC / EAD only): 
> Free notes (e.g. "OPT for summer, H-1B for full-time"):
>
> Form-time phrasing of "Do you require sponsorship?" lives in
> standard_questions.md and may differ — that's a strategic / negotiation
> choice, not a contradiction.

## Minimum hourly rate (intern, USD)
> [!TIP]
> Optional. E.g. "30" or leave blank for no floor.

## Minimum annual salary (new grad, USD)
> [!TIP]
> Optional. E.g. "100000" or leave blank for no floor.

## Remote preference
no preference

## Max applications per day (self-rate-limit)
30

# Demographics

> [!TIP]
> US ATS EEO fields. All voluntary by law. "Decline to answer" is always valid.

## Race
> [!TIP]
> Optional EEO. "Decline to answer" is a valid value.

## Gender
> [!TIP]
> Optional EEO. "Decline to answer" is a valid value.

## Ethnicity
> [!TIP]
> Optional EEO. "Not Hispanic or Latino" / "Hispanic or Latino" / "Decline to answer".

## Veteran status
I am not a protected veteran

## Disability status
> [!TIP]
> Optional EEO. "I do not wish to answer" is a valid value.

## LGBTQ+
> [!TIP]
> Optional. "Decline to state" is a valid value.

## Transgender
> [!TIP]
> Optional. "Decline to state" is a valid value.

## First-generation college student
No

# Clearance

## Do you have an active security clearance?
No

## Clearance level
> [!TIP]
> Optional. Only fill if active clearance: Secret / Top Secret / TS-SCI.

## Clearance status
> [!TIP]
> Optional. Only fill if active clearance: Active / Inactive / Eligible.

## Are you willing to obtain one?
Yes

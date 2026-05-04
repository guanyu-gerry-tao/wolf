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
>   H1 = category, H2 = field/question, body under H2 = your answer.
>
> Markers (each renders as a styled callout in any GitHub-Alert-aware viewer
> and is fully stripped before any AI sees the file):
>   `> [!IMPORTANT]` body starts with "REQUIRED —" → wolf cannot run without it.
>   `> [!NOTE]`       body starts with "OPTIONAL —" → safe to leave blank.
>
> Three answering modes:
>   - You have an answer → write it on a plain (non-`>`) line below the callout.
>   - You don't care / want to skip → leave the body completely empty.
>     Do NOT write "N/A", "—", "(skipped)" — those count as real answers.
>     The empty section is hidden from the AI; doctor will flag it only if
>     it is REQUIRED.
>   - You explicitly want to refuse (e.g. EEO demographics) → write the
>     literal phrase ("Decline to answer", "Prefer not to say"). Forms will
>     fill that exact text.

# Identity

## Legal first name

> [!IMPORTANT]
> REQUIRED — wolf cannot guess this. Used as the resume header.

## Legal middle name

> [!NOTE]
> OPTIONAL — leave empty if none.

## Legal last name

> [!IMPORTANT]
> REQUIRED — wolf cannot guess this. Used as the resume header.

## Preferred name

> [!NOTE]
> OPTIONAL — leave empty to use legal first name.

## Pronouns

> [!NOTE]
> OPTIONAL.

## Date of birth

> [!NOTE]
> OPTIONAL — required by some non-US ATS; format YYYY-MM-DD.

## Country of citizenship

> [!IMPORTANT]
> REQUIRED — country whose passport you hold (e.g. "United States",
> "China", "India"). Wolf fill uses this to answer ATS "Country of
> citizenship" dropdowns. This is a fact, not a strategy.

## Country you're currently in

United States

> [!NOTE]
> OPTIONAL — where you are physically right now. Defaults to United
> States (most NG mass-apply scenarios). Update if you're abroad.

# Contact

## Email

> [!IMPORTANT]
> REQUIRED — wolf cannot guess this. Used as resume header and outreach
> From: address.

## Phone

> [!IMPORTANT]
> REQUIRED — wolf cannot guess this. Used in the resume header.

# Address

## Full address

> [!IMPORTANT]
> REQUIRED — write complete address including country, e.g.
> "123 Main St, Apt 4, San Francisco, CA 94102, USA".

# Links

## First link (most prominent on resume)

> [!IMPORTANT]
> REQUIRED — at minimum your LinkedIn. Wolf infers link type
> (LinkedIn / GitHub / portfolio / LeetCode) from the URL.

## Second link (also on resume if there's room)

> [!NOTE]
> OPTIONAL.

## Other links

> [!NOTE]
> OPTIONAL — one URL per line, any number.

# Job Preferences

## Target roles

> [!IMPORTANT]
> REQUIRED — comma-separated, e.g. "Software Engineer, Backend Engineer".

## Target locations

> [!IMPORTANT]
> REQUIRED — comma-separated, e.g. "SF Bay Area, NYC, Remote-US".

## Relocation preference — where are you actually willing to live?

> [!IMPORTANT]
> REQUIRED — this is the HONEST answer for hunt filtering. Mark
> willingness at each level: "yes" / "no" / "maybe":
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

> [!NOTE]
> OPTIONAL — free-form preferences for the AI scorer, e.g.
> "prefer backend over frontend, OK with hybrid".

## Precision-apply companies (don't mass-apply)

> [!NOTE]
> OPTIONAL — comma-separated company names. Wolf will still tailor a
> resume but won't auto-fill the application; you apply manually.
> Leave empty to mass-apply everyone.

## Hard-reject companies (never apply, even if AI suggests)

> [!NOTE]
> OPTIONAL — comma-separated company names. Filtered out at hunt.

## Sponsorship preference — which jobs do you want to apply to?

> [!IMPORTANT]
> REQUIRED — your STRATEGY for hunt filtering, not your form answer.
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

> [!NOTE]
> OPTIONAL — e.g. "30" or leave empty for no floor.

## Minimum annual salary (new grad, USD)

> [!NOTE]
> OPTIONAL — e.g. "100000" or leave empty for no floor.

## Remote preference

no preference

> [!NOTE]
> OPTIONAL — values: "remote only" / "hybrid only" / "onsite only" /
> "no preference" (default).

## Max applications per day (self-rate-limit)

30

> [!NOTE]
> OPTIONAL — defaults to 30 if blank. Tune higher for aggressive volume.

# Demographics

> [!NOTE]
> OPTIONAL — US ATS EEO fields, all voluntary by law. Three modes per
> field: leave empty to skip; write your real answer; write
> "Decline to answer" if you want forms to fill that literal phrase.

## Race

> [!NOTE]
> OPTIONAL EEO.

## Gender

> [!NOTE]
> OPTIONAL EEO.

## Ethnicity

> [!NOTE]
> OPTIONAL EEO — values: "Hispanic or Latino" / "Not Hispanic or Latino" /
> "Decline to answer".

## Veteran status

I am not a protected veteran

> [!NOTE]
> OPTIONAL EEO — defaults shown above. Edit to your actual status if
> different ("I am a protected veteran" / "Decline to answer").

## Disability status

> [!NOTE]
> OPTIONAL EEO.

## LGBTQ+

> [!NOTE]
> OPTIONAL.

## Transgender

> [!NOTE]
> OPTIONAL.

## First-generation college student

No

> [!NOTE]
> OPTIONAL — "Yes" / "No" / "Decline to answer". Default shown above.

# Clearance

## Do you have an active security clearance?

No

> [!NOTE]
> OPTIONAL — "Yes" / "No". Default shown above. Edit to "Yes" if you have
> an active clearance, then fill the two fields below.

## Clearance level

> [!NOTE]
> OPTIONAL — only fill if active clearance: Secret / Top Secret / TS-SCI.

## Clearance status

> [!NOTE]
> OPTIONAL — only fill if active clearance: Active / Inactive / Eligible.

## Are you willing to obtain one?

Yes

> [!NOTE]
> OPTIONAL — "Yes" / "No". Default shown above.

# Standard Questions

<!--
Convention:
  H1 = category (Short Answers / Company-Product Opinions / Documents / ...)
  H2 = the question itself
  H3 (Documents only) = a label / alias for an attachment
  Body under H2 (or H3) = your answer / file name

Markers (each is a `//` line — stripped before AI sees the file):
  // REQUIRED — you must answer; AI cannot guess this.
  // (optional — leave blank if N/A)

Sections without `//` carry a sensible default; edit if it doesn't fit you.

This file is consumed by `wolf fill` — when an ATS form asks a question,
the agent finds the most relevant H2 here and fills the answer (adapting
{{company}} / {{role}} placeholders, or synthesizing from your "framework"
answers in the Company / Product Opinions section).
-->

# Short Answers

## What's your salary expectation?
Open to discuss based on the full compensation package and role scope.

## How did you hear about us?
LinkedIn

## Why this company?
// REQUIRED — write a flexible template; the agent will adapt it per company.

## Why this role?
// REQUIRED — write a flexible template; the agent will adapt it per role.

## Tell me about a time you failed
// REQUIRED — write one full STAR+R story. Reused across applications.

## Tell me about yourself
// REQUIRED — 1-paragraph self-introduction; AI adapts per role.

## Biggest strength
// REQUIRED

## Biggest weakness (with what you're doing about it)
// REQUIRED

## Where do you see yourself in 5 years?
// REQUIRED

## Tell me about a time you faced conflict
// REQUIRED — STAR+R story.

## Why are you leaving your current role?
// (optional — leave blank if NG/intern with no current role)

## When can you start?
Available immediately

## Are you authorized to work? (form phrasing)
// REQUIRED — short answer for the form. Truth lives in profile.md # Work Authorization.
//   e.g. "Yes, I am authorized to work in the United States."

## Do you require sponsorship? (form phrasing)
// REQUIRED — short answer for the form. Truth lives in profile.md # Work Authorization.
//   e.g. "No" / "Yes, in the future after my OPT expires" / etc.

## Are you willing to relocate? (form phrasing)
// REQUIRED — short answer for the form. Truth lives in profile.md # Job Preferences.

# Company / Product Opinions

<!--
These appear constantly in ATS forms ("What do you think of <our product>?",
"How would you improve us?"). In mass-apply you can't pre-write per-company
answers — so describe your APPROACH here (what dimensions you evaluate on,
what kinds of feedback you tend to give). The fill agent reads your approach
plus the actual company/product info from the JD and synthesizes the answer
at apply time.
-->

## How do you view our company? — your framework
// REQUIRED — describe how you typically form an opinion about a company:
//   what dimensions you weigh (mission, traction, team, culture, market,
//   technical depth, ...), what signals you look for, what tone you take
//   (genuine vs polite). Don't name any specific company here.

## How do you view our product? — your framework
// REQUIRED — describe how you evaluate a product as a candidate-user:
//   what you look at (UX, depth, defensibility, fit-to-market, technical
//   choices, ...), what level of detail you go to, whether you bring
//   comparisons. Don't name any specific product here.

## What suggestions do you have for our company? — your framework
// REQUIRED — how you frame suggestions about a company you're applying to:
//   what kinds of topics are fair game (hiring, GTM, positioning,
//   org design, ...), what tone (constructive vs critical), what to
//   avoid (anything that sounds like you've judged them before joining).

## What suggestions do you have for our product? — your framework
// REQUIRED — how you frame product suggestions:
//   depth (high-level vs concrete features), how to handle areas you
//   don't know well, whether to anchor in user pain or technical debt.

# Documents

<!--
H3 = label the agent matches against ATS form labels (e.g. "Transcript").
Body under H3 = file name inside `attachments/`. Path must be a bare filename;
the agent prepends `attachments/`. Files outside `attachments/` are not allowed.

Immigration / work-authorization documents are not listed here — ATS forms
don't consume them at the application stage. They show up post-offer for
I-9 verification, which is out of wolf's scope.
-->

## What academic documents do you have?

### Transcript
// (optional — fill in the filename, e.g. transcript.pdf, after dropping the file in attachments/)

### Unofficial transcript
// (optional — e.g. unofficial-transcript.pdf)

### Reference letter
// (optional — e.g. reference-prof-smith.pdf)

### Portfolio sample
// (optional — only for design / DS / writing roles)

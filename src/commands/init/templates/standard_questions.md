# Standard Questions

<!--
Convention:
  H1 = category (Short Answers / Company-Product Opinions / Documents / ...)
  H2 = the question itself
  H3 (Documents only) = a label / alias for an attachment
  Body under H2 (or H3) = your answer / file name

This file is consumed by `wolf fill` — when an ATS form asks a question,
the agent finds the most relevant H2 here and fills the answer (adapting
{{company}} / {{role}} placeholders, or synthesizing from your "framework"
answers in the Company / Product Opinions section).
-->

# Short Answers

## What's your salary expectation?
TODO

## How did you hear about us?
TODO

## Why this company?
TODO — write a flexible template; the agent will adapt it per company.

## Why this role?
TODO

## Tell me about a time you failed
TODO — write a STAR+R story.

## Tell me about yourself
TODO — 1-paragraph self-introduction. AI adapts per role.

## Biggest strength
TODO

## Biggest weakness (with what you're doing about it)
TODO

## Where do you see yourself in 5 years?
TODO

## Tell me about a time you faced conflict
TODO — STAR+R story.

## Why are you leaving your current role?
TODO — leave blank if not currently employed (typical NG case).

## When can you start?
TODO — e.g. "Available immediately" / "After May 2026 graduation" / "2 weeks notice".

## Are you authorized to work? (form phrasing)
TODO — short answer for the form. Truth lives in profile.md # Work Authorization.

## Do you require sponsorship? (form phrasing)
TODO — short answer for the form. Truth lives in profile.md # Work Authorization.

## Are you willing to relocate? (form phrasing)
TODO — short answer for the form. Truth lives in profile.md # Job Preferences.

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
TODO — describe how you typically form an opinion about a company:
       what dimensions you weigh (mission, traction, team, culture, market,
       technical depth, ...), what signals you look for, what tone you take
       (genuine vs polite). Don't name any specific company here.

## How do you view our product? — your framework
TODO — describe how you evaluate a product as a candidate-user:
       what you look at (UX, depth, defensibility, fit-to-market, technical
       choices, ...), what level of detail you go to, whether you bring
       comparisons. Don't name any specific product here.

## What suggestions do you have for our company? — your framework
TODO — how you frame suggestions about a company you're applying to:
       what kinds of topics are fair game (hiring, GTM, positioning,
       org design, ...), what tone (constructive vs critical), what to
       avoid (anything that sounds like you've judged them before joining).

## What suggestions do you have for our product? — your framework
TODO — how you frame product suggestions:
       depth (high-level vs concrete features), how to handle areas you
       don't know well, whether to anchor in user pain or technical debt.

# Documents

<!--
H3 = label the agent matches against ATS form labels (e.g. "Transcript").
Body under H3 = file name inside `attachments/`. Path must be a bare filename;
the agent prepends `attachments/`. Files outside `attachments/` are not allowed.

Example:
  ## What academic documents do you have?

  ### Transcript
  transcript.pdf
-->

## What academic documents do you have?

### Transcript
TODO (e.g. transcript.pdf)

### Unofficial transcript
TODO (e.g. unofficial-transcript.pdf)

### Reference letter
TODO

### Portfolio sample
TODO (only for design / DS / writing roles; drop in attachments/ if used)

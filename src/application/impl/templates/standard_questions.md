# Standard Questions

<!-- 
// Consumed by:
//   wolf fill (when M4 ships) — Short Answers, Company/Product Opinions
//                  frameworks, and Documents file pointers all feed into ATS
//                  form filling. The fill agent reads this file end-to-end
//                  for every application.
//   (Not consumed by tailor / score / reach. Tailor reads resume_pool.md +
//    profile.md; score reads JD + profile.md; reach reads profile.md.)
-->

> [!TIP]
> Convention:
>   H1 = category (Short Answers / Company-Product Opinions / Documents / ...)
>   H2 = the question itself
>   H3 (Documents only) = a label / alias for an attachment
>   Body under H2 (or H3) = your answer / file name
>
> Markers (each is a `>` blockquote line — stripped before AI sees the file;
> renders as a styled quote box in MD preview):
>   > [!IMPORTANT]
>   > you must answer; AI cannot guess this.
>   > Optional. Leave blank if N/A.
>
> Sections without a `>` marker carry a sensible default; edit if it doesn't fit you.
>
> This file is consumed by `wolf fill` — when an ATS form asks a question,
> the agent finds the most relevant H2 here and fills the answer (adapting
> {{company}} / {{role}} placeholders, or synthesizing from your "framework"
> answers in the Company / Product Opinions section).

# Short Answers

## What's your salary expectation?
Open to discuss based on the full compensation package and role scope.

## How did you hear about us?
LinkedIn

## Why this company?
> [!IMPORTANT]
> Write a flexible template; the agent will adapt it per company.

## Why this role?
> [!IMPORTANT]
> Write a flexible template; the agent will adapt it per role.

## Tell me about a time you failed
> [!IMPORTANT]
> Write one full STAR+R story. Reused across applications.

## Tell me about yourself
> [!IMPORTANT]
> 1-paragraph self-introduction; AI adapts per role.

## Biggest strength
> [!IMPORTANT]
> Just name 1-2 strengths and the angle (technical depth / leadership /
> speed / cross-functional). AI pulls supporting examples from resume_pool
> and phrases it for the role.

## Biggest weakness (with what you're doing about it)
> [!IMPORTANT]
> Name a real weakness + what you're actively doing about it.
> Skip the "I work too hard" trope — interviewers see through it.
> AI will phrase it diplomatically and match the role's tone.

## Where do you see yourself in 5 years?
> [!IMPORTANT]
> Sketch the direction only (IC depth / management track / domain mastery /
> founder path / learning trajectory). AI tailors the specifics per role
> so it lands as ambitious-but-aligned, not generic.

## Tell me about a time you faced conflict
> [!IMPORTANT]
> STAR+R story.

## Why are you leaving your current role?
> [!TIP]
> Optional. Leave blank if NG/intern with no current role.

## How do you handle stress / failure?
> [!IMPORTANT]
> You can either write one full STAR+R story, OR just sketch your default
> coping pattern (break-it-down / data-driven / talk-to-teammate / step-back
> -then-retry) and AI pulls a matching example from resume_pool.
> Common in NG / intern interviews.

## What motivates you?
> [!IMPORTANT]
> List 2-3 motivators in your own words (problem complexity / user impact /
> learning curve / autonomy / craft). AI picks whichever fits each role's
> pitch and weaves it into "why this role" / "why this company" answers too.

## Describe a time you led a team or project
> [!IMPORTANT]
> STAR+R story. Even an intern-scale lead (study group, hackathon team,
> open-source maintainer) works. Pick the one with the most concrete result.

## Describe a time you handled feedback you disagreed with
> [!IMPORTANT]
> STAR+R story. The interviewer is checking maturity, not your ability to
> win arguments. Lean toward "I tried it, learned X, here's what I'd do now."

## What is your management style?
> [!TIP]
> Optional for NG / IC roles. Fill if you've led people (TA, intern lead,
> club president) or if the role is manager-track. You can also just give
> the principles you lead by (high-trust / low-meeting / 1:1-heavy /
> ownership-first) and AI will write the story per role.

## Tell me about a project you're proud of
> [!IMPORTANT]
> Pick ONE project, real depth: what you built, why it was hard, what you
> learned. AI will adapt this for "biggest accomplishment" form questions too.

## When can you start?
Available immediately

## Form answer — Are you authorized to work?
> [!IMPORTANT]
> Verbatim form answer. Form usually wants a clean "Yes"/"No";
> the typical strategic answer is "Yes" if you have ANY current authorization,
> even time-limited (OPT / CPT). E.g.:
>   "Yes, I am authorized to work in the United States."

## Form answer — Do you require sponsorship?
> [!IMPORTANT]
> Verbatim form answer. The strategic preference (which jobs to
> even apply to) lives in profile.md # Job Preferences > Sponsorship preference.
> Form-time answers often understate future sponsorship need to maximize
> interview odds; this is YOUR negotiation choice, not auto-derived. E.g.:
>   "No" / "Yes, in the future after my OPT expires" /
>   "Currently no, may need H-1B sponsorship for permanent role"

## Form answer — Are you willing to relocate?
> [!IMPORTANT]
> Verbatim form answer. The honest preference (where you'd actually
> live) lives in profile.md # Job Preferences > Relocation preference.
> Form-time answers are usually MORE permissive than the granular truth
> (say "Yes", negotiate later). E.g.:
>   "Yes" / "Yes, within reason" / "Open to discussing the right opportunity"

# Company / Product Opinions

The H2 questions below give your APPROACH (frameworks, not concrete answers).
The fill agent combines them with company / product info from the JD to
synthesize a per-company answer at apply time.

> [!TIP]
> User authoring guidance:
>   In mass-apply you can't pre-write per-company answers, so describe your
>   approach (what dimensions you evaluate on, what kinds of feedback you tend
>   to give, what tone you take). Don't name any specific company or product.

## How do you view our company? — your framework
> [!IMPORTANT]
> Describe how you typically form an opinion about a company:
>   what dimensions you weigh (mission, traction, team, culture, market,
>   technical depth, ...), what signals you look for, what tone you take
>   (genuine vs polite). Don't name any specific company here.

## How do you view our product? — your framework
> [!IMPORTANT]
> Describe how you evaluate a product as a candidate-user:
>   what you look at (UX, depth, defensibility, fit-to-market, technical
>   choices, ...), what level of detail you go to, whether you bring
>   comparisons. Don't name any specific product here.

## What suggestions do you have for our company? — your framework
> [!IMPORTANT]
> How you frame suggestions about a company you're applying to:
>   what kinds of topics are fair game (hiring, GTM, positioning,
>   org design, ...), what tone (constructive vs critical), what to
>   avoid (anything that sounds like you've judged them before joining).

## What suggestions do you have for our product? — your framework
> [!IMPORTANT]
> How you frame product suggestions:
>   depth (high-level vs concrete features), how to handle areas you
>   don't know well, whether to anchor in user pain or technical debt.

# Documents

H3 = label the fill agent matches against ATS form upload-field labels.
Body under H3 = bare file name inside `attachments/`. Files outside
`attachments/` are not allowed.

> [!TIP]
> Files referenced here must exist in `attachments/`. If one is missing at
> fill time, `wolf fill` pauses and asks you to drop it in.
>
> Immigration / work-authorization documents are NOT listed here —
> ATS forms don't consume them at the application stage. They show up
> post-offer for I-9 verification, which is out of wolf's scope.

## What academic documents do you have?

### Transcript
> [!TIP]
> Optional. Fill in the filename, e.g. transcript.pdf, after dropping the file in attachments/.

### Unofficial transcript
> [!TIP]
> Optional. E.g. unofficial-transcript.pdf.

### Reference letter
> [!TIP]
> Optional. E.g. reference-prof-smith.pdf.

### Portfolio sample
> [!TIP]
> Optional. Only for design / DS / writing roles.

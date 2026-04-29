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
>   H1 = category (Short Answers / Company-Product Opinions / Documents)
>   H2 = the question itself
>   H3 (Documents only) = a label / alias for an attachment
>   Body under H2 (or H3) = your answer / file name
>
> Markers (each is stripped before AI sees the file; renders as a styled
> callout in any GitHub-Alert-aware viewer):
>   `> [!IMPORTANT]` body starts with "REQUIRED —" → wolf fill needs this.
>   `> [!NOTE]`       body starts with "OPTIONAL —" → safe to leave empty.
>
> Three answering modes:
>   - Have an answer → write it on a plain (non-`>`) line below the callout.
>   - Skip / don't care → leave body empty. Do NOT write "N/A" or "—".
>     Empty sections are hidden from the AI; wolf fill will pause and ask
>     when an ATS form actually requires the field.
>   - Explicit refusal → write the literal phrase ("Decline to answer").
>     wolf fill writes that exact text into the form.

# Short Answers

## What's your salary expectation?

Open to discuss based on the full compensation package and role scope.

> [!NOTE]
> OPTIONAL — default shown above. Edit if you want a different stance.

## How did you hear about us?

LinkedIn

> [!NOTE]
> OPTIONAL — default shown above. Edit per your usual answer.

## Why this company?

> [!IMPORTANT]
> REQUIRED — write a flexible template; the agent adapts it per company.

## Why this role?

> [!IMPORTANT]
> REQUIRED — write a flexible template; the agent adapts it per role.

## Tell me about a time you failed

> [!IMPORTANT]
> REQUIRED — one full STAR+R story. Reused across applications.

## Tell me about yourself

> [!IMPORTANT]
> REQUIRED — 1-paragraph self-introduction; AI adapts per role.

## Biggest strength

> [!IMPORTANT]
> REQUIRED — name 1-2 strengths and the angle (technical depth /
> leadership / speed / cross-functional). AI pulls supporting examples
> from resume_pool and phrases it for the role.

## Biggest weakness (with what you're doing about it)

> [!IMPORTANT]
> REQUIRED — name a real weakness + what you're actively doing about it.
> Skip the "I work too hard" trope — interviewers see through it. AI
> phrases it diplomatically and matches the role's tone.

## Where do you see yourself in 5 years?

> [!IMPORTANT]
> REQUIRED — sketch direction only (IC depth / management track /
> domain mastery / founder path / learning trajectory). AI tailors
> specifics per role so it lands as ambitious-but-aligned, not generic.

## Tell me about a time you faced conflict

> [!IMPORTANT]
> REQUIRED — STAR+R story.

## Why are you leaving your current role?

> [!NOTE]
> OPTIONAL — leave empty if NG/intern with no current role.

## How do you handle stress / failure?

> [!IMPORTANT]
> REQUIRED — write one full STAR+R story, OR sketch your default coping
> pattern (break-it-down / data-driven / talk-to-teammate / step-back-
> then-retry) and AI pulls a matching example from resume_pool. Common
> in NG / intern interviews.

## What motivates you?

> [!IMPORTANT]
> REQUIRED — list 2-3 motivators in your own words (problem complexity /
> user impact / learning curve / autonomy / craft). AI picks whichever
> fits each role's pitch and weaves it into "why this role" / "why this
> company" answers too.

## Describe a time you led a team or project

> [!IMPORTANT]
> REQUIRED — STAR+R story. Even an intern-scale lead (study group,
> hackathon team, open-source maintainer) works. Pick the one with the
> most concrete result.

## Describe a time you handled feedback you disagreed with

> [!IMPORTANT]
> REQUIRED — STAR+R story. Interviewer is checking maturity, not your
> ability to win arguments. Lean toward "I tried it, learned X, here's
> what I'd do now."

## What is your management style?

> [!NOTE]
> OPTIONAL — fill if you've led people (TA, intern lead, club president)
> or if the role is manager-track. You can also just give the principles
> you lead by (high-trust / low-meeting / 1:1-heavy / ownership-first)
> and AI writes the story per role.

## Tell me about a project you're proud of

> [!IMPORTANT]
> REQUIRED — pick ONE project, real depth: what you built, why it was
> hard, what you learned. AI adapts this for "biggest accomplishment"
> form questions too.

## When can you start?

Available immediately

> [!NOTE]
> OPTIONAL — default shown above. Edit if you have a fixed start date.

## Form answer — Are you authorized to work?

> [!IMPORTANT]
> REQUIRED — verbatim form answer. Form usually wants a clean "Yes"/"No";
> the typical strategic answer is "Yes" if you have ANY current
> authorization, even time-limited (OPT / CPT). E.g.:
>   "Yes, I am authorized to work in the United States."

## Form answer — Do you require sponsorship?

> [!IMPORTANT]
> REQUIRED — verbatim form answer. The strategic preference (which jobs
> to apply to) lives in profile.md # Job Preferences > Sponsorship
> preference. Form-time answers often understate future sponsorship
> need to maximize interview odds; this is YOUR negotiation choice. E.g.:
>   "No" / "Yes, in the future after my OPT expires" /
>   "Currently no, may need H-1B sponsorship for permanent role"

## Form answer — Are you willing to relocate?

> [!IMPORTANT]
> REQUIRED — verbatim form answer. Honest preference (where you'd
> actually live) lives in profile.md # Job Preferences > Relocation
> preference. Form-time answers are usually MORE permissive than the
> granular truth (say "Yes", negotiate later). E.g.:
>   "Yes" / "Yes, within reason" / "Open to discussing the right opportunity"

# Company / Product Opinions

> [!TIP]
> The H2 questions below give your APPROACH (frameworks, not concrete
> answers). The fill agent combines them with company / product info
> from the JD to synthesize a per-company answer at apply time.
>
> Authoring guidance: in mass-apply you can't pre-write per-company
> answers, so describe your approach (what dimensions you evaluate on,
> what kinds of feedback you tend to give, what tone you take). Don't
> name any specific company or product.

## How do you view our company? — your framework

> [!IMPORTANT]
> REQUIRED — describe how you typically form an opinion about a company:
> what dimensions you weigh (mission, traction, team, culture, market,
> technical depth), what signals you look for, what tone you take
> (genuine vs polite). Don't name any specific company here.

## How do you view our product? — your framework

> [!IMPORTANT]
> REQUIRED — describe how you evaluate a product as a candidate-user:
> what you look at (UX, depth, defensibility, fit-to-market, technical
> choices), what level of detail you go to, whether you bring
> comparisons. Don't name any specific product here.

## What suggestions do you have for our company? — your framework

> [!IMPORTANT]
> REQUIRED — how you frame suggestions about a company you're applying
> to: what kinds of topics are fair game (hiring, GTM, positioning,
> org design), what tone (constructive vs critical), what to avoid
> (anything that sounds like you've judged them before joining).

## What suggestions do you have for our product? — your framework

> [!IMPORTANT]
> REQUIRED — how you frame product suggestions: depth (high-level vs
> concrete features), how to handle areas you don't know well, whether
> to anchor in user pain or technical debt.

# Documents

> [!TIP]
> H3 = the label the fill agent matches against ATS form upload-field
> labels. Body under H3 = bare file name inside `attachments/`. Files
> outside `attachments/` are not allowed; if one is missing at fill
> time, `wolf fill` pauses and asks you to drop it in.
>
> Immigration / work-authorization documents are NOT listed here — ATS
> forms don't consume them at the application stage. They show up
> post-offer for I-9 verification, which is out of wolf's scope.

## What academic documents do you have?

> [!NOTE]
> OPTIONAL — fill any H3 below whose document you actually have, then
> drop the file into `attachments/`. Empty H3s are hidden from the AI.

### Transcript

### Unofficial transcript

### Reference letter

### Portfolio sample

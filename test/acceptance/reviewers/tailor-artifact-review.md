# Tailor Artifact AI Review Prompt

Use this prompt when an acceptance case asks for AI review of tailored resume or
cover-letter artifacts.

## Inputs To Inspect

- Source JD text and source row id when available.
- Source resume pool or resume fixture text.
- Generated `src/hint.md` when present.
- Generated `src/tailoring-brief.md` when present.
- Generated `src/resume.html`.
- Generated `resume.pdf` or screenshot/preview evidence when available.
- Generated `src/cover_letter.html`.
- Generated `cover_letter.pdf` or screenshot/preview evidence when available.

## Review Tasks

1. Check factual accuracy against the source resume facts. Flag invented
   companies, dates, degrees, certifications, metrics, projects, tools, or
   responsibilities.
2. Check JD relevance. The resume and cover letter should emphasize the JD's
   main role, seniority, technologies, responsibilities, and domain themes.
3. Check consistency. The resume, cover letter, hint, and brief should tell the
   same candidate story.
4. Check artifact quality. Note unreadable formatting, broken HTML, missing PDF,
   poor one-page behavior, or obvious layout defects.
5. Check unsupported claims. Quote or summarize the exact generated claim and
   explain why it is unsupported.

## Output Format

Write the review in the group report with these sections:

- `Review Result`: `PASS`, `PASS_WITH_MINOR_IMPROVEMENTS`, or `FAIL`.
- `Factual Accuracy`: concise evidence.
- `JD Relevance`: concise evidence.
- `Consistency`: concise evidence.
- `Artifact Quality`: concise evidence.
- `Unsupported Claims`: concrete list, or `None found`.
- `Bugs`: product defects with reproduction notes.
- `Improvements`: non-blocking quality improvements.

Use `FAIL` if there is any invented material fact, missing required artifact, or
unreadable primary artifact. Use `PASS_WITH_MINOR_IMPROVEMENTS` only for small
wording, emphasis, or formatting issues that do not undermine correctness.

# Standard Questions

<!--
TBD-1: minimal placeholder. Final content (full Short Answers + Documents
sub-tree) negotiated separately.

Convention:
  H1 = category (Short Answers / Documents / ...)
  H2 = the question itself
  H3 (Documents only) = a label / alias for an attachment
  Body under H2 (or H3) = your answer / file name

This file is consumed by `wolf fill` — when an ATS form asks a question,
the agent finds the most relevant H2 here and fills the answer (adapting
{{company}} / {{role}} placeholders if any).
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

# Documents

<!--
H3 = label the agent matches against ATS form labels (e.g. "EAD", "Transcript").
Body under H3 = file name inside `attachments/`. Path must be a bare filename;
the agent prepends `attachments/`. Files outside `attachments/` are not allowed.

Example:
  ## What proof of work authorization do you have?

  ### EAD
  ead.pdf

  ### I-20
  i20.pdf
-->

## What proof of work authorization do you have?

### EAD
TODO (e.g. ead.pdf)

### I-20
TODO

## What academic documents do you have?

### Transcript
TODO

### Reference letter
TODO

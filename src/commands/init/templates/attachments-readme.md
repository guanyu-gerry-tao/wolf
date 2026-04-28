# attachments/

Drop files you want to upload through ATS forms here:

- Transcript (`transcript.pdf`)
- Unofficial transcript (`unofficial-transcript.pdf`)
- Reference letter
- Portfolio sample (design / DS / writing roles)
- Anything else an ATS form actually asks for

Then reference each file by its **bare file name** under the `# Documents`
section of `../standard_questions.md`. Example:

```md
## What academic documents do you have?

### Transcript
transcript.pdf

### Unofficial transcript
unofficial-transcript.pdf
```

When `wolf fill` encounters an ATS form upload field, it matches the form's
label against the `### ...` headings in `standard_questions.md` and uploads
the file you named.

**What NOT to put here:**

- Immigration / work-authorization documents — ATS forms don't consume these
  at the application stage. They show up post-offer for I-9 verification,
  which is out of wolf's scope.
- A pre-written cover letter — wolf tailors one per job via `wolf tailor`.

**Constraints:**

- Files must live directly inside this `attachments/` folder. Subdirectories
  and absolute paths are not allowed.
- If a file you reference in `standard_questions.md` is missing here, `wolf
  fill` will pause and ask you to drop it in before continuing.

This `README.md` is ignored by the attachment matcher — feel free to edit
or delete it.

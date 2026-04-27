# attachments/

Drop files you want to upload through ATS forms here:

- Transcript (`transcript.pdf`)
- Unofficial transcript (`unofficial-transcript.pdf`)
- EAD card scan (`ead.pdf`)
- I-20 (`i20.pdf`)
- Passport scan (`passport.pdf`)
- Reference letters
- Anything else you might attach

Then reference each file by its **bare file name** under the `# Documents`
section of `../standard_questions.md`. Example:

```md
## What proof of work authorization do you have?

### EAD
ead.pdf

### I-20
i20.pdf
```

When `wolf fill` encounters an ATS form upload field, it matches the form's
label against the `### ...` headings in `standard_questions.md` and uploads
the file you named.

**Constraints:**

- Files must live directly inside this `attachments/` folder. Subdirectories
  and absolute paths are not allowed.
- If a file you reference in `standard_questions.md` is missing here, `wolf
  fill` will pause and ask you to drop it in before continuing.

This `README.md` is ignored by the attachment matcher — feel free to edit
or delete it.

# Data Layout

How wolf decides what goes into SQLite vs. on-disk files.

## Principle

> **schema = whatever a repository can directly CRUD as a value.
> disk   = original text, rendered artifacts, and human-authored notes.**

The decision is driven by the **write path**, not by content type. "Is this a fact or a judgment?", "Is it short or long?", "Is it structured or free-form?" — these are all the wrong questions. The right question is:

**"How does this datum get written, and by whom?"**

- If wolf code writes it through a repository → schema.
- If it arrives as an external blob, a rendered file, or a hand-authored note → disk.

## Three categories

### 1. Schema — keys, dimensions, and program-written values

Goes into a SQLite column when it satisfies *any* of:

- Primary key, foreign key, or pointer to another entity
- Filter / sort / group-by dimension used by repository queries
- Enum or numeric where the set of values is known and unambiguous
- A short value (text, JSON, tag) that wolf produces and updates programmatically

Examples in the current schema:

- `jobs.id`, `jobs.company_id`, `jobs.url` — keys / pointers
- `jobs.status`, `jobs.source` — enums, filtered by `wolf job list`
- `jobs.score`, `jobs.score_justification` — wolf-written values from the score pipeline
- `jobs.error` — short failure tag, written by repo on failure
- `batches.batch_id`, `batches.status` — provider IDs and execution state

### 2. Disk — original text, rendered artifacts, hand-authored notes

Goes into a file under the workspace when it is *any* of:

- External original text (job description, company description copied from a careers page)
- A rendered binary or large document that downstream tools consume directly (PDF resume for ATS, HTML/PDF cover letter for email attachment, screenshot)
- Human-authored content (the three profile MD files, freeform notes the user types)
- A program-generated file whose **location is fixed by convention**, so the database does not need to record where it lives

Examples:

- `data/jobs/<slug>/jd.md` — JD original
- `data/jobs/<slug>/tailored_resume.pdf` — rendered artifact, fixed name
- `data/jobs/<slug>/cover_letter.{html,pdf}` — same
- `<workspace>/profiles/<id>/profile.md`, `resume_pool.md`, `standard_questions.md` — user-authored

### 3. Convention paths — neither schema nor a separate index

When a file lives at a path that can be derived deterministically from a row plus a known slug rule, **the database does not store the path**. The slug function and the directory convention are the single source of truth.

```
slug(job)      = sanitize(company.name) + "_" + sanitize(job.title) + "_" + job.id.slice(0, 8)
artifactPath() = workspaceRoot + "/data/jobs/" + slug(job) + "/<fixed-filename>"
```

Existence is checked against the filesystem (`fs.existsSync`), not against a column. That avoids the classic drift bug where the DB says a file exists but it has been deleted (or vice versa).

## Anti-patterns

| Anti-pattern | Why it is wrong | Correct approach |
|---|---|---|
| `tailored_resume_pdf_path TEXT` and similar `*_path` columns | The path is derivable from the slug + a fixed filename. Storing it duplicates the convention and invites DB/disk drift. | Delete the column. Compute the path with `pathFor(job, artifact)`. |
| Append AI-generated `score_justification` into a markdown file | Which file? Which section? Append or replace? Write semantics are ambiguous and error-prone. | Store in a TEXT column. Repo writes are atomic and unambiguous. |
| Stuff JD original text into a `jobs.description TEXT` column | Long external blobs do not belong in a row. They are read by AI and humans, never SQL-filtered. | Save as `data/jobs/<slug>/jd.md`. |
| Use a free-text TEXT column for an enum that admits "negotiable / depends" answers | The "negotiation" happens at *read* time during scoring/tailoring, not at *write* time. The recorded value is a snapshot of what the JD said, including `NULL` when the JD was vague. | Keep the column structured (enum / JSON / `NULL`). Let the AI read `jd.md` for the nuance. |
| Mirror a derivable timestamp/path/flag into multiple columns | More state to keep in sync. | Pick one source of truth — usually the slug + convention or a single column — and derive the rest. |

## When to add a new schema column vs. a new file

Ask in order:

1. **Does any repository need to query, sort, filter, or count by this datum?** → schema column.
2. **Will wolf code update it programmatically (overwrite, append a tag, set a status)?** → schema column.
3. **Is it an external original, a rendered artifact, or a hand-authored note?** → disk file.
4. **Is it a program-generated file at a conventional location?** → disk file, no path column.

If the answer to (1) and (2) is "no" and the value is a long blob or a separate document, it almost certainly belongs on disk.

## Boundaries this document does not cover

- **Indexes, foreign keys, migrations** — see `ARCHITECTURE.md` and (future) migration docs.
- **Specific schemas** — see `src/repository/impl/schema.ts` (the single source of truth for table shape).
- **Profile internals** — see the profile section of `ARCHITECTURE.md`.

## Related

- `ARCHITECTURE.md` — five-layer architecture and where repositories sit
- `src/repository/impl/initializeSchema.ts` — DDL
- `src/repository/impl/schema.ts` — drizzle table definitions

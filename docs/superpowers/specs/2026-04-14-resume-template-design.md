# Resume Template System — Design Spec

**Date:** 2026-04-14
**Status:** Approved
**Scope:** Per-profile HTML resume templates generated from screenshots, with a built-in default

---

## Problem

The current `wolf tailor` pipeline asks Claude to handle both visual style and content in one call. Claude decides fonts, colors, CSS structure, and resume content simultaneously — leading to inconsistent output across jobs, and a bloated system prompt full of layout instructions.

---

## Goal

Separate visual style from content:

- **Style** is defined once per profile in a template file, extracted from a screenshot (or copied from a built-in default).
- **Content** is generated per job by Claude, using only the class names defined in the template.
- **Density** (font-size, line-height, margin) is adjusted by `fit()` via CSS variables declared in the template.

---

## Architecture

### Three layers, three responsibilities

| Layer | Owns | Does NOT own |
|---|---|---|
| **Template** | Visual style, CSS class vocabulary, fit variable declarations | Content, density values |
| **Claude (RewriteService)** | Content selection and rewriting | Fonts, colors, layout |
| **fit()** | Page density (font-size, line-height, margin) | Style, content |

### Template file structure

Each profile has one template file at `profiles/<id>/resume_template.html`.

The file contains **only a `<style>` block** — no `<html>`, `<head>`, or `<body>` tags. It is a CSS fragment that gets injected into shell.html's `<head>` at render time. The HTML structure of the resume is always provided by Claude's output.

```html
<style>
  /* ① fit() variables — declared here, overridden at render time */
  :root {
    --font-size: 11pt;
    --line-height: 1.3;
    --margin-in: 0.5in;
    --section-gap: 0.85em;
  }

  /* ② Visual style — fixed per profile, extracted from screenshot or copied from default */
  body { font-family: 'Latin Modern', serif; font-size: var(--font-size); line-height: var(--line-height); }

  /* ③ Class vocabulary — Claude must use exactly these class names */
  .resume-name    { ... }
  .resume-contact { ... }
  .section-title  { ... margin-top: var(--section-gap); }
  .job-item       { ... }
  .job-header     { ... }
  .job-bullets    { ... }
  .skills-list    { ... }
</style>
```

### Class vocabulary is fixed across all templates

The class names (`.section-title`, `.job-item`, etc.) never change between templates — only the CSS values (colors, fonts, spacing) change. This means:

- Claude's system prompt never needs to change — it always says "use these class names"
- `RewriteService` is template-agnostic; it only injects the `<style>` block into the prompt
- Replacing a template = only the visual output changes, never the content logic

---

## Default template

**Source:** A static file bundled in the codebase at `src/assets/default_resume_template.html`.

**Style:** Clean minimal style inspired by Overleaf's default CV template — Latin Modern (or similar serif), simple section dividers, no color except black/dark gray. Widely accepted by recruiters, ATS-safe.

**Generation:** `wolf init` copies this file into `profiles/<id>/resume_template.html` automatically. No AI call required, no API key needed.

**Replacement:** Running `wolf template generate --screenshot <path>` overwrites the same file. All subsequent `wolf tailor` calls use the new template automatically. No code changes needed.

---

## Data flow

### wolf init (profile creation)

```
wolf init
  → collect profile info (name, email, etc.)
  → copy src/assets/default_resume_template.html
      → profiles/<id>/resume_template.html
```

### wolf tailor <jobId> (per job)

```
TailorApplicationService.tailor(jobId)
  → jobRepository.get(jobId)               → Job
  → profileRepository.getDefault()         → UserProfile
  → profileRepository.getResumePool()      → resume_pool.md text
  → profileRepository.getTemplate()        → resume_template.html text

  → rewriteService.tailorResumeToHtml(pool, jd, profile, template)
      Claude receives:
        - The <style> block (class vocabulary)
        - resume_pool.md
        - JD text
        - Profile contact info
      Claude outputs:
        - HTML body using only the defined class names

  → renderService.renderResumePdf(htmlBody, templateStyle)
      Injects template <style> + Claude's HTML body into shell.html
      fit() overrides CSS variables to compress to one page

  → write PDF to data/<dir>/resume.pdf
  → jobRepository.update(jobId, { tailoredResumePdfPath })
```

### wolf template generate --screenshot <path> (optional, future)

```
wolf template generate --screenshot resume.png
  → read screenshot as base64
  → Claude Vision prompt:
      "Analyze this resume screenshot. Extract fonts, colors, spacing ratios.
       Output a <style> block using exactly these class names: [vocabulary list].
       Include the four --fit-* CSS variables."
  → validate: all required class names present in output
  → profileRepository.saveTemplate(output)
      → overwrites profiles/<id>/resume_template.html
```

---

## Code changes required

### New / modified files

| File | Change |
|---|---|
| `src/assets/default_resume_template.html` | New — the static default template |
| `src/repository/profile.ts` | Add `getTemplate(): Promise<string>` and `saveTemplate(html: string): Promise<void>` |
| `src/repository/impl/fileProfileRepository.ts` | Implement: read/write `profiles/<id>/resume_template.html` |
| `src/repository/impl/inMemoryProfileRepository.ts` | Implement: in-memory template store for tests |
| `src/service/rewrite.ts` | Update signature: add `templateStyle: string` param |
| `src/service/impl/rewriteServiceImpl.ts` | Inject template `<style>` block into system prompt |
| `src/service/render.ts` | Update signature: add `templateStyle: string` param |
| `src/service/impl/renderServiceImpl.ts` | Inject template `<style>` into shell alongside body |
| `src/application/impl/tailorApplicationService.ts` | Load template via `profileRepository.getTemplate()`, pass to services |
| `src/commands/init/index.ts` | Copy default template into profile dir on init |

### Future (wolf template generate — separate milestone)

| File | Change |
|---|---|
| `src/commands/template/index.ts` | New command — screenshot → Claude Vision → saveTemplate |
| `src/cli/index.ts` | Register `wolf template` command |
| `src/mcp/tools.ts` | Register `wolf_template_generate` MCP tool |

---

## Error handling

| Scenario | Behavior |
|---|---|
| `resume_template.html` missing | `TailorApplicationService` throws `TemplateNotFoundError` with message: "Run `wolf init` to generate a default template, or `wolf template generate` to create one from a screenshot." |
| `wolf template generate` Vision call fails | Throw `TemplateGenerationError`, keep existing template untouched |
| Generated template missing required class names | Validate after generation, throw with list of missing classes |

---

## Testing

- `profileRepository.getTemplate()` / `saveTemplate()` — unit tests with temp files
- `rewriteService` — existing mock tests updated: add `templateStyle` param, assert it appears in the prompt passed to `aiClient`
- `renderService` — existing mock tests updated: assert template style is injected into shell
- `tailorApplicationService` — existing mock tests updated: `makeProfileRepo()` mock returns a template string
- Default template file — snapshot test: assert all required class names are present

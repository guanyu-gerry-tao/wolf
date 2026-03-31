# Manual Testing Guide

Step-by-step instructions for testing wolf locally before merging to main.

---

## Prerequisites

> **Important:** `wolf init` creates `wolf.toml`, `data/`, and `resume/` in your **current directory**.
> Always `cd` to a dedicated test folder before running it — never run it inside the wolf project repo.

```bash
# 0. Create a dedicated test workspace (do this first!)
mkdir ~/test-wolf && cd ~/test-wolf

# 1. Build and install globally (run from the wolf repo)
cd ~/path/to/wolf
npm run build
npm link            # registers 'wolf' as a global CLI command
wolf --help         # verify it works

# 2. Confirm API key is set
wolf env show
# WOLF_ANTHROPIC_API_KEY should show as [set]

# 3. Switch to your test workspace
cd ~/test-wolf
```

---

## 1. CLI: `wolf init`

```bash
mkdir ~/test-wolf && cd ~/test-wolf
wolf init
```

**What to check:**
- [ ] Prompts for name, email, phone, work auth, target roles, target locations
- [ ] Creates `wolf.toml` in `~/test-wolf/`
- [ ] Creates `data/` directory
- [ ] Adds `data/` to `.gitignore`
- [ ] If `WOLF_ANTHROPIC_API_KEY` not set, prompts to run `wolf env set`
- [ ] If re-running with existing `wolf.toml`, warns and backs up to `wolf.toml.backup1`

**Sample inputs:**
```
Name:              Alex Chen
Email:             alex@example.com
Phone:             555-000-0001
Work auth:         F-1 OPT, need sponsorship
Target roles:      Software Engineer, Backend Engineer
Target locations:  NYC, Remote
```

---

## 2. CLI: `wolf add`

```bash
cd ~/test-wolf
wolf add \
  --title "Software Engineer, Backend Platform" \
  --company "Stripe" \
  --jd "$(cat ~/path/to/wolf/samples/jd/jd1_clean_bullets.txt)"
```

**What to check:**
- [ ] Returns a job object with a `jobId`
- [ ] No errors

Note the `jobId` — you'll need it for `wolf tailor`.

---

## 3. CLI: `wolf tailor`

Place a `.tex` resume in `~/test-wolf/resume/` and update `wolf.toml` with `resumePath`.

```bash
cp ~/path/to/wolf/samples/resume/Resume.tex ~/test-wolf/resume/

# Edit wolf.toml: set resumePath = "resume/Resume.tex"

wolf tailor --job <jobId>
```

**What to check:**
- [ ] Produces a tailored `.tex` and `.pdf` in `data/<profile>/<jobSlug>/`
- [ ] Resume fits within 1 page (or `maxResumePages` if set)
- [ ] No orphan words (single word on last line of a bullet point)
- [ ] Refinement loop logged (should see up to 5 iterations, exits early on LGTM)
- [ ] Screenshot `.png` is generated
- [ ] Returns `tailoredPdfPath`, `screenshotPath`, `coverLetterPdfPath` (if generated)

**Cover letter:**
```bash
wolf tailor --job <jobId> --cover-letter
```
- [ ] Cover letter PDF is ≤ 1 page

---

## 4. MCP: `wolf_setup`

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wolf": {
      "command": "wolf",
      "args": ["mcp", "serve"],
      "env": {
        "WOLF_ANTHROPIC_API_KEY": "sk-ant-..."
      }
    }
  }
}
```

Restart Claude Desktop. In a new conversation:

> "Help me set up wolf"

**What to check:**
- [ ] Claude warns about API keys before asking for profile info ("run `wolf env set` in your terminal")
- [ ] Claude collects name, email, phone, work auth, roles, locations through conversation
- [ ] Claude calls `wolf_setup` once at the end with all fields
- [ ] `wolf.toml` is created in the directory where `wolf mcp serve` was launched
- [ ] Response includes next steps: run `wolf env set`, then `wolf_templategen`

---

## 5. MCP: `wolf_tailor`

In Claude Desktop (after wolf_setup), with a job already added:

> "Tailor my resume for job ID \<jobId\>"

**What to check:**
- [ ] Claude calls `wolf_tailor` with the job ID
- [ ] Response includes an inline resume screenshot
- [ ] Response lists changes made and match score
- [ ] Response shows file paths in code blocks for copy-paste upload

---

## 6. Dev cleanup between test runs

```bash
cd ~/test-wolf

wolf dev clean --jobs         # remove job output dirs + clear DB (keep templates)
wolf dev clean --all          # above + remove generated templates
wolf dev clean --dangerousall # wipe all data/ contents (requires typing "yes")
```

---

## Sample JDs

Located in `samples/jd/`. Use these to test different parsing scenarios:

| File | Format | Good for testing |
|---|---|---|
| `jd1_clean_bullets.txt` | Clean bullets | Baseline / happy path |
| `jd2_paragraphs.txt` | Paragraphs only | JD parsing with no structure |
| `jd3_mixed.txt` | Mixed | Most common real-world case |
| `jd4_minimal.txt` | Minimal | Very short JD edge case |
| `jd5_wall_of_text.txt` | Wall of text | Parsing robustness |

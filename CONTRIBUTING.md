# Contributing to wolf

> [!IMPORTANT]
> Before you start: download this document and feed it to Claude, ChatGPT, or any AI tool. Let it walk you through each step. If you hit an error or get confused, just ask — it's much faster.

---

## What is open source, and what is contributing

An open source project is one where the code is publicly available for anyone to read and participate in. wolf is that kind of project.

"Contributing" means you implemented a feature or fixed a bug and submitted it for the project owner's review. Once approved, your code officially becomes part of the project and your name appears in the contributor list.

You don't need to be hired. This isn't a job. No visa, no permission required — anyone can contribute.

**Why contribute?**

- **Resume credibility** — open source contributions are public record on GitHub and your resume; interviewers can see exactly what you've built
- **Real engineering practice** — reading others' code, getting feedback in code review, fixing bugs in a real project teaches far more than practice problems
- **Build connections** — collaborate with the project owner and other contributors; meet people who are actually doing engineering work
- **Use what you build** — wolf is a job hunting tool; you build it, you use it

---

## What you can do

wolf is an AI-powered job hunting tool, currently in development. You can help implement its features.

No strong prior experience needed — as long as you're willing to use AI to help you write code.

If you know some TypeScript or JavaScript, even better. You're also welcome to become a Collaborator or Maintainer: help manage the project, review PRs, shape the roadmap.

---

## Step 0: Set up your development environment

> Before writing code, you need a few tools installed. This only needs to be done once. If you're not sure whether you already have them, run each command below and check for errors.

**1. Install Git**

Git manages code versions — you need it to download the project and submit changes.

- Mac: open Terminal and run `git --version`. If a version number appears, it's installed; otherwise macOS will prompt you to install it.
- Windows: download the installer from [git-scm.com](https://git-scm.com).

**2. Install Node.js (includes npm)**

wolf is written in TypeScript/JavaScript and needs Node.js to run. npm is bundled with Node.js.

Go to [nodejs.org](https://nodejs.org) and download the LTS version (18 or higher recommended).

Verify after installing:

```bash
node -v   # should show a version number like v22.0.0
npm -v    # should show a version number like 10.0.0
```

**3. Install a code editor**

[VS Code](https://code.visualstudio.com) is free and works great. Once installed, add the Claude Code extension so an AI can help you write code directly in the editor.

---

## Step 1: Fork the project to your GitHub account

> You don't have permission to push directly to the wolf repository — that's normal for external contributors. The solution is to "fork": copy wolf to your own GitHub account. You have full control over that copy. Once you're done, you open a pull request asking wolf to merge your changes in.

1. Go to [wolf's GitHub page](https://github.com/guanyu-gerry-tao/wolf)
2. Click the **Fork** button in the top-right corner
3. Select your own account and confirm

You'll now have `your-username/wolf` — your personal copy.

---

## Step 2: Clone the project to your computer

> Clone your fork, not the original wolf repository. That way you can push changes back up.

Create a folder for the project first:

```bash
# Mac/Linux:
mkdir -p ~/Documents/projects
cd ~/Documents/projects

# Windows:
mkdir C:\Users\your-username\Documents\projects
cd C:\Users\your-username\Documents\projects
```

Then clone your fork (replace `your-username` with your GitHub username):

```bash
git clone https://github.com/your-username/wolf.git
cd wolf
```

Finally, link the original repository so you can sync updates later:

```bash
git remote add upstream https://github.com/guanyu-gerry-tao/wolf.git
```

> [!NOTE]
> `origin` points to your fork, `upstream` points to the original wolf repo. When the original gets updates, run `git fetch upstream` to pull them in.

---

## Step 3: Install dependencies and build

> Make sure you're inside the `wolf` folder (you should see `wolf` in your terminal path). The project relies on many third-party packages. `npm install` downloads all of them automatically. This only needs to be done once.

```bash
npm install   # install all dependencies
npm run build # compile TypeScript to JavaScript
```

Verify it worked:

```bash
npm test  # run tests — all should pass
```

If you see `X passed`, everything is working.

If a test fails, paste the full error message into your AI and ask for help. Still stuck? Contact the project owner.

---

## Step 4: Find a task

> Tasks in open source projects are publicly posted — like a bounty board. Anyone can pick one up, do the work, and submit it. Once approved, your code is officially part of the project.

1. Open [GitHub Issues](https://github.com/guanyu-gerry-tao/wolf/issues)
2. Look for issues labeled `good first issue` — these are designed for new contributors
3. Read the issue carefully — it usually describes what to do, which branch to start from, and how to verify your work
4. Comment on the issue: "I'd like to work on this"
5. Wait for the project owner to assign the issue to you, then proceed

> [!NOTE]
> Why wait for assignment? Two people might want to work on the same task. Assignment prevents duplicated effort.

---

## Step 5: Create your branch

> A "branch" is your own working copy. Changes on your branch don't affect the main codebase until you submit a pull request.

> [!IMPORTANT]
> Issues usually specify which branch to start from (called the "base branch") — it's not always `main`. Create your branch from the base branch specified in the issue, and your PR should target that same base branch.

```bash
# Pull the latest branches from upstream (a fresh fork only has main)
git fetch upstream

# Switch to the base branch specified in the issue (replace <base-branch> with the actual name)
git checkout -b <base-branch> upstream/<base-branch>

# Create your own branch from here
git checkout -b feat/your-feature-name
# e.g.: git checkout -b feat/hunt-scoring
```

Branch naming format: `<type>/<short-name>`

| Prefix | When to use |
|---|---|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `test/` | Tests |
| `docs/` | Documentation |

---

## Step 6: Write code

**Read the issue before touching any code.** It usually describes what to implement, which files to change, and how to verify the result. Paste the issue into your AI, let it explain what needs to be done, then have it guide you step by step.

Recommended: open the project in VS Code, start Claude Code or GitHub Copilot, ask the AI to walk you through the `src/` directory structure, then give it your issue and let it lead.

> wolf uses a layered architecture: business logic belongs in `src/commands/`, not in `src/cli/` or `src/mcp/`. If you're unsure where code should go, ask your AI or read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

**Test skeletons are already written — your job is to make them pass.**

wolf uses Test-Driven Development (TDD). For every function you implement, a test skeleton already exists in the corresponding `__tests__/` file. The tests look like this:

```typescript
it.todo('returns a valid ScoringResponse and updates the job in DB');
```

`it.todo` means the test is pending — it doesn't run yet. Once you implement the function, convert each `it.todo` to a real test with assertions:

```typescript
it('returns a valid ScoringResponse and updates the job in DB', async () => {
  // set up test data
  // call the function
  // assert the result
});
```

Test files live next to the source they test:

```
src/utils/batch.ts  →  src/utils/__tests__/batch.test.ts
src/commands/score/index.ts  →  src/commands/score/__tests__/score.test.ts
```

Run tests:

```bash
npm test
```

All `it.todo` tests show up as "todo" (not failures) — CI stays green even if not everything is implemented yet. Once you convert a todo to a real test, it must pass before your PR is accepted.

---

## Step 7: Commit your changes

> Once your code is written, "commit" the changes to git and "push" them to your fork. Not sure how to write a commit message? Ask your AI or use VS Code's built-in GitHub Copilot to generate one automatically.

```bash
# Stage the files you changed (replace with your actual file path)
git add <your-changed-file>

# Commit with a short description
git commit -m "feat: add job deduplication logic"

# Push to your fork
git push -u origin feat/your-feature-name
```

> [!NOTE]
> Commit message format: `type: short description`, written in English. Common types: `feat` (new feature), `fix` (bug fix), `test` (tests), `docs` (documentation).

---

## Step 8: Test it yourself (Dog Fooding)

> [!IMPORTANT]
> Before opening a PR, run what you built for real. Tests passing does not mean the feature works — tests verify code logic, they don't replace actually using it.

**Dog fooding** means "eating your own dog food" — using the tool you built in a real scenario, not just checking that CI is green.

```bash
cd /path/to/wolf      # navigate to your wolf project root
npm run build         # recompile
npm install -g .      # install wolf locally so you can run it as a command
wolf <your-command>   # run it for real
```

Ask yourself:

- Does the feature work as expected in the normal case?
- If you pass bad input or skip a required argument, is the error message clear?
- Did anything happen that you didn't expect?

If you find a problem, go back to Step 6, fix it, and test again. Once you're satisfied, move on.

---

## Step 8.5: Run the test suites

Wolf has three test layers:

- Unit tests (`npm test`): verify function-level logic. CI already runs this on every PR (`npm ci + npm run build + npm test`); nothing to do locally.
- Smoke suite (`test/smoke/`): runs the core CLI commands to confirm the build, workspace isolation, and basic flows still work. Free, no API key, a few minutes.
- Acceptance suite (`test/acceptance/`): calls the real Anthropic API to drive the full tailor pipeline; an AI reviewer scores the resume / cover letter. Around \$0.20-0.50 per run. Compute time is under 10 minutes, but the orchestrator dispatches sub-agents during the run and Claude Code may prompt for permission — please stay nearby to approve in time.

Before opening a PR, please:

| Layer | Cost | Pre-PR | How |
|---|---|---|---|
| Unit tests | free | Nothing — CI runs it | CI |
| Smoke suite | free | Please run it if your change touches CLI / commands / build modes / workspace handling | Locally, see below |
| Acceptance suite | ~$0.20-0.50 | Case by case, see below | Locally, or ask the maintainer |

### Smoke suite

Fast gate. Uses `/tmp/wolf-test/` workspaces only — never touches your real `~/wolf` or shell RC files.

How to run: please copy the orchestrator prompt from [test/smoke/README.md](test/smoke/README.md) into Claude Code (or another agent runner) and let it dispatch the groups. Results land under `test/runs/smoke-<timestamp>/` and `test/runs/LATEST.md` is updated.

Once it's done, please paste the smoke `report.md` summary line (e.g. "9 / 9 PASS") into your PR description.

If smoke fails for a reason unrelated to your change (e.g. a pre-existing issue), please mention it in the PR description and link the failing report.

### Acceptance suite

Deeper than smoke: real AI calls produce a resume + cover letter, and a separate AI reviewer scores the output. About \$0.20-0.50 per full tailor-group run based on real usage data — small but not zero, which is why this is a judgment call rather than a blanket requirement.

Please run it when your change has any of these characteristics:

- Touches `src/service/` or `src/application/`
- Touches a `.md` prompt file under `src/service/impl/prompts/`
- Touches `src/service/impl/render/` or `tailorApplicationServiceImpl.ts`
- Adds or changes a use case or acceptance criterion in `docs/requirements/`
- Strengthens or relaxes any AC currently mapped to an implemented acceptance group (see [test/acceptance/COVERAGE.md](test/acceptance/COVERAGE.md))

You can skip it (please add "skipped acceptance because X" to the PR description) when your change is:

- Pure docs / README / comment edits
- A small refactor inside `src/utils/` already covered by unit tests
- A new acceptance case added to a planned (not yet implemented) group
- A typo or formatting fix

If you're not sure, please just ask in the PR description: "I didn't run acceptance because X — do you want me to?" The maintainer will reply.

How to run: please copy the orchestrator prompt from [test/acceptance/README.md](test/acceptance/README.md) "How To Run" section into Claude Code. You'll need `WOLF_ANTHROPIC_API_KEY` set. The full run report lands under `test/runs/acceptance-<timestamp>/`; please paste the suite-level summary line into your PR description.

If you don't have an API key but the change needs acceptance, please mention it in the PR and the maintainer can run it for you.

---

## Step 9: Open a Pull Request

> A Pull Request (PR) is how you tell the project owner "I'm done — please review and merge this." Make sure the PR targets the original wolf repository's base branch, not your own fork.

1. Go to [wolf's GitHub page](https://github.com/guanyu-gerry-tao/wolf)
2. GitHub will usually show a prompt — click **"Compare & pull request"**
3. Confirm the base branch matches what the issue specified (not necessarily `main`)
4. Describe what you did and link the issue (write `Closes #issue-number`)
5. Submit and wait for review

---

## Getting help

1. **Ask your AI first** — paste the full error message into Claude Code, ChatGPT, or whatever AI tool you use. 90% of problems can be solved this way.
2. **CI failing?** — click through to the GitHub Actions error output, copy it, and ask your AI to explain it.
3. **Still stuck?** — contact the project owner.

---

## Key documents

| Document | What it covers |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Code structure and layer responsibilities |
| [docs/MILESTONES.md](docs/MILESTONES.md) | Roadmap and task checklist |
| [docs/TYPES.md](docs/TYPES.md) | All shared TypeScript types |
| [CLAUDE.md](CLAUDE.md) | Project overview (for AI tools) |

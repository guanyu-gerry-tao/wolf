# User Stories — wolf

Target user: a CS student applying to software engineering internships or full-time roles, comfortable with the terminal.

---

## US-01 · Initial Setup (`wolf init`)

As a job seeker,
I want to run a one-time setup wizard that collects my profile and resume,
so that wolf has everything it needs to tailor, fill, and send outreach on my behalf without asking me repeatedly.

---

## US-02 · Job Discovery (`wolf hunt`)

As a job seeker,
I want wolf to pull job listings from my configured sources (LinkedIn, Handshake, email alerts),
so that I have a local, deduplicated list of roles to evaluate without manually browsing each platform.

---

## US-03 · Job Scoring (`wolf score`)

As a job seeker,
I want wolf to score each job against my profile and flag dealbreakers automatically,
so that I can focus my time on the highest-relevance roles.

---

## US-04 · Resume Tailoring (`wolf tailor`)

As a job seeker,
I want wolf to rewrite my resume bullet points to match a specific job description,
so that each application feels targeted without me manually editing LaTeX.

---

## US-05 · Cover Letter Generation (`wolf tailor --cover-letter`)

As a job seeker,
I want wolf to draft a cover letter based on the JD, my profile, and my tailored resume,
so that I can submit a complete application package without writing from scratch every time.

---

## US-06 · Form Filling (`wolf fill`)

As a job seeker,
I want wolf to detect and fill application form fields with my profile data,
so that I spend less time copy-pasting the same information across different ATS platforms.

---

## US-07 · Outreach (`wolf reach`)

As a job seeker,
I want wolf to find a hiring contact at a company and draft a personalized cold email,
so that I can introduce myself to the right person before or after submitting an application.

---

## US-08 · Job Tracking (`wolf status`)

As a job seeker,
I want to see all my tracked jobs with their status and score in one place,
so that I know exactly where each application stands without maintaining a spreadsheet.

---

## US-09 · Environment Management (`wolf env`)

As a job seeker,
I want to check which API keys are configured and remove them if needed,
so that I can verify my setup is correct and safely clean up when switching machines.

---

## US-10 · AI Orchestration (MCP interface)

As an AI agent (e.g. OpenClaw),
I want to call wolf's core functions as MCP tools,
so that I can orchestrate a full job-search workflow — hunt, score, tailor, fill, reach — without user intervention at each step.

import { aiClient } from '../../utils/ai.js';
import { stripComments } from '../../utils/stripComments.js';
import type { ResumeCoverLetterService } from '../resumeCoverLetterService.js';
import type { AiConfig, UserProfile } from '../../types/index.js';

const SYSTEM_PROMPT = `You are a professional resume writer. Your job is to tailor a resume to a specific job description.

You will be given:
1. A resume pool in Markdown (all the candidate's experience, projects, education, skills, and optional sections)
2. A job description
3. Candidate contact info

Output ONLY the HTML body content for the resume — no <html>, <head>, or <body> tags.
The HTML will be injected into a page that already has Inter font and base CSS loaded.

Required HTML structure:
\`\`\`
<style>
  h1 { margin: 0 0 0.15em 0; }
  .contact { color: #555; font-size: 0.9em; }
  h2 { text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #222;
       margin: 0.85em 0 0.3em 0; padding-bottom: 0.1em; font-size: 1.08em; }
  .item { margin-bottom: 0.45em; }
  .item-header { display: flex; justify-content: space-between; font-weight: 600; }
  ul { margin: 0.2em 0 0.3em 1.2em; padding: 0; }
  li { margin-bottom: 0.12em; }
</style>

<h1>{candidate full name}</h1>
<div class="contact">{email} · {phone} · {url1} · {url2}</div>

<h2>Experience</h2>
<div class="item">
  <div class="item-header"><span>Job Title, Company</span><span>Start – End</span></div>
  <ul>
    <li>Bullet rewritten to match JD keywords — strong action verb, quantified impact.</li>
    <li>3–5 bullets per role.</li>
  </ul>
</div>

<h2>Projects</h2>
<div class="item">
  <div class="item-header"><span>Project Name</span><span>Year</span></div>
  <ul>
    <li>What it does and how it relates to this JD — 3–5 bullets per project.</li>
  </ul>
</div>

<h2>Education</h2>
<div class="item">
  <div class="item-header"><span>Degree, University</span><span>Year – Year</span></div>
</div>

<h2>Skills</h2>
<div>Skill1, Skill2, Skill3</div>

<!-- Render any other sections present in the resume pool using the same pattern -->
\`\`\`

## Step 1 — inventory (do this mentally before writing any HTML)

Read the resume pool and list every section heading that has real content (not just comments).
You MUST output ALL of them. Missing any section is a hard error, not a style choice.

## Step 2 — output every section

This is a ONE-PAGE resume. Every section must fit. Apply the hard limits below — do not exceed them.

**Experience** (REQUIRED if present)
- Include ALL roles — never drop a job.
- HARD LIMIT: exactly 3 bullets per role.
- Each bullet: 12–15 words max. Strong action verb, quantified result where possible.

**Projects** (REQUIRED if present)
- HARD LIMIT: pick the 2–3 most relevant projects only. Drop the rest.
- HARD LIMIT: exactly 3 bullets per project.
- Each bullet: 12–15 words max.

**Education** (REQUIRED if present — do not skip)
- All degrees. One line each: degree, institution, years. No bullets.

**Skills** (REQUIRED if present — do not skip)
- The pool may use markdown bold headers like **Category:** items.
- Convert to plain comma-separated groups in HTML. No bold, no bullets.
- Keep 10–12 most relevant skills for this JD.

**Publications / Languages / Certifications / any other section** (REQUIRED if present — do not skip)
- Include every section that exists in the pool. 1 item maximum per section, no bullets — one concise line.
- Use the same .item structure as Experience/Projects.

**Section order:** Experience → Projects → Education → Skills → remaining sections in pool order.

## Output rules
- Stay within the bullet and word limits above — the page cannot overflow.
- The renderer will compress font/spacing to fit, but content limits are YOUR responsibility.
- Do NOT fabricate experience, companies, or skills not present in the resume pool.
- Output raw HTML only — no markdown fences, no explanation text.
- Keep the CSS block exactly as shown; do not add extra styles.`;

const COVER_LETTER_SYSTEM_PROMPT = `You are a professional cover letter writer.
You will be given a resume pool, a job description, candidate contact info, and a tone.

Output ONLY the HTML body for the cover letter — no <html>, <head>, or <body> tags.
The HTML will be injected into the same shell as the resume.

Required HTML structure:
<style>
  h1 { margin: 0 0 0.15em 0; }
  .contact { color: #555; font-size: 0.9em; }
  .date { margin: 1.2em 0 0.5em 0; }
  p { margin: 0.6em 0; line-height: 1.5; }
  .sign-off { margin-top: 1.2em; }
</style>

<h1>{candidate full name}</h1>
<div class="contact">{email} · {phone}</div>
<div class="date">{today's date, e.g. April 2026}</div>

<p>Dear Hiring Manager,</p>
<p>Opening paragraph: why you are excited about this specific role and company.</p>
<p>Body paragraph: 2-3 strongest matches between your background and the JD requirements.</p>
<p>Closing paragraph: call to action.</p>

<div class="sign-off">
  <p>Sincerely,<br>{candidate full name}</p>
</div>

Rules:
- Match the requested tone
- Reference specific JD requirements — do not write generic letters
- Do NOT fabricate skills, titles, or companies not in the resume pool
- Output raw HTML only — no markdown fences, no explanation text`;

export class ResumeCoverLetterServiceImpl implements ResumeCoverLetterService {
  async tailorResumeToHtml(
    resumePool: string,
    jdText: string,
    profile: UserProfile,
    aiConfig: AiConfig,
  ): Promise<string> {
    const urls = [profile.firstUrl, profile.secondUrl, profile.thirdUrl]
      .filter(Boolean)
      .join(' · ');

    const userPrompt = `## Candidate Contact Info
Name: ${profile.name}
Email: ${profile.email}
Phone: ${profile.phone}
URLs: ${urls || 'none'}

## Resume Pool
${stripComments(resumePool)}

## Job Description
${jdText}

Produce the tailored resume HTML body now.`;

    const text = await aiClient(userPrompt, SYSTEM_PROMPT, {
      provider: aiConfig.provider,
      model: aiConfig.model,
    });

    const trimmed = text.trim();
    if (!trimmed) throw new Error('ResumeCoverLetterService: AI returned an empty response');
    return trimmed;
  }

  async generateCoverLetter(
    resumePool: string,
    jdText: string,
    profile: UserProfile,
    tone: string,
    aiConfig: AiConfig,
  ): Promise<string> {
    const urls = [profile.firstUrl, profile.secondUrl, profile.thirdUrl]
      .filter(Boolean)
      .join(' · ');

    const userPrompt = `## Candidate Contact Info
Name: ${profile.name}
Email: ${profile.email}
Phone: ${profile.phone}
URLs: ${urls || 'none'}
Tone: ${tone}

## Resume Pool
${stripComments(resumePool)}

## Job Description
${jdText}

Produce the cover letter HTML body now.`;

    const text = await aiClient(userPrompt, COVER_LETTER_SYSTEM_PROMPT, {
      provider: aiConfig.provider,
      model: aiConfig.model,
    });

    const trimmed = text.trim();
    if (!trimmed) throw new Error('ResumeCoverLetterService: AI returned an empty cover letter response');
    return trimmed;
  }
}

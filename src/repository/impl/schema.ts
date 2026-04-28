/**
 * schema.ts — Drizzle ORM table definitions.
 *
 * Single source of truth for the database schema.
 * TypeScript row types are inferred from here.
 *
 * All CREATE TABLE statements live in ./initializeSchema.ts.
 * Repositories import table references from here.
 */
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { CompanySize } from '../../utils/types/company.js';
import type { JobError, JobSource, JobStatus, Salary } from '../../utils/types/job.js';
import type { Sponsorship } from '../../utils/types/sponsorship.js';

type BatchType = 'score' | 'tailor';
type BatchAiProvider = 'anthropic' | 'openai';
type BatchStatus = 'pending' | 'completed' | 'failed';

// ---------------------------------------------------------------------------
// companies
// ---------------------------------------------------------------------------

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  domain: text('domain'),
  linkedinUrl: text('linkedin_url'),
  size: text('size').$type<CompanySize>(),
  industry: text('industry'),
  headquartersLocation: text('headquarters_location'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ---------------------------------------------------------------------------
// jobs
// ---------------------------------------------------------------------------

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  companyId: text('company_id').notNull(),
  url: text('url').notNull(),
  source: text('source').$type<JobSource>().notNull(),
  location: text('location').notNull(),
  remote: integer('remote', { mode: 'boolean' }).notNull(),
  salary: text('salary', { mode: 'json' }).$type<Salary>(),
  workAuthorizationRequired: text('work_authorization_required').$type<Sponsorship>().notNull(),
  clearanceRequired: integer('clearance_required', { mode: 'boolean' }).notNull(),
  score: real('score'),
  scoreJustification: text('score_justification'),
  status: text('status').$type<JobStatus>().notNull(),
  error: text('error').$type<JobError>(),
  appliedProfileId: text('applied_profile_id'),
  tailoredResumePdfPath: text('tailored_resume_pdf_path'),
  coverLetterHtmlPath: text('cover_letter_html_path'),
  coverLetterPdfPath: text('cover_letter_pdf_path'),
  screenshotPath: text('screenshot_path'),
  outreachDraftPath: text('outreach_draft_path'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// ---------------------------------------------------------------------------
// batches
// ---------------------------------------------------------------------------

export const batches = sqliteTable('batches', {
  id: text('id').primaryKey(),                // wolf internal UUID
  batchId: text('batch_id').notNull(),        // external ID returned by the AI provider (Anthropic / OpenAI)
  type: text('type').$type<BatchType>().notNull(),
  aiProvider: text('ai_provider').$type<BatchAiProvider>().notNull(),
  profileId: text('profile_id').notNull(),
  status: text('status').$type<BatchStatus>().notNull(),
  submittedAt: text('submitted_at').notNull(),
  completedAt: text('completed_at'),
});
